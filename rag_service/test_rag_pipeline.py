#!/usr/bin/env python3
"""Direct test of RAG pipeline to debug what's happening."""

import sys
from langchain_community.vectorstores import FAISS
from langchain_openai import AzureOpenAIEmbeddings
from openai import AzureOpenAI
import azure_config as config

def test_rag_pipeline():
    print("=" * 70)
    print("TESTING RAG PIPELINE END-TO-END")
    print("=" * 70)
    
    # Step 1: Load vectorstore
    print("\n1️⃣  Loading vectorstore...")
    try:
        embeddings = AzureOpenAIEmbeddings(
            azure_endpoint=config.AZURE_OPENAI_ENDPOINT,
            deployment=config.AZURE_OPENAI_DEPLOYMENT_EMBEDDING,
            openai_api_key=config.AZURE_OPENAI_API_KEY,
            openai_api_version=config.AZURE_OPENAI_API_VERSION,
            chunk_size=1,
            max_retries=3
        )
        vectorstore = FAISS.load_local("vectorstore", embeddings, allow_dangerous_deserialization=True)
        print(f"✅ Vectorstore loaded with {vectorstore.index.ntotal} vectors")
    except Exception as e:
        print(f"❌ Failed to load vectorstore: {e}")
        return False
    
    # Step 2: Test retriever
    print("\n2️⃣  Testing retriever...")
    retriever = vectorstore.as_retriever(search_kwargs={"k": 8})
    
    test_queries = [
        "When is the dormitory application opening?",
        "When is the thesis deadline?",
        "What is the consultant contact details?",
        "Where is the international coordinator office?",
        "What documents are needed for visa renewal?"
    ]
    
    for query in test_queries:
        print(f"\n   Query: '{query}'")
        docs = retriever.invoke(query)
        print(f"   Retrieved {len(docs)} documents:")
        for i, doc in enumerate(docs, 1):
            content = doc.page_content[:100].replace('\n', ' ')
            print(f"      [{i}] {content}...")
    
    # Step 3: Test with Azure OpenAI
    print("\n\n3️⃣  Testing Azure OpenAI Chat Completion...")
    
    client = AzureOpenAI(
        api_key=config.AZURE_OPENAI_API_KEY,
        api_version=config.AZURE_OPENAI_API_VERSION,
        azure_endpoint=config.AZURE_OPENAI_ENDPOINT,
    )
    
    query = "When is the dormitory application opening?"
    print(f"\n   Query: '{query}'")
    
    docs = retriever.invoke(query)
    context = "\n".join(doc.page_content for doc in docs)
    print(f"\n   Context (first 500 chars):\n{context[:500]}...")
    
    system_prompt = """You are a precise university assistant. Use ONLY the following context to answer.
- Be specific and include exact details when available: building, floor, room number, office hours, email, phone, deadlines, required documents.
- When listing multiple items (documents, courses, offices, steps), use bullet points with '- ' and put one fact per bullet.
- Keep answers compact and avoid filler text.
- If the context does not contain the answer, say you don't know."""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}\n\nAnswer:"}
    ]
    
    try:
        response = client.chat.completions.create(
            model=config.AZURE_OPENAI_DEPLOYMENT_CHAT,
            messages=messages,
            temperature=0.2,
            max_tokens=800
        )
        answer = response.choices[0].message.content
        print(f"\n   ✅ Azure Response:\n{answer}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 70)
    print("✅ RAG PIPELINE TEST COMPLETE")
    print("=" * 70)
    return True

if __name__ == "__main__":
    success = test_rag_pipeline()
    sys.exit(0 if success else 1)
