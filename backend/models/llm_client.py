import os
import json
import re
from openai import OpenAI
import anthropic


class LLMClient:
    def __init__(self, provider="openai", model="gpt-4o"):
        self.provider = provider
        self.model = model

        if provider == "openai":
            self.client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        elif provider == "deepseek":
            self.client = OpenAI(
                api_key=os.environ["DEEPSEEK_API_KEY"],
                base_url="https://api.deepseek.com",
            )
        elif provider == "poe":
            self.client = OpenAI(
                api_key=os.environ["POE_API_KEY"],
                base_url="https://api.poe.com/v1",
            )
        elif provider == "claude":
            self.client = anthropic.Anthropic(
                api_key=os.environ["ANTHROPIC_API_KEY"]
            )

    def chat(self, system, user: str, json_mode=False) -> str:
        system = str(system)
        if self.provider in ("openai", "deepseek"):
            kwargs = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.7,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            resp = self.client.chat.completions.create(**kwargs)
            return resp.choices[0].message.content

        elif self.provider == "poe":
            # Poe's Responses API — don't use text.format for Claude models,
            # rely on prompt instruction instead
            input_text = user
            if json_mode:
                input_text = user + "\n\nOutput a JSON object directly — no explanatory text, no markdown code blocks."
            resp = self.client.responses.create(
                model=self.model,
                instructions=system,
                input=input_text,
            )
            return resp.output_text or ""

        elif self.provider == "claude":
            resp = self.client.messages.create(
                model=self.model,
                max_tokens=8192,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            return resp.content[0].text

    def chat_with_history(self, system, messages: list[dict]) -> str:
        system = str(system)
        if self.provider in ("openai", "deepseek"):
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "system", "content": system}] + messages,
                temperature=0.7,
            )
            return resp.choices[0].message.content

        elif self.provider == "poe":
            resp = self.client.responses.create(
                model=self.model,
                instructions=system,
                input=messages,
            )
            return resp.output_text or ""

        elif self.provider == "claude":
            resp = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=system,
                messages=messages,
            )
            return resp.content[0].text

    def chat_json(self, system: str, user: str) -> dict:
        raw = self.chat(system, user, json_mode=True)
        return _extract_json(raw)


def _extract_json(text: str) -> dict:
    """Robustly extract a JSON object from model output."""
    if not text or not text.strip():
        return {}
    text = text.strip()

    # Strip markdown code fences
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Handle double-brace format {{...}} that some models output when mimicking prompt examples
    if text.startswith('{{') or text.startswith('{{"'):
        normalized = text.replace('{{', '{').replace('}}', '}')
        try:
            return json.loads(normalized)
        except json.JSONDecodeError:
            pass

    # Find the outermost {...} block
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end > start:
        candidate = text[start:end + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            # Try collapsing double braces in the candidate
            try:
                return json.loads(candidate.replace('{{', '{').replace('}}', '}'))
            except json.JSONDecodeError:
                pass

    return {}
