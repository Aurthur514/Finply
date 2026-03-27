from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import uvicorn
from routers.stock import router as stock_router
from routers.trading import router as trading_router
from routers.prediction import router as prediction_router
from routers.news import router as news_router
from routers.risk import router as risk_router
from routers.assistant import router as assistant_router
from routers.research import router as research_router

app = FastAPI(title="Sentinel AI Financial Sandbox", version="1.0.0")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development and tunneling
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include routers
app.include_router(stock_router)
app.include_router(trading_router)
app.include_router(prediction_router)
app.include_router(news_router)
app.include_router(risk_router)
app.include_router(assistant_router)
app.include_router(research_router)

@app.get("/")
async def root():
    return {"message": "Welcome to Sentinel AI Financial Sandbox"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
