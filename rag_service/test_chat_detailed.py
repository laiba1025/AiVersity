import requests
import json

def test_chat():
    print("\nTesting Chat Functionality:")
    print("-" * 40)
    
    url = "http://127.0.0.1:5001/query"
    headers = {"Content-Type": "application/json"}
    
    test_questions = [
        "Where is the International Office located?",
        "What documents do I need for visa renewal?",
        "What are the study programs available?",
        "Hello, can you help me with information about deadlines?"
    ]
    
    for question in test_questions:
        print(f"\nTesting Question: {question}")
        payload = {
            "question": question,
            "chat_history": []
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload)
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print("\nResponse:")
                print("-" * 20)
                print("Answer:", result.get("answer", "No answer provided"))
                print("\nSources:")
                print("-" * 20)
                for source in result.get("sources", []):
                    print(f"- {source[:150]}...")
            else:
                print("Error Response:", response.text)
        except requests.exceptions.ConnectionError:
            print("❌ Connection Error: Could not connect to the server. Is it running on port 5001?")
        except Exception as e:
            print(f"❌ Error: {str(e)}")
        
        print("\n" + "="*50)

if __name__ == "__main__":
    test_chat()