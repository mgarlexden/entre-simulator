"""챗봇 /ask 확장: 우리 사실 합치기, 주제 필터, 화면이 보낸 점포 값(ctx)으로 즉석 문장 만들기.

api/cite_api.py (수빈 님)의 검색 점수 계산(_rank_facts)과 근거 파일(facts.json)은 그대로 쓰고, 그 앞뒤만 바꾼다.
cite_api.py 끝에서 install(app)을 한 번 부르면 /ask 가 이 모듈의 것으로 바뀐다.

하는 일
  1. 근거 합치기   facts.json (API 자료) + facts_changeup.json (월세, 동네, 경영 지표) + ctx 로 만든 문장
  2. 주제 필터     질문에서 주제를 먼저 알아내고, 그 주제의 근거 문장만 후보로 남긴다. 모델은 쓰지 않는다.
  3. 범위 밖 질문  로또, 주식, 세금처럼 이 서비스가 다루지 않는 질문은 억지로 답하지 않는다.
  4. 모를 때       맞는 근거가 없으면 없다고 말한다 (다른 주제의 문장을 대신 붙이지 않는다).
LLM 이나 임베딩을 쓰지 않으므로 답은 근거 문장 그대로이고 비용이 들지 않는다.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MOCK = ROOT / "web" / "public" / "mock"

# ---------------------------------------------------------------- 주제 (질문 정규식 -> 근거 문장 id 접두사)
FAMILIES: dict[str, tuple[str, ...]] = {
    "weather": ("weather", "hourly_rain"),
    "holiday": ("holiday",),
    "rent": ("rent_", "premium", "kosis_cost_임차료", "live_rent", "live_deposit"),
    "competition": ("pork", "dong_", "live_shop"),
    "sales": ("hansik", "cafe", "dong_"),
    "neighborhood": ("dong_", "rent_dong_"),
    "price": ("price_", "kmta_pork", "kmta_import", "kmta_retail_pork", "kmta_market_pork", "pork_retail", "pork_import",
              "pork_wholesale", "pork_margin", "pork_stock", "pig_auction"),
    "livestock": ("kape_", "pig_", "kmta_hanwoo", "kmta_pork_grading", "kmta_pork_consumption"),
    "cost": ("kosis_",),
    "myshop": ("live_",),
}
TOPIC_RE: list[tuple[str, re.Pattern]] = [
    ("weather", re.compile(r"날씨|기온|장마|강수|소나기|비가|비 ?(오|와|온|올|내)|눈이|눈 ?(오|와|온)|더위|추위|한파|폭염")),
    ("holiday", re.compile(r"공휴일|휴일|연휴|명절|설날|추석|쉬는 ?날")),
    ("rent", re.compile(r"월세|임대|임차|보증금|권리금|평당")),
    ("competition", re.compile(r"경쟁|몇 ?곳|몇 ?군데|가게 ?수|점포 ?수|고깃집 ?수|고깃집이 ?몇|몇 ?개|가장 많은 ?(구|동)|새로 ?생기")),
    ("sales", re.compile(r"매출|객단가|폐업|생존|문 ?닫|결제|한식음식점|카페")),
    ("neighborhood", re.compile(r"동네|행정동|유형")),
    ("price", re.compile(r"가격|시세|도매|소비자가|소매|경락|삼겹|목살|목심|항정|kg|지육|원육|고기 ?값|물가|올랐|내렸|오를|내릴")),
    ("livestock", re.compile(r"사육|마릿수|마리|두수|농장|농가|출하|도축|자돈|젖소|한우|육우|송아지")),
    ("cost", re.compile(r"식재료비|인건비|임차료|영업이익률|원가율|마진|비용 ?구조|비율|퍼센트|몇 ?%|몇 ?프로")),
    ("myshop", re.compile(r"이 ?(동네|구|지역)|내 ?(가게|점포|조건)|제 ?가게|우리 ?가게|입력한|내가|제가|본전|회수|되찾|흑자|적자|몇 ?달|개월|영업이익(?!률)|"
                          r"현금|잔고|여는 ?데|창업 ?비용|들어요|드는|투자|대출|직원|알바|테이블|평수|몇 ?평|좌석|몇 ?석|시뮬레이션|"
                          r"하루에 ?몇|몇 ?명|남기|남아요|남나요")),
]
OWN = re.compile(r"내 ?(가게|점포|조건|월세)|제 ?가게|우리 ?가게|입력한|내가|제가|지금 ?(내|제)|이 ?(동네|구|지역)|여기")
OFFTOPIC = re.compile(r"로또|비트코인|코인|주식|펀드|환율|대통령|선거|축구|야구|연애|영화|숙제|세금|세무|부가세|법률|소송|대출 ?상품|"
                      r"(내일|오늘|모레|이번 ?주).{0,6}(날씨|비)|맛집 ?추천|번호 ?알려")
PORK_PRICE = re.compile(r"^pork_(retail|import|wholesale|margin|stock)")
RULEQ = re.compile(r"어떻게 ?(나눠|분류|정해|구분|나누)|분류 ?(기준|방법)|기준이 ?뭐|규칙")
SNOW = re.compile(r"눈 ?(이|도)? ?(오|와|온|올|내)|폭설|적설")
GU = re.compile(r"[가-힣]{1,3}구(?![가-힣])")
PER_GU = re.compile(r"^(hansik_(?!seoul)|cafe_(?!seoul)|pork_(?!top|retail|import|wholesale|margin|stock))")
EFFECT = re.compile(r"줄어|늘어|영향|효과|떨어|오르면|내리면|올리면|때문에|손님이 ?(줄|늘)")

NONE_MESSAGE = ("이 질문에 맞는 근거 자료는 아직 없어요. 월세, 동네, 상가 점포 수, 매출·폐업률, 외식업 비용 구성, 날씨, 공휴일, "
                "돼지고기 가격에 대한 질문이나 입력한 가게와 시뮬레이션 결과에 대한 질문을 해 주세요.")
OFF_MESSAGE = "이 서비스는 가게를 열 때 필요한 숫자(동네, 월세, 비용, 가격, 시뮬레이션)만 다뤄요. 세금, 법률, 투자 같은 질문은 답하지 않아요."


# ---------------------------------------------------------------- 근거 읽기
_CACHE: dict[str, tuple[tuple, dict]] = {}


def _load(name: str) -> dict:
    p = MOCK / name
    if not p.exists():
        return {"sources": {}, "facts": []}
    stamp = (p.stat().st_mtime_ns, p.stat().st_size)
    hit = _CACHE.get(name)
    if hit and hit[0] == stamp:
        return hit[1]
    d = json.loads(p.read_text(encoding="utf-8"))
    _CACHE[name] = (stamp, d)
    return d


def static_facts() -> tuple[list[dict], dict]:
    a, b = _load("facts.json"), _load("facts_changeup.json")
    return a["facts"] + b["facts"], {**a["sources"], **b["sources"]}


def dong_names() -> set[str]:
    return {f["tags"][0] for f in _load("facts_changeup.json")["facts"] if f["id"].startswith("dong_") and f["id"] != "dong_type_rule"}


# ---------------------------------------------------------------- 화면이 보낸 값으로 만드는 문장
def man(v: float) -> str:
    """만원 단위 숫자 -> '7,383만원', 1억 이상은 '1억 2,000만원' (화면의 man()과 같다)."""
    v = round(v)
    sign = "−" if v < 0 else ""
    v = abs(v)
    if v >= 10000:
        eok, rest = divmod(v, 10000)
        return f"{sign}{eok}억" + (f" {rest:,}만원" if rest else "원")
    return f"{sign}{v:,}만원"


def won(v: float) -> str:
    return man(v / 1e4)


def signed(v: float) -> str:
    s = won(v)
    return s if v < 0 else f"+{s}"


def live_facts(ctx: dict | None) -> list[dict]:
    if not ctx:
        return []
    out: list[dict] = []

    def add(fid: str, tags: list[str], text: str) -> None:
        out.append({"id": f"live_{fid}", "tags": ["내가게", "내", "가게", *tags], "text": text, "sources": ["app"]})

    where = f"{ctx.get('gu', '')}{' ' + ctx['dong'] if ctx.get('dong') else ''}".strip()
    p = ctx.get("pyeong")
    if p:
        add("shop", ["점포", "직원", "알바", "인원", "평수", "테이블", "좌석", "규모", "몇 명", "몇 평"],
            f"지금 입력한 가게는 {where}에 {p}평, 테이블 {ctx.get('tables', '?')}개({ctx.get('seats', '?')}석), 직원 {ctx.get('staff', '?')}명이에요."
            + (f" 동네 유형은 {ctx['area_type']}이에요." if ctx.get("area_type") else ""))
    if ctx.get("pork_area") is not None or ctx.get("pork_gu") is not None:
        n = ctx.get("pork_area") if ctx.get("pork_area") is not None else ctx.get("pork_gu")
        st = f", 한식음식점 {ctx['stores_area']:,}곳" if ctx.get("stores_area") else ""
        add("area", ["경쟁", "점포", "고깃집", "돼지고기", "동네", "몇 곳", "이 동네", "가게 수"],
            f"{where or ctx.get('gu', '')}에는 돼지고기 구이·찜 가게가 {n:,}곳{st} 있어요." + (f" 서울 25개 구 중 {ctx['pork_rank']}번째로 많은 구예요." if ctx.get("pork_rank") else ""))
    if ctx.get("rent") is not None and p:
        add("rent", ["월세", "임대", "평당", "임대료"],
            f"월세는 평당 약 {ctx['rent']}만원({ctx.get('rent_src', '입력')})으로 잡았어요. {p}평이면 한 달 약 {man(ctx['rent'] * p)}이에요.")
    total = ctx.get("opening_total")
    if total is not None:
        lines = sorted(ctx.get("lines") or [], key=lambda x: -x.get("amount", 0))[:3]
        top = ", ".join(f"{x['label']} {man(x['amount'])}" for x in lines)
        add("opening", ["여는", "비용", "창업", "투자", "개업", "드는", "돈", "인테리어", "설비", "얼마"],
            f"여는 데 드는 돈은 {man(total)}이에요." + (f" 가장 큰 항목은 {top}이에요." if top else ""))
    if ctx.get("deposit") is not None:
        add("deposit", ["보증금", "월세", "임대", "돌려"],
            f"보증금은 {man(ctx['deposit'])}이고 가게를 닫을 때 돌려받는 돈이에요.")
    if ctx.get("cash_left") is not None:
        loan = f" + 대출 {man(ctx['loan'])}" if ctx.get("loan") else ""
        add("cash", ["현금", "잔고", "남", "자금", "가진", "운영자금", "통장"],
            f"가진 돈 {man(ctx.get('capital', 0))}{loan}에서 여는 데 {man(total or 0)}을 쓰고 {man(ctx['cash_left'])}이 남아요.")
        add("loan", ["대출", "이자", "빚"],
            f"대출은 {man(ctx['loan'])}이고 이자만 매달 낸다고 가정했어요(연 6%)." if ctx.get("loan") else "대출은 받지 않았어요.")

    eng = ctx.get("engine")
    if not eng or not eng.get("months"):
        add("sim_none", ["본전", "회수", "되찾", "몇 달", "개월", "흑자", "남기", "시작", "시뮬레이션", "영업이익", "투자금", "하루", "몇 명"],
            "아직 시뮬레이션을 돌리지 않았어요. 시뮬레이션 탭에서 6개월을 돌리면 몇 달째부터 남는지, 투자금을 언제 되찾는지 알려 드릴 수 있어요.")
        return out
    for m in eng["months"]:
        add(f"month_{m['month']}", [f"{m['month']}월", "영업이익", "매출", "손님", "시뮬레이션", "결과", "이번 달", "지난달"],
            f"시뮬레이션 {m['month']}월은 매출 {won(m['revenue'])}, 영업이익 {signed(m['op'])}이었어요. 손님은 {round(m['covers']):,}명이에요.")
    n = len(eng["months"])
    if eng.get("finished"):
        pb = eng.get("payback") or {}
        spent = eng.get("spent")
        tags = ["본전", "회수", "되찾", "몇 달", "개월", "흑자", "남기", "시작", "투자금", "시뮬레이션"]
        if pb.get("month"):
            add("payback", tags, f"쓴 돈 {won(spent)}은 {pb['month']}개월째에 되찾아요"
                + (" (6개월 뒤는 마지막 석 달 평균으로 이어 붙인 추정이에요)." if pb.get("estimated") else "."))
        else:
            add("payback", tags, f"쓴 돈 {won(spent or 0)}은 이 속도로는 되찾지 못해요" + (f" ({pb['reason']})." if pb.get("reason") else "."))
        add("end", ["현금", "6개월", "뒤", "잔고", "최저", "시뮬레이션", "남아"],
            f"{n}개월 뒤 현금은 {won(eng.get('end_cash', 0))}이고, 가장 낮았던 때는 {won(eng.get('lowest_cash', 0))}이에요."
            + (" 가게를 닫게 됐어요." if eng.get("closed") else ""))
    else:
        add("progress", ["본전", "회수", "되찾", "몇 달", "개월", "흑자", "남기", "시작", "투자금", "현금", "잔고", "시뮬레이션"],
            f"시뮬레이션은 {n}개월째까지 진행했고 지금 현금은 {won(eng.get('cash_now', 0))}이에요. 6개월을 끝까지 돌리면 투자금을 언제 되찾는지 알려 드릴 수 있어요.")
    last = next((m for m in reversed(eng["months"]) if m.get("covers")), None)
    if last:
        contrib = (last["revenue"] - last["cogs"] - last["fees"]) / last["covers"]
        fixed = last["labor"] + last["rent"] + last["mgmt"]
        if contrib > 0:
            per_month = fixed / contrib
            days = last.get("open_days") or 26
            add("breakeven", ["본전", "하루", "몇 명", "손님", "손익분기", "받아야", "시뮬레이션"],
                f"{last['month']}월 비용 기준으로 영업이익이 0이 되려면 한 달 약 {round(per_month):,}명, 하루 약 {round(per_month / days):,}명이 와야 해요 "
                f"(사장 가상 급여 300만원 포함). 그달에는 하루 평균 {round(last['covers'] / days):,}명이 왔어요.")
    return out


# ---------------------------------------------------------------- 주제 판별과 선택
def match_dongs(q: str, dongs: set[str]) -> set[str]:
    """질문에 나온 동 이름. 정확히 같거나, '망원동'처럼 어간이 같은 동(망원1동, 망원2동)."""
    found = {d for d in dongs if d in q}
    for tok in re.findall(r"([가-힣]{2,5})동(?![가-힣])", q):
        found |= {d for d in dongs if d.startswith(tok) and d.endswith("동")} if len(tok) >= 2 else set()
    return found


def topics(q: str, dongs: set[str]) -> set[str]:
    t = {name for name, rx in TOPIC_RE if rx.search(q)}
    if match_dongs(q, dongs):
        t.add("neighborhood")
    return t


def allowed_ids(fid: str, tps: set[str], q: str) -> bool:
    if not tps:
        return True
    pre: list[str] = []
    for t in tps:
        pre += FAMILIES[t]
    if fid.startswith(tuple(pre)):
        if PORK_PRICE.match(fid) and "price" not in tps:
            return False   # pork_retail_*, pork_wholesale_* 는 가격 주제에서만 (고깃집 점포 수 질문에 끼지 않게)
        return True
    return False


def run(q: str, ctx: dict | None = None, k: int = 3) -> dict:
    from api import cite_api as C   # 늦게 불러서 순환 import를 피한다

    if OFFTOPIC.search(q) and not OWN.search(q):
        return {"answer": None, "facts": [], "citations": [], "message": OFF_MESSAGE}
    stat, sources = static_facts()
    live = live_facts(ctx)
    sources = {**sources, **({"app": _load("facts_changeup.json")["sources"].get("app")} if live else {})}
    dongs = dong_names()
    tps = topics(q, dongs)
    near = match_dongs(q, dongs)
    named_dong = bool(near)
    if near:
        tps.add("neighborhood")
        q = q + " " + " ".join(sorted(near)[:6])   # 어간으로 찾은 동 이름을 질문에 보태 같은 이름의 문장을 찾게 한다
    if SNOW.search(q):
        return {"answer": None, "facts": [], "citations": [], "message": "눈이 오는 날에 대한 자료는 없어요. 비가 온 시간의 비율은 있으니 날씨 질문으로 물어봐 주세요."}

    if not re.search(r"\d", q):
        for pat, ask_back in C.CLARIFY:
            if pat.search(q) and "cost" not in tps and not re.search(r"요즘|최근|지금|현재|시세|올랐|내렸|오를|얼마예요|얼마에요", q):
                return {"answer": None, "facts": [], "citations": [], "message": ask_back}

    pool = stat + live
    if not named_dong and "neighborhood" not in tps:
        pool = [f for f in pool if not f["id"].startswith(("dong_", "rent_dong_"))]
    pool = [f for f in pool if allowed_ids(f["id"], tps, q) or f["id"].startswith("live_") and "myshop" in tps]
    if not pool:
        return {"answer": None, "facts": [], "citations": [], "message": NONE_MESSAGE}
    if not GU.search(q) and not named_dong and tps & {"sales", "competition"} and "rent" not in tps:
        seoul = [f for f in pool if not PER_GU.match(f["id"])]
        pool = seoul or pool
    if OWN.search(q) and live:
        own = [f for f in pool if f["id"].startswith("live_")]
        pool = own or pool

    if "neighborhood" in tps and RULEQ.search(q) and not named_dong:
        rule = [f for f in stat if f["id"] == "dong_type_rule"]
        pool = rule or pool

    ranked = C._rank_facts(q, pool)
    # 화면이 보낸 값은 지금 사용자가 보고 있는 가게의 값이라 같은 점수면 먼저 보여 준다
    ranked = sorted(((s * (1.25 if f["id"].startswith("live_") else 1.0), f) for s, f in ranked), key=lambda x: -x[0])
    top = ranked[0][0] if ranked else 0.0
    if top < 0.15:
        return {"answer": None, "facts": [], "citations": [], "message": NONE_MESSAGE}
    hits, seen = [], set()
    for sim, f in ranked:
        if sim < max(0.15, 0.7 * top) or f["text"] in seen:
            continue
        seen.add(f["text"])
        hits.append((sim, f))
        if len(hits) == k:
            break
    facts_out, used = [], []
    for sim, f in hits:
        for sid in f["sources"]:
            if sid not in used:
                used.append(sid)
        facts_out.append({"text": f["text"], "source_ids": f["sources"], "similarity": round(sim, 3)})
    cites = []
    for sid in used:
        s = sources.get(sid)
        if not s:
            continue
        cites.append({"id": sid, "title": s["title"], "publisher": s["publisher"], "year": s["period"],
                      "type": "화면 계산" if sid == "app" else "공공 API", "url": s["url"], "note": f"호출 식별자: {s['api']}"})
    answer = facts_out[0]["text"] if len(facts_out) == 1 else "\n".join(f"• {f['text']}" for f in facts_out)
    if EFFECT.search(q) and tps and "myshop" not in tps:
        answer = "이 일이 손님 수나 매출에 얼마나 영향을 주는지 직접 잰 자료는 없어요. 대신 관련 자료를 보여 드려요.\n" + answer
    return {"answer": answer, "facts": facts_out, "citations": cites}


def install(app) -> None:
    """cite_api 의 GET /ask 를 이 모듈의 것으로 바꾸고, ctx 를 받는 POST /ask 를 추가한다."""
    from fastapi import Body, Query

    app.router.routes = [r for r in app.router.routes if not (getattr(r, "path", "") == "/ask")]

    @app.get("/ask")
    def ask_get(q: str = Query(..., min_length=1, max_length=300), k: int = Query(3, ge=1, le=6)):
        return run(q, None, k)

    @app.post("/ask")
    def ask_post(body: dict = Body(...)):
        q = str(body.get("q", ""))[:300]
        if not q.strip():
            return {"answer": None, "facts": [], "citations": [], "message": "질문을 적어 주세요."}
        ctx = body.get("ctx") if isinstance(body.get("ctx"), dict) else None
        return run(q, ctx, max(1, min(6, int(body.get("k", 3)))))
