#!/usr/bin/env python3
"""
Database initialization script for Sentinel AI Financial Sandbox
Supports both local SQLite and Supabase PostgreSQL databases
"""

import os
from models import Base, engine

def init_database():
    """Initialize database tables"""
    try:
        print("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ Database initialized successfully!")

        # Check database type
        db_url = os.getenv("DATABASE_URL", "sqlite:///./sentinel.db")
        if "supabase" in db_url.lower():
            print("📦 Using Supabase PostgreSQL database")
        else:
            print("💾 Using local SQLite database")

    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        return False

    return True

if __name__ == "__main__":
    init_database()