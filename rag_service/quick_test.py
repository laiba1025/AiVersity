#!/usr/bin/env python3
import requests
import json

def test_query():
    print("\n=== Testing SQL-Backed RAG ===\n")
    
    url = "http://127.0.0.1:5001/query"
    headers = {"Content-Type": "application/json"}
    
    payload = {
        "question": "What are the deadlines for MSc thesis?",
        "chat_history": []
    }
    
    try:
        print("Sending query to:", url)
        print("Question:", payload["question"])
        print("-" * 60)
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        print(f"Status Code: {response.status_code}\n")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ ANSWER:")
            print(result.get("answer", "No answer returned"))
            print("\n📚 SOURCES:")
            sources = result.get("sources", [])
            if sources:
                for i, source in enumerate(sources, 1):
                    print(f"  {i}. {source[:150]}...")
            else:
                print("  (No sources returned)")
        else:
            print("❌ Error Response:")
            print(response.text)
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Flask is not running on port 5001")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_query()
