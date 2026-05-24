import os
from openai import AzureOpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure Azure OpenAI client
client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_KEY"),
    api_version="2024-02-15-preview",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

deployment_chat = os.getenv("AZURE_OPENAI_DEPLOYMENT_CHAT")
deployment_embedding = os.getenv("AZURE_OPENAI_DEPLOYMENT_EMBEDDING")

def test_azure_ai_connection():
    try:
        # Test chat completion
        print("Testing chat completion...")
        chat_response = client.chat.completions.create(
            model=os.getenv("AZURE_OPENAI_DEPLOYMENT_CHAT"),
            messages=[{"role": "user", "content": "Hello, how are you?"}]
        )
        print(f"Chat Response: {chat_response.choices[0].message.content}\n")

        # Test embeddings
        print("Testing embeddings...")
        embedding_response = client.embeddings.create(
            model=os.getenv("AZURE_OPENAI_DEPLOYMENT_EMBEDDING"),
            input=["Hello, testing embeddings"]
        )
        print(f"Embedding vector length: {len(embedding_response.data[0].embedding)}\n")

        print("✅ All tests passed!")
        return True

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    test_azure_ai_connection()