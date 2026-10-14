"""출처 검색 API (목업 챗봇용). 실행: python -m uvicorn api.cite_api:app --port 8001

ontology/sources.csv 에서 공신력 있는 출처만 골라 질문과 가장 가까운 것을 돌려준다.
- 포함: 논문(paper), 공공데이터(public_data), 공공기관 보고서(report)
- 제외: 뉴스(news), 블로그(blog), 내부 문서(internal), 익명·미검증 표시가 있는 행
답변 문장은 모델이 만들지 않고, 출처 메모(reliability_note)를 그대로 옮긴다.
"""
from __future__ import annotations

import csv
import re
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / "ontology" / "sources.csv"
CREDIBLE_TYPES = {"paper", "public_data", "report"}
# 뉴스는 원자료를 만든 기관이 제목·발행처·메모에 명시된 경우만 쓴다 (예: "참가격", "국세청 2023").
PRIMARY_AGENCIES = (
    "참가격", "축산물품질평가원", "KAMIS", "국세청", "한국은행", "식약처", "식품의약품안전처", "KREI", "농촌경제연구원",
    "한국부동산원", "농림축산식품부", "중소벤처기업부", "국가데이터처", "통계청", "소상공인시장진흥공단",
    "금융위원회", "기상청", "서울특별시",
)
NEWS_EXCLUDE = ("anecdotal", "opinion", "vendor", "snippet", "scope unclear")  # 사례, 의견, 업체 추정, 검색 조각, 범위 불명
EXCLUDE_PREFIXES = ("UNVERIFIED",)              # whole source flagged by the research team
EXCLUDE_MARKERS = (                                 # only a summary, snippet or preprint was read, not the checked original
    "anonymous", "search snippet", "search summary", "not the paper", "preprint", "not opened",
)

app = FastAPI(title="출처 검색 (목업 챗봇)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5174", "http://localhost:5174"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _load() -> list[dict]:
    rows = []
    with CSV.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            note = r.get("reliability_note", "") or ""
            if r.get("type") not in CREDIBLE_TYPES:
                if r.get("type") != "news":
                    continue
                named = " ".join([r["title"], r.get("publisher_author", ""), note])
                if not any(a in named for a in PRIMARY_AGENCIES):
                    continue
                if any(m in note.lower() for m in NEWS_EXCLUDE):
                    continue
            if note.upper().startswith(EXCLUDE_PREFIXES) or any(m in note.lower() for m in EXCLUDE_MARKERS):
                continue
            rows.append({
                "id": r["source_id"],
                "title": r["title"],
                "publisher": r.get("publisher_author", ""),
                "year": r.get("year", "") or "",
                "url": r.get("url", ""),
                "type": r["type"],
                "note": note,
            })
    return rows


SOURCES = _load()
TYPE_LABEL = {"paper": "논문", "public_data": "공공데이터", "report": "공공기관 보고서", "news": "언론 보도 (원자료 기관 명시)"}


def _grams(text: str) -> set[str]:
    t = re.sub(r"[^0-9A-Za-z가-힣]+", "", text.lower())
    return {t[i:i + 2] for i in range(len(t) - 1)}


def _score(q: set[str], s: dict) -> float:
    """Share of the question's two-character pieces that appear in the source's title, publisher or note."""
    doc = _grams(" ".join([s["title"], s["publisher"], s["note"]]))
    if not q or not doc:
        return 0.0
    overlap = len(q & doc)
    return overlap / len(q) if overlap >= 2 else 0.0


@app.get("/cite")
def cite(q: str = Query(..., min_length=1, max_length=300), k: int = Query(3, ge=1, le=5)):
    qg = _grams(q)
    ranked = sorted(((_score(qg, s), s) for s in SOURCES), key=lambda x: -x[0])
    hits = [s for sc, s in ranked if sc >= 0.15][:k]
    cites = [{
        "id": s["id"], "title": s["title"], "publisher": s["publisher"], "year": s["year"],
        "type": TYPE_LABEL[s["type"]], "url": s["url"], "note": s["note"],
    } for s in hits]
    if not cites:
        answer = "목업에서 쓰는 공신력 있는 출처 중에는 이 질문에 맞는 자료가 없어요. 출처 장부에서 전체 목록을 볼 수 있어요."
    else:
        answer = "공신력 있는 출처에서 찾은 내용이에요. 아래 자료 메모를 그대로 옮긴 것이라 숫자의 맥락은 원자료로 확인해 주세요."
    return {"answer": answer, "citations": cites, "credible_count": len(SOURCES)}


@app.get("/health")
def health():
    return {"ok": True, "credible_sources": len(SOURCES)}


# ---- 근거 항목 기반 답변 (pipelines/build_facts.py 가 만든 facts.json) ----
FACTS_PATH = ROOT / "web" / "public" / "mock" / "facts.json"


def _facts() -> dict:
    import json
    return json.loads(FACTS_PATH.read_text(encoding="utf-8"))


STOP = {"알려줘", "알려", "얼마", "얼마나", "몇", "어떻게", "있어요", "인가요", "예요", "이에요", "해줘", "좀", "그리고", "은", "는", "이", "가", "을", "를", "의", "에", "도", "요"}


def _query_tokens(q: str) -> list[str]:
    """질문을 낱말로 나누고 조사(가·는·을 등)를 떼어 낸다. 예: '돼지고기 소매가' -> ['돼지고기', '소매']."""
    out = []
    for t in re.findall(r"[0-9A-Za-z가-힣]+", q):
        if t in STOP or len(t) < 2:
            continue
        if len(t) > 2 and t[-1] in "가이은는을를의에도요":
            t = t[:-1]
        if len(t) >= 2 and t not in STOP:
            out.append(t)
    return out


def _fact_score(tokens: list[str], fact: dict) -> float:
    """낱말마다 점수: 태그와 같으면 3점, 태그에 들어 있으면 2점, 문장에 있으면 1점."""
    tags = [t for t in fact.get("tags", []) if t]
    text = fact["text"]
    score = 0.0
    for t in tokens:
        if t in tags:
            score += 3
        elif any(t in tag or tag in t for tag in tags):
            score += 2
        elif t in text:
            score += 1
    return score


@app.get("/ask")
def ask(q: str = Query(..., min_length=1, max_length=300), k: int = Query(2, ge=1, le=6)):
    data = _facts()
    tokens = _query_tokens(q)
    scored = [(_fact_score(tokens, f), f) for f in data["facts"]]
    scored = [(sc, f) for sc, f in scored if sc >= 2]
    if not scored:
        return {"answer": None, "facts": [], "citations": [],
                "message": "등록된 근거 자료에 없는 질문이에요. 화면의 숫자에 대한 질문이나 상권·상가·날씨·공휴일·축산물 가격에 대한 질문을 해 주세요."}
    # 가장 높은 점수의 60% 이상인 항목만 남기고, 점수 순으로 k개까지 보여 준다.
    top = max(sc for sc, _ in scored)
    scored = [(sc, f) for sc, f in scored if sc >= 0.75 * top]
    scored.sort(key=lambda x: -x[0])
    hits = []
    seen_text = set()
    for _, f in scored:
        if f["text"] in seen_text:
            continue
        seen_text.add(f["text"])
        hits.append(f)
        if len(hits) == k:
            break
    used_ids: list[str] = []
    facts_out = []
    for f in hits:
        cites = []
        for sid in f["sources"]:
            if sid not in used_ids:
                used_ids.append(sid)
            cites.append(sid)
        facts_out.append({"text": f["text"], "source_ids": cites})
    citations = []
    for sid in used_ids:
        s = data["sources"][sid]
        citations.append({"id": sid, "title": s["title"], "publisher": s["publisher"], "year": s["period"],
                          "type": "공공 API", "url": s["url"], "note": f"호출 식별자: {s['api']}"})
    answer = " ".join(f["text"] for f in facts_out)
    return {"answer": answer, "facts": facts_out, "citations": citations}
