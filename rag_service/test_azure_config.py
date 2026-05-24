import azure_config as config
from openai import AzureOpenAI

def test_azure_config():
    print("Testing Azure OpenAI Configuration...")
    print(f"API Key exists: {bool(config.AZURE_OPENAI_API_KEY)}")
    print(f"Endpoint: {config.AZURE_OPENAI_ENDPOINT}")
    print(f"Chat Deployment: {config.AZURE_OPENAI_DEPLOYMENT_CHAT}")
    print(f"API Version: {config.AZURE_OPENAI_API_VERSION}")
    
    try:
        # Initialize Azure OpenAI client
        print("\nTesting Azure OpenAI connection...")
        client = AzureOpenAI(
            api_key=config.AZURE_OPENAI_API_KEY,
            api_version=config.AZURE_OPENAI_API_VERSION,
            azure_endpoint=config.AZURE_OPENAI_ENDPOINT
        )
        
        # Try a simple completion to test the connection
        response = client.chat.completions.create(
            model=config.AZURE_OPENAI_DEPLOYMENT_CHAT,
            messages=[
                {"role": "user", "content": "Hello, are you working?"}
            ]
        )
        print("✅ Connection test successful!")
        print(f"Response: {response.choices[0].message.content}")
        
    except Exception as e:
        print(f"❌ Error testing Azure OpenAI connection: {str(e)}")

if __name__ == "__main__":
    test_azure_config()