import enum
import os

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text, create_engine, inspect, text
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy.sql import func


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sentinel.db")

engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    # SQLite works more reliably for this local app without SQLAlchemy queue pooling.
    engine_kwargs["poolclass"] = NullPool

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class OrderType(str, enum.Enum):
    MARKET = "market"
    LIMIT = "limit"


class OrderSide(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    FILLED = "filled"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, default="Sentinel User")
    email = Column(String, unique=True, index=True, nullable=False)
    balance = Column(Float, nullable=False, default=100000.0)
    realized_pnl = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
    positions = relationship("Position", back_populates="user", cascade="all, delete-orphan")
    trades = relationship("Trade", back_populates="user", cascade="all, delete-orphan")
    watchlist = relationship("Watchlist", back_populates="user", cascade="all, delete-orphan")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String, nullable=False, index=True)
    side = Column(Enum(OrderSide), nullable=False)
    order_type = Column(Enum(OrderType), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)
    requested_price = Column(Float, nullable=False, default=0.0)
    executed_price = Column(Float, nullable=False, default=0.0)
    fees = Column(Float, nullable=False, default=0.0)
    slippage = Column(Float, nullable=False, default=0.0)
    status = Column(Enum(OrderStatus), nullable=False, default=OrderStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="orders")
    trades = relationship("Trade", back_populates="order", cascade="all, delete-orphan")


class Position(Base):
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String, nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    avg_price = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="positions")


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String, nullable=False, index=True)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    gross_total = Column(Float, nullable=False, default=0.0)
    net_total = Column(Float, nullable=False, default=0.0)
    fees = Column(Float, nullable=False, default=0.0)
    slippage = Column(Float, nullable=False, default=0.0)
    side = Column(Enum(OrderSide), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    order = relationship("Order", back_populates="trades")
    user = relationship("User", back_populates="trades")


class Watchlist(Base):
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="watchlist")


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, nullable=False, index=True)
    prediction_type = Column(String, nullable=False)
    signal = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    predicted_price = Column(Float, nullable=True)
    reasoning = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)


def init_db() -> None:
    inspector = inspect(engine)

    if "trades_legacy" in inspector.get_table_names():
        with engine.begin() as connection:
            connection.execute(text("DROP TABLE trades_legacy"))
        inspector = inspect(engine)

    if "users" in inspector.get_table_names():
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "realized_pnl" not in user_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE users ADD COLUMN realized_pnl FLOAT DEFAULT 0"))

    if "trades" in inspector.get_table_names():
        trade_columns = {column["name"] for column in inspector.get_columns("trades")}
        for column_name, default_value in {
            "gross_total": 0,
            "net_total": 0,
            "fees": 0,
            "slippage": 0,
        }.items():
            if column_name not in trade_columns:
                with engine.begin() as connection:
                    connection.execute(text(f"ALTER TABLE trades ADD COLUMN {column_name} FLOAT DEFAULT {default_value}"))

    if "orders" in inspector.get_table_names():
        order_columns = {column["name"] for column in inspector.get_columns("orders")}
        for column_name, default_value in {
            "requested_price": 0,
            "executed_price": 0,
            "fees": 0,
            "slippage": 0,
        }.items():
            if column_name not in order_columns:
                with engine.begin() as connection:
                    connection.execute(text(f"ALTER TABLE orders ADD COLUMN {column_name} FLOAT DEFAULT {default_value}"))

    Base.metadata.create_all(bind=engine)


init_db()
