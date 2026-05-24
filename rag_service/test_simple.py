import requests
import json

def test_simple_query():
    print("\nTesting Simple Query:")
    print("-" * 40)
    
    url = "http://127.0.0.1:5001/query"
    headers = {"Content-Type": "application/json"}
    
    payload = {
        "question": "What are the deadlines for MSc?",
        "chat_history": []
    }
    
    try:
        print("Sending request to:", url)
        print("Payload:", json.dumps(payload, indent=2))
        response = requests.post(url, headers=headers, json=payload)
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("\nResponse:")
            print(json.dumps(result, indent=2))
        else:
            print("Error Response:", response.text)
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Could not connect to the server. Is it running on port 5001?")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_simple_query()