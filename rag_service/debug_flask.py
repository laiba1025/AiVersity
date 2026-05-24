#!/usr/bin/env python3
"""Debug Flask endpoint to see what's being sent/received."""

import requests
import json

FLASK_URL = "http://localhost:5001/query"

query = "When is the dormitory application opening?"

print("=" * 70)
print("DEBUGGING FLASK ENDPOINT")
print("=" * 70)
print(f"\nQuery: {query}")
print(f"URL: {FLASK_URL}")

payload = {
    "question": query,
    "chat_history": []
}

print(f"\nPayload: {json.dumps(payload, indent=2)}")

try:
    response = requests.post(FLASK_URL, json=payload, timeout=20)
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    print(f"\nResponse Body:")
    data = response.json()
    print(json.dumps(data, indent=2))
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
