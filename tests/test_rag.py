import sys
from pathlib import Path
from uuid import UUID

# Add backend directory to path (tests/ is a sibling of backend/, so go up two parents)
sys.path.append(str(Path(__file__).parent.parent / "backend"))

from app.db.session import SessionLocal
from app.ingestion.pipeline import ingest_video
from app.rag.chain import run_rag_chain

def test_pipeline():
    db = SessionLocal()
    try:
        # 1. Provide a real YouTube URL you want to test with
        test_url = "https://www.youtube.com/watch?v=EUU7_nXTVsg"  # Replace with a valid YouTube URL
        print(f"-> Ingesting video: {test_url}")
        
        # Run ingestion (returns video object and a boolean)
        video_obj, already_exists = ingest_video(db, test_url)
        print(f"-> Video successfully ingested! Video ID UUID: {video_obj.id}")
        
        # 2. Test the RAG chain
        sample_query = "What is the main topic discussed in this video?"
        print(f"-> Running RAG chain with query: '{sample_query}'")
        
        result = run_rag_chain(db, video_obj.id, sample_query)
        
        print("\n================ RAG RESULTS ================")
        print(f"Answer:\n{result['answer']}\n")
        print(f"Citations:\n{result['citations']}")
        print("=============================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_pipeline()