"""
Rebuild the FAISS vectorstore from curriculum data.

Sources:
- server/storage-data.json (authoritative snapshot used by the Node API)
- server/data/curricula/cs_bsc.json (program-specific source, optional)

This script creates one document per course and a summary document per (program, semester)
so that retrieval can hit both individual courses and semester-level lists.

Usage (Windows PowerShell):
  # from repo root
  .\rag_service\venv\Scripts\python.exe .\rag_service\ingest_curriculum.py
"""
import json
import os
import shutil
from collections import defaultdict
from typing import List, Dict, Any

from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS

from document_processor import DocumentProcessor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
STORAGE_JSON = os.path.join(ROOT, "server", "storage-data.json")
CS_BSC_JSON = os.path.join(ROOT, "server", "data", "curricula", "cs_bsc.json")
VECTORSTORE_DIR = os.path.join(ROOT, "rag_service", "vectorstore")


def load_courses_from_storage() -> List[Dict[str, Any]]:
    if not os.path.exists(STORAGE_JSON):
        return []
    with open(STORAGE_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("courses", [])


def load_courses_from_cs_bsc() -> List[Dict[str, Any]]:
    if not os.path.exists(CS_BSC_JSON):
        return []
    with open(CS_BSC_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("courses", [])


def course_to_text(c: Dict[str, Any]) -> str:
    program = c.get("program") or ""
    code = c.get("code") or ""
    title = c.get("title") or ""
    credits = c.get("credits") or 0
    semester = c.get("semester")
    required = bool(c.get("required"))
    elective = bool(c.get("elective"))
    comp_elective = bool(c.get("compulsoryElective"))
    typ = (
        "Required" if required else ("Elective" if elective else "Optional")
    )
    if comp_elective:
        typ += " (Compulsory elective)"
    sem_txt = "N/A" if semester is None else str(semester)
    lines = [
        f"Program: {program}",
        f"Course code: {code}",
        f"Title: {title}",
        f"Credits: {credits}",
        f"Semester: {sem_txt}",
        f"Type: {typ}",
    ]
    # Add helpful synonyms for retrieval
    if required:
        lines.append("required course")
    if elective:
        lines.append("elective course")
    if comp_elective:
        lines.append("compulsory elective")
    return "\n".join(lines)


def build_documents(courses: List[Dict[str, Any]]) -> List[Document]:
    docs: List[Document] = []
    # One doc per course
    for c in courses:
        text = course_to_text(c)
        meta = {
            "source": "curriculum",
            "program": c.get("program"),
            "code": c.get("code"),
            "title": c.get("title"),
            "semester": c.get("semester"),
            "credits": c.get("credits"),
            "required": bool(c.get("required")),
            "elective": bool(c.get("elective")),
            "compulsoryElective": bool(c.get("compulsoryElective")),
        }
        docs.append(Document(page_content=text, metadata=meta))

    # Semester summaries per program
    by_prog_sem: Dict[str, Dict[str, List[Dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
    for c in courses:
        prog = c.get("program") or ""
        sem_key = "Other" if c.get("semester") is None else str(c.get("semester"))
        by_prog_sem[prog][sem_key].append(c)

    for prog, sem_map in by_prog_sem.items():
        for sem, lst in sem_map.items():
            total = sum(int(ci.get("credits") or 0) for ci in lst)
            header = f"Program: {prog}\nSemester: {sem}\nTotal credits: {total}\n"
            lines = []
            for ci in lst:
                typ = "Required" if ci.get("required") else ("Elective" if ci.get("elective") else "Optional")
                if ci.get("compulsoryElective"):
                    typ += " (Compulsory elective)"
                lines.append(f"- {ci.get('code')} — {ci.get('title')} — {ci.get('credits')} credits — {typ}")
            text = header + "\n".join(lines)
            docs.append(Document(page_content=text, metadata={
                "source": "curriculum",
                "program": prog,
                "semester": sem,
                "summary": True,
            }))
    return docs


def main():
    print("Loading courses from storage snapshot...")
    storage_courses = load_courses_from_storage()
    print(f"  Storage courses: {len(storage_courses)}")

    print("Loading courses from CS BSc JSON (optional)...")
    cs_bsc_courses = load_courses_from_cs_bsc()
    print(f"  CS BSc courses: {len(cs_bsc_courses)}")

    # Merge by (program, code, title) to deduplicate
    merged: Dict[tuple, Dict[str, Any]] = {}
    for lst in (storage_courses, cs_bsc_courses):
        for c in lst:
            key = (c.get("program"), c.get("code"), c.get("title"))
            merged[key] = c

    all_courses = list(merged.values())
    # Basic sanity filter: ensure credits are non-negative and semester within reasonable bounds
    filtered = [c for c in all_courses if isinstance(c.get("credits"), (int, float)) and (c.get("credits") or 0) >= 0]
    print(f"Total unique courses to index: {len(filtered)}")

    docs = build_documents(filtered)
    print(f"Assembled {len(docs)} document(s) for vectorization")

    # Rebuild vectorstore
    if os.path.isdir(VECTORSTORE_DIR):
        print(f"Removing existing vectorstore at {VECTORSTORE_DIR}...")
        shutil.rmtree(VECTORSTORE_DIR, ignore_errors=True)
    os.makedirs(VECTORSTORE_DIR, exist_ok=True)

    print("Initializing embeddings via DocumentProcessor...")
    processor = DocumentProcessor(model_choice="openai")
    print("Building FAISS index from curriculum documents...")
    vs = FAISS.from_documents(docs, processor.embeddings)
    vs.save_local(VECTORSTORE_DIR)
    print("Done. Saved FAISS index to:", VECTORSTORE_DIR)


if __name__ == "__main__":
    main()
