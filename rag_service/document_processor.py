import os
import hashlib
import time
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from langchain_openai import AzureOpenAIEmbeddings  # Updated import
from openai import AzureOpenAI
import azure_config as config
import requests

class DocumentProcessor:
    def __init__(self, model_choice: str):
        print("Initializing DocumentProcessor...")
        self.model_choice = model_choice
        
        print("Checking Azure OpenAI configuration...")
        print(f"API Key exists: {bool(config.AZURE_OPENAI_API_KEY)}")
        print(f"Endpoint: {config.AZURE_OPENAI_ENDPOINT}")
        print(f"API Version: {config.AZURE_OPENAI_API_VERSION}")
        print(f"Deployment (Embedding): {config.AZURE_OPENAI_DEPLOYMENT_EMBEDDING}")
        
        # Initialize Azure OpenAI client
        print("Initializing Azure OpenAI client...")
        self.client = AzureOpenAI(
            api_key=config.AZURE_OPENAI_API_KEY,
            api_version=config.AZURE_OPENAI_API_VERSION,
            azure_endpoint=config.AZURE_OPENAI_ENDPOINT
        )
        print("Azure OpenAI client initialized successfully")
        
        # Initialize embeddings
        print("Initializing AzureOpenAIEmbeddings...")
        self.embeddings = AzureOpenAIEmbeddings(
            azure_endpoint=config.AZURE_OPENAI_ENDPOINT,
            deployment=config.AZURE_OPENAI_DEPLOYMENT_EMBEDDING,
            openai_api_key=config.AZURE_OPENAI_API_KEY,
            openai_api_version=config.AZURE_OPENAI_API_VERSION,
            chunk_size=1,
            max_retries=3
        )
        print("AzureOpenAIEmbeddings initialized successfully")
        self.vectorstore_path = "vectorstore"

    def _compute_file_hash(self, path):
        """Create a hash fingerprint of a file for change tracking."""
        with open(path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()

    def process_documents(self, pdf_paths):
        """
        Legacy method kept for backward-compatibility (PDF-based). Prefer process_documents_from_api.
        """
        print("\nStarting document processing (legacy PDF mode)...")
        if self._vectorstore_exists():
            print("📦 Loading existing vectorstore...")
            return FAISS.load_local(self.vectorstore_path, self.embeddings, allow_dangerous_deserialization=True)

        # No-op if no PDFs provided
        if not pdf_paths:
            print("No PDF paths provided; returning None.")
            return None

        from langchain_community.document_loaders import PyPDFLoader  # lazy import
        print("🧠 Building new vectorstore from PDFs...")
        docs = []
        for path in pdf_paths:
            loader = PyPDFLoader(path)
            docs.extend(loader.load())

        if not docs:
            return None

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=config.CHUNK_SIZE,
            chunk_overlap=config.CHUNK_OVERLAP
        )
        chunks = splitter.split_documents(docs)
        vectorstore = FAISS.from_documents(chunks, self.embeddings)
        vectorstore.save_local(self.vectorstore_path)
        return vectorstore

    def process_documents_from_api(self, api_url: str, batch_size: int = 1000):
        """
        Build/Load vectorstore from corpus chunks served by the Node API, which reads Azure SQL.
        This fulfills: RAG model trained on data stored in Azure SQL.
        """
        print("\nStarting document processing (SQL-backed via API)...")
        print(f"Corpus API: {api_url}")

        if self._vectorstore_exists():
            print("📦 Loading existing vectorstore...")
            return FAISS.load_local(self.vectorstore_path, self.embeddings, allow_dangerous_deserialization=True)

        # Fetch chunks in pages
        all_docs = []
        after_id = 0
        total = 0
        while True:
            try:
                resp = requests.get(api_url, params={"limit": batch_size, "afterId": after_id}, timeout=60)
                resp.raise_for_status()
                data = resp.json()
                chunks = data.get("chunks", [])
                if not chunks:
                    break
                for ch in chunks:
                    text = (ch.get("text") or "").strip()
                    if not text:
                        continue
                    meta = {
                        "documentId": ch.get("documentId"),
                        "chunkIndex": ch.get("chunkIndex"),
                        "sourcePage": ch.get("sourcePage"),
                        "title": ch.get("title"),
                        "sourceUri": ch.get("sourceUri"),
                    }
                    all_docs.append(Document(page_content=text, metadata=meta))
                    after_id = max(after_id, int(ch.get("id", after_id)))
                total += len(chunks)
                print(f"Fetched {len(chunks)} chunk(s), total so far: {total}")
                if len(chunks) < batch_size:
                    break
            except Exception as e:
                print(f"Error fetching corpus chunks: {e}")
                break

        if not all_docs:
            print("No corpus chunks fetched; returning None.")
            return None

        print(f"Building FAISS from {len(all_docs)} chunk(s)...")
        # Build the vectorstore incrementally in small batches to be resilient to transient API/network issues
        batch = 64
        vectorstore = None
        for i in range(0, len(all_docs), batch):
            subdocs = all_docs[i:i+batch]
            # Retry a few times for each batch
            for attempt in range(1, 5):
                try:
                    if vectorstore is None:
                        vectorstore = FAISS.from_documents(subdocs, self.embeddings)
                    else:
                        vectorstore.add_documents(subdocs)
                    break
                except Exception as e:
                    wait = min(30, 2 ** attempt)
                    print(f"Embedding batch {i//batch+1} failed (attempt {attempt}): {e}. Retrying in {wait}s...")
                    time.sleep(wait)
            else:
                # If all retries failed for this batch, raise so we don't silently continue with missing data
                raise
        vectorstore.save_local(self.vectorstore_path)
        return vectorstore

    async def get_completion(self, messages, temperature=None):
        """Get a chat completion from Azure OpenAI."""
        try:
            response = self.client.chat.completions.create(
                model=config.AZURE_OPENAI_DEPLOYMENT_CHAT,
                messages=messages,
                temperature=temperature or config.TEMPERATURE,
                max_tokens=config.MAX_TOKENS
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error getting completion: {str(e)}")
            return None

    def _vectorstore_exists(self):
        return os.path.exists(os.path.join(self.vectorstore_path, "index.faiss")) and \
               os.path.exists(os.path.join(self.vectorstore_path, "index.pkl"))
