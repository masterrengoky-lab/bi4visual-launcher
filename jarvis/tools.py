"""Действия, которые помощник умеет выполнять на компьютере.

Каждый инструмент регистрируется декоратором @tool. Описание и параметры
уходят в «мозг» (Claude или Ollama), а он решает, что вызвать.
"""
import base64
import ctypes
import datetime
import difflib
import io
import json
import os
import re
import shutil
import subprocess
import threading
import time
import urllib.parse
import webbrowser
from pathlib import Path

IS_WIN = os.name == "nt"
HOME = Path.home()
import sys

# В собранном Jarvis.exe настройки и заметки лежат рядом с exe, а не во временной папке.
APP_DIR = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent.parent
NOTES_FILE = APP_DIR / "notes.json"


class Context:
    """То, что инструментам нужно от основной программы."""

    def __init__(self):
        self.speak = print
        self.confirm = lambda question: input(question + " (да/нет) ").strip().lower().startswith("д")
        self.confirm_dangerous = True
        self.screen_scale = 1.0


CTX = Context()
REGISTRY = {}


def tool(name, description, params=None, required=None, confirm=None):
    """confirm: функция(args) -> вопрос для подтверждения или None."""
    params = params or {}

    def deco(fn):
        REGISTRY[name] = {
            "name": name,
            "description": description,
            "params": params,
            "required": list(params.keys()) if required is None else required,
            "fn": fn,
            "confirm": confirm,
        }
        return fn

    return deco


def S(desc, **extra):
    return {"type": "string", "description": desc, **extra}


def N(desc, **extra):
    return {"type": "number", "description": desc, **extra}


def B(desc):
    return {"type": "boolean", "description": desc}


# ---------------------------------------------------------------- выполнение

def execute(name, args):
    """Выполняет инструмент. Возвращает строку или dict с картинкой."""
    t = REGISTRY.get(name)
    if not t:
        return f"Ошибка: инструмента {name} нет."
    args = args or {}
    if isinstance(args, str):
        try:
            args = json.loads(args) if args.strip() else {}
        except json.JSONDecodeError:
            return "Ошибка: аргументы не в формате JSON."
    if t["confirm"] and CTX.confirm_dangerous:
        question = t["confirm"](args)
        if question:
            print(f"   ⚠ {name} {json.dumps(args, ensure_ascii=False)}")
            if not CTX.confirm(question):
                return "Пользователь отменил это действие. Не повторяй его без новой просьбы."
    try:
        result = t["fn"](**args)
    except TypeError as e:
        return f"Ошибка в аргументах: {e}"
    except Exception as e:  # инструмент не должен ронять помощника
        return f"Ошибка: {type(e).__name__}: {e}"
    if result is None:
        return "Готово."
    return result


def cut(text, limit=4000):
    text = str(text)
    return text if len(text) <= limit else text[:limit] + f"\n…(обрезано, всего {len(text)} символов)"


def resolve(path):
    p = os.path.expandvars(os.path.expanduser(str(path).strip().strip('"')))
    p = Path(p)
    if not p.is_absolute():
        p = HOME / p
    return p


# ---------------------------------------------------------------- папки

def known_folders():
    folders = {"home": HOME}
    if IS_WIN:
        csidl = {"desktop": 0x10, "documents": 0x05, "pictures": 0x27, "music": 0x0D, "videos": 0x0E}
        for key, cid in csidl.items():
            buf = ctypes.create_unicode_buffer(260)
            if ctypes.windll.shell32.SHGetFolderPathW(None, cid, None, 0, buf) == 0:
                folders[key] = Path(buf.value)
    for key, sub in [("desktop", "Desktop"), ("documents", "Documents"), ("pictures", "Pictures"),
                     ("music", "Music"), ("videos", "Videos")]:
        folders.setdefault(key, HOME / sub)
    folders["downloads"] = HOME / "Downloads"
    return folders


# ---------------------------------------------------------------- команды

DANGER = re.compile(
    r"remove-item|\brm\b|\bdel\b|\berase\b|\brmdir\b|\brd\b|\bformat\s+[a-z]:|format-volume|clear-disk|diskpart|"
    r"stop-computer|restart-computer|shutdown|reg\s+delete|remove-itemproperty|set-itemproperty|"
    r"bcdedit|cipher\s+/w|set-executionpolicy|stop-process|taskkill|clear-recyclebin|uninstall|"
    r"remove-appxpackage|disable-|netsh|new-itemproperty|\bmove-item\b|\bmv\b|\bmove\b|rename-item|"
    r"invoke-expression|\biex\b|downloadstring|start-process.+-verb\s+runas|>\s*[a-z]:\\|out-file|set-content",
    re.I,
)


def _ps_confirm(a):
    cmd = a.get("command", "")
    if DANGER.search(cmd):
        return "Эта команда может удалить или изменить что-то в системе. Выполнить?"
    return None


@tool("run_powershell",
      "Выполнить команду PowerShell на компьютере и получить её вывод. Универсальный инструмент: "
      "используй его для всего, на что нет отдельного инструмента (настройки Windows, сеть, "
      "установка программ через winget, работа с файлами, информация о системе и т.д.).",
      {"command": S("Команда PowerShell"),
       "timeout_sec": N("Сколько секунд ждать завершения, по умолчанию 60")},
      required=["command"], confirm=_ps_confirm)
def run_powershell(command, timeout_sec=60):
    prefix = "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $ProgressPreference='SilentlyContinue'; "
    shell = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", prefix + command] if IS_WIN \
        else ["bash", "-lc", command]
    try:
        r = subprocess.run(shell, capture_output=True, timeout=float(timeout_sec),
                           creationflags=0x08000000 if IS_WIN else 0)
    except subprocess.TimeoutExpired:
        return f"Команда не завершилась за {timeout_sec} секунд."
    out = r.stdout.decode("utf-8", "replace").strip()
    err = r.stderr.decode("utf-8", "replace").strip()
    text = f"Код выхода: {r.returncode}\n"
    if out:
        text += f"Вывод:\n{out}\n"
    if err:
        text += f"Ошибки:\n{err}\n"
    return cut(text)


# ---------------------------------------------------------------- программы

ALIASES = {
    "блокнот": "notepad", "notepad": "notepad",
    "калькулятор": "calc", "calculator": "calc",
    "проводник": "explorer", "explorer": "explorer",
    "диспетчер задач": "taskmgr", "task manager": "taskmgr",
    "панель управления": "control",
    "параметры": "ms-settings:", "настройки": "ms-settings:", "settings": "ms-settings:",
    "командная строка": "cmd", "cmd": "cmd", "терминал": "wt", "powershell": "powershell",
    "paint": "mspaint", "пэйнт": "mspaint",
    "ножницы": "snippingtool",
    "редактор реестра": "regedit",
}

_apps_cache = None


def _start_apps():
    """Все приложения из меню «Пуск»: имя -> способ запуска."""
    global _apps_cache
    if _apps_cache is not None:
        return _apps_cache
    apps = {}
    dirs = [Path(os.environ.get("ProgramData", "C:/ProgramData")) / "Microsoft/Windows/Start Menu/Programs",
            Path(os.environ.get("APPDATA", HOME)) / "Microsoft/Windows/Start Menu/Programs",
            known_folders()["desktop"], Path(os.environ.get("PUBLIC", "C:/Users/Public")) / "Desktop"]
    for d in dirs:
        if d.exists():
            for f in d.rglob("*"):
                if f.suffix.lower() in (".lnk", ".url", ".appref-ms"):
                    apps.setdefault(f.stem, str(f))
    if IS_WIN:
        try:
            r = subprocess.run(["powershell", "-NoProfile", "-Command",
                                "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-StartApps | ConvertTo-Json -Compress"],
                               capture_output=True, timeout=20, creationflags=0x08000000)
            data = json.loads(r.stdout.decode("utf-8", "replace") or "[]")
            if isinstance(data, dict):
                data = [data]
            for item in data:
                apps.setdefault(item["Name"], "shell:AppsFolder\\" + item["AppID"])
        except Exception:
            pass
    _apps_cache = apps
    return apps


def _find_app(name):
    apps = _start_apps()
    low = {k.lower(): k for k in apps}
    q = name.lower().strip()
    if q in low:
        return low[q]
    contains = [k for lk, k in low.items() if q in lk]
    if contains:
        return min(contains, key=len)
    close = difflib.get_close_matches(q, list(low), n=1, cutoff=0.6)
    return low[close[0]] if close else None


def _launch(target):
    if target.startswith("shell:AppsFolder"):
        subprocess.Popen(["explorer.exe", target])
    else:
        os.startfile(target)


@tool("open_app",
      "Запустить программу или игру по названию (как оно написано в меню «Пуск», например "
      "Telegram, Discord, Steam, Google Chrome, Minecraft, Word, блокнот, калькулятор).",
      {"name": S("Название программы")})
def open_app(name):
    q = name.lower().strip()
    if q in ("браузер", "browser"):
        webbrowser.open("https://www.google.com")
        return "Открыл браузер."
    if q in ALIASES:
        _launch(ALIASES[q])
        return f"Запустил {name}."
    found = _find_app(name)
    if found:
        _launch(_start_apps()[found])
        return f"Запустил {found}."
    exe = shutil.which(name)
    if exe:
        subprocess.Popen([exe])
        return f"Запустил {exe}."
    return f"Программа «{name}» не найдена в меню Пуск. Можно поискать через list_apps или find_files."


@tool("list_apps", "Список установленных программ из меню «Пуск», можно с фильтром.",
      {"filter": S("Часть названия, необязательно")}, required=[])
def list_apps(filter=""):
    names = sorted(_start_apps())
    if filter:
        names = [n for n in names if filter.lower() in n.lower()]
    return cut(", ".join(names) or "Ничего не найдено.", 3000)


@tool("open_url", "Открыть сайт или ссылку в браузере.", {"url": S("Адрес сайта")})
def open_url(url):
    if not re.match(r"^[a-z]+:", url):
        url = "https://" + url
    webbrowser.open(url)
    return f"Открыл {url}."


@tool("open_search_in_browser",
      "Открыть в браузере поиск: в Google, Яндексе или на YouTube.",
      {"query": S("Что искать"), "site": S("google, yandex или youtube", enum=["google", "yandex", "youtube"])},
      required=["query"])
def open_search_in_browser(query, site="google"):
    q = urllib.parse.quote(query)
    url = {"yandex": f"https://yandex.ru/search/?text={q}",
           "youtube": f"https://www.youtube.com/results?search_query={q}"}.get(site, f"https://www.google.com/search?q={q}")
    webbrowser.open(url)
    return f"Открыл поиск «{query}»."


# ---------------------------------------------------------------- окна

def _windows():
    import pygetwindow as gw
    return [w for w in gw.getAllWindows() if w.title.strip() and w.width > 0]


def _find_window(title):
    wins = _windows()
    q = title.lower()
    match = [w for w in wins if q in w.title.lower()]
    if not match:
        titles = {w.title.lower(): w for w in wins}
        close = difflib.get_close_matches(q, list(titles), n=1, cutoff=0.4)
        match = [titles[close[0]]] if close else []
    if not match:
        raise ValueError(f"окно «{title}» не найдено")
    return match[0]


@tool("list_windows", "Список открытых окон.")
def list_windows():
    return cut("\n".join(sorted({w.title for w in _windows()})) or "Открытых окон нет.")


@tool("window_action",
      "Сделать что-то с окном: activate (переключиться), minimize, maximize, restore, close (закрыть окно "
      "как крестиком, программа сама спросит про сохранение). Также minimize_all — свернуть все окна.",
      {"title": S("Часть заголовка окна"),
       "action": S("Действие", enum=["activate", "minimize", "maximize", "restore", "close", "minimize_all"])},
      required=["action"])
def window_action(action, title=""):
    if action == "minimize_all":
        import pyautogui
        pyautogui.hotkey("win", "d")
        return "Свернул все окна."
    w = _find_window(title)
    if action == "activate":
        if w.isMinimized:
            w.restore()
        try:
            w.activate()
        except Exception:
            w.minimize()
            w.restore()
    else:
        getattr(w, action)()
    return f"{action}: {w.title}"


# ---------------------------------------------------------------- звук и медиа

def _volume_iface():
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
    speakers = AudioUtilities.GetSpeakers()
    if hasattr(speakers, "EndpointVolume"):
        return speakers.EndpointVolume
    from comtypes import CLSCTX_ALL
    from ctypes import POINTER, cast
    iface = speakers.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    return cast(iface, POINTER(IAudioEndpointVolume))


@tool("volume",
      "Громкость системы: узнать (get), установить уровень 0–100 (set), изменить на величину (change, "
      "например +10 или -20), выключить или включить звук (mute/unmute).",
      {"action": S("Что сделать", enum=["get", "set", "change", "mute", "unmute"]),
       "value": N("Уровень или изменение")}, required=["action"])
def volume(action, value=0):
    v = _volume_iface()
    cur = round(v.GetMasterVolumeLevelScalar() * 100)
    if action == "get":
        return f"Громкость {cur}%, звук {'выключен' if v.GetMute() else 'включён'}."
    if action == "mute":
        v.SetMute(1, None)
        return "Звук выключен."
    if action == "unmute":
        v.SetMute(0, None)
        return "Звук включён."
    new = float(value) if action == "set" else cur + float(value)
    new = max(0, min(100, new))
    v.SetMute(0, None)
    v.SetMasterVolumeLevelScalar(new / 100, None)
    return f"Громкость {round(new)}%."


MEDIA_KEYS = {"play_pause": 0xB3, "next": 0xB0, "previous": 0xB1, "stop": 0xB2}


@tool("media",
      "Управление музыкой и видео (работает с Яндекс Музыкой, Spotify, YouTube в браузере и т.п.): "
      "play_pause, next, previous, stop.",
      {"action": S("Действие", enum=list(MEDIA_KEYS))})
def media(action):
    vk = MEDIA_KEYS[action]
    ctypes.windll.user32.keybd_event(vk, 0, 0, 0)
    ctypes.windll.user32.keybd_event(vk, 0, 2, 0)
    return f"Нажал {action}."


# ---------------------------------------------------------------- клавиатура и мышь

@tool("press_keys",
      "Нажать сочетание клавиш, например ctrl+c, alt+tab, win+d, ctrl+shift+esc, enter, f5, space. "
      "Несколько нажатий подряд можно передать через пробел: 'ctrl+a ctrl+c'.",
      {"keys": S("Клавиши")})
def press_keys(keys):
    import pyautogui
    for combo in keys.split():
        parts = [k.strip().lower() for k in combo.split("+") if k.strip()]
        parts = [{"windows": "win", "control": "ctrl", "escape": "esc", "return": "enter"}.get(p, p) for p in parts]
        pyautogui.hotkey(*parts)
        time.sleep(0.15)
    return f"Нажал {keys}."


@tool("type_text", "Напечатать текст в активное окно (в то место, где сейчас курсор). Поддерживает русский.",
      {"text": S("Текст"), "press_enter": B("Нажать Enter после текста")}, required=["text"])
def type_text(text, press_enter=False):
    import pyautogui
    import pyperclip
    try:
        old = pyperclip.paste()
    except Exception:
        old = None
    pyperclip.copy(text)
    time.sleep(0.05)
    pyautogui.hotkey("ctrl", "v")
    time.sleep(0.2)
    if press_enter:
        pyautogui.press("enter")
    if old is not None:
        threading.Timer(1.0, lambda: pyperclip.copy(old)).start()
    return "Напечатал."


@tool("mouse",
      "Мышь: click (левый клик), double_click, right_click, move, scroll (value: положительное вверх, "
      "отрицательное вниз). Координаты x, y — в пикселях последнего снимка экрана из look_at_screen.",
      {"action": S("Действие", enum=["click", "double_click", "right_click", "move", "scroll"]),
       "x": N("X"), "y": N("Y"), "value": N("Сколько прокрутить")}, required=["action"])
def mouse(action, x=None, y=None, value=0):
    import pyautogui
    pos = None
    if x is not None and y is not None:
        pos = (int(float(x) * CTX.screen_scale), int(float(y) * CTX.screen_scale))
    if action == "scroll":
        pyautogui.scroll(int(value) * 100, *(pos or ()))
    elif action == "move":
        pyautogui.moveTo(*pos, duration=0.2)
    else:
        {"click": pyautogui.click, "double_click": pyautogui.doubleClick,
         "right_click": pyautogui.rightClick}[action](*(pos or ()))
    return f"{action} {pos or ''}".strip()


@tool("clipboard", "Буфер обмена: прочитать (get) или записать текст (set).",
      {"action": S("get или set", enum=["get", "set"]), "text": S("Текст для set")}, required=["action"])
def clipboard(action, text=""):
    import pyperclip
    if action == "set":
        pyperclip.copy(text)
        return "Скопировал в буфер."
    return cut("В буфере: " + (pyperclip.paste() or "(пусто)"))


# ---------------------------------------------------------------- экран

def _grab():
    from PIL import ImageGrab
    return ImageGrab.grab()


@tool("look_at_screen",
      "Посмотреть на экран пользователя (получить снимок). Используй, когда нужно понять, что открыто, "
      "прочитать текст с экрана или найти кнопку для клика мышью.")
def look_at_screen():
    img = _grab().convert("RGB")
    scale = max(img.width, img.height) / 1568
    if scale > 1:
        img = img.resize((round(img.width / scale), round(img.height / scale)))
    else:
        scale = 1.0
    CTX.screen_scale = scale
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=80)
    return {"text": f"Снимок экрана {img.width}x{img.height}.",
            "image_b64": base64.b64encode(buf.getvalue()).decode(), "media_type": "image/jpeg"}


@tool("save_screenshot", "Сохранить скриншот экрана в папку «Изображения/Screenshots».")
def save_screenshot():
    folder = known_folders()["pictures"] / "Screenshots"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"Скриншот {datetime.datetime.now():%Y-%m-%d %H-%M-%S}.png"
    _grab().save(path)
    return f"Скриншот сохранён: {path}"


# ---------------------------------------------------------------- файлы

@tool("list_folder", "Показать содержимое папки.", {"path": S("Путь к папке")})
def list_folder(path):
    p = resolve(path)
    items = sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
    lines = [("📁 " if i.is_dir() else "📄 ") + i.name for i in items[:200]]
    return cut(f"{p} ({len(items)} шт.):\n" + "\n".join(lines))


@tool("find_files",
      "Найти файлы или папки по имени (можно с * и ?) в папке и всех вложенных. По умолчанию ищет в домашней папке.",
      {"pattern": S("Имя или шаблон, например *.docx или *отчёт*"), "folder": S("Где искать")},
      required=["pattern"])
def find_files(pattern, folder=""):
    import fnmatch
    root = resolve(folder) if folder else HOME
    if not any(c in pattern for c in "*?"):
        pattern = f"*{pattern}*"
    skip = {"appdata", "node_modules", ".git", "$recycle.bin", "windows", "venv", ".venv", "__pycache__"}
    found, start = [], time.time()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d.lower() not in skip and not d.startswith(".")]
        for n in dirnames + filenames:
            if fnmatch.fnmatch(n.lower(), pattern.lower()):
                found.append(os.path.join(dirpath, n))
        if len(found) >= 40 or time.time() - start > 20:
            break
    return cut("\n".join(found) if found else "Ничего не найдено.")


@tool("open_path", "Открыть файл или папку программой по умолчанию.", {"path": S("Путь")})
def open_path(path):
    p = resolve(path)
    if not p.exists():
        return f"Не существует: {p}"
    os.startfile(str(p))
    return f"Открыл {p}."


@tool("read_text_file", "Прочитать текстовый файл.", {"path": S("Путь"), "max_chars": N("Максимум символов")},
      required=["path"])
def read_text_file(path, max_chars=6000):
    p = resolve(path)
    data = p.read_bytes()
    for enc in ("utf-8", "cp1251"):
        try:
            return cut(data.decode(enc), int(max_chars))
        except UnicodeDecodeError:
            continue
    return cut(data.decode("utf-8", "replace"), int(max_chars))


def _write_confirm(a):
    p = resolve(a.get("path", ""))
    if p.exists() and not a.get("append"):
        return f"Файл {p.name} уже есть. Перезаписать его?"
    return None


@tool("write_text_file", "Создать или перезаписать текстовый файл (или дописать в конец при append).",
      {"path": S("Путь"), "content": S("Текст"), "append": B("Дописать в конец")},
      required=["path", "content"], confirm=_write_confirm)
def write_text_file(path, content, append=False):
    p = resolve(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "a" if append else "w", encoding="utf-8") as f:
        f.write(content)
    return f"Записал {p}."


@tool("create_folder", "Создать папку.", {"path": S("Путь")})
def create_folder(path):
    p = resolve(path)
    p.mkdir(parents=True, exist_ok=True)
    return f"Создал папку {p}."


@tool("move_or_copy", "Переместить, переименовать или скопировать файл или папку.",
      {"source": S("Откуда"), "destination": S("Куда"), "copy": B("true — копировать, false — переместить")},
      required=["source", "destination"],
      confirm=lambda a: None if a.get("copy") else f"Переместить {resolve(a.get('source', '')).name}?")
def move_or_copy(source, destination, copy=False):
    src, dst = resolve(source), resolve(destination)
    if copy:
        if src.is_dir():
            shutil.copytree(src, dst / src.name if dst.is_dir() else dst)
        else:
            shutil.copy2(src, dst)
        return f"Скопировал в {dst}."
    shutil.move(str(src), str(dst))
    return f"Переместил в {dst}."


@tool("delete_to_recycle_bin", "Удалить файл или папку в корзину.", {"path": S("Путь")},
      confirm=lambda a: f"Удалить {resolve(a.get('path', '')).name} в корзину?")
def delete_to_recycle_bin(path):
    from send2trash import send2trash
    p = resolve(path)
    if not p.exists():
        return f"Не существует: {p}"
    send2trash(str(p))
    return f"Удалил в корзину: {p}."


# ---------------------------------------------------------------- система

@tool("system_info", "Загрузка процессора, память, диски, батарея, время работы.")
def system_info():
    import psutil
    mem = psutil.virtual_memory()
    lines = [f"Процессор: {psutil.cpu_percent(interval=0.5)}%",
             f"Память: занято {mem.used / 2**30:.1f} из {mem.total / 2**30:.1f} ГБ ({mem.percent}%)"]
    for part in psutil.disk_partitions():
        try:
            u = psutil.disk_usage(part.mountpoint)
            lines.append(f"Диск {part.mountpoint}: свободно {u.free / 2**30:.0f} из {u.total / 2**30:.0f} ГБ")
        except Exception:
            pass
    bat = psutil.sensors_battery() if hasattr(psutil, "sensors_battery") else None
    if bat:
        lines.append(f"Батарея: {bat.percent:.0f}%, {'заряжается' if bat.power_plugged else 'от батареи'}")
    up = datetime.timedelta(seconds=int(time.time() - psutil.boot_time()))
    lines.append(f"Компьютер работает: {up}")
    return "\n".join(lines)


@tool("list_processes", "Программы, которые больше всего едят память или процессор.",
      {"sort_by": S("memory или cpu", enum=["memory", "cpu"])}, required=[])
def list_processes(sort_by="memory"):
    import psutil
    procs = {}
    for p in psutil.process_iter(["name", "memory_info"]):
        try:
            name = p.info["name"]
            d = procs.setdefault(name, {"mem": 0, "cpu": 0})
            d["mem"] += p.info["memory_info"].rss
            d["cpu"] += p.cpu_percent(None)
        except Exception:
            pass
    if sort_by == "cpu":
        time.sleep(0.5)
        for p in psutil.process_iter(["name"]):
            try:
                procs[p.info["name"]]["cpu"] += p.cpu_percent(None)
            except Exception:
                pass
    key = "cpu" if sort_by == "cpu" else "mem"
    top = sorted(procs.items(), key=lambda kv: kv[1][key], reverse=True)[:15]
    return "\n".join(f"{n}: {d['mem'] / 2**20:.0f} МБ, CPU {d['cpu']:.0f}%" for n, d in top)


@tool("kill_process", "Принудительно завершить программу по имени процесса (например chrome.exe). "
      "Несохранённые данные пропадут, поэтому сначала лучше пробовать window_action close.",
      {"name": S("Имя процесса")},
      confirm=lambda a: f"Принудительно закрыть {a.get('name')}? Несохранённое пропадёт.")
def kill_process(name):
    import psutil
    q = name.lower().removesuffix(".exe")
    n = 0
    for p in psutil.process_iter(["name"]):
        try:
            if (p.info["name"] or "").lower().removesuffix(".exe") == q:
                p.kill()
                n += 1
        except Exception:
            pass
    return f"Завершено процессов: {n}." if n else f"Процесс {name} не найден."


POWER = {
    "lock": ("rundll32.exe user32.dll,LockWorkStation", None),
    "sleep": ("rundll32.exe powrprof.dll,SetSuspendState 0,1,0", "Отправить компьютер в сон?"),
    "shutdown": ("shutdown /s /t {d}", "Выключить компьютер?"),
    "restart": ("shutdown /r /t {d}", "Перезагрузить компьютер?"),
    "logoff": ("shutdown /l", "Выйти из учётной записи?"),
    "cancel": ("shutdown /a", None),
}


@tool("power",
      "Питание: lock (заблокировать), sleep (сон), shutdown (выключить), restart (перезагрузить), "
      "logoff (выйти из системы), cancel (отменить запланированное выключение). delay_sec — через сколько секунд.",
      {"action": S("Действие", enum=list(POWER)), "delay_sec": N("Задержка в секундах")},
      required=["action"], confirm=lambda a: POWER.get(a.get("action"), (None, None))[1])
def power(action, delay_sec=5):
    cmd = POWER[action][0].format(d=int(delay_sec))
    subprocess.run(cmd, shell=True)
    return f"Выполнено: {action}."


# ---------------------------------------------------------------- время, таймеры, заметки

_timers = []


@tool("get_datetime", "Текущие дата, время и день недели.")
def get_datetime():
    days = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]
    now = datetime.datetime.now()
    return f"{now:%d.%m.%Y %H:%M}, {days[now.weekday()]}"


@tool("set_timer", "Поставить таймер или напоминание: через указанное число секунд помощник скажет текст вслух.",
      {"seconds": N("Через сколько секунд"), "text": S("Что сказать")})
def set_timer(seconds, text):
    due = datetime.datetime.now() + datetime.timedelta(seconds=float(seconds))

    def fire():
        try:
            import winsound
            for _ in range(3):
                winsound.Beep(1000, 200)
        except Exception:
            pass
        CTX.speak(f"Напоминаю: {text}")
        _timers[:] = [t for t in _timers if t[2] is not timer]

    timer = threading.Timer(float(seconds), fire)
    timer.daemon = True
    timer.start()
    _timers.append((due, text, timer))
    return f"Таймер на {due:%H:%M:%S}: {text}"


@tool("list_timers", "Список активных таймеров и напоминаний.")
def list_timers():
    return "\n".join(f"{d:%H:%M:%S} — {t}" for d, t, _ in _timers) or "Таймеров нет."


@tool("cancel_timers", "Отменить все таймеры.")
def cancel_timers():
    for _, _, t in _timers:
        t.cancel()
    _timers.clear()
    return "Все таймеры отменены."


def load_notes():
    try:
        return json.loads(NOTES_FILE.read_text("utf-8"))
    except Exception:
        return []


@tool("remember", "Запомнить факт о пользователе или его просьбу навсегда (сохраняется между запусками).",
      {"note": S("Что запомнить")})
def remember(note):
    notes = load_notes()
    notes.append(note)
    NOTES_FILE.write_text(json.dumps(notes, ensure_ascii=False, indent=1), "utf-8")
    return "Запомнил."


@tool("forget", "Удалить из памяти заметки, содержащие текст (или все, если text пустой).",
      {"text": S("Что забыть")}, required=[])
def forget(text=""):
    notes = load_notes()
    keep = [n for n in notes if text and text.lower() not in n.lower()]
    NOTES_FILE.write_text(json.dumps(keep, ensure_ascii=False, indent=1), "utf-8")
    return f"Забыл заметок: {len(notes) - len(keep)}."


@tool("get_weather", "Погода сейчас и прогноз на 3 дня для города.", {"city": S("Город")})
def get_weather(city):
    import requests
    r = requests.get(f"https://wttr.in/{urllib.parse.quote(city)}", params={"format": "j1", "lang": "ru"}, timeout=10)
    d = r.json()
    cur = d["current_condition"][0]
    desc = (cur.get("lang_ru") or cur["weatherDesc"])[0]["value"]
    lines = [f"Сейчас {cur['temp_C']}°C, ощущается как {cur['FeelsLikeC']}°C, {desc}, ветер {cur['windspeedKmph']} км/ч"]
    for day in d["weather"]:
        lines.append(f"{day['date']}: от {day['mintempC']} до {day['maxtempC']}°C")
    return "\n".join(lines)


# ---------------------------------------------------------------- схемы для моделей

def schemas(fmt, skip=()):
    out = []
    for t in REGISTRY.values():
        if t["name"] in skip:
            continue
        schema = {"type": "object", "properties": t["params"], "required": t["required"]}
        if fmt == "claude":
            out.append({"name": t["name"], "description": t["description"], "input_schema": schema})
        else:
            out.append({"type": "function", "function": {"name": t["name"], "description": t["description"],
                                                         "parameters": schema}})
    return out
