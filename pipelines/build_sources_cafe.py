"""web/public/mock/sources_cafe.json 을 만든다. #/sources 카페 탭의 갭 표 데이터.
카페 갭 대조: 갭 정리표(106개) x 팀원 파일 2개 x 건희 최신 params.yaml -> sources_cafe.json
입력은 모두 읽기 전용. 값은 파일에 적힌 그대로 옮기고 해석은 STATUS 규칙과 OVERRIDE 에만 있다."""
import json, re, sys
from pathlib import Path
import openpyxl, yaml

# 사용: python -m pipelines.build_sources_cafe <갭 정리표.xlsx> <params.yaml> <출력.json>
#   갭 정리표 = 카페_건희_데이터_갭_정리.xlsx (이 저장소 밖, 팀 공유 폴더)
#   params.yaml = sdic-persona-team1 origin/feat/cafe-month 의 research/cafe/params.yaml (git show 로 꺼냄)
GAP, PARAMS, OUT = (Path(a) for a in sys.argv[1:4])

P = yaml.safe_load(PARAMS.read_text(encoding="utf-8"))
SECT = {"상권별 값": "district_meta", "수요": "demand", "처리 능력": "capacity", "초기 투자비": "capex",
        "월 운영비": "opex", "12개월 시즌": "season", "매장 배치 규격": "layout"}
DIST = {"대학로": "3120012", "신촌": "3120094", "성수동카페거리": "3110131"}


def now_of(area: str, var: str):
    m = re.match(r"(\w+) \((.+)\)", var)
    if m:
        k, d = m.group(1), DIST.get(m.group(2))
        e = P["district_meta"].get(d, {}).get(k) if d else None
    else:
        e = P.get(SECT.get(area, ""), {}).get(var)
    if not isinstance(e, dict):
        return None, None, None
    return e.get("value"), e.get("grade"), e.get("note") or e.get("source")


def short(v, n=60):
    s = json.dumps(v, ensure_ascii=False) if not isinstance(v, str) else v
    return s if len(s) <= n else s[: n - 1] + "…"


# 약한 근거 보완_1014.xlsx 의 12행 (원 시트 '보완 결과'). 값은 파일 그대로, 반영 여부는 건희 params.yaml 과 비교한 결과.
WEAK12 = {
    "independent_scale": ("0.55 → 0.72 (범위 0.71~0.74)", "채움", "충돌",
                          "건희가 10-14에 이 변수를 없애고 업계 평균 연매출(1억 9,033만원) × 상권 지수 방식으로 바꿈. 팀원 값은 쓰이지 않음. 두 방식의 수요 크기가 다른지 비교 필요"),
    "weekly_holiday_factor": ("1.2 (209h ÷ 174h)", "채움", "반영", "건희 params.yaml 이 1.2, 등급 H(근로기준법)로 이미 같은 값. 주 15시간 미만 1.0 분기는 시뮬에 아직 없음"),
    "vat_refund_month": ("2 (조기환급 법정 일정과 일치)", "채움", "미반영", "근거는 확보했으나 건희 params.yaml 등급은 L 그대로. 조기환급 미신청 시 6~7개월 지연 시나리오를 둘지 결정 필요"),
    "electrical": ("공중 1,419,000 / 지중 2,029,500 (15kW 증설, VAT 포함)", "채움", "미반영", "건희 값 200만원(L) 그대로. 증설 kW와 공중/지중은 매장 가정이고 내부 배선 공사비는 따로 견적 필요. 건희는 같은 날 한전 표준시설부담금 73~85만원(5→11kW)을 별도로 찾음"),
    "electricity_anchor_20py_krw": ("300,000 × 월별 계절 지수 0.97~1.60", "채움", "미반영", "건희 params.yaml 은 기사 1건(L) 값 그대로이고 계절 지수는 어디에도 쓰이지 않음. 서비스업 전체가 대리 지표(카페만의 통계 없음)"),
    "key_money_krw (성수동카페거리)": ("39,900,000 → 42,640,000 (상가임대차 실태조사 2023, 업종 무관 1층)", "채움", "미반영", "건희는 R-ONE 서울 숙박·음식점 중앙값 3,990만원을 M으로 두고 농경연 표22(3,828.6만원)로 교차 확인만 함. 상권별 실측값은 쓰지 않음"),
    "key_money_krw (신촌)": ("39,900,000 → 75,790,000 (신촌역 로터리, 기존의 약 1.9배)", "채움", "미반영", "위와 같음. 값 차이가 커서 신촌 점포 초기 투자비가 크게 달라짐"),
    "dessert_food_cost_share": ("0.40 → 0.30 (업소용 냉동 베이커리 도매가 25~31%, 구매 원가 기준)", "채움", "충돌", "건희는 같은 날 농경연 표97 ÷ 표95(제과 39.7%)로 0.40을 M으로 올림. 팀원은 구매 원가, 건희는 직접 굽는 제과점 원가율이라 정의가 다름"),
    "machine_cph_by_groups": ("{1:30, 2:60, 3:95, 4:120} 유지. 소비전력 상한 검산 1그룹 83잔/h, 2그룹 121잔/h", "일부 채움", "참고", "제조사 사양에 시간당 잔 수가 없어 상한 검산만 가능. 1잔 100kJ, 60초는 가정"),
    "barista_cph": ("45 유지 (근거 범위 32~60)", "채움", "반영", "건희도 같은 날 M(Rao, WBC)으로 올림. 팀원은 자격시험 최저 속도로 하한 32를 추가"),
    "dwell_h": ("보류 (오픈서베이 2026에 체류시간 문항 없음)", "보류", "남음", "건희 params.yaml 은 2012·2013 자기응답 조사로 M(1.1h)을 둠. 팀원 쪽은 새 근거 없음"),
    "balk_max": ("0.1 유지 (모형·실험 논문뿐, 매장 실측 없음)", "보류", "남음", "0~0.2 범위 민감도 변수로 처리 권장"),
}


# 카페_시뮬레이터_입점_변수자료_v6.xlsx (카페 리서치 팀원, 2026-10-14, Drive '카페_자료 모음'): 독립(비프랜차이즈) 카페만 걸러
# KREI 2025 원자료에서 직접 계산한 값과 서울 425개 행정동 지표. 값은 엑셀에 적힌 그대로.
V6 = {
    "independent_scale": ("서울 독립 카페 월매출 평균 1,460만원(n=63). 전국 독립 연매출 평균 1억 3,507만 / 중앙값 1억 234만", "채움",
                          "건희 앵커(전국 음료점 평균 연 1억 9,033만원, 프랜차이즈 포함) 대비 전국 독립 평균 0.71배, 서울 독립 월 1,460만 ÷ 1,586만 = 0.92배. 서울 값은 표본 63곳으로 작음"),
    "dine_in_share": ("독립 카페 매출 비중: 홀 71.9% / 포장 22.0% / 배달 6.2% (평균, H)", "채움",
                      "설문 49.4%(건희), 전체 64.8%(팀원 1차)와 또 다른 값. 독립 카페만으로 계산한 값이라 정의가 가장 맞음. 어느 값을 쓸지 결정 필요"),
    "misc_krw": ("기타비용 월 49.9만원 (독립, 25~75%: 18.8~90.4만, 홍보·수수료·소모품 포함)", "채움", "건희 40만원(가정)과 같은 규모. 기타비용 비율 6%(4~10%)"),
    "water_gas_krw": ("세금과 공과 월 49.9만원 (독립 중앙값, 세금 포함이라 수도·가스만 분리 불가)", "참고", "분리 불가는 그대로"),
    "open_hour": ("오픈 10시 (낮음 9, 높음 10.5), 독립 카페 중앙값", "채움", "건희 10시와 같음"),
    "close_hour": ("마감 21시 (낮음 19, 높음 22), 하루 평균 10.6시간", "채움", "건희 22시(가정)보다 1시간 이름. 표준 영업시간 선택지를 21시로 바꿀지 결정"),
    "days_per_month": ("월 영업일 26일 (25~75%: 26~30일), 독립 카페 중앙값", "채움", "건희는 28일(농경연 표25 평균). 중앙값과 평균의 차이"),
    "owner_hours_per_day": ("대표자 하루 근로 10시간 (8~11), 독립 카페 중앙값", "채움", "건희 9.3시간(상용 근로자 평균)보다 직접 값"),
    "loan_term_months": ("일반경영안정자금 한도 7,000만원, 5년(거치 2년), 기준금리+0.6%p(변동). 청년고용연계 7,000만원, 신용취약 3,000만원", "채움",
                         "건희 60개월(거치 없음)과 기간이 같고 거치 2년이 추가됨. 한도는 업종 무관 값(토스플레이스 2026 정리, 업계 글 M)"),
    "key_money_krw (신촌)": ("독립 카페 서울 권리금 3,000만원 (권리금 낸 매장 기준, 낸 비율 76.3%, n=40). 구별 값은 마포 4,000 등 1~3곳", "참고", "상권별 값이 아니라 서울 값. 4,264만(성수)·7,579만(신촌)과 규모는 비슷하나 업종 무관 1층 평균과 정의가 다름"),
    "key_money_krw (성수동카페거리)": ("독립 카페 서울 권리금 3,000만원 (낸 비율 76.3%)", "참고", "위와 같음"),
    "deposit_per_pyeong_krw (신촌)": ("독립 카페 서울 보증금 중앙값 3,000만원 (n=40), 평당 월세 10만원", "참고", "구별 표본이 1~8곳이라 신촌·성수 값은 못 얻음"),
    "deposit_per_pyeong_krw (성수동카페거리)": ("독립 카페 서울 보증금 중앙값 3,000만원", "참고", "위와 같음"),
    "rival_nearby_share": ("행정동 425곳의 분기·연 개업 점포 수와 개업률 (연 개업률 raw)", "참고", "개업 수는 동별로 있음. 그중 바로 옆에 생기는 비율은 여전히 가정"),
    "marketing_share": ("기타비용 비율 6% (4~10%), 조사에 마케팅비 항목이 따로 없음", "참고", "건희 마케팅 2% + 수선 1% + 소모품 1.5% = 4.5%가 이 범위 안"),
    "repairs_share": ("위와 같음 (기타비용 안에 포함, 분리 불가)", "참고", ""),
    "supplies_share": ("위와 같음 (기타비용 안에 포함, 분리 불가)", "참고", ""),
    "price_level_range": ("무인카페 아메리카노 수용가격대 Hot 1,156~3,363원, Iced 1,538~3,377원 (대학생 296명, 2025)", "참고", "무인카페·20대 대학생 값이라 일반 카페에 그대로 쓸 수 없음"),
    "staff_peak_range": ("전체 근로자 중앙값 2명(대표 포함), 직원(대표·가족 제외)은 중앙값 0명, 알바 월 150만원(6시간×20일)", "참고", "설계 규칙은 그대로"),
}

# 2-2 정량 데이터_1014.xlsx 가 값을 준 갭 (갭 정리표의 '팀 파일로 해결되는 정도' 열 + 건희 최신값과 비교)
Q22 = {
    "dine_in_share": ("충돌", "표58 매장 64.8% / 테이크아웃 26.4% / 배달 8.8% (점포 매출 기준)", "건희는 오픈서베이 설문 49.4%(지출 기준)를 M으로 둠. 건희 문서도 '찾았으나 바꾸지 않음'에 적어 둠"),
    "misc_krw": ("미반영", "표103 기타비용 연 1,134.6만원 = 월 94.6만원", "건희 40만원(가정) 그대로. 건희 문서: 전기·수도·잡비 줄을 따로 두어 합치면 표103보다 커서 바꾸지 않음"),
    "employer_insurance": ("반영", "국민연금 4.75 + 건강 3.595 + 고용 1.15 + 산재 0.86 = 10.355% (장기요양 제외)", "건희가 10-14에 10.8274%(장기요양 0.4724 포함)로 올리고 H로 분류. 팀원 값과 장기요양 포함 여부만 다름"),
    "close_hour": ("참고", "하루 영업시간 11.4시간 (표24), 12시간 초과 27.3%", "시각은 없고 길이만 있음. 건희 10~22시(가정) 그대로"),
    "open_hour": ("참고", "하루 영업시간 11.4시간 (표24)", "위와 같음"),
    "water_gas_krw": ("참고", "세금과 공과 월 97.95만원 (표100, 세금 포함이라 분리 불가)", "건희 10만원(가정) 그대로. 건희가 수도만 따로 7.86만원(M)으로 추정했으나 params.yaml 엔 반영 안 됨"),
    "industry_avg_sales_krw": ("참고", "커피전문점 연 1억 9,694.5만원 (표95)", "건희는 비알코올 음료점 전체 1억 9,033만원(이투데이 경유)을 씀. 커피전문점 값으로 교체 가능, 차이 3.5%"),
    "peak_surge": ("참고", "서울 시간대 비중 11~14시 35.9% (서울시 상권분석)", "건희가 10-14에 최대 시간대 비중 재정규화를 넣었으나 surge 1.3 자체는 가정 그대로"),
    "deposit_per_pyeong_krw (신촌)": ("충돌", "상가임대차 실태조사 신촌역 보증금 3,952만원, 평당 295.6만원 (약한 근거 보완 '상권 비교')", "건희 181만원(대학로 값을 월세 비율로 환산한 가정)과 1.6배 차이. 두 값 모두 업종 무관 1층 평균이거나 가정"),
    "deposit_per_pyeong_krw (성수동카페거리)": ("충돌", "상가임대차 실태조사 성수동 카페거리 보증금 1,861만원, 평당 209.7만원 ('상권 비교')", "건희 289만원(가정)이 더 큼. 방향이 신촌과 반대"),
    "interior_per_pyeong": ("참고", "개업 시 투자비 평균 7,848.6만원 (총액만, 표31)", "건희가 정보공개서 16개 브랜드 중앙값 209만원으로 M으로 직접 채움. 총액 검증용"),
    "table": ("참고", "개업 시 투자비 총액만", "건희가 다나와 중앙값 6만원 M으로 직접 채움"),
    "price_change_pct_range": ("참고", "프랜차이즈 아메리카노 3,001원, 커피 대표메뉴 4,118원", "설계 규칙. 참고만"),
    "price_level_range": ("참고", "표85 메뉴 가격", "설계 규칙. 참고만"),
    "staff_peak_range": ("참고", "근로자 3.01명 (표115)", "설계 규칙. 참고만"),
    "electricity_anchor_20py_krw": ("참고", "세금과 공과 월 97.95만원 (분리 안 됨)", "위 약한 근거 보완 행 참고"),
    "independent_scale": ("참고", "전국 커피전문점 연 1억 9,695만원 (프랜차이즈 포함)", "비프랜차이즈×서울 값이 아님. 약한 근거 보완 파일이 이어서 채움"),
    "key_money_krw (성수동카페거리)": ("반영", "임차권리금 3,828.6만원 (표22, 102곳, 전국 평균)", "건희가 교차 확인으로 params.yaml 에 인용함 (4% 안에서 일치)"),
    "key_money_krw (신촌)": ("반영", "임차권리금 3,828.6만원 (표22)", "위와 같음"),
    "weekly_holiday_factor": ("반영", "월 환산 209시간, 최저임금 2,156,880원", "계산 근거 확보, 건희 값과 같음"),
}

SECTION = {
    # 상권·입지: 어느 동네인지에 따라 값이 달라지는 것, 동네 수요의 모양, 경쟁과 임대 변동
    "상권·입지": {"deposit_per_pyeong_krw", "key_money_krw", "peak_surge", "dine_in_share", "rent_hike_p", "rival_nearby_share",
               "rival_demand_mult", "rival_elasticity_add", "independent_scale", "industry_avg_sales_krw", "cups_per_tx",
               "seasonality_by_quarter", "open_hour", "close_hour", "hours", "hours_shift_share", "days_per_month"},
    # 매장 운영: 가게 안에서 일어나는 일 (처리 속도, 사람, 원가, 설비 단가, 손님 행동)
    "매장 운영": {"machine_cph_by_groups", "baristas_by_groups", "barista_cph", "floor_staff_seat_threshold", "barista_on_pos_order_factor",
               "barista_on_pos_drink_share", "dirty_table_block_share", "dwell_h", "persons_per_cup", "balk_max", "balk_mid_util",
               "balk_width", "staff_utilization", "staff_cover", "staff_balk_mult", "support_s_per_order", "owner_hours_per_day",
               "misc_krw", "water_gas_krw", "electricity_krw_per_kwh", "electricity_anchor_20py_krw", "base_kw_per_pyeong",
               "espresso_kw_per_group", "oven_kw", "oven_hours", "showcase_kw", "fridge_kw", "ice_maker_kw", "marketing_share",
               "repairs_share", "supplies_share", "card_share", "packaging_per_takeout_cup", "weekly_holiday_factor",
               "employer_insurance", "interior_per_pyeong", "chair", "table", "bar_seat", "bar_counter_per_m", "pos", "fridge", "sink",
               "electrical", "dessert_waste_share", "dessert_min_spoilage_krw", "dessert_prep_hours_per_day",
               "dessert_no_showcase_factor", "dessert_food_cost_share", "breakdown_p", "breakdown_repair_krw", "breakdown_down_days",
               "viral_p", "viral_demand_mult", "viral_carry_mult", "viral_marketing_boost", "marketing_max_lift", "marketing_half_krw",
               "marketing_max_krw", "regular_share", "regular_visits_per_month", "regulars_speed", "regulars_speed_marketing",
               "regulars_target_per_satisfaction", "regulars_target_range", "launch_share", "rating_start", "rating_range",
               "rating_speed", "rating_per_satisfaction", "rating_demand_per_star", "satisfaction_walkaway", "satisfaction_price",
               "satisfaction_staff", "satisfaction_dessert", "satisfaction_breakdown", "price_elasticity"},
}


def section_of(var: str) -> str:
    k = var.split(" (")[0]
    for s, names in SECTION.items():
        if k in names:
            return s
    return "그 외"


wb = openpyxl.load_workbook(GAP, data_only=True)
ws = wb["3 갭과 찾는 방법"]
rows = [r for r in ws.iter_rows(min_row=1, values_only=True)]
hdr = next(i for i, r in enumerate(rows) if r and r[0] == "우선순위")
gaps = []
for r in rows[hdr + 1:]:
    if not r or not r[0]:
        continue
    pri, area, var, old, oldg, gap, how, cand, team, _owner, _memo = (list(r) + [None] * 11)[:11]
    k = var.split(" (")[0]
    nv, ng, nn = now_of(area, var)
    weak = WEAK12.get(var) or WEAK12.get(k) if (var in WEAK12 or (k in WEAK12 and " (" not in var)) else None
    q = Q22.get(var) or Q22.get(k)
    grade_up = oldg in ("가정", "약한 근거 (사례 1건·자체 계산)") and ng in ("H", "M")
    if weak:
        status, filler = {"반영": "채움 · 반영됨", "미반영": "채움 · 아직 반영 안 됨", "충돌": "채움 · 값이 충돌", "참고": "일부 채움", "남음": "보류"}[weak[2]], "약한 근거 보완_1014"
    elif q and q[0] == "충돌":
        status, filler = "채움 · 값이 충돌", "2-2 정량 데이터_1014"
    elif q and q[0] == "반영":
        status, filler = "채움 · 반영됨", "2-2 정량 데이터_1014"
    elif q and q[0] == "미반영":
        status, filler = "채움 · 아직 반영 안 됨", "2-2 정량 데이터_1014"
    elif grade_up:
        status, filler = "건희가 이후 직접 채움", "건희 (10-14 등급 정리)"
    elif q:
        status, filler = "참고만 가능", "2-2 정량 데이터_1014"
    elif ng in ("H", "M") and oldg not in ("가정", "약한 근거 (사례 1건·자체 계산)"):
        status, filler = "이미 근거 있음", ""
    else:
        status, filler = "남음", ""
    if q and grade_up and status.startswith("채움") is False:
        pass
    gaps.append({
        "pri": pri, "area": area, "var": var, "section": section_of(var), "old": short(old), "old_grade": oldg, "gap": gap,
        "now": short(nv) if nv is not None else "", "now_grade": ng or "", "status": status, "filler": filler,
        "weak": {"value": weak[0], "state": weak[1], "applied": weak[2], "note": weak[3]} if weak else None,
        "q22": {"applied": q[0], "value": q[1], "note": q[2]} if q else None,
        "how": how, "cand": cand,
    })


# 건희 웹 경로(changeup/lean params.json)에서는 등급이 올랐지만 파이썬 params.yaml 에는 아직 반영되지 않은 것
for g in gaps:
    k = g["var"].split(" (")[0]
    if k == "days_per_month":
        g.update(status="건희가 이후 직접 채움", filler="건희 (웹 params.json anchor_days)", now_grade="H (웹) / 가정 (yaml)",
                 section="상권·입지", web_note="농경연 2025 표25: 커피전문점 월 28.0일(H). 파이썬 params.yaml 의 등급 표시는 아직 가정")
    if k in ("base_kw_per_pyeong", "espresso_kw_per_group", "oven_kw", "oven_hours", "showcase_kw", "fridge_kw", "ice_maker_kw", "electricity_krw_per_kwh"):
        g["web_note"] = "웹(ChangeUp) 경로는 이 kW 모형을 쓰지 않고 한전 KSIC 56 계량기 요금으로 평당 1.32만원(M)을 씀. 파이썬 엔진 쪽만 가정"
    if k == "water_gas_krw":
        g["web_note"] = "웹 경로: 수도 35㎥/월 × 2026 일반용 요금 7.86만원(M, 서울시 소상공인 수도요금 감면 총액에서 역산) + 가스 2.1만원(가정). 합계 10만원은 L"
    if k == "dwell_h":
        g.update(status="건희가 이후 직접 채움", filler="건희 (10-14 등급 정리, 팀원은 보류)")

# v6 대조: 아직 근거가 없거나 충돌하던 갭에 v6 값을 붙인다. 채움이면 상태를 바꾸고, 참고면 값만 붙인다.
for g in gaps:
    k = g["var"] if g["var"] in V6 else g["var"].split(" (")[0]
    if k not in V6:
        continue
    val, state, note = V6[k]
    g["v6"] = {"value": val, "state": state, "note": note}
    if state == "채움" and g["status"] in ("남음", "보류", "채움 · 값이 충돌", "채움 · 아직 반영 안 됨", "참고만 가능", "일부 채움"):
        g["status"], g["filler"] = "v6 자료로 채움", "카페_시뮬레이터_입점_변수자료_v6 (+ " + g["filler"] + ")" if g["filler"] else "카페_시뮬레이터_입점_변수자료_v6"
    elif state == "참고" and g["status"] in ("남음", "보류", "v6 참고값 있음"):
        g["status"], g["filler"] = "v6 참고값 있음", "카페_시뮬레이터_입점_변수자료_v6"

# 갭 정리표에 없었던 건희 변수 중 지금도 가정/L 인 것 (표 작성 이후 새로 생긴 변수 포함)
known = {g["var"].split(" (")[0] for g in gaps}
extra = []
for sec, d in P.items():
    if not isinstance(d, dict) or sec in ("defaults",):
        continue
    for k, e in d.items():
        if isinstance(e, dict) and e.get("grade") in ("가정", "L") and k not in known and sec != "layout" and sec != "district_meta":
            extra.append({"sec": sec, "var": k, "grade": e["grade"], "value": short(e.get("value")), "note": short(e.get("note") or e.get("source") or "", 90)})

GRADE_SHORT = {"약한 근거 (사례 1건·자체 계산)": "L", "실제 출처 (업계·보도)": "M", "실제 출처 (공식)": "H"}
for g in gaps:
    g["old_grade"] = GRADE_SHORT.get(g["old_grade"], g["old_grade"])

from collections import Counter
cnt = Counter(g["status"] for g in gaps)
sec = Counter((g["section"], g["status"] in ("남음", "보류", "v6 참고값 있음")) for g in gaps)
out = {"gaps": gaps, "extra": extra, "counts": dict(cnt),
       "remain_by_section": {s: sum(1 for g in gaps if g["section"] == s and g["status"] in ("남음", "보류", "v6 참고값 있음")) for s in ("상권·입지", "매장 운영", "그 외")}}
OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(gaps), dict(cnt)); print(out["remain_by_section"]); print("extra", len(extra))
