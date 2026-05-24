#!/usr/bin/env python3
"""
Extract CS BSc curriculum courses from the PDF in rag_service/documents/Academic Information
and emit a structured JSON file usable by the Node API storage.

Heuristics:
- Treat courses listed under "SEMESTER X" as required (compulsory) unless otherwise specified.
- Treat courses listed under "Compulsory Elective Courses" sections as elective with compulsoryElective=True,
  using the "Recommended SEMESTER N ELECTIVES" blocks to assign a semester.
- Credits are parsed from a trailing "| <N> Credit(s)" segment.
- This is a best-effort extractor for quick alignment; manual review recommended.
"""
import json
import os
import re
from typing import List, Dict, Any, Optional

from pypdf import PdfReader

ROOT = os.path.dirname(os.path.dirname(__file__))
PDF_PATH = os.path.join(ROOT, "rag_service", "documents", "Academic Information", "COMPUTER SCIENCE BSC CURRICULUM.pdf")
OUT_PATH = os.path.join(ROOT, "server", "data", "curricula", "cs_bsc.json")

SEMESTER_HEADING = re.compile(r"^\s*SEMESTER\s+(\d+)\b", re.IGNORECASE)
PREP_HEADING = re.compile(r"^\s*PREPARATORY\s+SEMESTER", re.IGNORECASE)
COURSE_LINE = re.compile(r"^(?P<code>[A-Za-z]{2,}[-\w()]+):\s*(?P<title>.+?)\s*$")
CREDITS_LINE = re.compile(r"\b(\d+)\s+Credit(s)?\b", re.IGNORECASE)
COMP_ELEC_HDR = re.compile(r"^\s*Compulsory\s+Elective\s+Courses", re.IGNORECASE)
RECOMMENDED_SEM_ELEC = re.compile(r"Recommended\s+SEMESTER\s+(\d+)\s+ELECTIVES", re.IGNORECASE)


def read_pdf_text(path: str) -> List[str]:
    reader = PdfReader(path)
    lines: List[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        for ln in text.splitlines():
            ln = ln.strip("\u200b\ufeff ")
            if ln:
                lines.append(ln)
    return lines


def extract_courses(lines: List[str]) -> List[Dict[str, Any]]:
    courses: List[Dict[str, Any]] = []
    current_semester: Optional[int] = None
    in_prep = False
    in_comp_elec = False
    comp_elec_semester: Optional[int] = None

    pending: Optional[Dict[str, Any]] = None

    def flush_pending():
        nonlocal pending
        if pending is None:
            return
        # Ensure credits is int
        try:
            if isinstance(pending.get("credits"), str):
                pending["credits"] = int(pending["credits"])  # type: ignore
        except Exception:
            pending["credits"] = None
        # Skip incomplete entries without code/title
        if pending.get("code") and pending.get("title"):
            courses.append(pending)
        pending = None

    for raw in lines:
        # Section switches
        if PREP_HEADING.search(raw):
            flush_pending()
            in_prep = True
            in_comp_elec = False
            current_semester = 0
            comp_elec_semester = None
            continue

        m_sem = SEMESTER_HEADING.search(raw)
        if m_sem:
            flush_pending()
            in_prep = False
            in_comp_elec = False
            current_semester = int(m_sem.group(1))
            comp_elec_semester = None
            continue

        if COMP_ELEC_HDR.search(raw):
            flush_pending()
            in_prep = False
            in_comp_elec = True
            comp_elec_semester = None
            current_semester = None
            continue

        m_reco = RECOMMENDED_SEM_ELEC.search(raw)
        if m_reco and in_comp_elec:
            flush_pending()
            comp_elec_semester = int(m_reco.group(1))
            continue

        # Course parsing
        m_course = COURSE_LINE.match(raw)
        if m_course:
            # new course begins -> flush previous
            flush_pending()
            code = m_course.group("code").strip()
            title = m_course.group("title").strip()
            entry = {
                "program": "CS BSc",
                "code": code,
                "title": title,
                "credits": None,
                "semester": comp_elec_semester if in_comp_elec else current_semester,
                "required": not in_comp_elec,  # assume semester sections are compulsory
                "elective": in_comp_elec,
                "compulsoryElective": in_comp_elec,
            }
            pending = entry
            continue

        # credits lines may follow after the course line
        if pending is not None:
            mc = CREDITS_LINE.search(raw)
            if mc:
                pending["credits"] = int(mc.group(1))
                continue

    # flush last
    flush_pending()

    # Filter out entries without semester (rare in electives if not marked). Keep them but set semester to None.
    # Also drop duplicates if any by (code, semester)
    seen = set()
    deduped: List[Dict[str, Any]] = []
    for c in courses:
        key = (c.get("code"), c.get("semester"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(c)

    # basic cleanup: ensure credits is int or default 0
    for c in deduped:
        if not isinstance(c.get("credits"), int):
            c["credits"] = 0

    # Known corrections/overrides for cases where the PDF lacks explicit credit lines
    for c in deduped:
        title_norm = (c.get("title") or "").strip().lower()
        code_norm = (c.get("code") or "").strip().lower()
        # Thesis consultation in Semester 6 is 20 credits
        if title_norm == "thesis consultation" or code_norm == "ip-24fszd":
            c["credits"] = 20
    return deduped


def main():
    if not os.path.exists(PDF_PATH):
        raise SystemExit(f"PDF not found: {PDF_PATH}")
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    lines = read_pdf_text(PDF_PATH)
    data = extract_courses(lines)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"program": "CS BSc", "courses": data}, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(data)} courses to {OUT_PATH}")


if __name__ == "__main__":
    main()
