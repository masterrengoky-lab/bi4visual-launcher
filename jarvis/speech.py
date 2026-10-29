"""Микрофон и распознавание речи (Vosk, работает без интернета)."""
import json
import queue
import time


class Listener:
    def __init__(self, model_path, device=None, samplerate=16000):
        import sounddevice as sd
        import vosk

        vosk.SetLogLevel(-1)
        self.model = vosk.Model(str(model_path))
        self.samplerate = samplerate
        self.q = queue.Queue()
        self.muted = False
        self.rec = vosk.KaldiRecognizer(self.model, samplerate)
        self.partial = ""
        self.stream = sd.RawInputStream(samplerate=samplerate, blocksize=4000, device=device,
                                        dtype="int16", channels=1, callback=self._cb)
        self.stream.start()

    def _cb(self, indata, frames, t, status):
        if not self.muted:
            self.q.put(bytes(indata))

    def mute(self):
        self.muted = True

    def unmute(self):
        """Включить микрофон, выбросив всё, что он услышал, пока говорил сам помощник."""
        while not self.q.empty():
            try:
                self.q.get_nowait()
            except queue.Empty:
                break
        self.rec.Reset()
        self.partial = ""
        self.muted = False

    def step(self, max_wait=0.5):
        """Слушает до max_wait секунд. Возвращает законченную фразу или None.
        Если человек начал говорить, ждёт конца фразы дольше."""
        deadline = time.time() + max_wait
        while True:
            timeout = deadline - time.time()
            if self.partial:
                timeout = max(timeout, 3.0)
            if timeout <= 0:
                return None
            try:
                data = self.q.get(timeout=min(timeout, 0.3))
            except queue.Empty:
                if time.time() >= deadline and not self.partial:
                    return None
                continue
            if self.rec.AcceptWaveform(data):
                self.partial = ""
                text = json.loads(self.rec.Result()).get("text", "").strip()
                if text:
                    return text
            else:
                self.partial = json.loads(self.rec.PartialResult()).get("partial", "").strip()

    def listen(self, seconds):
        """Ждёт одну фразу не дольше seconds (если не начали говорить)."""
        deadline = time.time() + seconds
        while time.time() < deadline or self.partial:
            text = self.step(0.5)
            if text:
                return text
        return None
