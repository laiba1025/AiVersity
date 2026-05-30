import os
from dotenv import load_dotenv

load_dotenv()

# Model configurations
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Vector store settings
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200   

# Model settings
TEMPERATURE = 0.7
MAX_TOKENS = 2000

# Available models
AVAILABLE_MODELS = {
    "ollama": "llama3.2",
    "openai": "gpt-3.5-turbo",
    "groq": "groq-3.5-turbo"
}

#  Default model choice
DEFAULT_MODEL = "openai"