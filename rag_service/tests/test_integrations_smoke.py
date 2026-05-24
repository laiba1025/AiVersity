import os
import time
import json
import pytest
import requests

try:
    import websocket  # websocket-client
    HAS_WS = True
except Exception:
    HAS_WS = False

GATEWAY_BASE = os.getenv("GATEWAY_BASE", "http://localhost:3000")
RAG_BASE = os.getenv("RAG_BASE", "http://localhost:5001")


def test_azure_blob_sas_generation_optional_login():
    email = os.getenv("TEST_EMAIL")
    password = os.getenv("TEST_PASSWORD")
    sess = requests.Session()
    if email and password:
        r = sess.post(f"{GATEWAY_BASE}/api/auth/login", json={"email": email, "password": password}, timeout=10)
        assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    # Attempt SAS generation with a sample filename
    payload = {"filename": os.getenv("TEST_FILENAME", "example.pdf"), "permissions": "r", "expiresInSeconds": 300}
    r = sess.post(f"{GATEWAY_BASE}/api/documents/sas", json=payload, timeout=10)
    # Either 200 (exists) or 404/400 depending on presence; assert schema when 200
    assert r.status_code in (200, 400, 404), f"unexpected status: {r.status_code}"
    if r.status_code == 200:
        ct = r.headers.get("Content-Type", "")
        if "application/json" in ct:
            data = r.json()
            assert "sasUrl" in data or "url" in data, "SAS response missing url"
            assert "expiresAt" in data or "expiry" in data, "SAS response missing expiry"
        else:
            # If non-JSON returned (e.g., HTML), just confirm status 200 for smoke
            assert len(r.text) > 0


@pytest.mark.skipif(not HAS_WS, reason="websocket-client not installed")
def test_websocket_notification_connect_and_auth():
    ws_url = GATEWAY_BASE.replace("http", "ws")
    if not ws_url.endswith("/"):
        ws_url += "/"
    ws_url += ""
    ws = websocket.create_connection(ws_url, timeout=10)
    try:
        # Send authenticate message (userId required)
        user_id = int(os.getenv("TEST_USER_ID", "1"))
        msg = {"type": "authenticate", "userId": user_id}
        ws.send(json.dumps(msg))
        # We expect either no error or a simple ack; allow a short wait
        ws.settimeout(2)
        try:
            _ = ws.recv()
        except Exception:
            # No message is acceptable in smoke test
            pass
    finally:
        ws.close()


@pytest.mark.skipif(not HAS_WS, reason="websocket-client not installed")
def test_websocket_document_uploaded_event():
    """Connect WS, authenticate, then upload a small file and expect a DOCUMENT_UPLOADED event."""
    email = os.getenv("TEST_EMAIL")
    password = os.getenv("TEST_PASSWORD")
    if not (email and password):
        pytest.skip("TEST_EMAIL/TEST_PASSWORD not provided")

    # Login to get cookie
    sess = requests.Session()
    r = sess.post(f"{GATEWAY_BASE}/api/auth/login", json={"email": email, "password": password}, timeout=10)
    assert r.status_code == 200, f"login failed: {r.status_code}"

    # Open WebSocket and authenticate
    ws_url = GATEWAY_BASE.replace("http", "ws")
    if not ws_url.endswith("/"):
        ws_url += "/"
    ws = websocket.create_connection(ws_url, timeout=10)
    try:
        # Send authenticate message (use userId from profile or env fallback)
        user_id_env = os.getenv("TEST_USER_ID")
        if user_id_env:
            user_id = int(user_id_env)
        else:
            prof = sess.get(f"{GATEWAY_BASE}/api/user", timeout=10)
            assert prof.status_code == 200, "failed to fetch user profile"
            user_id = prof.json().get("id") or 1
        ws.send(json.dumps({"type": "authenticate", "userId": user_id}))

        # Upload a tiny file
        files = {"file": ("passport.pdf", b"stub-bytes", "application/pdf")}
        up = sess.post(f"{GATEWAY_BASE}/api/documents/upload", files=files, timeout=20)
        assert up.status_code in (200, 201), f"upload failed: {up.status_code} {up.text}"

        # Expect a DOCUMENT_UPLOADED broadcast shortly
        ws.settimeout(5)
        received = False
        for _ in range(3):
            try:
                msg = ws.recv()
                data = json.loads(msg)
                if isinstance(data, dict) and data.get("type") == "DOCUMENT_UPLOADED":
                    received = True
                    break
            except Exception:
                time.sleep(1)
        assert received, "Did not receive DOCUMENT_UPLOADED notification"
    finally:
        ws.close()


def test_rag_search_topk_vs_mmr():
    # Current implementation may expose GET /search with query params
    r = requests.get(f"{RAG_BASE}/search", params={"q": "graduation requirements", "k": 3}, timeout=10)
    assert r.status_code in (200, 404), f"search unexpected: {r.status_code} {r.text}"
    if r.status_code == 200:
        ct = r.headers.get("Content-Type", "")
        if "application/json" in ct:
            data = r.json()
            assert isinstance(data, dict), "search payload not dict"
            assert "results" in data or len(data.keys()) > 0
        else:
            assert len(r.text) > 0
    # Try a hypothetical MMR-style param; should be gracefully handled or ignored
    r2 = requests.get(f"{RAG_BASE}/search", params={"q": "graduation requirements", "k": 12, "search_type": "mmr", "lambda_mult": 0.5}, timeout=10)
    assert r2.status_code in (200, 404), f"MMR search unexpected: {r2.status_code}"
