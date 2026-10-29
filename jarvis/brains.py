"""«Мозги» помощника: облачный Claude и локальный Ollama. Оба умеют вызывать инструменты."""
import json

import requests

from . import tools

MAX_STEPS = 25


def _log_tool(name, args, result):
    text = result["text"] if isinstance(result, dict) else str(result)
    print(f"   🔧 {name} {json.dumps(args, ensure_ascii=False)[:200]} → {text[:200].replace(chr(10), ' ')}")


class ClaudeBrain:
    label = "облачный (Claude)"

    def __init__(self, cfg, system_prompt):
        import anthropic

        self.anthropic = anthropic
        self.client = anthropic.Anthropic(api_key=cfg.get("api_key") or None)
        self.model = cfg.get("model", "claude-opus-5-5")
        self.effort = cfg.get("effort", "low")
        self.tools = tools.schemas("claude")
        if cfg.get("web_search", True):
            self.tools.append({"type": "web_search_20260209", "name": "web_search", "max_uses": 3})
        self.system_prompt = system_prompt
        self.reset()

    def reset(self):
        # Историю только дописываем: правка старых ходов ломает «мысли» модели.
        # Поэтому вместо обрезки начинаем новый разговор.
        self.messages = []
        self.system = self.system_prompt()

    def ask(self, text):
        if len(self.messages) > 120:
            self.reset()
        self.messages.append({"role": "user", "content": text})
        try:
            return self._loop()
        except self.anthropic.AuthenticationError:
            self.reset()
            return "Не подходит ключ API Claude. Проверь его в файле config.json."
        except self.anthropic.PermissionDeniedError:
            self.reset()
            return "У ключа API нет доступа к этой модели."
        except self.anthropic.RateLimitError:
            self.reset()
            return "Слишком много запросов или закончились деньги на счёте API. Попробуй чуть позже."
        except self.anthropic.APIConnectionError:
            self.reset()
            return "Нет связи с сервером Claude. Проверь интернет."
        except self.anthropic.APIStatusError as e:
            self.reset()
            return f"Сервер Claude вернул ошибку {e.status_code}."

    def _loop(self):
        for _ in range(MAX_STEPS):
            resp = self.client.beta.messages.create(
                model=self.model,
                max_tokens=16000,
                system=self.system,
                tools=self.tools,
                messages=self.messages,
                thinking={"type": "adaptive"},
                output_config={"effort": self.effort},
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                cache_control={"type": "ephemeral"},
            )
            if resp.stop_reason == "refusal":
                self.reset()
                return "С этим я помочь не могу."
            content = [b for b in resp.content if b.type != "fallback"]
            self.messages.append({"role": "assistant", "content": content})
            if resp.stop_reason == "pause_turn":
                continue
            if resp.stop_reason != "tool_use":
                return " ".join(b.text for b in content if b.type == "text").strip() or "Готово."
            results = []
            for b in content:
                if b.type != "tool_use":
                    continue
                result = tools.execute(b.name, b.input)
                _log_tool(b.name, b.input, result)
                if isinstance(result, dict) and "image_b64" in result:
                    body = [{"type": "text", "text": result["text"]},
                            {"type": "image", "source": {"type": "base64", "media_type": result["media_type"],
                                                         "data": result["image_b64"]}}]
                else:
                    body = str(result)
                results.append({"type": "tool_result", "tool_use_id": b.id, "content": body})
            self.messages.append({"role": "user", "content": results})
        return "Задача оказалась слишком длинной, я остановился."


class OllamaBrain:
    label = "локальный (Ollama)"

    def __init__(self, cfg, system_prompt):
        self.url = cfg.get("url", "http://localhost:11434").rstrip("/")
        self.model = cfg.get("model", "qwen2.5:7b")
        self.tools = tools.schemas("ollama", skip={"look_at_screen", "mouse"})
        self.system_prompt = system_prompt
        self.reset()

    def reset(self):
        self.messages = []
        self.system = self.system_prompt()

    def check(self):
        try:
            names = [m["name"] for m in requests.get(self.url + "/api/tags", timeout=5).json().get("models", [])]
        except Exception:
            return "Ollama не запущена. Установи её с сайта ollama.com и запусти."
        if not any(n == self.model or n.split(":")[0] == self.model for n in names):
            return f"В Ollama нет модели {self.model}. Выполни в терминале: ollama pull {self.model}"
        return None

    def ask(self, text):
        self.messages.append({"role": "user", "content": text})
        # У локальной модели маленькое окно контекста: держим последние сообщения, начиная с реплики пользователя.
        if len(self.messages) > 40:
            tail = self.messages[-30:]
            while tail and tail[0]["role"] != "user":
                tail.pop(0)
            self.messages = tail
        try:
            return self._loop()
        except requests.ConnectionError:
            return "Не могу подключиться к Ollama. Она запущена?"
        except requests.Timeout:
            return "Локальная модель слишком долго думает."

    def _loop(self):
        for _ in range(MAX_STEPS):
            r = requests.post(self.url + "/api/chat", timeout=300, json={
                "model": self.model,
                "messages": [{"role": "system", "content": self.system}] + self.messages,
                "tools": self.tools,
                "stream": False,
                "options": {"temperature": 0.3, "num_ctx": 8192},
            })
            if r.status_code != 200:
                return f"Ollama вернула ошибку: {r.text[:200]}"
            msg = r.json()["message"]
            calls = msg.get("tool_calls") or []
            self.messages.append({"role": "assistant", "content": msg.get("content", ""),
                                  **({"tool_calls": calls} if calls else {})})
            if not calls:
                return (msg.get("content") or "Готово.").strip()
            for call in calls:
                fn = call["function"]
                args = fn.get("arguments") or {}
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except json.JSONDecodeError:
                        args = {}
                result = tools.execute(fn["name"], args)
                _log_tool(fn["name"], args, result)
                text = result["text"] if isinstance(result, dict) else str(result)
                self.messages.append({"role": "tool", "tool_name": fn["name"], "content": text})
        return "Задача оказалась слишком длинной, я остановился."
