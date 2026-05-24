from document_processor import DocumentProcessor
from langchain_community.vectorstores import FAISS

def main():
    processor = DocumentProcessor(model_choice="openai")
    vs = FAISS.load_local('vectorstore', processor.embeddings, allow_dangerous_deserialization=True)
    query = 'international office'
    print(f"Searching for: {query}")
    results = vs.similarity_search_with_score(query, k=10)
    for i, (doc, score) in enumerate(results, start=1):
        print(f"\nResult {i}: score={score}")
        print(doc.metadata)
        print(doc.page_content[:400].replace('\n',' '))

if __name__ == '__main__':
    main()
