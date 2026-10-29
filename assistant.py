"""Голосовой помощник для Windows.

Запуск:  python assistant.py            — голосом (и можно печатать в окне)
         python assistant.py --text     — только текстом, без микрофона
         python assistant.py --brain claude|ollama
"""
import argparse
import ctypes
import datetime
import difflib
import json
import os
import queue
import re
import sys
import threading
import time
from pathlib import Path

from jarvis import tools
from jarvis.brains import ClaudeBrain, OllamaBrain
from jarvis.voice import Speaker

FROZEN = getattr(sys, "frozen", False)
APP_DIR = tools.APP_DIR
BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", APP_DIR))
CONFIG_FILE = APP_DIR / "config.json"

YES = ("да", "давай", "конечно", "подтверждаю", "выполняй", "ок", "окей", "ага", "угу", "можно", "согласен", "yes")
NO = ("нет", "не надо", "отмена", "отмени", "стоп", "не")


def first_run_setup():
    """Первый запуск exe: создаём config.json и спрашиваем, какой мозг включить."""
    cfg = json.loads((BUNDLE_DIR / "config.json").read_text("utf-8"))
    print("=== Первый запуск: настройка ===\n")
    print("  1 - локальный мозг (Ollama, бесплатно, нужна видеокарта от 8 ГБ)")
    print("  2 - облачный мозг (Claude, нужен ключ API, самый умный)")
    print("  3 - оба\n")
    choice = input("Выбери 1, 2 или 3 и нажми Enter: ").strip()
    if choice in ("2", "3"):
        print("\nКлюч API берётся на https://console.anthropic.com/settings/keys")
        key = input("Вставь ключ (sk-ant-...) или нажми Enter, чтобы пропустить: ").strip()
        cfg["claude"]["api_key"] = key
        cfg["brain"] = "claude" if key else "ollama"
    if choice in ("1", "3") or cfg["brain"] == "ollama":
        setup_ollama(cfg["ollama"]["model"])
    CONFIG_FILE.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), "utf-8")
    print(f"\nНастройки сохранены в {CONFIG_FILE}\n")


def setup_ollama(model):
    import shutil
    import subprocess
    exe = shutil.which("ollama") or str(Path(os.environ.get("LOCALAPPDATA", "")) / "Programs/Ollama/ollama.exe")
    if not Path(exe).exists():
        print("\nСтавлю Ollama через winget…")
        subprocess.run(["winget", "install", "-e", "--id", "Ollama.Ollama",
                        "--accept-package-agreements", "--accept-source-agreements"])
    if not Path(exe).exists():
        print("Не получилось поставить Ollama. Скачай её с https://ollama.com и запусти Jarvis снова.")
        return
    print(f"\nКачаю локальную модель {model}, около 4,7 ГБ…")
    subprocess.run([exe, "pull", model])


def load_config():
    if not CONFIG_FILE.exists():
        first_run_setup()
    cfg = json.loads(CONFIG_FILE.read_text("utf-8"))
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key and not cfg["claude"].get("api_key"):
        cfg["claude"]["api_key"] = key
    return cfg


def save_brain_choice(brain):
    cfg = json.loads(CONFIG_FILE.read_text("utf-8"))
    cfg["brain"] = brain
    CONFIG_FILE.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), "utf-8")


def system_prompt(cfg):
    def build():
        f = tools.known_folders()
        notes = tools.load_notes()
        notes_text = "\n".join(f"- {n}" for n in notes) if notes else "пока нет"
        return f"""Ты — {cfg['name']}, голосовой помощник на компьютере пользователя под Windows.
Пользователь говорит голосом, речь распознаётся автоматически и может содержать ошибки: догадывайся по смыслу.
Твои ответы зачитываются вслух синтезатором речи. Поэтому отвечай коротко, обычно одним-двумя предложениями,
живым разговорным русским языком, без markdown, списков, эмодзи и ссылок.

Ты управляешь компьютером через инструменты. Если просьбу можно выполнить инструментами, выполняй сразу,
не переспрашивай: опасные действия программа сама подтвердит у пользователя. Для всего, на что нет отдельного
инструмента, используй run_powershell. Если действие не получилось, попробуй другой способ, а если не вышло —
коротко скажи, что именно не так. После действия кратко скажи, что сделал. Не выдумывай результаты.

О компьютере: пользователь {os.environ.get('USERNAME', '')}, домашняя папка {f['home']},
рабочий стол {f['desktop']}, документы {f['documents']}, загрузки {f['downloads']},
изображения {f['pictures']}, музыка {f['music']}, видео {f['videos']}.
В начале каждой реплики пользователя в квадратных скобках стоят текущие дата и время.

Что ты помнишь о пользователе (инструменты remember и forget):
{notes_text}"""

    return build


def make_brain(name, cfg):
    prompt = system_prompt(cfg)
    if name == "claude":
        if not cfg["claude"].get("api_key"):
            raise RuntimeError("Для облачного режима впиши ключ API в config.json (поле claude.api_key).")
        return ClaudeBrain(cfg["claude"], prompt)
    brain = OllamaBrain(cfg["ollama"], prompt)
    problem = brain.check()
    if problem:
        raise RuntimeError(problem)
    return brain


class Assistant:
    def __init__(self, cfg, text_mode=False, brain=None):
        self.cfg = cfg
        self.name = cfg["name"]
        self.wake = [w.lower() for w in cfg["wake_words"]]
        self.typed = queue.Queue()
        self.text_mode = text_mode
        self.speaker = Speaker(cfg["tts"], self.name)
        self.speaker.enabled = not (text_mode and not cfg["tts"].get("speak_in_text_mode", False))
        self.listener = None
        if not text_mode:
            from jarvis.speech import Listener
            model = APP_DIR / cfg["stt"]["model_path"]
            if not model.exists():
                model = BUNDLE_DIR / cfg["stt"]["model_path"]
            if not model.exists():
                raise SystemExit(f"Нет модели распознавания речи: {model}\nЗапусти install.bat ещё раз.")
            print("Загружаю распознавание речи…")
            self.listener = Listener(model, cfg["stt"].get("mic_device"))
            self.speaker.before = self.listener.mute
            self.speaker.after = self.listener.unmute
        tools.CTX.speak = self.speaker.say
        tools.CTX.confirm = self.confirm
        tools.CTX.confirm_dangerous = cfg.get("confirm_dangerous", True)
        self.brain_name = brain or cfg["brain"]
        self.brain = make_brain(self.brain_name, cfg)
        self.last_talk = time.time()

    # ---------------------------------------------------------- ввод

    def _stdin_reader(self):
        for line in sys.stdin:
            line = line.strip()
            if line:
                self.typed.put(line)

    def _has_wake(self, words):
        for i, w in enumerate(words):
            w = re.sub(r"[^\wё-]", "", w)
            if w in self.wake or difflib.get_close_matches(w, self.wake, n=1, cutoff=0.75):
                return i
        return None

    def next_command(self, follow_up=False):
        """Ждёт следующую команду: напечатанную или сказанную после слова-активатора."""
        until = time.time() + self.cfg.get("follow_up_sec", 6) if follow_up else 0
        while True:
            try:
                return self.typed.get(timeout=0.05 if self.listener else None)
            except queue.Empty:
                pass
            text = self.listener.step(0.5)
            if not text:
                continue
            words = text.lower().split()
            i = self._has_wake(words)
            if i is None:
                if time.time() < until:
                    return text
                print(f"   (слышу: {text})")
                continue
            command = " ".join(words[i + 1:]).strip(" ,.")
            if command:
                return command
            self._beep()
            self.speaker.say("Слушаю.")
            command = self.listener.listen(8)
            if command:
                return command

    def confirm(self, question):
        self.speaker.say(question)
        if self.text_mode:
            answer = input("🧑 (да/нет): ")
        else:
            answer = None
            deadline = time.time() + 10
            while time.time() < deadline and not answer:
                try:
                    answer = self.typed.get_nowait()
                except queue.Empty:
                    answer = self.listener.step(0.5)
            if not answer:
                self.speaker.say("Не услышал ответа, отменяю.")
                return False
        answer = answer.lower().strip(" .!,")
        print(f"🧑 Ты: {answer}")
        ok = any(answer == y or answer.startswith(y + " ") for y in YES) and not answer.startswith("не")
        if not ok:
            self.speaker.say("Отменил.")
        return ok

    def _beep(self):
        try:
            import winsound
            winsound.Beep(880, 120)
        except Exception:
            pass

    # ---------------------------------------------------------- обработка

    def handle(self, text):
        low = text.lower().strip(" .!?,")
        if re.search(r"переключ\w*\s+(на\s+)?(облач|claude|клод|интернет)", low):
            return self.switch("claude")
        if re.search(r"переключ\w*\s+(на\s+)?(локал|олл?ам|ollama|офлайн)", low):
            return self.switch("ollama")
        if low in ("новый разговор", "забудь разговор", "начнём сначала", "начнем сначала", "сброс"):
            self.brain.reset()
            return self.speaker.say("Хорошо, начинаем с чистого листа.")
        if low in ("помолчи", "замолчи", "без звука"):
            self.speaker.enabled = False
            return print("   (голос выключен, скажи «говори» чтобы включить)")
        if low in ("говори", "включи голос"):
            self.speaker.enabled = True
            return self.speaker.say("Снова говорю.")
        if low in ("отбой", "выключись", "заверши работу", "выход", "exit", "quit"):
            self.speaker.say("До связи!")
            raise SystemExit

        if time.time() - self.last_talk > self.cfg.get("conversation_timeout_sec", 300):
            self.brain.reset()
        now = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
        answer = self.brain.ask(f"[{now}] {text}")
        self.last_talk = time.time()
        self.speaker.say(answer)

    def switch(self, name):
        if name == self.brain_name:
            return self.speaker.say(f"Я и так работаю в режиме {self.brain.label}.")
        try:
            self.brain = make_brain(name, self.cfg)
        except RuntimeError as e:
            return self.speaker.say(str(e))
        self.brain_name = name
        save_brain_choice(name)
        self.speaker.say(f"Переключился на {self.brain.label} режим.")

    def run(self):
        print(f"\n=== {self.name} готов. Мозг: {self.brain.label}. ===")
        if self.listener:
            print(f"Скажи «{self.cfg['wake_words'][0].capitalize()}, …» или просто напиши команду здесь.")
            threading.Thread(target=self._stdin_reader, daemon=True).start()
        else:
            print("Пиши команды. «выход» — закрыть.")
        self.speaker.say(self.cfg.get("greeting", "Я на связи."))
        follow = False
        while True:
            if self.text_mode:
                try:
                    cmd = input("🧑 Ты: ").strip()
                except EOFError:
                    return
                if not cmd:
                    continue
            else:
                cmd = self.next_command(follow_up=follow)
                print(f"🧑 Ты: {cmd}")
            try:
                self.handle(cmd)
                follow = True
            except SystemExit:
                return
            except Exception as e:
                print(f"   Ошибка: {type(e).__name__}: {e}")
                self.speaker.say("Что-то пошло не так, подробности в окне.")


def selftest():
    import edge_tts, pyautogui, pyperclip, pygetwindow, psutil, pyttsx3, send2trash, sounddevice, vosk  # noqa: F401
    import anthropic  # noqa: F401
    from PIL import ImageGrab  # noqa: F401
    from pycaw.pycaw import AudioUtilities  # noqa: F401
    cfg = json.loads((BUNDLE_DIR / "config.json").read_text("utf-8"))
    vosk.SetLogLevel(-1)
    vosk.Model(str(BUNDLE_DIR / cfg["stt"]["model_path"]))
    print("tools:", len(tools.REGISTRY), "|", tools.execute("get_datetime", {}), "|", tools.execute("system_info", {})[:40])
    print("SELFTEST OK")


def main():
    if os.name == "nt":
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(2)
        except Exception:
            pass
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stdin.reconfigure(encoding="utf-8")
    except Exception:
        pass
    p = argparse.ArgumentParser()
    p.add_argument("--text", action="store_true", help="без микрофона, только текст")
    p.add_argument("--brain", choices=["claude", "ollama"])
    p.add_argument("--selftest", action="store_true", help="проверить, что всё собралось")
    a = p.parse_args()
    if a.selftest:
        return selftest()
    cfg = load_config()
    try:
        Assistant(cfg, text_mode=a.text, brain=a.brain).run()
    except RuntimeError as e:
        print(f"\n{e}\n")
        input("Нажми Enter, чтобы закрыть…")
    except KeyboardInterrupt:
        pass
    except Exception:
        import traceback
        traceback.print_exc()
        input("\nПомощник упал, текст ошибки выше. Нажми Enter, чтобы закрыть…")


if __name__ == "__main__":
    main()
