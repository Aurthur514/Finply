from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, Response, UploadFile
from pydantic import BaseModel

from ai_engine import HedgeFundAI
from market_data import MarketDataService
from ml_models.news_predictor import NewsStockPredictor
from models import SessionLocal
from openai_service import OpenAIService
from trading_engine import TradingEngine


router = APIRouter(prefix="/assistant", tags=["assistant"])
market_service = MarketDataService()
news_predictor = NewsStockPredictor()
openai_service = OpenAIService()


class AssistantChatRequest(BaseModel):
    message: str
    symbol: Optional[str] = None
    user_id: Optional[int] = None


class AssistantSpeechRequest(BaseModel):
    text: str


def _format_price(value: Optional[float]) -> str:
    if value is None:
        return "N/A"
    return f"${value:,.2f}"


def _extract_symbol(message: str, fallback_symbol: Optional[str]) -> Optional[str]:
    tokens = [token.strip(" ,.!?").upper() for token in message.split()]
    for token in tokens:
        if token.endswith((".NS", ".BO")):
            return token
        if 2 <= len(token) <= 6 and token.isalpha():
            if market_service.is_supported_symbol(token):
                return token
    return fallback_symbol.upper().strip() if fallback_symbol else None


def _build_portfolio_answer(engine: TradingEngine, user_id: int) -> Dict[str, Any]:
    portfolio = engine.get_portfolio(user_id)
    positions = portfolio.get("positions", [])
    top_position = max(positions, key=lambda item: item["market_value"], default=None)
    summary = (
        f"Your portfolio value is {_format_price(portfolio['total_value'])} with cash "
        f"{_format_price(portfolio['cash_balance'])}. Unrealized PnL is "
        f"{_format_price(portfolio['unrealized_pnl'])} and realized PnL is "
        f"{_format_price(portfolio['realized_pnl'])}."
    )
    if top_position:
        summary += (
            f" Your largest holding is {top_position['symbol']} worth "
            f"{_format_price(top_position['market_value'])}."
        )
    return {
        "answer": summary,
        "suggestions": [
            "What is my risk exposure?",
            f"Analyze {top_position['symbol']}" if top_position else "Analyze my selected asset",
            "Summarize my open positions",
        ],
        "context": {
            "portfolio": portfolio,
        },
    }


def _build_risk_answer(engine: TradingEngine, user_id: int) -> Dict[str, Any]:
    portfolio = engine.get_portfolio(user_id)
    positions = portfolio.get("positions", [])
    if not positions:
        return {
            "answer": "You do not have open positions yet, so portfolio risk is currently low. Your biggest risk is opportunity cost rather than drawdown.",
            "suggestions": ["Analyze AAPL", "What should I watch before buying?"],
            "context": {"portfolio": portfolio},
        }

    total_positions_value = max(portfolio.get("positions_value", 0), 1)
    ranked = sorted(positions, key=lambda item: item["market_value"], reverse=True)
    largest = ranked[0]
    concentration = (largest["market_value"] / total_positions_value) * 100
    answer = (
        f"Your portfolio has {len(positions)} open positions with total invested capital of "
        f"{_format_price(portfolio['positions_value'])}. The largest position is {largest['symbol']} at "
        f"{concentration:.1f}% of invested capital. Unrealized PnL is {_format_price(portfolio['unrealized_pnl'])}, "
        "so concentration and position sizing are the main risk drivers right now."
    )
    return {
        "answer": answer,
        "suggestions": [
            f"Should I reduce {largest['symbol']}?",
            "Summarize my portfolio",
            "How much should I risk per trade?",
        ],
        "context": {
            "largest_position": largest,
            "concentration_percent": round(concentration, 2),
        },
    }


def _build_symbol_answer(symbol: str, message: str) -> Dict[str, Any]:
    quote = market_service.get_quote(symbol)
    if not quote:
        raise HTTPException(status_code=404, detail=f"{symbol} is not supported")

    technical = market_service.get_technical_analysis(symbol)

    db = SessionLocal()
    try:
        prediction = HedgeFundAI(db).generate_prediction(symbol)
    finally:
        db.close()

    news = news_predictor.fetch_news(f"{symbol} market", days=1)[:2]
    action_hint = "invest" in message.lower() or "buy" in message.lower() or "sell" in message.lower()

    answer_parts = [
        f"{symbol} is trading at {_format_price(float(quote['price']))} with daily change {quote.get('change_percent', 'N/A')}.",
        f"Technical analysis currently leans {technical.get('recommendation', {}).get('action', 'HOLD')}.",
        f"The ensemble AI signal is {prediction.get('signal', 'HOLD')} with {prediction.get('confidence', 0) * 100:.0f}% confidence.",
    ]

    if action_hint:
        answer_parts.append(
            "If you are considering a trade, line up the AI signal with the technical trend and keep position size small enough that a stop loss would not damage the portfolio."
        )

    if news:
        answer_parts.append(f"Recent headline tone includes: {news[0].get('title', 'market updates')}.")

    return {
        "answer": " ".join(answer_parts),
        "suggestions": [
            f"Should I buy {symbol} now?",
            f"What are the risks in {symbol}?",
            f"Give me a quick summary of {symbol}",
        ],
        "context": {
            "symbol": symbol,
            "quote": quote,
            "technical": technical,
            "prediction": prediction,
            "news": news,
        },
    }


@router.post("/chat")
async def chat_with_assistant(request: AssistantChatRequest) -> Dict[str, Any]:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    normalized = message.lower()
    symbol = _extract_symbol(message, request.symbol)

    db = SessionLocal()
    try:
        engine = TradingEngine(db)

        if any(keyword in normalized for keyword in ["portfolio", "balance", "holding", "holdings", "pnl"]):
            if not request.user_id:
                raise HTTPException(status_code=400, detail="user_id is required for portfolio questions")
            payload = _build_portfolio_answer(engine, request.user_id)
        elif any(keyword in normalized for keyword in ["risk", "drawdown", "exposure", "safe"]):
            if request.user_id:
                payload = _build_risk_answer(engine, request.user_id)
            elif symbol:
                payload = _build_symbol_answer(symbol, message)
            else:
                payload = {
                    "answer": "Ask about a symbol or connect a paper trading account, and I can assess trade risk, concentration, and momentum.",
                    "suggestions": ["Analyze AAPL", "Summarize my portfolio", "What is the risk in RELIANCE.NS?"],
                    "context": {},
                }
        elif symbol:
            payload = _build_symbol_answer(symbol, message)
        else:
            payload = {
                "answer": (
                    "I can help with three things: analyze a stock or crypto, summarize your portfolio, or explain trade risk. "
                    "Try asking things like 'Analyze RELIANCE.NS', 'Should I buy AAPL?', or 'Summarize my portfolio'."
                ),
                "suggestions": [
                    "Analyze AAPL",
                    "Analyze RELIANCE.NS",
                    "Summarize my portfolio",
                ],
                "context": {},
            }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        db.close()

    return {
        "answer": payload["answer"],
        "suggestions": payload.get("suggestions", []),
        "context": payload.get("context", {}),
        "speakable": payload["answer"],
    }


@router.post("/voice/transcribe")
async def transcribe_voice(file: UploadFile = File(...)) -> Dict[str, str]:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Audio file is required")
    if not openai_service.enabled:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY is not configured for natural voice transcription")

    try:
        transcript = openai_service.transcribe_audio(
            filename=file.filename or "speech.webm",
            content=content,
            content_type=file.content_type or "audio/webm",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}") from exc

    return {"text": transcript}


@router.post("/voice/speak")
async def speak_text(request: AssistantSpeechRequest) -> Response:
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    if not openai_service.enabled:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY is not configured for natural voice output")

    try:
        audio = openai_service.synthesize_speech(text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Speech generation failed: {exc}") from exc

    return Response(content=audio, media_type="audio/mpeg")
