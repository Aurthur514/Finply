import re
from datetime import datetime, timedelta
import os
from typing import Dict, List

class NewsStockPredictor:
    def __init__(self):
        # API keys
        self.news_api_key = os.getenv("NEWS_API_KEY", "demo")
        self.alpha_vantage_key = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")
        self.theme_keywords = {
            "monetary_policy": ["fed", "rate", "interest", "yield", "inflation", "central bank"],
            "energy": ["oil", "crude", "gas", "energy", "opec", "refinery"],
            "technology": ["ai", "chip", "semiconductor", "cloud", "software", "data center"],
            "consumer": ["retail", "consumer", "spending", "ecommerce", "sales"],
            "geopolitics": ["war", "tariff", "sanction", "conflict", "supply chain", "election"],
            "financials": ["bank", "credit", "loan", "liquidity", "default"],
        }

        self.theme_direction = {
            "monetary_policy": -0.2,
            "energy": 0.05,
            "technology": 0.18,
            "consumer": 0.08,
            "geopolitics": -0.12,
            "financials": -0.06,
        }
    
    def fetch_news(self, query: str = "stock market", days: int = 1) -> List[Dict]:
        """Fetch news from NewsAPI"""
        base_news = [
            {
                "title": "Tesla announces new AI chip development",
                "description": "Tesla is working on advanced AI chips for autonomous driving",
                "publishedAt": (datetime.now() - timedelta(hours=2)).isoformat()
            },
            {
                "title": "Oil prices surge amid market volatility",
                "description": "Crude oil prices increased by 3% following supply concerns",
                "publishedAt": (datetime.now() - timedelta(hours=4)).isoformat()
            },
            {
                "title": "Federal Reserve signals interest rate stability",
                "description": "Fed officials indicate no immediate rate changes",
                "publishedAt": (datetime.now() - timedelta(hours=6)).isoformat()
            },
            {
                "title": "Asian manufacturing activity stabilizes as supply chains improve",
                "description": "Regional factory surveys show modest recovery in electronics and export demand",
                "publishedAt": (datetime.now() - timedelta(hours=8)).isoformat()
            },
            {
                "title": "European banks tighten lending standards amid growth concerns",
                "description": "Credit conditions remain selective as investors monitor recession risks",
                "publishedAt": (datetime.now() - timedelta(hours=10)).isoformat()
            },
            {
                "title": "US retail sales remain resilient despite uneven consumer sentiment",
                "description": "Spending trends suggest selective strength in discretionary categories",
                "publishedAt": (datetime.now() - timedelta(hours=12)).isoformat()
            },
        ]
        query_terms = {term for term in self.clean_text(query).split() if len(term) > 2}
        if not query_terms:
            return base_news

        ranked = []
        for article in base_news:
            haystack = self.clean_text(f"{article.get('title', '')} {article.get('description', '')}")
            matches = sum(1 for term in query_terms if term in haystack)
            ranked.append((matches, article))

        ranked.sort(key=lambda item: item[0], reverse=True)
        prioritized = [article for score, article in ranked if score > 0]
        return prioritized or base_news
    
    def clean_text(self, text: str) -> str:
        """Clean and preprocess text"""
        if not text:
            return ""
        
        # Remove URLs, mentions, hashtags
        text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
        text = re.sub(r'@\w+|#\w+', '', text)
        
        # Remove special characters and extra whitespace
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text.lower()
    
    def analyze_sentiment(self, text: str) -> Dict:
        """Keyword-based deterministic sentiment analysis."""
        positive_words = ['increase', 'rise', 'growth', 'profit', 'bullish', 'positive', 'announces', 'new', 'development']
        negative_words = ['decrease', 'fall', 'loss', 'bearish', 'negative', 'decline', 'crash', 'volatility']

        text_lower = text.lower()
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        total_hits = positive_count + negative_count

        if positive_count > negative_count:
            sentiment = 'positive'
            confidence = min(0.9, 0.55 + (positive_count - negative_count) * 0.1 + total_hits * 0.03)
        elif negative_count > positive_count:
            sentiment = 'negative'
            confidence = min(0.9, 0.55 + (negative_count - positive_count) * 0.1 + total_hits * 0.03)
        else:
            sentiment = 'neutral'
            confidence = 0.5 + min(total_hits, 3) * 0.03

        return {
            'sentiment': sentiment,
            'confidence': round(confidence, 2)
        }

    def extract_market_themes(self, news: List[Dict]) -> List[Dict]:
        theme_scores = {theme: 0.0 for theme in self.theme_keywords}

        for article in news:
            text = self.clean_text(f"{article.get('title', '')} {article.get('description', '')}")
            for theme, keywords in self.theme_keywords.items():
                hits = sum(1 for keyword in keywords if keyword in text)
                if hits:
                    theme_scores[theme] += hits * self.theme_direction[theme]

        themes = []
        for theme, score in theme_scores.items():
            if score == 0:
                continue
            themes.append({
                "theme": theme,
                "impact_score": round(score, 3),
                "direction": "tailwind" if score > 0 else "headwind",
                "strength": min(1.0, round(abs(score), 3)),
            })

        themes.sort(key=lambda item: abs(item["impact_score"]), reverse=True)
        return themes
    
    def predict_stock_movement(self, symbol: str) -> Dict:
        """Predict stock movement based on recent news"""
        # Fetch recent news
        news = self.fetch_news(f"{symbol} stock", days=1)
        
        if not news:
            return {
                'symbol': symbol,
                'sentiment': 'neutral',
                'probability_up': 0.5,
                'error': 'No recent news found'
            }
        
        # Analyze sentiment from recent news
        sentiments = []
        for article in news[:5]:  # Analyze top 5 articles
            title = self.clean_text(article.get('title', ''))
            description = self.clean_text(article.get('description', ''))
            content = f"{title} {description}"
            
            sentiment_result = self.analyze_sentiment(content)
            sentiments.append(sentiment_result)
        
        # Aggregate sentiment
        positive_count = sum(1 for s in sentiments if s['sentiment'] == 'positive')
        negative_count = sum(1 for s in sentiments if s['sentiment'] == 'negative')
        
        if positive_count > negative_count:
            overall_sentiment = 'positive'
        elif negative_count > positive_count:
            overall_sentiment = 'negative'
        else:
            overall_sentiment = 'neutral'

        # Generate probability based on sentiment
        if overall_sentiment == 'positive':
            probability_up = 0.58 + min(positive_count - negative_count, 3) * 0.08
        elif overall_sentiment == 'negative':
            probability_up = 0.42 - min(negative_count - positive_count, 3) * 0.08
        else:
            probability_up = 0.5

        themes = self.extract_market_themes(news)
        
        return {
            'symbol': symbol,
            'sentiment': overall_sentiment,
            'probability_up': round(max(0.05, min(0.95, probability_up)), 2),
            'themes': themes,
        }

    def summarize_news_sentiment(self, query: str, days: int = 3) -> Dict:
        news = self.fetch_news(query, days=days)
        if not news:
            return {
                "query": query,
                "overall_sentiment": "neutral",
                "confidence": 0.5,
                "article_count": 0,
                "bullish_count": 0,
                "bearish_count": 0,
                "neutral_count": 0,
                "bullish_headline": None,
                "bearish_headline": None,
                "themes": [],
                "timeline": [],
            }

        scored_articles = []
        bullish_count = 0
        bearish_count = 0
        neutral_count = 0
        confidence_total = 0.0

        for article in news:
            text = f"{article.get('title', '')} {article.get('description', '')}"
            sentiment = self.analyze_sentiment(self.clean_text(text))
            scored = {
                "title": article.get("title"),
                "description": article.get("description"),
                "publishedAt": article.get("publishedAt"),
                "sentiment": sentiment["sentiment"],
                "confidence": sentiment["confidence"],
            }
            scored_articles.append(scored)
            confidence_total += sentiment["confidence"]
            if sentiment["sentiment"] == "positive":
                bullish_count += 1
            elif sentiment["sentiment"] == "negative":
                bearish_count += 1
            else:
                neutral_count += 1

        if bullish_count > bearish_count:
            overall_sentiment = "bullish"
        elif bearish_count > bullish_count:
            overall_sentiment = "bearish"
        else:
            overall_sentiment = "neutral"

        bullish_headline = next((item for item in scored_articles if item["sentiment"] == "positive"), None)
        bearish_headline = next((item for item in scored_articles if item["sentiment"] == "negative"), None)

        timeline = []
        for item in scored_articles[:6]:
            timeline.append(
                {
                    "title": item["title"],
                    "sentiment": item["sentiment"],
                    "confidence": item["confidence"],
                    "publishedAt": item["publishedAt"],
                }
            )

        return {
            "query": query,
            "overall_sentiment": overall_sentiment,
            "confidence": round(confidence_total / max(len(scored_articles), 1), 2),
            "article_count": len(scored_articles),
            "bullish_count": bullish_count,
            "bearish_count": bearish_count,
            "neutral_count": neutral_count,
            "bullish_headline": bullish_headline,
            "bearish_headline": bearish_headline,
            "themes": self.extract_market_themes(news),
            "timeline": timeline,
        }

# Example usage
if __name__ == "__main__":
    predictor = NewsStockPredictor()
    
    # Example prediction
    result = predictor.predict_stock_movement("TSLA")
    print(result)
