import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import httpx
import re

load_dotenv()

GEMINI_API_URL = os.getenv("GEMINI_API_URL", "").strip()    # e.g. https://generativelanguage.googleapis.com/v1beta2/models/xxx:generate
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
BACKEND_PORT = int(os.getenv("BACKEND_PORT", 8080))

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class AnalyzeRequest(BaseModel):
    messages: list | None = None
    text: str | None = None
    max_tokens: int | None = 400

@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    # Build the text to summarize
    if req.text:
        text = req.text
    elif req.messages:
        # join messages safely
        text = "\n".join([str(m) for m in req.messages])[:20000]  # limit size
    else:
        raise HTTPException(status_code=400, detail="No text or messages provided")

    prompt = (
        "You are an assistant that extracts the important information and provides a short, "
        "clear summary (3-6 bullets) and a 1-line title. Format output as JSON with keys: "
        "\"title\" and \"bullets\" (array of strings).\\n\\n"
        f"Text to summarize:\\n{text}"
    )

    # Try Gemini if configured
    if GEMINI_API_URL and GEMINI_API_KEY:
        try:
            headers = {
            "Content-Type": "application/json",
        }

        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": prompt}]}
            ]
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
               f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
                headers=headers,
                json=payload
            )
            resp.raise_for_status()
            jr = resp.json()

            # Attempt to extract readable text from common fields
            # Different providers return output in different keys — try several heuristics
            summary_text = None

            # Heuristic 1: common 'choices' -> 'text' (OpenAI-like)
            if isinstance(jr.get("choices"), list) and jr["choices"]:
                c0 = jr["choices"][0]
                if isinstance(c0, dict):
                    summary_text = c0.get("text") or c0.get("message") or c0.get("message", {}).get("content")

            # Heuristic 2: Google Gen AI may return 'candidates' or 'output' or 'content'
            if not summary_text:
                # candidates -> content
                if isinstance(jr.get("candidates"), list) and jr["candidates"]:
                    cand = jr["candidates"][0]
                    if isinstance(cand, dict) and cand.get("content"):
                        summary_text = cand["content"]
                # 'output' field (sometimes nested)
                if not summary_text and isinstance(jr.get("output"), (dict, list)):
                    out = jr["output"]
                    if isinstance(out, list) and out and isinstance(out[0], dict):
                        summary_text = out[0].get("content") or out[0].get("text")
                    elif isinstance(out, dict):
                        summary_text = out.get("content") or out.get("text")

            # Heuristic 3: some Gemini variants put text in jr['text'] or jr['summary']
            if not summary_text:
                summary_text = jr.get("text") or jr.get("summary") or jr.get("result")

            # If still empty, fallback to stringifying the response
            if not summary_text:
                summary_text = json.dumps(jr)

            # Try to parse JSON-like output from model (if model returned JSON)
            parsed = try_parse_json_block(summary_text)
            if isinstance(parsed, dict) and parsed.get("title") and parsed.get("bullets"):
                return {"summary": parsed}

            # Otherwise, convert plain text into a structured summary using naive parser
            bullets = generate_bullets_from_text(summary_text)
            title = extract_title_from_text(summary_text) or (bullets[0] if bullets else "Summary")
            return {"summary": {"title": title, "bullets": bullets}, "raw_response": jr}

        except httpx.HTTPStatusError as exc:
            # Gemini returned non-2xx
            return {"error": f"Gemini API returned {exc.response.status_code}", "details": exc.response.text}
        except Exception as e:
            # Log and continue to fallback
            return {"error": "Gemini call failed", "details": str(e)}

    # If Gemini not configured, fallback to naive summarizer
    naive = naive_summarize(text)
    bullets = generate_bullets_from_text(naive)
    title = extract_title_from_text(naive) or "Summary (local)"
    return {"summary": {"title": title, "bullets": bullets}, "fallback": True}


def try_parse_json_block(s: str):
    """
    If the model returned JSON text (or code block containing JSON),
    extract and parse it. Otherwise return None.
    """
    if not s or not isinstance(s, str):
        return None
    # find first { ... } JSON block
    m = re.search(r"({[\s\S]*})", s)
    if m:
        block = m.group(1)
        try:
            return json.loads(block)
        except Exception:
            pass
    # try the entire string
    try:
        return json.loads(s)
    except Exception:
        return None


def generate_bullets_from_text(text: str, max_bullets: int = 5):
    # simple heuristic: split into sentences and pick the top N (by length)
    if not text:
        return []
    sents = re.split(r'(?<=[.!?])\s+', text.strip())
    sents = [s.strip() for s in sents if len(s.strip())>20]
    sents = sorted(sents, key=lambda x: -len(x))
    bullets = [truncate_line(x, 240) for x in sents[:max_bullets]]
    return bullets


def extract_title_from_text(text: str):
    # try first line or first strong sentence
    if not text:
        return None
    first = text.strip().split("\n", 1)[0]
    # shorten
    return truncate_line(first, 80)


def truncate_line(s: str, n: int):
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "..."


def naive_summarize(text: str, max_sentences: int = 4):
    # super-simple: return the first N sentences
    sents = re.split(r'(?<=[.!?])\s+', text.strip())
    return " ".join(sents[:max_sentences])

