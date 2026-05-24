import os
import requests
import pytest

BASE_URL = os.getenv("RAG_BASE_URL", "http://localhost:5001")


def _service_up() -> bool:
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


@pytest.mark.skipif(not _service_up(), reason="RAG service not running on BASE_URL")
def test_query_schema():
    payload = {"question": "Graduation requirements?", "chat_history": []}
    r = requests.post(f"{BASE_URL}/query", json=payload, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("answer"), str)
    assert isinstance(data.get("sources"), list)


@pytest.mark.skipif(not _service_up(), reason="RAG service not running on BASE_URL")
def test_search_endpoint_contract():
    q = "graduation requirements"
    r = requests.get(f"{BASE_URL}/search", params={"q": q, "top_k": 5}, timeout=10)
    assert r.status_code in (200, 404)
    if r.headers.get("Content-Type", "").startswith("application/json"):
        data = r.json()
        assert isinstance(data.get("results", []), list)
