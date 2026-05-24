#!/usr/bin/env python3
"""
Rebuild vectorstore from ALL document folders.
This script will:
1. Delete old vectorstore files
2. Collect ALL PDFs from documents/ subdirectories
3. Re-embed and create FAISS index
4. Persist to disk
"""

import os
import shutil
from pathlib import Path
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import AzureOpenAIEmbeddings
import azure_config as config

def rebuild_vectorstore():
    print("=" * 60)
    print("REBUILDING VECTORSTORE FROM ALL DOCUMENTS")
    print("=" * 60)
    
    # Step 1: Clean old vectorstore
    vectorstore_path = "vectorstore"
    if os.path.exists(vectorstore_path):
        print(f"🗑️  Removing old vectorstore at {vectorstore_path}...")
        shutil.rmtree(vectorstore_path)
    else:
        print(f"✅ No existing vectorstore found (clean start)")
    
    # Step 2: Collect all PDFs from documents/ folder
    print("\n📂 Scanning documents/ folder for PDFs...")
    pdf_paths = []
    documents_dir = Path("documents")
    
    if not documents_dir.exists():
        print("❌ ERROR: documents/ folder does not exist!")
        return False
    
    for pdf_file in documents_dir.rglob("*.pdf"):
        pdf_paths.append(str(pdf_file))
        print(f"   Found: {pdf_file}")
    
    if not pdf_paths:
        print("❌ ERROR: No PDFs found in documents/ folder!")
        return False
    
    print(f"\n✅ Found {len(pdf_paths)} PDFs to process")
    
    # Step 3: Initialize embeddings
    print("\n🔧 Initializing Azure OpenAI Embeddings...")
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
        print(f"❌ Failed to initialize embeddings: {e}")
        return False
    
    # Step 4: Load and chunk documents
    print("\n📄 Loading PDFs...")
    all_docs = []
    for pdf_path in pdf_paths:
        try:
            loader = PyPDFLoader(pdf_path)
            docs = loader.load()
            all_docs.extend(docs)
            print(f"   ✅ Loaded {len(docs)} pages from {os.path.basename(pdf_path)}")
        except Exception as e:
            print(f"   ⚠️  Failed to load {pdf_path}: {e}")
            continue
    
    if not all_docs:
        print("❌ ERROR: No documents loaded!")
        return False
    
    print(f"\n📊 Total pages loaded: {len(all_docs)}")
    
    # Step 5: Split documents into chunks
    print("\n✂️  Chunking documents...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    chunks = splitter.split_documents(all_docs)
    print(f"✅ Created {len(chunks)} chunks")
    
    # Step 6: Create vectorstore
    print("\n🧠 Creating FAISS vectorstore (this may take a while)...")
    print("   Embedding chunks...")
    
    try:
        # Create vectorstore in batches to handle large datasets
        batch_size = 50
        vectorstore = None
        
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i+batch_size]
            batch_num = i // batch_size + 1
            total_batches = (len(chunks) + batch_size - 1) // batch_size
            
            try:
                if vectorstore is None:
                    vectorstore = FAISS.from_documents(batch, embeddings)
                    print(f"   ✅ Batch {batch_num}/{total_batches} - Created vectorstore with {len(batch)} chunks")
                else:
                    vectorstore.add_documents(batch)
                    print(f"   ✅ Batch {batch_num}/{total_batches} - Added {len(batch)} chunks")
            except Exception as e:
                print(f"   ❌ Batch {batch_num} failed: {e}")
                raise
        
        if vectorstore is None:
            print("❌ ERROR: Vectorstore creation failed!")
            return False
        
        print(f"\n✅ Vectorstore created with {len(chunks)} chunks")
        
    except Exception as e:
        print(f"❌ Error creating vectorstore: {e}")
        return False
    
    # Step 7: Save vectorstore
    print(f"\n💾 Saving vectorstore to {vectorstore_path}...")
    try:
        vectorstore.save_local(vectorstore_path)
        print(f"✅ Vectorstore saved successfully")
    except Exception as e:
        print(f"❌ Error saving vectorstore: {e}")
        return False
    
    # Step 8: Verify
    print("\n🔍 Verifying vectorstore...")
    index_path = os.path.join(vectorstore_path, "index.faiss")
    pkl_path = os.path.join(vectorstore_path, "index.pkl")
    
    if os.path.exists(index_path) and os.path.exists(pkl_path):
        index_size = os.path.getsize(index_path) / 1024 / 1024  # MB
        pkl_size = os.path.getsize(pkl_path) / 1024 / 1024
        print(f"✅ Index files created:")
        print(f"   - index.faiss: {index_size:.2f} MB")
        print(f"   - index.pkl: {pkl_size:.2f} MB")
    else:
        print("❌ ERROR: Index files not created!")
        return False
    
    # Step 9: Test retrieval
    print("\n🧪 Testing retrieval with sample queries...")
    test_queries = [
        "Where is the international coordinator office?",
        "What documents do I need for visa renewal?",
        "Where is the dormitory?",
        "What are health services available?",
        "How do I register for courses?"
    ]
    
    try:
        loaded_store = FAISS.load_local(vectorstore_path, embeddings, allow_dangerous_deserialization=True)
        retriever = loaded_store.as_retriever(search_kwargs={"k": 3})
        
        for query in test_queries:
            results = retriever.invoke(query)
            print(f"\n   Query: '{query}'")
            if results:
                print(f"   ✅ Retrieved {len(results)} chunks:")
                for i, doc in enumerate(results, 1):
                    snippet = doc.page_content[:100].replace('\n', ' ')
                    print(f"      {i}. {snippet}...")
            else:
                print(f"   ⚠️  No results found")
    except Exception as e:
        print(f"❌ Error testing retrieval: {e}")
        return False
    
    print("\n" + "=" * 60)
    print("✅ VECTORSTORE REBUILD COMPLETE!")
    print("=" * 60)
    print("\nThe RAG system is ready to use. Restart the Flask server:")
    print("   python run_flask.py")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    success = rebuild_vectorstore()
    exit(0 if success else 1)
