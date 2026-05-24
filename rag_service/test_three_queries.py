#!/usr/bin/env python3
import requests
import json

URL = "http://127.0.0.1:5001/query"

queries = [
    "When is the dormitory application opening?",
    "When is the thesis deadline?",
    "Where is the international coordinator office?",
]

for q in queries:
    print("\n" + "-"*70)
    print("Q:", q)
    try:
        resp = requests.post(URL, json={"question": q, "chat_history": []}, timeout=60)
        print("Status:", resp.status_code)
        data = resp.json()
        print("Answer:\n", data.get("answer"))
        sources = data.get("sources", [])
        print("Sources:", len(sources))
        if sources:
            print("First source snippet:\n", sources[0][:300])
    except Exception as e:
        print("Error:", e)
