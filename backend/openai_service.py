from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

import requests


class OpenAIService:
    def __init__(self) -> None:
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.prediction_model = os.getenv("OPENAI_PREDICTION_MODEL", "gpt-4o-mini")
        self.transcription_model = os.getenv("OPENAI_TRANSCRIPTION_MODEL", "gpt-4o-mini-transcribe")
        self.tts_model = os.getenv("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
        self.tts_voice = os.getenv("OPENAI_TTS_VOICE", "alloy")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def _headers(self) -> Dict[str, str]:
        if not self.enabled:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        return {
            "Authorization": f"Bearer {self.api_key}",
        }

    def transcribe_audio(self, filename: str, content: bytes, content_type: str = "audio/webm") -> str:
        response = requests.post(
            f"{self.base_url}/audio/transcriptions",
            headers=self._headers(),
            data={
                "model": self.transcription_model,
            },
            files={
                "file": (filename, content, content_type),
            },
            timeout=120,
        )
        response.raise_for_status()
        payload = response.json()
        return payload.get("text", "").strip()

    def synthesize_speech(self, text: str) -> bytes:
        response = requests.post(
            f"{self.base_url}/audio/speech",
            headers={
                **self._headers(),
                "Content-Type": "application/json",
            },
            json={
                "model": self.tts_model,
                "voice": self.tts_voice,
                "input": text,
                "format": "mp3",
            },
            timeout=120,
        )
        response.raise_for_status()
        return response.content

    def generate_prediction(self, symbol: str, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        response = requests.post(
            f"{self.base_url}/chat/completions",
            headers={
                **self._headers(),
                "Content-Type": "application/json",
            },
            json={
                "model": self.prediction_model,
                "response_format": {
                    "type": "json_object",
                },
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are a financial analysis assistant. "
                            "Return strict JSON with keys: signal, confidence, predicted_price, reasoning, risk_summary, catalysts. "
                            "signal must be BUY, HOLD, or SELL. confidence must be a number from 0 to 1. "
                            "predicted_price must be a number. catalysts must be an array of short strings."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Analyze {symbol} using this market context and produce a grounded trading view.\n"
                            f"{json.dumps(context, default=str)}"
                        ),
                    },
                ],
                "temperature": 0.2,
            },
            timeout=120,
        )
        response.raise_for_status()
        payload = response.json()
        content = payload["choices"][0]["message"]["content"]
        if not content:
            return None

        parsed = json.loads(content)
        return {
            "signal": str(parsed.get("signal", "HOLD")).upper(),
            "confidence": float(parsed.get("confidence", 0.6)),
            "predicted_price": float(parsed.get("predicted_price", 0) or 0),
            "reasoning": parsed.get("reasoning", "AI analysis unavailable."),
            "risk_summary": parsed.get("risk_summary", ""),
            "catalysts": parsed.get("catalysts", []),
            "provider": "OpenAI",
            "model": self.prediction_model,
        }
