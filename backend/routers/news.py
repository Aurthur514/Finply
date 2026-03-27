from fastapi import APIRouter, HTTPException
from ml_models.news_predictor import NewsStockPredictor
from typing import List, Dict

router = APIRouter(prefix="/news", tags=["news"])
predictor = NewsStockPredictor()

@router.get("")
@router.get("/")
async def get_news(query: str = "stock market", days: int = 1) -> List[Dict]:
    """Fetch recent news for a given query."""
    try:
        news = predictor.fetch_news(query, days=days)
        return news
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_news_summary(query: str = "stock market", days: int = 3) -> Dict:
    """Return aggregate sentiment summary for a query."""
    try:
        return predictor.summarize_news_sentiment(query, days=days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
