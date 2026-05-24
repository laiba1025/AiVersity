import requests

url = "http://127.0.0.1:5001/query"

def run(q: str):
    r = requests.post(url, json={"question": q, "chat_history": []}, timeout=60)
    print("Status:", r.status_code)
    try:
        print(r.json())
    except Exception:
        print(r.text)

if __name__ == "__main__":
    for q in ["hello", "what is the SH deadline?", "where is the campus library?"]:
        print("\nQ:", q)
        run(q)
