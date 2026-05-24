"""
Create a FAISS vectorstore from server/storage-data.json entries (contacts, messages, locations, notifications)
so the RAG assistant can answer administrative questions (international office, visa FAQ, contacts).

Usage (PowerShell):
  .\rag_service\venv\Scripts\python.exe .\rag_service\ingest_storage_snapshot.py
"""
import json
import os
import shutil
from typing import List

from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS

from document_processor import DocumentProcessor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
STORAGE_JSON = os.path.join(ROOT, "server", "storage-data.json")
VECTORSTORE_DIR = os.path.join(ROOT, "rag_service", "vectorstore")


def load_snapshot():
    if not os.path.exists(STORAGE_JSON):
        print("storage-data.json not found; aborting.")
        return None
    with open(STORAGE_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


def docs_from_snapshot(snapshot: dict) -> List[Document]:
    docs: List[Document] = []

    # Build a quick lookup for locations by id to enrich contacts
    loc_map = {}
    for l in snapshot.get("locations", []) or []:
        lid = l.get("id")
        if lid is not None:
            loc_map[lid] = l

    # Messages: index both questions and answers explicitly (answers carry factual text)
    for m in snapshot.get("messages", []) or []:
        content = m.get("content") or m.get("text") or m.get("question") or ""
        if not content:
            continue
        is_user = bool(m.get("isUserMessage"))
        sources = m.get("sources") if isinstance(m.get("sources"), list) else []
        if is_user:
            text = f"User question: {content}"
        else:
            src_line = f"\nSources: {', '.join(sources)}" if sources else ""
            text = f"Answer: {content}{src_line}"
        docs.append(Document(page_content=text, metadata={"source": "storage:messages"}))

    # Contacts: include rich details (office, hours, email, phone, tags, and resolved location)
    for c in snapshot.get("contacts", []) or []:
        name = c.get("name") or c.get("fullName") or ""
        role = c.get("role") or ""
        dept = c.get("department") or ""
        email = c.get("email") or ""
        phone = c.get("phone") or ""
        office = c.get("office") or c.get("location") or ""
        hours = c.get("officeHours") or c.get("hours") or ""
        tags = ", ".join(c.get("tags") or [])
        # Resolve locationId to building / floor / room when present
        loc_id = c.get("locationId")
        loc_resolved = ""
        if loc_id in loc_map:
            l = loc_map[loc_id]
            b = l.get("building") or ""
            f = l.get("floor") or ""
            r = l.get("roomNumber") or ""
            loc_resolved = f"Building {b}, {f}{', Room ' + r if r else ''}"
        lines = [
            f"Name: {name}",
            f"Role: {role}",
            f"Department: {dept}",
            f"Office: {office}",
            f"Office hours: {hours}",
            f"Email: {email}",
            f"Phone: {phone}",
        ]
        if loc_resolved:
            lines.append(f"Location: {loc_resolved}")
        if tags:
            lines.append(f"Tags: {tags}")
        docs.append(Document(page_content="\n".join(lines), metadata={"source": "storage:contacts"}))

    # Locations: capture precise wayfinding details
    for l in snapshot.get("locations", []) or []:
        title = l.get("name") or l.get("title") or ""
        desc = l.get("description") or l.get("content") or l.get("details") or ""
        b = l.get("building") or ""
        f = l.get("floor") or ""
        r = l.get("roomNumber") or ""
        hours = l.get("hours") or ""
        lines = [title, desc]
        loc_line = f"Building {b}, {f}{', Room ' + r if r else ''}".strip().strip(',')
        if b or f or r:
            lines.append(loc_line)
        if hours:
            lines.append(f"Hours: {hours}")
        docs.append(Document(page_content="\n".join(lines), metadata={"source": "storage:locations"}))

    # Notifications/events that may contain deadlines
    for n in snapshot.get("notifications", []) or []:
        title = n.get("title") or ""
        desc = n.get("description") or n.get("content") or ""
        docs.append(Document(page_content=f"{title}\n{desc}", metadata={"source": "storage:notifications"}))

    # Generic: include any plain 'documents' or 'documents_corpus' slices
    for d in snapshot.get("documents", []) or []:
        title = d.get("title") or d.get("name") or "Document"
        content = d.get("content") or d.get("text") or ""
        docs.append(Document(page_content=f"{title}\n{content}", metadata={"source": "storage:documents"}))

    # If snapshot includes 'courses' it's fine but ingest_curriculum already handles courses
    return docs


def main():
    snapshot = load_snapshot()
    if snapshot is None:
        return

    docs = docs_from_snapshot(snapshot)
    print(f"Assembled {len(docs)} document(s) from snapshot.")
    if not docs:
        print("No documents extracted from snapshot; nothing to index.")
        return

    # Remove existing vectorstore (we will rebuild)
    if os.path.isdir(VECTORSTORE_DIR):
        print(f"Removing existing vectorstore at {VECTORSTORE_DIR}...")
        shutil.rmtree(VECTORSTORE_DIR, ignore_errors=True)
    os.makedirs(VECTORSTORE_DIR, exist_ok=True)

    # Initialize embeddings via DocumentProcessor (keeps same config as other ingests)
    print("Initializing DocumentProcessor to obtain embeddings...")
    processor = DocumentProcessor(model_choice="openai")
    print("Building FAISS index from snapshot documents...")
    vs = FAISS.from_documents(docs, processor.embeddings)
    vs.save_local(VECTORSTORE_DIR)
    print("Done. Saved FAISS index to:", VECTORSTORE_DIR)


if __name__ == "__main__":
    main()
