import os

_PROMPTS_DIR = os.path.dirname(__file__)


def load_prompt(filename: str) -> str:
    path = os.path.join(_PROMPTS_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


class _PromptTemplate:
    """
    Wraps a prompt string and provides a .format(**kwargs) that only replaces
    {key} tokens matching the given kwargs, leaving all other {…} untouched.
    This prevents KeyErrors when the prompt contains literal JSON examples.
    """
    def __init__(self, text: str):
        self._text = text

    def format(self, **kwargs) -> str:
        result = self._text
        for key, value in kwargs.items():
            result = result.replace(f"{{{key}}}", str(value))
        return result

    def __str__(self):
        return self._text


def load_prompt(filename: str) -> _PromptTemplate:
    path = os.path.join(_PROMPTS_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return _PromptTemplate(f.read())
