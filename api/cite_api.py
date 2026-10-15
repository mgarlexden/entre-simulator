"""출처 검색 API (목업 챗봇용). 실행: python -m uvicorn api.cite_api:app --port 8001

ontology/sources.csv 에서 공신력 있는 출처만 골라 질문과 가장 가까운 것을 돌려준다.
- 포함: 논문(paper), 공공데이터(public_data), 공공기관 보고서(report)
- 제외: 뉴스(news), 블로그(blog), 내부 문서(internal), 익명·미검증 표시가 있는 행
답변 문장은 모델이 만들지 않고, 출처 메모(reliability_note)를 그대로 옮긴다.
"""
from __future__ import annotations

import csv
import math
import os
import re
import requests
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

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
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
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


# ---- KAMIS 원가 조회 (실시간 도매가) ----
KAMIS_API_KEY = os.getenv("KAMIS_API_KEY", "")
KAMIS_URL = "https://www.kamis.go.kr/service/price/xml.do"

# KAMIS 품목 코드 매핑
KAMIS_PRODUCTS = {
    "상추": "1103",      # 상추
    "배추": "1104",      # 배추
    "무": "1101",        # 무
    "당근": "1106",      # 당근
    "양파": "1107",      # 양파
    "대파": "1109",      # 대파
    "시금치": "1108",    # 시금치
    "쑥갓": "1110",      # 쑥갓
    "고추": "1111",      # 고추
    "마늘": "1112",      # 깐마늘
    "토마토": "1201",    # 토마토
    "오이": "1202",      # 오이
    "가지": "1205",      # 가지
}


def fetch_kamis_price(material: str) -> dict | None:
    """KAMIS API에서 실시간 도매가 조회"""
    if material not in KAMIS_PRODUCTS:
        return None

    product_code = KAMIS_PRODUCTS[material]
    today = datetime.now()
    start_day = (today - timedelta(days=7)).strftime("%Y%m%d")  # 7일 전
    end_day = today.strftime("%Y%m%d")

    params = {
        "action": "periodProductList",
        "apikey": KAMIS_API_KEY,
        "startday": start_day,
        "endday": end_day,
        "product": product_code,
    }

    try:
        response = requests.get(KAMIS_URL, params=params, timeout=10)
        response.raise_for_status()

        # XML 파싱
        root = ET.fromstring(response.content)
        items = root.findall(".//item")

        if not items:
            return None

        # 최신 데이터 (가장 최근)
        latest = items[-1]
        price_text = latest.findtext("price", "").replace(",", "")

        # 이전 데이터 (7일 전)
        prev_price_text = items[0].findtext("price", "").replace(",", "")

        try:
            current_price = int(price_text) if price_text else 0
            prev_price = int(prev_price_text) if prev_price_text else current_price
        except ValueError:
            return None

        if current_price == 0:
            return None

        # 변동률 계산
        change = current_price - prev_price
        change_pct = (change / prev_price * 100) if prev_price > 0 else 0

        trend = "올랐어요" if change > 0 else "내렸어요" if change < 0 else "비슷해요"

        return {
            "material": material,
            "current_price": current_price,
            "prev_price": prev_price,
            "change": change,
            "change_pct": round(change_pct, 1),
            "unit": "원/kg",
            "trend": trend,
            "date": latest.findtext("date", ""),
        }
    except Exception as e:
        print(f"KAMIS API 오류: {e}")
        return None


@app.get("/price")
def get_price(material: str = Query(..., min_length=1, max_length=50)):
    """KAMIS 실시간 도매가 조회: 상추, 배추, 무, 당근, 양파 등

    응답 예시:
    {
        "material": "상추",
        "current_price": 3500,
        "prev_price": 3200,
        "change": 300,
        "change_pct": 9.4,
        "unit": "원/kg",
        "trend": "올랐어요",
        "date": "2026-10-15"
    }
    """
    material = material.strip()

    if material not in KAMIS_PRODUCTS:
        available = ", ".join(KAMIS_PRODUCTS.keys())
        return {
            "error": f"'{material}'은 조회할 수 없습니다",
            "available": available,
        }

    if not KAMIS_API_KEY:
        return {
            "error": "KAMIS_API_KEY가 설정되지 않았습니다",
            "info": ".env 파일에 KAMIS_API_KEY를 추가하세요",
        }

    result = fetch_kamis_price(material)

    if result is None:
        return {
            "error": f"{material}의 도매가를 조회할 수 없습니다",
            "info": "KAMIS API 응답을 확인하세요",
        }

    return result


# ---- 축산물 도/소매가 조회 ----
MEAT_PRICE_API_KEY = os.getenv("MEAT_PRICE_API_KEY", "")
LIVESTOCK_URL = "https://www1.livestock.go.kr/api"

# 축산물 품목 코드 매핑 (축산물품질평가원)
LIVESTOCK_PRODUCTS = {
    "돼지고기": "02",      # 돼지고기
    "소고기": "01",        # 소고기
    "닭고기": "03",        # 닭고기
}

# 부위별 코드 (돼지고기 기준)
PORK_CUTS = {
    "삼겹살": "0201",
    "목살": "0202",
    "등심": "0203",
    "앞다리": "0204",
}


def fetch_livestock_price(meat: str) -> dict | None:
    """축산물품질평가원 API에서 축산물 가격 조회 (Mock 데이터 버전)

    실제 API 연동: https://www1.livestock.go.kr/api/
    """
    if meat not in LIVESTOCK_PRODUCTS:
        return None

    # Mock 데이터 (축산물품질평가원 API 연동 대기 중)
    mock_livestock_prices = {
        "돼지고기": {
            "소매": {"current": 18500, "prev": 17800, "unit": "원/kg", "change_pct": 3.9},
            "도매": {"current": 15200, "prev": 14900, "unit": "원/kg", "change_pct": 2.0},
            "parts": {
                "삼겹살": {"current": 21000, "prev": 20200, "unit": "원/kg"},
                "목살": {"current": 12800, "prev": 12500, "unit": "원/kg"},
                "등심": {"current": 18000, "prev": 17300, "unit": "원/kg"},
                "앞다리": {"current": 14500, "prev": 14000, "unit": "원/kg"},
                "갈비": {"current": 28000, "prev": 27000, "unit": "원/kg"},
            }
        },
        "소고기": {
            "소매": {"current": 46500, "prev": 45000, "unit": "원/kg", "change_pct": 3.3},
            "도매": {"current": 39000, "prev": 38000, "unit": "원/kg", "change_pct": 2.6},
            "parts": {
                "등심": {"current": 52000, "prev": 50000, "unit": "원/kg"},
                "안심": {"current": 58000, "prev": 56000, "unit": "원/kg"},
                "불고기": {"current": 35000, "prev": 34000, "unit": "원/kg"},
            }
        },
        "닭고기": {
            "소매": {"current": 8200, "prev": 8000, "unit": "원/kg", "change_pct": 2.5},
            "도매": {"current": 6700, "prev": 6500, "unit": "원/kg", "change_pct": 3.1},
            "parts": {
                "닭다리": {"current": 7500, "prev": 7300, "unit": "원/kg"},
                "닭가슴살": {"current": 9500, "prev": 9200, "unit": "원/kg"},
                "닭날개": {"current": 8000, "prev": 7800, "unit": "원/kg"},
            }
        },
    }

    if meat not in mock_livestock_prices:
        return None

    data = mock_livestock_prices[meat]

    # 소매가를 기본으로 반환
    retail = data["소매"]
    wholesale = data["도매"]

    change_retail = retail["current"] - retail["prev"]
    change_wholesale = wholesale["current"] - wholesale["prev"]

    return {
        "meat": meat,
        "retail_price": retail["current"],
        "retail_prev": retail["prev"],
        "retail_change": change_retail,
        "wholesale_price": wholesale["current"],
        "wholesale_prev": wholesale["prev"],
        "wholesale_change": change_wholesale,
        "unit": "원/kg",
        "date": datetime.now().strftime("%Y-%m-%d"),
    }


@app.get("/livestock")
def get_livestock_price(meat: str = Query(..., min_length=1, max_length=50)):
    """축산물 가격 조회: 돼지고기, 소고기, 닭고기

    응답 예시:
    {
        "meat": "돼지고기",
        "retail_price": 18000,
        "retail_prev": 17500,
        "retail_change": 500,
        "wholesale_price": 15000,
        "wholesale_prev": 14800,
        "wholesale_change": 200,
        "unit": "원/kg",
        "date": "2026-10-15"
    }
    """
    meat = meat.strip()

    if meat not in LIVESTOCK_PRODUCTS:
        available = ", ".join(LIVESTOCK_PRODUCTS.keys())
        return {
            "error": f"'{meat}'은 조회할 수 없습니다",
            "available": available,
        }

    result = fetch_livestock_price(meat)

    if result is None:
        return {
            "error": f"{meat}의 가격을 조회할 수 없습니다",
            "info": "축산물품질평가원 API 응답을 확인하세요",
        }

    return result


# ---- 근거 항목 기반 답변 (pipelines/build_facts.py 가 만든 facts.json) ----
FACTS_PATH = ROOT / "web" / "public" / "mock" / "facts.json"


def _facts() -> dict:
    import json
    return json.loads(FACTS_PATH.read_text(encoding="utf-8"))


STOP = {"얼마예", "알려줘", "알려", "얼마", "얼마나", "몇", "어떻게", "있어요", "인가요", "예요", "이에요", "해줘", "좀", "그리고", "은", "는", "이", "가", "을", "를", "의", "에", "도", "요"}


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


def _vec(text: str) -> Counter:
    return Counter(_grams(text))


# 질문에 자주 쓰는 말을 근거 문장에 실제로 쓰이는 말로 넓힌다. 예: "동향"을 물으면 "추이", "올랐"이 있는 문장을 찾는다.
SYNONYMS = {
    "동향": ["추이", "추세", "올랐", "내렸", "변화"],
    "추세": ["추이", "동향", "변화"],
    "가격": ["원/kg", "원/100g", "경락가격", "도매가", "소비자가격"],
    "최근": ["9월", "8월", "2026"],
    "어때": ["추이", "올랐", "내렸"],
    # 소비자가(소매)와 도매가를 구분한다. 태그 이름에 맞춰 연결한다.
    "소비자": ["소비자가격", "소매"], "소비자가": ["소비자가격", "소매"], "소매가": ["소비자가격", "소매"], "소매": ["소비자가격"],
    "도매가": ["도매", "식육포장"], "도매": ["식육포장"],
}


def _rank_facts(q: str, facts: list[dict]) -> list[tuple[float, dict]]:
    """질문과 근거 항목의 문자 2-gram TF-IDF 코사인 유사도(0~1). 태그는 두 번 넣어 가중치를 준다."""
    docs = [_vec(" ".join(f.get("tags", [])) * 1 + " " + " ".join(f.get("tags", [])) + " " + f["text"]) for f in facts]
    df: Counter = Counter()
    for d in docs:
        df.update(d.keys())
    n = len(docs)
    idf = {g: math.log((n + 1) / (c + 1)) + 1 for g, c in df.items()}

    def weigh(v: Counter) -> dict[str, float]:
        w = {g: c * idf.get(g, math.log(n + 1) + 1) for g, c in v.items()}
        norm = math.sqrt(sum(x * x for x in w.values())) or 1.0
        return {g: x / norm for g, x in w.items()}

    # 자료 어디에도 없는 2-gram(예: '원가', '구입')은 질문 벡터에서 뺀다. 남겨 두면 유사도가 떨어진다.
    toks = _query_tokens(q)
    expanded = toks + [w for t in toks for w in SYNONYMS.get(t, [])]
    qgrams = Counter({g: c for g, c in _vec(" ".join(expanded) or q).items() if g in df})
    qv = weigh(qgrams)
    out = []
    for f, d in zip(facts, docs):
        dv = weigh(d)
        sim = sum(x * dv.get(g, 0.0) for g, x in qv.items())
        # 질문 낱말이 태그와 정확히 같으면 가산점 (예: '도매'는 도매 항목을 먼저 올린다).
        sim += 0.15 * sum(1 for t in expanded if t in f.get("tags", []))
        # 질문에 '수입'이 없으면 수입 돼지고기 항목은 국내산 질문의 답으로 보지 않는다.
        if "수입" not in q and "수입" in f.get("tags", []):
            sim *= 0.8
        out.append((sim, f))
    out.sort(key=lambda x: -x[0])
    return out


# 근거만으로는 답을 정할 수 없는 질문은 항목을 붙이지 않고, 필요한 정보를 되물어 본다.
# (키워드, 되물을 문장). 질문에 숫자가 이미 있으면 되묻지 않는다.
CLARIFY = [
    (re.compile(r"구입 ?비용|원가|예산|재료비|고기 ?값.*(잡|계획)"),
     "돼지고기 구입 비용은 한 달에 쓰는 양을 알아야 계산할 수 있어요. 한 달에 돼지고기를 몇 kg 정도 쓰시나요? 메뉴(삼겹살·목살 등)를 같이 알려 주시면 더 정확하게 계산해 드릴게요."),
]


@app.get("/ask")
def ask(q: str = Query(..., min_length=1, max_length=300), k: int = Query(3, ge=1, le=6)):
    data = _facts()
    if not re.search(r"\d", q):
        for pat, ask_back in CLARIFY:
            if pat.search(q):
                return {"answer": None, "facts": [], "citations": [], "message": ask_back}
    ranked = _rank_facts(q, data["facts"])
    # 유사도 0.15 미만은 무관한 것으로 보고 버린다. 최고 유사도의 70% 아래도 뺀다.
    top = ranked[0][0] if ranked else 0.0
    if top < 0.15:
        return {"answer": None, "facts": [], "citations": [],
                "message": "등록된 근거 자료에 없는 질문이에요. 화면의 숫자에 대한 질문이나 상권·상가·날씨·공휴일·축산물 가격에 대한 질문을 해 주세요."}
    hits, seen_text = [], set()
    for sim, f in ranked:
        if sim < max(0.15, 0.7 * top) or f["text"] in seen_text:
            continue
        seen_text.add(f["text"])
        hits.append((sim, f))
        if len(hits) == k:
            break
    used_ids: list[str] = []
    facts_out = []
    for sim, f in hits:
        for sid in f["sources"]:
            if sid not in used_ids:
                used_ids.append(sid)
        facts_out.append({"text": f["text"], "source_ids": f["sources"], "similarity": round(sim, 3)})
    citations = []
    for sid in used_ids:
        src = data["sources"][sid]
        citations.append({"id": sid, "title": src["title"], "publisher": src["publisher"], "year": src["period"],
                          "type": "공공 API", "url": src["url"], "note": f"호출 식별자: {src['api']}"})
    # 항목이 둘 이상이면 불릿으로 나눠 보여 준다.
    answer = facts_out[0]["text"] if len(facts_out) == 1 else "\n".join(f"• {f['text']}" for f in facts_out)
    return {"answer": answer, "facts": facts_out, "citations": citations}
