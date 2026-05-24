from flask import Flask, request, jsonify
from flask_cors import CORS
import os, sys

# Ensure we import modules from this rag_service directory, not a sibling copy
sys.path.insert(0, os.path.dirname(__file__))

app = Flask(__name__)
CORS(app)

# Attempt to start in "full" mode: load FAISS vectorstore and enable ChatManager.
# If dependencies or Azure config are missing, fall back to lightweight stub behavior.
vectorstore = None
chat_manager = None
try:
    from document_processor import DocumentProcessor
    from chat_manager import ChatManager
    print("[RAG] Initializing full mode (FAISS + ChatManager)...")
    processor = DocumentProcessor(model_choice="openai")
    print("[RAG] Loading vectorstore if present...")
    if processor._vectorstore_exists():
        from langchain_community.vectorstores import FAISS
        vectorstore = FAISS.load_local(processor.vectorstore_path, processor.embeddings, allow_dangerous_deserialization=True)
        print("[RAG] Vectorstore loaded.")
    else:
        print("[RAG] No vectorstore found; full retrieval will be unavailable.")
    chat_manager = ChatManager(vectorstore, model_choice="openai")
    print("[RAG] Full mode ready.")
except Exception as e:
    print(f"[RAG] Full mode initialization failed: {e}\n[Fallback] Starting lightweight stubs.")
    vectorstore = None
    chat_manager = None

@app.route("/query", methods=["POST"])
def query():
    data = request.json
    question = data.get("question", "")
    chat_history = data.get("chat_history", [])

    if not question:
        return jsonify({"error": "Question is required"}), 400
    # Full path
    if chat_manager is not None:
        try:
            answer, sources = chat_manager.get_response(question, chat_history)
            return jsonify({"answer": answer, "sources": sources})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    # Fallback stub
    return jsonify({"answer": "Stub answer: knowledge base disabled.", "sources": []})

@app.route("/search", methods=["GET"])
def search():
    q = request.args.get("q", "").strip()
    k = int(request.args.get("k", 5))
    if not q:
        return jsonify({"error": "Query is required"}), 400

    try:
        # Full retrieval
        if vectorstore is not None:
            results = []
            sims = vectorstore.similarity_search_with_score(q, k=k)
            for doc, score in sims:
                meta = doc.metadata or {}
                source = meta.get("source")
                page = meta.get("page")
                content = doc.page_content or ""
                snippet = content[:500] + ("..." if len(content) > 500 else "")
                results.append({
                    "snippet": snippet,
                    "source": source,
                    "page": page,
                    "score": float(score) if score is not None else None
                })
            return jsonify({"results": results})
        # Fallback stub: shape only
        return jsonify({"results": []})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True, use_reloader=False)
