import azure_config as config
from openai import AzureOpenAI
from langchain_openai import AzureOpenAIEmbeddings

def test_configurations():
    print("\nTesting Azure OpenAI Configurations:")
    print("-" * 40)
    
    # Check if environment variables are set
    print("1. Checking Environment Variables:")
    print(f"API Key exists: {bool(config.AZURE_OPENAI_API_KEY)}")
    print(f"Endpoint exists: {bool(config.AZURE_OPENAI_ENDPOINT)}")
    print(f"API Version: {config.AZURE_OPENAI_API_VERSION}")
    print(f"Chat Deployment: {config.AZURE_OPENAI_DEPLOYMENT_CHAT}")
    print(f"Embedding Deployment: {config.AZURE_OPENAI_DEPLOYMENT_EMBEDDING}")
    
    # Test Azure OpenAI Client
    print("\n2. Testing Azure OpenAI Client:")
    try:
        client = AzureOpenAI(
            api_key=config.AZURE_OPENAI_API_KEY,
            api_version=config.AZURE_OPENAI_API_VERSION,
            azure_endpoint=config.AZURE_OPENAI_ENDPOINT
        )
        print("✅ Azure OpenAI client created successfully")
        
        # Test a simple completion
        try:
            response = client.chat.completions.create(
                model=config.AZURE_OPENAI_DEPLOYMENT_CHAT,
                messages=[{"role": "user", "content": "Hello!"}],
                max_tokens=10
            )
            print("✅ Chat completion test successful")
        except Exception as e:
            print(f"❌ Chat completion test failed: {str(e)}")
            
    except Exception as e:
        print(f"❌ Failed to create Azure OpenAI client: {str(e)}")
    
    # Test Embeddings
    print("\n3. Testing Azure OpenAI Embeddings:")
    try:
        embeddings = AzureOpenAIEmbeddings(
            azure_endpoint=config.AZURE_OPENAI_ENDPOINT,
            deployment=config.AZURE_OPENAI_DEPLOYMENT_EMBEDDING,
            openai_api_key=config.AZURE_OPENAI_API_KEY,
            openai_api_version=config.AZURE_OPENAI_API_VERSION,
            chunk_size=1
        )
        # Test embedding generation
        try:
            result = embeddings.embed_query("Hello, world!")
            print(f"✅ Embedding generation successful (vector size: {len(result)})")
        except Exception as e:
            print(f"❌ Embedding generation failed: {str(e)}")
    except Exception as e:
        print(f"❌ Failed to create embeddings client: {str(e)}")

if __name__ == "__main__":
    test_configurations()