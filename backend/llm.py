"""
LLM 适配器层
========
统一接口，可切换 Gemini / DeepSeek / Claude / OpenAI。

设计原则:
- 所有 provider 实现同一个 `chat()` 方法
- 通过环境变量 LLM_PROVIDER 切换
- 失败时给出明确错误信息（API key 缺失、quota 超限等）
"""

from __future__ import annotations

import os
import json
from abc import ABC, abstractmethod
from typing import Any

import httpx


class LLMError(Exception):
    """LLM 调用错误（API key 缺失、超出 quota、网络问题等）"""


class LLMClient(ABC):
    """所有 LLM provider 的抽象基类。"""

    @abstractmethod
    async def chat(
        self,
        system_prompt: str,
        user_message: str,
        history: list[dict[str, str]] | None = None,
        json_mode: bool = False,
    ) -> str:
        """
        发送对话请求。

        Args:
            system_prompt: 系统提示词
            user_message: 用户消息
            history: 历史对话 [{"role": "user"|"assistant", "content": "..."}]
            json_mode: 是否要求返回 JSON 格式

        Returns:
            LLM 生成的文本
        """
        ...


# ============================================================
# Gemini 实现
# ============================================================
class GeminiClient(LLMClient):
    """Google Gemini API 客户端。免费额度 1500 请求/天 (2.0 Flash)。"""

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.model = os.getenv("LLM_MODEL") or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        if not self.api_key:
            raise LLMError(
                "GEMINI_API_KEY 未设置。在 https://aistudio.google.com/app/apikey 申请后填到 .env"
            )

    async def chat(
        self,
        system_prompt: str,
        user_message: str,
        history: list[dict[str, str]] | None = None,
        json_mode: bool = False,
    ) -> str:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )

        # Gemini 用 contents 而非 messages，role 取值 user/model
        contents = []
        if history:
            for msg in history:
                role = "model" if msg["role"] == "assistant" else "user"
                contents.append({"role": role, "parts": [{"text": msg["content"]}]})
        contents.append({"role": "user", "parts": [{"text": user_message}]})

        payload: dict[str, Any] = {
            "contents": contents,
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 4096,
            },
        }
        if json_mode:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 429:
                raise LLMError(
                    "已达到 Gemini 免费层限流（5 次/分钟）。请稍等 30-60 秒再试，"
                    "或在设置中切换其他模型 / 升级付费层。"
                )
            if resp.status_code == 401 or resp.status_code == 403:
                raise LLMError("Gemini API key 无效或已过期，请检查 .env 配置。")
            if resp.status_code != 200:
                raise LLMError(f"Gemini API 错误 {resp.status_code}: {resp.text[:300]}")
            data = resp.json()
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError) as e:
                raise LLMError(f"Gemini 返回格式异常: {data}") from e


# ============================================================
# DeepSeek 实现（OpenAI 兼容）
# ============================================================
class DeepSeekClient(LLMClient):
    """DeepSeek API 客户端。便宜，约 $0.14/百万 input tokens。"""

    def __init__(self):
        self.api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
        self.model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
        if not self.api_key:
            raise LLMError(
                "DEEPSEEK_API_KEY 未设置。在 https://platform.deepseek.com/ 申请后填到 .env"
            )

    async def chat(
        self,
        system_prompt: str,
        user_message: str,
        history: list[dict[str, str]] | None = None,
        json_mode: bool = False,
    ) -> str:
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 4096,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            if resp.status_code != 200:
                raise LLMError(f"DeepSeek API 错误 {resp.status_code}: {resp.text[:500]}")
            data = resp.json()
            return data["choices"][0]["message"]["content"]


# ============================================================
# Claude 实现
# ============================================================
class ClaudeClient(LLMClient):
    """Anthropic Claude API 客户端。质量最好。"""

    def __init__(self):
        self.api_key = os.getenv("CLAUDE_API_KEY", "").strip()
        self.model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-5")
        if not self.api_key:
            raise LLMError(
                "CLAUDE_API_KEY 未设置。在 https://console.anthropic.com/ 申请后填到 .env"
            )

    async def chat(
        self,
        system_prompt: str,
        user_message: str,
        history: list[dict[str, str]] | None = None,
        json_mode: bool = False,
    ) -> str:
        messages = []
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        # Claude 没有原生 json_mode，靠 prompt 引导
        if json_mode:
            system_prompt += "\n\n严格只返回 JSON,不要任何其他文字、代码块标记或解释。"

        payload = {
            "model": self.model,
            "system": system_prompt,
            "messages": messages,
            "max_tokens": 4096,
            "temperature": 0.2,
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                json=payload,
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
            )
            if resp.status_code != 200:
                raise LLMError(f"Claude API 错误 {resp.status_code}: {resp.text[:500]}")
            data = resp.json()
            return data["content"][0]["text"]


# ============================================================
# OpenAI 实现
# ============================================================
class OpenAIClient(LLMClient):
    """OpenAI API 客户端。"""

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        if not self.api_key:
            raise LLMError("OPENAI_API_KEY 未设置")

    async def chat(
        self,
        system_prompt: str,
        user_message: str,
        history: list[dict[str, str]] | None = None,
        json_mode: bool = False,
    ) -> str:
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 4096,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            if resp.status_code != 200:
                raise LLMError(f"OpenAI API 错误 {resp.status_code}: {resp.text[:500]}")
            data = resp.json()
            return data["choices"][0]["message"]["content"]


# ============================================================
# 工厂函数
# ============================================================
_PROVIDERS = {
    "gemini": GeminiClient,
    "deepseek": DeepSeekClient,
    "claude": ClaudeClient,
    "openai": OpenAIClient,
}


def get_llm_client() -> LLMClient:
    """根据环境变量 LLM_PROVIDER 创建 LLM 客户端。"""
    provider = os.getenv("LLM_PROVIDER", "gemini").lower().strip()
    if provider not in _PROVIDERS:
        raise LLMError(
            f"未知 LLM_PROVIDER: {provider}。支持: {list(_PROVIDERS.keys())}"
        )
    return _PROVIDERS[provider]()


def extract_json(text: str) -> dict | list:
    """
    从 LLM 回复里提取 JSON。
    处理常见的 markdown 代码块包裹、前后多余文字等情况。
    """
    text = text.strip()
    # 去掉 markdown 代码块
    if text.startswith("```"):
        lines = text.split("\n")
        # 去首尾的 ``` 行
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines)

    # 直接尝试解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 尝试找到第一个 { 或 [ 到最后一个 } 或 ]
    start = min(
        (text.find(c) for c in "{[" if text.find(c) != -1),
        default=-1,
    )
    end = max(text.rfind("}"), text.rfind("]"))
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"无法从 LLM 回复中提取 JSON:\n{text[:500]}")
