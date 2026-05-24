from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from openai import AzureOpenAI
import azure_config as config
import os
import re
import difflib
import requests

class ChatManager:
    def __init__(self, vectorstore, model_choice):
        self.vectorstore = vectorstore
        self.model_choice = model_choice
        # Configure a dedicated Azure OpenAI client (official SDK)
        self.azure_client = AzureOpenAI(
            api_key=config.AZURE_OPENAI_API_KEY,
            api_version=config.AZURE_OPENAI_API_VERSION,
            azure_endpoint=config.AZURE_OPENAI_ENDPOINT,
        )
        # Wrap Azure client as a LangChain Runnable to avoid SDK param mismatches
        self.llm = RunnableLambda(self._invoke_azure)
        # Base URL for the Node API providing structured curricula/courses
        self.node_api_base = os.getenv("NODE_API_BASE", "http://localhost:3000")
        
        # Initialize retriever only if vectorstore exists
        if self.vectorstore is not None:
            self.retriever = self.vectorstore.as_retriever(
                search_type="mmr",
                search_kwargs={
                    "k": 12,
                    "fetch_k": 36,
                    "lambda_mult": 0.5
                }
            )
        else:
            self.retriever = None
            print("WARNING: Vectorstore is None, retriever not initialized!")

        template = """You are a helpful university assistant for ELTE students.

INSTRUCTIONS:
- Answer questions using the provided context
- Be specific with details: building, floor, room, office hours, email, phone, deadlines, required documents
- Use bullet points (- ) for lists
- Keep answers concise
- If context doesn't contain the specific information requested, say what you DO know from the context
- Do NOT say "I don't know" if the context contains any relevant information

Context:
{context}

Question: {question}

Answer:"""

        self.prompt = ChatPromptTemplate.from_template(template)
        
        if self.retriever is not None:
            self.chain = (
                {
                    "context": lambda x: "\n".join(doc.page_content for doc in self.retriever.invoke(x)),
                    "question": RunnablePassthrough()
                }
                | self.prompt
                | self.llm
            )
        else:
            self.chain = None

    def get_response(self, query, chat_history):
        try:

            if self.vectorstore is None or self.chain is None:
                return "I don't know - the knowledge base is not loaded. Please contact support.", []
            
            if self._looks_like_course_query(query):
                fb = self._try_course_fallback(query)
                if fb is not None:
                    return fb["answer"], fb["sources"]

            try:
                response = self.chain.invoke(query)
            except Exception as e:
                print(f"Error invoking chain: {e}")
                response = "I couldn't process your question. Please try again."
            
            try:
                source_documents = self.retriever.invoke(query)
            except Exception as e:
                print(f"Error retrieving sources: {e}")
                source_documents = []
            
            sources = []
            for doc in source_documents:
                snippet = doc.page_content[:300] + "..." if len(doc.page_content) > 300 else doc.page_content
                sources.append(snippet)
            
            return response, sources
        except Exception as e:
            print(f"Error in get_response: {str(e)}")
            import traceback
            traceback.print_exc()
            return f"I encountered an error: {str(e)}", []

    def _invoke_azure(self, prompt_value):
        """Invoke Azure OpenAI Chat Completions using the prompt value coming from LangChain.

        Accepts either a ChatPromptValue (with to_messages()) or a plain string.
        Returns the text content of the first choice.
        """
        try:
            # Convert LangChain messages to OpenAI schema
            if hasattr(prompt_value, "to_messages"):
                lc_messages = prompt_value.to_messages()
                messages = []
                for m in lc_messages:
                    # Map LangChain message types to OpenAI roles
                    msg_type = getattr(m, "type", "user")
                    if msg_type == "human":
                        role = "user"
                    elif msg_type == "ai":
                        role = "assistant"
                    elif msg_type == "system":
                        role = "system"
                    else:
                        role = "user"
                    messages.append({"role": role, "content": m.content})
            else:
                # Treat as plain user message
                messages = [{"role": "user", "content": str(prompt_value)}]

            response = self.azure_client.chat.completions.create(
                model=config.AZURE_OPENAI_DEPLOYMENT_CHAT, 
                messages=messages,
                temperature=config.TEMPERATURE,
                max_tokens=getattr(config, "MAX_TOKENS", 800),
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            # Surface errors to Flask so the client can react appropriately
            raise RuntimeError(f"Azure OpenAI call failed: {e}")

    # --------------------------
    # Curriculum/course fallback
    # --------------------------
    def _looks_like_course_query(self, q: str) -> bool:
        ql = (q or "").lower()
        keywords = [
            "course", "courses", "curriculum", "syllabus", "semester", "credits",
            "compulsory", "required", "elective", "core", "program"
        ]
        return any(k in ql for k in keywords)

    def _fetch_programs(self):
        try:
            url = f"{self.node_api_base}/api/programs"
            r = requests.get(url, timeout=6)
            r.raise_for_status()
            data = r.json() or {}
            progs = data.get("programs") or []
            # Normalize to strings
            return [str(p) for p in progs if p]
        except Exception:
            return []

    def _extract_program(self, q: str, programs: list[str]):
        ql = (q or "").lower()
        # 1) Direct substring match against known programs
        for p in programs:
            if p and p.lower() in ql:
                return p

        # 2) Alias mapping for common phrasings/typos
        aliases = {
            "cs bsc": "CS BSc",
            "cs bs": "CS BSc",
            "computer science bsc": "CS BSc",
            "computer science bs": "CS BSc",
            "bachelor of science in computer science": "CS BSc",
            "bsc in computer science": "CS BSc",
            "msc data science": "MSc Data Science",
            "data science msc": "MSc Data Science",
            "msc software architecture": "MSc Software Architecture",
            "software architecture msc": "MSc Software Architecture",
            "msc cybersecurity": "MSc Cybersecurity",
            "cybersecurity msc": "MSc Cybersecurity",
            "msc autonomous systems": "MSc Autonomous Systems",
            "autonomous systems msc": "MSc Autonomous Systems",
            "digital factory msc": "MSc Digital Factory",
            "msc digital factory": "MSc Digital Factory",
            "ai msc": "AI MSc",
            "msc ai": "AI MSc",
        }
        for k, v in aliases.items():
            if k in ql and v in programs:
                return v

        # 3) Fuzzy match to closest program name
        choices = [p for p in programs if isinstance(p, str)]
        # extract candidate phrases from query: collapse whitespace and keep letters
        cleaned = re.sub(r"[^a-z0-9\s]", " ", ql)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        # try difflib on the full cleaned query
        if choices and cleaned:
            match = difflib.get_close_matches(cleaned, choices, n=1, cutoff=0.6)
            if match:
                return match[0]
        # fallback: try on token subsets (e.g., 'computer science bs')
        tokens = cleaned.split()
        for size in range(min(4, len(tokens)), 1, -1):
            for i in range(0, len(tokens) - size + 1):
                span = " ".join(tokens[i:i+size])
                m2 = difflib.get_close_matches(span, choices, n=1, cutoff=0.7)
                if m2:
                    return m2[0]
        return None

    def _fetch_courses_for_program(self, program: str):
        try:
            url = f"{self.node_api_base}/api/courses"
            r = requests.get(url, params={"program": program}, timeout=8)
            r.raise_for_status()
            data = r.json() or []
            # Expect list of { id, code, title, credits, semester, required, elective, compulsoryElective }
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def _summarize_courses(self, program: str, courses: list[dict], *, target_semester: int | None = None, only_compulsory: bool = False) -> str:
        # Group by semester; within each, list required first then electives
        by_sem: dict[int | None, list] = {}
        for c in courses:
            sem = c.get("semester")
            by_sem.setdefault(sem, []).append(c)

        lines: list[str] = []
        lines.append(f"Program: {program}")
        semesters_to_print = []
        if target_semester and isinstance(target_semester, int):
            semesters_to_print = [s for s in sorted([s for s in by_sem.keys() if isinstance(s, int)]) if s == target_semester]
        else:
            semesters_to_print = sorted([s for s in by_sem.keys() if isinstance(s, int)])
            if None in by_sem:
                semesters_to_print.append(None)

        for sem in semesters_to_print:
            bucket = by_sem.get(sem, [])
            req = [c for c in bucket if c.get("required")]
            # Distinguish compulsory-electives from normal electives
            comp_ele = [c for c in bucket if c.get("elective") and c.get("compulsoryElective")]
            ele = [c for c in bucket if c.get("elective") and not c.get("compulsoryElective")]
            heading = f"Semester {sem}" if isinstance(sem, int) else "Unassigned semester"
            lines.append(f"\n{heading}:")
            if req:
                lines.append("  Required:")
                for c in sorted(req, key=lambda x: x.get("code") or ""):
                    lines.append(f"    - {c.get('code')} {c.get('title')} ({c.get('credits')} cr)")
            if not only_compulsory:
                if comp_ele:
                    lines.append("  Compulsory electives:")
                    for c in sorted(comp_ele, key=lambda x: x.get("code") or ""):
                        lines.append(f"    - {c.get('code')} {c.get('title')} ({c.get('credits')} cr)")
                if ele:
                    lines.append("  Electives:")
                    for c in sorted(ele, key=lambda x: x.get("code") or ""):
                        lines.append(f"    - {c.get('code')} {c.get('title')} ({c.get('credits')} cr)")
        return "\n".join(lines)

    def _parse_semester_and_filters(self, q: str):
        ql = (q or "").lower()
        # Detect explicit semester numbers
        m = re.search(r"semester\s*(\d+)", ql)
        sem_num = int(m.group(1)) if m else None
        # Ordinals
        ord_map = {
            "first": 1, "1st": 1,
            "second": 2, "2nd": 2,
            "third": 3, "3rd": 3,
            "fourth": 4, "4th": 4,
            "fifth": 5, "5th": 5,
            "sixth": 6, "6th": 6,
        }
        for k, v in ord_map.items():
            if re.search(rf"\b{k}\b", ql):
                sem_num = sem_num or v
                break

        only_compulsory = any(w in ql for w in ["compulsory", "required only", "only required", "core only", "mandatory"])
        return sem_num, only_compulsory

    def _try_course_fallback(self, query: str):
        if not self._looks_like_course_query(query):
            return None

        programs = self._fetch_programs()
        if not programs:
            return None

        program = self._extract_program(query, programs)
        if not program:
            # Ask user to specify a program from the available list
            trimmed = ", ".join(programs[:8]) + (", ..." if len(programs) > 8 else "")
            answer = (
                "I can list the curriculum by program. Which program do you mean? "
                f"Available programs include: {trimmed}"
            )
            return {"answer": answer, "sources": [f"{self.node_api_base}/api/programs"]}

        courses = self._fetch_courses_for_program(program)
        if not courses:
            return None

        sem_num, only_compulsory = self._parse_semester_and_filters(query)
        summary = self._summarize_courses(program, courses, target_semester=sem_num, only_compulsory=only_compulsory)
        sources = [f"{self.node_api_base}/api/courses?program={requests.utils.quote(program)}"]
        return {"answer": summary, "sources": sources}
