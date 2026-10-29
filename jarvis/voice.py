"""Голос помощника: SAPI (встроенный в Windows, офлайн) или Edge (нейроголос, нужен интернет)."""
import asyncio
import ctypes
import os
import re
import tempfile
import threading


def clean(text):
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"https?://\S+", "ссылка", text)
    text = re.sub(r"[*_#`>|~]", "", text)
    text = re.sub(r"[\U0001F300-\U0001FAFF☀-➿]", "", text)
    return re.sub(r"\s+", " ", text).strip()


class Speaker:
    def __init__(self, cfg, name="Помощник"):
        self.engine = cfg.get("engine", "edge")
        self.edge_voice = cfg.get("edge_voice", "ru-RU-DmitryNeural")
        self.rate = int(cfg.get("sapi_rate", 190))
        self.name = name
        self.enabled = True
        self.lock = threading.Lock()
        self.before = self.after = lambda: None

    def say(self, text):
        print(f"🤖 {self.name}: {text}")
        text = clean(text)
        if not text or not self.enabled:
            return
        with self.lock:
            self.before()
            try:
                if self.engine == "edge":
                    try:
                        self._edge(text)
                        return
                    except Exception as e:
                        print(f"   (голос Edge недоступен: {e}; говорю голосом Windows)")
                        self.engine = "sapi"
                self._sapi(text)
            finally:
                self.after()

    def _sapi(self, text):
        import pyttsx3

        eng = pyttsx3.init()
        for v in eng.getProperty("voices"):
            info = (v.name + " " + v.id + " " + " ".join(map(str, getattr(v, "languages", [])))).lower()
            if "ru" in info or "russian" in info or "irina" in info or "pavel" in info:
                eng.setProperty("voice", v.id)
                break
        eng.setProperty("rate", self.rate)
        eng.say(text)
        eng.runAndWait()
        eng.stop()

    def _edge(self, text):
        import edge_tts

        path = os.path.join(tempfile.gettempdir(), "jarvis_tts.mp3")
        asyncio.run(edge_tts.Communicate(text, self.edge_voice).save(path))
        mci = ctypes.windll.winmm.mciSendStringW
        mci("close jarvis_tts", None, 0, None)
        if mci(f'open "{path}" type mpegvideo alias jarvis_tts', None, 0, None) != 0:
            raise RuntimeError("не удалось открыть звук")
        mci("play jarvis_tts wait", None, 0, None)
        mci("close jarvis_tts", None, 0, None)
