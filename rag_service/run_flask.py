#!/usr/bin/env python3
"""
Simple Flask startup script that runs directly (no PowerShell wrapping issues).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import app, processor

if __name__ == "__main__":
    print("\n✅ Flask app ready. Running on http://127.0.0.1:5001\n")
    app.run(host="0.0.0.0", port=5001, debug=False, use_reloader=False)
