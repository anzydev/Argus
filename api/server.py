"""
server.py — FastAPI application serving the Argus /compare endpoint.

Start with:
    uvicorn api.server:app --reload --port 8000
"""

import random
import os
import zipfile
import io
from collections import Counter
from dotenv import load_dotenv

load_dotenv()
import itertools  # noqa: E402
import json  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402
from fastapi import FastAPI, UploadFile, File, Form, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from fastapi.responses import FileResponse  # noqa: E402
import httpx  # noqa: E402
from groq import Groq  # noqa: E402


try:
    from api.ast_engine import compare
except ImportError:
    from ast_engine import compare

# ── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Argus API",
    description="AST-based structural code plagiarism detection.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow the frontend (file:// or localhost)
    allow_methods=["*"],
    allow_headers=["*"],
)

PLAGIARISM_THRESHOLD = 0.70
MODERATE_THRESHOLD = 0.40
MIN_LINES = 10


def validate_min_lines(code: str, label: str = "Code") -> None:
    """Raise HTTP 400 if the code has fewer than MIN_LINES non-empty lines
    or if excessive line repetition is detected (padding abuse)."""
    lines = [ln.strip() for ln in code.strip().splitlines() if ln.strip()]
    line_count = len(lines)

    if line_count < MIN_LINES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{label} has only {line_count} non-empty lines. "
                f"Code must be at least {MIN_LINES} lines long "
                f"for reliable plagiarism or AI detection."
            ),
        )

    # Detect line-padding abuse (e.g. print() repeated 11 times)
    counts = Counter(lines)
    most_common_line, most_common_count = counts.most_common(1)[0]
    unique_count = len(counts)
    repetition_ratio = most_common_count / line_count

    if repetition_ratio > 0.75 and line_count >= MIN_LINES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{label} contains excessive repetition — the line "
                f"'{most_common_line[:50]}' appears {most_common_count} "
                f"out of {line_count} times ({repetition_ratio:.0%}). "
                f"Please submit genuine code for analysis."
            ),
        )

    if unique_count < MIN_LINES * 0.4:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{label} has only {unique_count} unique lines out of "
                f"{line_count} total. Code appears to be padded with "
                f"repeated lines. Please submit genuine code."
            ),
        )


# ── Request / Response models ────────────────────────────────────────────────
class CompareRequest(BaseModel):
    code1: str = Field(..., description="Source code of the first Python file.")
    code2: str = Field(..., description="Source code of the second Python file.")
    ngram_size: int | None = Field(3, ge=1, le=20, description="N-gram window size.")
    language: str = Field(
        "python", description="Programming language (e.g. python, java, cpp)"
    )
    api_key: str | None = Field(None, description="Groq API Key for logic pre-check")


class CompareResponse(BaseModel):
    score: float
    score_pct: str
    verdict: str
    details: dict[str, object]


class SingleAiRequest(BaseModel):
    code: str = Field(..., description="Source code to analyze.")
    language: str = Field(
        "python", description="Programming language (e.g. python, java, cpp)"
    )
    api_key: str | None = Field(None, description="Groq API Key")


class BatchCompareResult(BaseModel):
    file1: str
    file2: str
    score: float
    score_pct: str
    verdict: str
    details: dict[str, object]


class BatchCompareResponse(BaseModel):
    results: list[BatchCompareResult]
    files: dict[str, str] = Field(default_factory=dict)


class BatchAiResult(BaseModel):
    file: str
    is_ai: bool
    confidence: int
    reason: str


class BatchAiResponse(BaseModel):
    results: list[BatchAiResult]


# ── Endpoints ────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Meta"])
def health_check():
    """Simple liveness probe."""


class ValidateKeyRequest(BaseModel):
    api_key: str = Field(..., description="Groq API key to validate.")


@app.post("/validate_key", tags=["Meta"])
def validate_key(payload: ValidateKeyRequest):
    """Validate a Groq API key by making a minimal chat completion call."""
    try:
        client = Groq(api_key=payload.api_key)
        client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=1,
        )
        return {"valid": True, "message": "API key is valid."}
    except Exception as e:
        err_msg = str(e)
        return {"valid": False, "message": err_msg}


def ai_verify_plagiarism(
    code1: str, code2: str, language: str, api_key: str | None
) -> dict:
    if not api_key:
        api_key = os.getenv("GROQ_API_KEY", "")

    try:
        client = Groq(api_key=api_key)
        prompt = f"""
        Analyze the following two {language} code snippets for plagiarism.

        STEP 1 — Determine if they solve the SAME problem or algorithm.
        STEP 2 — If yes, determine if the problem has LIMITED SOLUTIONS.
        Many classic problems (e.g. Two-Sum with hash map, binary search,
        FizzBuzz, basic sorting algorithms, simple CRUD operations, standard
        tree traversals) have only a handful of correct approaches. If the
        problem is well-known and the structural similarity is simply because
        there are very few valid ways to solve it, mark
        "limited_solutions" as true.
        STEP 3 — Check for BLATANT COPYING indicators:
        - Identical or near-identical variable/function names
        - Same comments, docstrings, or formatting
        - Same code structure AND same naming conventions
        If the codes solve the same problem but use DIFFERENT variable
        names, formatting, comments, and coding style, that is strong
        evidence of independent work — NOT plagiarism.
        STEP 4 — Only flag "same_logic" as true (plagiarism suspected)
        when both codes share the same approach AND show blatant copying
        indicators (same names, same formatting, same comments). If they
        merely share the same algorithmic approach but differ in style,
        names, and formatting, set "same_logic" to false.

        Code 1:
        {code1}

        Code 2:
        {code2}

        Respond ONLY with a JSON object in this format:
        {{"same_problem": true/false, "same_logic": true/false,
        "limited_solutions": true/false, "confidence": 0-100,
        "reason": "brief string explaining your reasoning"}}
        """
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        return json.loads(content or "{}")
    except Exception as e:
        print(f"AI Check failed: {e}")
        return {
            "same_problem": True,
            "same_logic": True,
            "limited_solutions": False,
            "error": str(e),
        }


def verify_language_match(
    code: str, expected_language: str, api_key: str
) -> dict[str, object]:
    """
    Uses Groq LLM to quickly verify if the pasted code actually matches the expected language.
    """
    try:
        from groq import Groq

        client = Groq(api_key=api_key)

        prompt = f"""
        Analyze the following code snippet.
        The user claims this code is written in {expected_language}.
        Is it actually {expected_language}? If not, what is the actual language?

        Code:
        {code}

        Respond ONLY with a JSON object in this format:
        {{"matches": true/false, "actual_language":
        "string name of the actual language, or the expected
        one if it matches"}}
        """
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=256,
        )
        content = response.choices[0].message.content
        return json.loads(content or "{}")
    except Exception as e:
        print(f"Language verification failed: {e}")
        return {"matches": True, "actual_language": expected_language}


def ai_detect_generation(code: str, language: str, api_key: str) -> dict[str, object]:
    """
    Uses Groq LLM to determine if a single code snippet was likely AI-generated.
    """
    try:
        from groq import Groq

        client = Groq(api_key=api_key)

        prompt = f"""
        You are an expert code analyst. Analyze the following
        {language} code snippet and determine whether it was
        written by AI (e.g. ChatGPT, Claude, Copilot) or by a human.

        **Common signs of AI-generated code:**
        - Overly clean, uniform formatting with consistent style throughout
        - Comprehensive docstrings, type hints, and inline comments explaining obvious logic
        - Perfect error handling patterns (try/except with specific exceptions)
        - Textbook-perfect variable naming (descriptive, snake_case, no abbreviations)
        - Modular structure with helper functions even for simple tasks
        - Generic placeholder names like "example", "sample", "demo" in non-demo code
        - Step-by-step comments that read like a tutorial
        - Defensive coding patterns everywhere (input validation, edge case handling)
        - Using modern best practices uniformly (f-strings, pathlib, dataclasses, etc.)
        - Code that feels "too perfect" — no shortcuts, no quirks, no personality

        **Common signs of human-written code:**
        - Inconsistent style, mixed formatting, or personal coding quirks
        - Minimal or no comments/docstrings
        - Abbreviated or cryptic variable names
        - Missing error handling or incomplete edge case coverage
        - Copy-paste artifacts or TODO comments
        - Organic, imperfect structure that evolved during development
        - Hard-coded values, magic numbers, or quick hacks

        Weigh ALL indicators objectively. Do NOT default to either conclusion — evaluate the evidence fairly.

        Code:
        {code}

        Respond ONLY with a JSON object in this format:
        {{"is_ai": true/false, "confidence": 0-100, "reason": "brief 1-sentence string explaining your reasoning"}}
        """
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system",
                 "content": "You are an expert at distinguishing "
                 "AI-generated code from human-written code. "
                 "Be accurate and objective."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        content = response.choices[0].message.content
        return json.loads(content or "{}")
    except Exception as e:
        print(f"AI Generation Check failed: {e}")
        return {
            "is_ai": False,
            "confidence": 0,
            "error": str(e),
            "reason": f"AI Check failed: {e}",
        }


@app.post("/compare", response_model=CompareResponse, tags=["Detection"])
def compare_code(payload: CompareRequest):
    """
    Endpoint to compare two source code snippets using Tree-sitter AST extraction
    and N-gram generation for Jaccard similarity.
    """
    # 0. Minimum line-count validation
    validate_min_lines(payload.code1, "File A")
    validate_min_lines(payload.code2, "File B")

    # 1. API Key validation for LLM checks
    active_api_key = (
        payload.api_key
        or os.getenv("GROQ_API_KEY")
    )

    if not active_api_key:
        raise HTTPException(
            status_code=400,
            detail="A valid Groq API Key is required for language validation and AI checks.",
        )

    # 2. Language Validation Pre-check
    combined_code = f"CODE 1:\n{payload.code1}\n\nCODE 2:\n{payload.code2}"
    lang_check = verify_language_match(combined_code, payload.language, active_api_key)
    if not lang_check.get("matches", True):
        actual_lang = str(lang_check.get("actual_language", "an unknown language"))
        raise HTTPException(
            status_code=400,
            detail=(
                f"Language Mismatch: You selected "
                f"{payload.language.upper()}, but the code appears "
                f"to be {actual_lang.upper()}. "
                f"Please select the correct language."
            ),
        )

    # 3. AST Comparison
    n = payload.ngram_size if payload.ngram_size is not None else 3
    try:
        result = compare(payload.code1, payload.code2, n, payload.language)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Parsing error: {exc}",
        )

    score = result["score"]

    verdict = "Low Similarity — No Plagiarism Detected"
    if score >= 0.70:
        verdict = "High Structural Overlap — Plagiarism Suspected"
    elif score >= 0.40:
        verdict = "Moderate Overlap — Manual Review Recommended"

    ai_reasoning = ""
    # 4. AI Pre-check if score suggests possible plagiarism
    if score >= 0.40 and active_api_key:
        ai_check = ai_verify_plagiarism(
            payload.code1, payload.code2, payload.language, active_api_key
        )
        if not ai_check.get("same_problem", True):
            score = 0.0
            verdict = "⚠️ Different Problem Statements"
            ai_reasoning = ai_check.get("reason", "AI determined different problems.")
        elif ai_check.get("limited_solutions", False) and not ai_check.get("same_logic", True):
            verdict = "✅ Limited-Solution Problem — Not Plagiarism"
            ai_reasoning = ai_check.get(
                "reason",
                "This problem has very few valid solutions; "
                "structural similarity is expected.",
            )
            score = max(score * 0.3, 0.0)
        else:
            if not ai_check.get("same_logic", True):
                verdict += " (AI: Different Logic Used)"
            else:
                verdict += " (AI: Same Logic Used)"
            ai_reasoning = ai_check.get("reason", "")
            if "error" in ai_check:
                verdict += f" (AI Error: {ai_check['error']})"

    # 3. AI Generation Detection (for both codes)
    code1_ai = {"is_ai": False, "confidence": 0, "reason": "No API key"}
    code2_ai = {"is_ai": False, "confidence": 0, "reason": "No API key"}

    if active_api_key:
        code1_ai = ai_detect_generation(payload.code1, payload.language, active_api_key)
        code2_ai = ai_detect_generation(payload.code2, payload.language, active_api_key)

    result["ai_reasoning"] = ai_reasoning
    result["code1_ai"] = code1_ai
    result["code2_ai"] = code2_ai

    return CompareResponse(
        score=score, score_pct=f"{score * 100:.1f}%", verdict=verdict, details=result
    )


@app.post("/compare_zip", response_model=BatchCompareResponse, tags=["Detection"])
def compare_zip(
    file: UploadFile = File(...),
    ngram_size: int = Form(3),
    language: str = Form("python"),
    api_key: str | None = Form(None),
):
    """
    Upload a ZIP file containing multiple scripts.
    Extracts relevant files based on language and performs pairwise structural comparison.
    """
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported.")

    # Extension mapping
    EXTENSIONS = {
        "python": (".py",),
        "java": (".java",),
        "cpp": (".cpp", ".cxx", ".cc", ".h", ".hpp", ".c"),
        "javascript": (".js", ".jsx"),
        "html": (".html", ".htm"),
        "css": (".css",),
        "rust": (".rs",),
    }
    valid_exts = EXTENSIONS.get(language.lower(), (".py",))

    try:
        content = file.file.read()
        skipped_short_zip: list[str] = []
        with zipfile.ZipFile(io.BytesIO(content), "r") as zip_ref:
            py_files = {}
            for name in zip_ref.namelist():
                if name.lower().endswith(valid_exts) and not name.startswith(
                    "__MACOSX/"
                ):
                    if not name.endswith("/"):
                        clean_name = os.path.basename(name) or name
                        code_text = zip_ref.read(name).decode(
                            "utf-8", "ignore"
                        )
                        non_empty = len([ln for ln in code_text.strip().splitlines() if ln.strip()])
                        if non_empty < MIN_LINES:
                            skipped_short_zip.append(clean_name)
                            continue
                        py_files[clean_name] = code_text

    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP file.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if len(py_files) < 2:
        ext_str = "/".join(valid_exts)
        raise HTTPException(
            status_code=400,
            detail=f"ZIP file must contain at least two {language} scripts ({ext_str}).",
        )

    file_names = list(py_files.keys())
    pairs = list(itertools.combinations(file_names, 2))
    total_files = len(file_names)

    # 1. Pass 1: Raw AST extraction and generic template detection
    raw_results = {}
    adjacency_high_matches = {f: 0 for f in file_names}

    for f1, f2 in pairs:
        code1 = py_files[f1]
        code2 = py_files[f2]
        try:
            result = compare(code1, code2, ngram_size, language)
            score = float(str(result["score"]))
            raw_results[(f1, f2)] = {"score": score, "details": result, "error": False}
            if score >= 0.70:
                adjacency_high_matches[f1] += 1
                adjacency_high_matches[f2] += 1
        except Exception:
            raw_results[(f1, f2)] = {"score": 0.0, "details": {}, "error": True}

    common_threshold = max(3, int(total_files * 0.15))
    is_generic = {f: adjacency_high_matches[f] >= common_threshold for f in file_names}

    results = []
    active_api_key = (
        api_key
        or os.getenv("GROQ_API_KEY")
    )

    for f1, f2 in pairs:
        res = raw_results[(f1, f2)]
        if bool(res.get("error")):
            results.append(
                BatchCompareResult(
                    file1=f1,
                    file2=f2,
                    score=0.0,
                    score_pct="0.0%",
                    verdict="⚠️ Parsing Error in one of the files",
                    details={},
                )
            )
            continue

        score = float(str(res.get("score", 0.0)))
        details = res.get("details", {})
        if not isinstance(details, dict):
            details = {}

        verdict = "Low Similarity — No Plagiarism Detected"
        needs_ai = False

        is_f1_generic = is_generic[f1]
        is_f2_generic = is_generic[f2]

        if score >= 0.70:
            if is_f1_generic and is_f2_generic:
                verdict = "Common Generic Solution — Ignored"
            else:
                verdict = "High Structural Overlap — Plagiarism Suspected"
                needs_ai = True
        elif score >= 0.40:
            if is_f1_generic and is_f2_generic:
                verdict = "Common Generic Solution — Ignored"
            else:
                verdict = "Moderate Overlap — Manual Review Recommended"
                needs_ai = True

        # 2. Pass 2: AI logic check for suspicious outliers
        ai_reasoning = ""
        if needs_ai and active_api_key:
            ai_check = ai_verify_plagiarism(
                py_files[f1], py_files[f2], language, active_api_key
            )
            if ai_check.get("limited_solutions", False) and not ai_check.get("same_logic", True):
                reason = str(ai_check.get("reason", "Limited-solution problem"))
                results.append(
                    BatchCompareResult(
                        file1=f1,
                        file2=f2,
                        score=max(score * 0.3, 0.0),
                        score_pct=f"{max(score * 0.3, 0.0) * 100:.1f}%",
                        verdict=f"✅ Limited-Solution Problem — {reason}",
                        details={"ai_reasoning": reason},
                    )
                )
                continue
            elif not ai_check.get("same_problem", True):
                reason = str(ai_check.get("reason", "Different Problem Statements"))
                results.append(
                    BatchCompareResult(
                        file1=f1,
                        file2=f2,
                        score=0.0,
                        score_pct="0.0%",
                        verdict=f"{reason} — No Plagiarism Detected",
                        details={"ai_reasoning": reason},
                    )
                )
                continue
            else:
                if not ai_check.get("same_logic", True):
                    verdict += " (AI: Different Logic Used)"
                else:
                    verdict += " (AI: Same Logic Used)"
                ai_reasoning = str(ai_check.get("reason", ""))
                if "error" in ai_check:
                    verdict += f" (AI Error: {ai_check['error']})"

        details["ai_reasoning"] = ai_reasoning

        results.append(
            BatchCompareResult(
                file1=f1,
                file2=f2,
                score=score,
                score_pct=f"{score * 100:.1f}%",
                verdict=verdict,
                details=details,
            )
        )

    # Sort results by score (descending)
    results.sort(key=lambda x: x.score, reverse=True)

    return BatchCompareResponse(results=results, files=py_files)


@app.post("/detect_ai_single", response_model=BatchAiResult, tags=["AI Detection"])
def detect_ai_single(payload: SingleAiRequest):
    """
    Evaluates a single code snippet for AI authorship using Groq.
    """
    # 0. Minimum line-count validation
    validate_min_lines(payload.code, "Code snippet")

    active_api_key = (
        payload.api_key
        or os.getenv("GROQ_API_KEY")
    )

    if not active_api_key:
        raise HTTPException(
            status_code=400, detail="A valid Groq API Key is required for AI detection."
        )

    lang_check = verify_language_match(payload.code, payload.language, active_api_key)
    if not lang_check.get("matches", True):
        actual_lang = str(lang_check.get("actual_language", "an unknown language"))
        raise HTTPException(
            status_code=400,
            detail=(
                f"Language Mismatch: You selected "
                f"{payload.language.upper()}, but the code appears "
                f"to be {actual_lang.upper()}. "
                f"Please select the correct language."
            ),
        )

    ai_check = ai_detect_generation(payload.code, payload.language, active_api_key)

    is_ai = bool(ai_check.get("is_ai", False))
    confidence = int(str(ai_check.get("confidence", 0)))
    reason = str(ai_check.get("reason", "Analysis failed"))

    if "error" in ai_check:
        reason = str(ai_check["error"])

    return BatchAiResult(
        file="Snippet",
        is_ai=is_ai,
        confidence=confidence,
        reason=reason,
    )


@app.post("/detect_ai_batch", response_model=BatchAiResponse, tags=["AI Detection"])
def detect_ai_batch(
    file: UploadFile = File(...),
    language: str = Form("python"),
    api_key: str | None = Form(None),
):
    """
    Upload a ZIP file containing multiple scripts.
    Evaluates each file individually for AI authorship using Groq.
    """
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported.")

    active_api_key = (
        api_key
        or os.getenv("GROQ_API_KEY")
    )

    if not active_api_key:
        raise HTTPException(
            status_code=400, detail="A valid Groq API Key is required for AI detection."
        )

    EXTENSIONS = {
        "python": (".py",),
        "java": (".java",),
        "cpp": (".cpp", ".cxx", ".cc", ".h", ".hpp", ".c"),
        "javascript": (".js", ".jsx"),
        "html": (".html", ".htm"),
        "css": (".css",),
        "rust": (".rs",),
    }
    valid_exts = EXTENSIONS.get(language.lower(), (".py",))

    skipped_short_ai: list[str] = []
    try:
        content = file.file.read()
        with zipfile.ZipFile(io.BytesIO(content), "r") as zip_ref:
            py_files = {}
            for name in zip_ref.namelist():
                if name.lower().endswith(valid_exts) and not name.startswith(
                    "__MACOSX/"
                ):
                    if not name.endswith("/"):
                        clean_name = os.path.basename(name) or name
                        code_text = zip_ref.read(name).decode(
                            "utf-8", "ignore"
                        )
                        non_empty = len([ln for ln in code_text.strip().splitlines() if ln.strip()])
                        if non_empty < MIN_LINES:
                            skipped_short_ai.append(clean_name)
                            continue
                        py_files[clean_name] = code_text
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP file.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not py_files:
        ext_str = "/".join(valid_exts)
        raise HTTPException(
            status_code=400,
            detail=f"ZIP file must contain {language} scripts ({ext_str}).",
        )

    results = []

    # Report skipped short files
    for short_file in skipped_short_ai:
        results.append(
            BatchAiResult(
                file=short_file,
                is_ai=False,
                confidence=0,
                reason=f"Skipped — fewer than {MIN_LINES} lines (too short for reliable analysis)",
            )
        )

    for filename, code in py_files.items():
        ai_check = ai_detect_generation(code, language, active_api_key)

        is_ai = bool(ai_check.get("is_ai", False))
        confidence = int(str(ai_check.get("confidence", 0)))
        reason = str(ai_check.get("reason", "Analysis failed"))

        if "error" in ai_check:
            reason = str(ai_check["error"])

        results.append(
            BatchAiResult(
                file=filename,
                is_ai=is_ai,
                confidence=confidence,
                reason=reason,
            )
        )

    return BatchAiResponse(results=results)


@app.get("/random_code", tags=["Meta"])
async def get_random_code(language: str = "python"):
    """
    Fetch a random snippet from recent open-source GitHub repositories for a given language.
    """
    # Map syntax logic for GitHub search
    gh_lang = "cpp" if language.lower() in ("cpp", "c++", "c") else language.lower()

    EXTENSIONS = {
        "python": (".py",),
        "java": (".java",),
        "cpp": (".cpp", ".cxx", ".cc", ".h", ".hpp", ".c"),
        "javascript": (".js", ".jsx"),
        "html": (".html", ".htm"),
        "css": (".css",),
        "rust": (".rs",),
    }
    valid_exts = EXTENSIONS.get(language.lower(), (".py",))

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"https://api.github.com/search/repositories?q=language:{gh_lang}&sort=updated&per_page=30"
            )
            r.raise_for_status()

            repos = r.json().get("items", [])
            if not repos:
                raise HTTPException(status_code=500, detail="No repositories found.")

            for _ in range(5):
                repo = random.choice(repos)
                owner = repo["owner"]["login"]
                name = repo["name"]
                branch = repo["default_branch"]

                tree_url = f"https://api.github.com/repos/{owner}/{name}/git/trees/{branch}?recursive=1"
                tr = await client.get(tree_url)
                if tr.status_code != 200:
                    continue

                tree = tr.json().get("tree", [])
                py_files = [
                    item["path"]
                    for item in tree
                    if item["path"].lower().endswith(valid_exts)
                    and item["type"] == "blob"
                ]

                if not py_files:
                    continue

                path = random.choice(py_files)
                raw_url = (
                    f"https://raw.githubusercontent.com/{owner}/{name}/{branch}/{path}"
                )
                rr = await client.get(raw_url)
                if rr.status_code != 200:
                    continue

                code_text = rr.text[:3500]  # Limit size
                return {
                    "code": f"// Source: https://github.com/{owner}/{name}/blob/{branch}/{path}\n\n{code_text}"
                }

            raise HTTPException(
                status_code=500,
                detail=f"Could not locate a raw {language} file after multiple attempts.",
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch random code: {e}")


# ── Serve Frontend (local dev only, skipped on Vercel) ─────────────────────────
if not os.environ.get("VERCEL"):
    ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    app.mount("/static", StaticFiles(directory=ROOT_DIR), name="static")

    @app.get("/")
    def serve_index():
        """Serve the frontend HTML at the root URL."""
        return FileResponse(os.path.join(ROOT_DIR, "index.html"))
