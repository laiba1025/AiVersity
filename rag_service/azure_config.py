import os
from dotenv import load_dotenv

load_dotenv()

# Azure OpenAI Settings
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_KEY")  # Updated env var name
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_DEPLOYMENT_CHAT = os.getenv("AZURE_OPENAI_DEPLOYMENT_CHAT", "aiversity-chat")
AZURE_OPENAI_DEPLOYMENT_EMBEDDING = os.getenv("AZURE_OPENAI_DEPLOYMENT_EMBEDDING", "aiversity-embed")  # Updated default name
AZURE_OPENAI_API_VERSION = "2024-02-15-preview"  # Added API version

# Vector store settings
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

# Model settings
TEMPERATURE = 0.2
MAX_TOKENS = 2000