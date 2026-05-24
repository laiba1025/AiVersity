import requests
import json

def test_chat():
    print("\nTesting Chat Endpoint:")
    print("-" * 40)
    
    url = "http://localhost:5001/query"
    headers = {"Content-Type": "application/json"}
    
    # Test case 1: Simple question
    print("\n1. Testing simple question:")
    payload = {
        "question": "What is BME?",
        "chat_history": []
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Response:", json.dumps(response.json(), indent=2))
        else:
            print("Error:", response.text)
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Could not connect to the server. Is it running on port 5001?")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    
    # Test case 2: Follow-up question
    print("\n2. Testing with chat history:")
    payload = {
        "question": "Tell me more about the admission requirements",
        "chat_history": [
            ["What is BME?", "BME stands for Biomedical Engineering."]
        ]
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Response:", json.dumps(response.json(), indent=2))
        else:
            print("Error:", response.text)
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Could not connect to the server. Is it running on port 5001?")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_chat()