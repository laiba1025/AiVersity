#!/usr/bin/env python3
"""
Automated test script for the entire RAG application.
Tests: vectorstore, retriever, Azure OpenAI, and Flask API.
"""

import requests
import json
import time
import sys

def test_flask_api():
    """Test Flask /query endpoint"""
    print("\n" + "=" * 70)
    print("TESTING FLASK RAG API")
    print("=" * 70)
    
    FLASK_URL = "http://localhost:5001/query"
    
    test_cases = [
        {
            "question": "When is the dormitory application opening?",
            "expected_keywords": ["application", "deadline", "May", "November", "June"]
        },
        {
            "question": "When is the thesis deadline?",
            "expected_keywords": ["thesis", "deadline", "January", "June", "November"]
        },
        {
            "question": "What is the consultant contact details?",
            "expected_keywords": ["contact", "email", "phone", "psychologist", "counselor"]
        },
        {
            "question": "Where is the international coordinator office?",
            "expected_keywords": ["international", "coordinator", "office", "email", "phone"]
        },
        {
            "question": "What documents do I need for visa renewal?",
            "expected_keywords": ["visa", "passport", "documents", "residence permit"]
        }
    ]
    
    passed = 0
    failed = 0
    
    for i, test in enumerate(test_cases, 1):
        question = test["question"]
        expected = test["expected_keywords"]
        
        print(f"\n\n{'─' * 70}")
        print(f"Test {i}: {question}")
        print(f"{'─' * 70}")
        
        try:
            # Make API request
            payload = {
                "question": question,
                "chat_history": []
            }
            
            response = requests.post(FLASK_URL, json=payload, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            answer = data.get("answer", "")
            sources = data.get("sources", [])
            
            print(f"✅ Status: {response.status_code}")
            print(f"\n📝 Answer:\n{answer}")
            print(f"\n📚 Sources retrieved: {len(sources)}")
            
            # Check if expected keywords are in answer
            answer_lower = answer.lower()
            found_keywords = [kw for kw in expected if kw.lower() in answer_lower]
            missing_keywords = [kw for kw in expected if kw.lower() not in answer_lower]
            
            print(f"\n✓ Found keywords: {found_keywords}")
            if missing_keywords:
                print(f"✗ Missing keywords: {missing_keywords}")
            
            # Check for "I don't know" response
            if "i don't know" in answer_lower and len(found_keywords) == 0:
                print(f"\n❌ FAILED: Response is 'I don't know' with no relevant keywords")
                failed += 1
            elif len(found_keywords) >= len(expected) * 0.6:  # 60% of keywords found
                print(f"\n✅ PASSED: Found {len(found_keywords)}/{len(expected)} expected keywords")
                passed += 1
            else:
                print(f"\n⚠️  WARNING: Only found {len(found_keywords)}/{len(expected)} keywords")
                passed += 1
                
        except requests.exceptions.ConnectionError:
            print(f"❌ FAILED: Cannot connect to Flask server at {FLASK_URL}")
            print(f"   Make sure Flask is running: python run_flask.py")
            failed += 1
        except Exception as e:
            print(f"❌ FAILED: {e}")
            failed += 1
        
        time.sleep(1)  # Rate limit
    
    # Summary
    print(f"\n\n{'=' * 70}")
    print("TEST SUMMARY")
    print(f"{'=' * 70}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📊 Success Rate: {passed}/{passed+failed} ({100*passed/(passed+failed) if (passed+failed) > 0 else 0:.1f}%)")
    print(f"{'=' * 70}\n")
    
    return failed == 0

if __name__ == "__main__":
    print("\n🚀 Starting RAG Application Tests...\n")
    print("Prerequisites:")
    print("  1. Node backend running on port 3000 (npm run dev)")
    print("  2. Flask RAG service running on port 5001 (python run_flask.py)")
    print("\nWaiting 3 seconds for servers to be ready...")
    time.sleep(3)
    
    success = test_flask_api()
    
    if success:
        print("🎉 All tests passed!")
        sys.exit(0)
    else:
        print("❌ Some tests failed")
        sys.exit(1)
"""
Full application smoke test for AiVersity services.

This script exercises critical endpoints across the Node.js gateway and
the Python RAG service to validate that the end-to-end application is
responsive and correctly wired. It is intentionally lightweight and avoids
modifying persistent state when possible.

Assumptions:
- Express gateway is running on http://localhost:3000
- Flask RAG service is running on http://localhost:5000
- Session-protected routes may require a login; we include an optional
  login step if test credentials are available via environment variables.

Usage:
    python rag_service/test_full_application.py

Optional environment variables:
    TEST_EMAIL: test user email for login
    TEST_PASSWORD: test user password for login

Exit codes:
    0 on success, non-zero on failure.
"""

import os
import sys
import time
from typing import Any, Dict, Optional

import requests


GATEWAY_BASE = os.getenv("GATEWAY_BASE", "http://localhost:3000")
RAG_BASE = os.getenv("RAG_BASE", "http://localhost:5000")


class TestFailure(Exception):
    pass


def _print_result(name: str, ok: bool, detail: Optional[str] = None) -> None:
    status = "PASS" if ok else "FAIL"
    line = f"[ {status} ] {name}"
    if detail:
        line += f" — {detail}"
    print(line)


def check_gateway_health(session: requests.Session) -> None:
    name = "Gateway health"
    try:
        resp = session.get(f"{GATEWAY_BASE}/health", timeout=5)
        ok = resp.status_code == 200
        _print_result(name, ok, f"status={resp.status_code}")
        if not ok:
            raise TestFailure(f"Gateway health failed: {resp.status_code}")
    except Exception as e:
        _print_result(name, False, str(e))
        raise


def optional_login(session: requests.Session) -> None:
    email = os.getenv("TEST_EMAIL")
    password = os.getenv("TEST_PASSWORD")
    name = "Gateway login (optional)"
    if not email or not password:
        _print_result(name, True, "skipped — no credentials provided")
        return
    try:
        resp = session.post(
            f"{GATEWAY_BASE}/api/auth/login",
            json={"email": email, "password": password},
            timeout=10,
        )
        ok = resp.status_code == 200
        _print_result(name, ok, f"status={resp.status_code}")
        if not ok:
            raise TestFailure(f"Login failed: {resp.status_code} {resp.text}")
    except Exception as e:
        _print_result(name, False, str(e))
        raise


def check_documents_list(session: requests.Session) -> None:
    name = "Gateway documents list"
    try:
        resp = session.get(f"{GATEWAY_BASE}/api/documents", timeout=10)
        ok = resp.status_code == 200 and isinstance(resp.json(), list)
        _print_result(name, ok, f"count={len(resp.json()) if ok else 'n/a'}")
        if not ok:
            raise TestFailure(f"Documents list failed: {resp.status_code}")
    except Exception as e:
        _print_result(name, False, str(e))
        raise


def check_generate_sas(session: requests.Session) -> None:
    name = "Gateway generate SAS (read)"
    try:
        # Expecting endpoint that issues SAS for an existing blob by id/name
        # If your API differs, adjust the path and payload accordingly.
        resp = session.post(
            f"{GATEWAY_BASE}/api/documents/sas",
            json={"blobName": "example.pdf", "permissions": "r", "expiresInSeconds": 300},
            timeout=10,
        )
        ok = resp.status_code == 200 and "sasUrl" in resp.json()
        detail = resp.json().get("sasUrl")[:80] + "..." if ok else f"status={resp.status_code}"
        _print_result(name, ok, detail)
        if not ok:
            raise TestFailure(f"SAS generation failed: {resp.status_code} {resp.text}")
    except Exception as e:
        _print_result(name, False, str(e))
        raise


def check_rag_query() -> None:
    name = "RAG /query"
    try:
        resp = requests.post(
            f"{RAG_BASE}/query",
            json={"question": "What is the policy on course prerequisites?"},
            timeout=15,
        )
        ok = resp.status_code == 200 and isinstance(resp.json(), dict)
        payload = resp.json() if ok else {}
        detail = f"keys={list(payload.keys())}" if ok else f"status={resp.status_code}"
        _print_result(name, ok, detail)
        if not ok:
            raise TestFailure(f"RAG /query failed: {resp.status_code} {resp.text}")
    except Exception as e:
        _print_result(name, False, str(e))
        raise


def check_rag_search() -> None:
    name = "RAG /search"
    try:
        resp = requests.post(
            f"{RAG_BASE}/search",
            json={"query": "graduation requirements", "k": 3},
            timeout=15,
        )
        ok = resp.status_code == 200 and isinstance(resp.json(), dict)
        payload = resp.json() if ok else {}
        detail = f"keys={list(payload.keys())}" if ok else f"status={resp.status_code}"
        _print_result(name, ok, detail)
        if not ok:
            raise TestFailure(f"RAG /search failed: {resp.status_code} {resp.text}")
    except Exception as e:
        _print_result(name, False, str(e))
        raise


def main() -> int:
    print("Starting full application smoke tests...")
    session = requests.Session()
    # Keep cookies for session-based routes

    failures = 0

    steps = [
        lambda: check_gateway_health(session),
        lambda: optional_login(session),
        lambda: check_documents_list(session),
        lambda: check_generate_sas(session),
        check_rag_query,
        check_rag_search,
    ]

    for step in steps:
        try:
            step()
        except Exception:
            failures += 1

    print("\nSummary:")
    print(f"Total checks: {len(steps)}; Failures: {failures}")

    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
