import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables from .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL not found in environment variables or .env file.")
    exit(1)

print("Attempting to connect to Supabase...")

try:
    # Create the engine
    engine = create_engine(DATABASE_URL)
    
    # Establish a connection and run a simple query
    with engine.connect() as connection:
        # Test basic connection
        result = connection.execute(text("SELECT version();"))
        db_version = result.fetchone()[0]
        print("✅ SUCCESS: Connected to Supabase successfully!")
        print(f"PostgreSQL Version: {db_version}")
        
        # Optional: Check if the vector extension is installed
        vector_check = connection.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector';"))
        if vector_check.fetchone():
            print("✅ pgvector extension is enabled!")
        else:
            print("⚠️ WARNING: pgvector extension is NOT enabled yet. Run 'create extension if not exists vector;' in your Supabase SQL Editor.")

except Exception as e:
    print("❌ CONNECTION FAILED:")
    print(e)