#!/usr/bin/env python3
"""Quick test to verify vectorstore is working and retrieving documents."""

import sys
from pathlib import Path
from langchain_community.vectorstores import FAISS
from langchain_openai import AzureOpenAIEmbeddings
import azure_config as config

def test_vectorstore():
    print("=" * 60)
    print("TESTING VECTORSTORE")
    print("=" * 60)
    
    vectorstore_path = "vectorstore"
    
    # Step 1: Check files exist
    print("\n1️⃣  Checking vectorstore files...")
    import os
    if not os.path.exists(vectorstore_path):
        print(f"❌ Vectorstore path does not exist: {vectorstore_path}")
        return False
    
    index_file = os.path.join(vectorstore_path, "index.faiss")
    pkl_file = os.path.join(vectorstore_path, "index.pkl")
    
    if os.path.exists(index_file):
        size_mb = os.path.getsize(index_file) / 1024 / 1024
        print(f"✅ index.faiss exists: {size_mb:.2f} MB")
    else:
        print(f"❌ index.faiss not found")
        return False
    
    if os.path.exists(pkl_file):
        size_kb = os.path.getsize(pkl_file) / 1024
        print(f"✅ index.pkl exists: {size_kb:.2f} KB")
    else:
        print(f"❌ index.pkl not found")
        return False
    
    # Step 2: Load vectorstore
    print("\n2️⃣  Loading vectorstore...")
    try:
        embeddings = AzureOpenAIEmbeddings(
            azure_endpoint=config.AZURE_OPENAI_ENDPOINT,
            deployment=config.AZURE_OPENAI_DEPLOYMENT_EMBEDDING,
            openai_api_key=config.AZURE_OPENAI_API_KEY,
            openai_api_version=config.AZURE_OPENAI_API_VERSION,
            chunk_size=1,
            max_retries=3
        )
        print("✅ Embeddings initialized")
    except Exception as e:
        print(f"❌ Failed to init embeddings: {e}")
        return False
    
    try:
        vectorstore = FAISS.load_local(vectorstore_path, embeddings, allow_dangerous_deserialization=True)
        print("✅ Vectorstore loaded")
    except Exception as e:
        print(f"❌ Failed to load vectorstore: {e}")
        return False
    
    # Step 3: Get vectorstore info
    print("\n3️⃣  Vectorstore statistics...")
    try:
        # FAISS stores index stats internally
        if hasattr(vectorstore, 'index'):
            ntotal = vectorstore.index.ntotal
            print(f"✅ Total vectors in index: {ntotal}")
        else:
            print("⚠️  Cannot determine vector count")
    except Exception as e:
        print(f"⚠️  Error getting stats: {e}")
    
    # Step 4: Test similarity search
    print("\n4️⃣  Testing similarity search...")
    test_queries = [
        "Where is the international coordinator office?",
        "dormitory application deadline",
        "MSC coordinator",
        "thesis deadline",
        "visa renewal documents",
        "health services",
        "course registration"
    ]
    
    try:
        retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
        
        for query in test_queries:
            print(f"\n   📌 Query: '{query}'")
            results = retriever.invoke(query)
            
            if results:
                print(f"   ✅ Retrieved {len(results)} documents:")
                for i, doc in enumerate(results, 1):
                    content = doc.page_content[:150].replace('\n', ' ')
                    metadata = doc.metadata or {}
                    source = metadata.get('title', 'unknown')
                    print(f"      [{i}] Source: {source}")
                    print(f"          Content: {content}...")
            else:
                print(f"   ❌ No results found!")
    
    except Exception as e:
        print(f"❌ Error during search: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 60)
    print("✅ VECTORSTORE TEST COMPLETE")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = test_vectorstore()
    sys.exit(0 if success else 1)
