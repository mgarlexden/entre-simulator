// #/sources: operator page. Where every number on the mock comes from and how far it can be trusted.
// Keep this file in step with model.ts: a constant added there gets a row here.
import { useEffect, useState } from "react";
import { CATALOG, GRADES, man, type GuData } from "./model";
import SourcesCafe from "./SourcesCafe";
import SourcesGogi from "./SourcesGogi";
import SourcesChanges from "./SourcesChanges";
import SourcesTodo from "./SourcesTodo";
import "./sources.css";

type Kind = "실측" | "차용" | "가정" | "예시값";
const KIND_NOTE: Record<Kind, string> = {
  실측: "공공데이터를 내려받아 계산한 값. 출처와 계산 스크립트가 있음",
  차용: "기존 대학로 가상 매장(sdic-persona-team1)의 값. 팀이 출처를 달아 만든 추정치이며 원 레포가 '검토 전 예시'라고 밝힘",
  가정: "근거 자료 없이 정한 값. 바꿔도 되는 설정값",
  예시값: "화면을 채우려고 임의로 만든 값. 사실과 무관",
};

type Row = { item: string; value: string; kind: Kind; source: string; note?: string };


// 결정 사항과 보류. 날짜순으로 쌓는다. 결정이 바뀌면 줄을 고치지 말고 새 줄을 위에 추가한다.
type Decision = { date: string; topic: string; decision: string; why: string; where: string; status: string };
const DECISIONS: Decision[] = [
  { date: "2026-10-15", topic: "동네 선택 (구 → 행정동)", decision: "구를 고른 뒤 선택 사항으로 동네(행정동)를 고른다. 동네를 고르면 그 동네의 점포당 매출(구 안의 상대 위치), 요일·분기 지수, 월세, 유형이 바뀌고, 사건은 동네 유형에 맞는 것만 나온다.",
    why: "엔진의 달력과 사건이 대학로 기준이라 구 하나로는 맞지 않는다. 행정동 423개는 서울시 상권분석(매출)과 소상공인 상가정보(점포·돼지구이 수)로 만들 수 있다. 유형은 20대 매출 비중 27% 이상이면 대학·청년, 점심 비중 30% 이상이고 주말 비중 25% 이하면 오피스, 주말 비중 36% 이상이면 주거, 나머지는 일반이다.",
    where: "동네 분석 > 동네 (Analysis.tsx), 시뮬레이션 (SimulateEngine.tsx), pipelines/build_dong_stats.py → dong_stats.json", status: "적용됨" },
  { date: "2026-10-15", topic: "시뮬레이션 탭 = 엔진", decision: "시뮬레이션 탭을 목업 계산(sim.ts)에서 건희 엔진으로 교체한다. 한 달에 한 번 운영 계획을 정하면 엔진이 그달을 계산하고 화면이 하루씩 재생한다. 날마다의 값은 엔진이 만든 밤별 매출을 그달 합계에 맞춰 나눈 것이다.",
    why: "엔진이 손님·좌석·직원·만족도·단골·사건을 한 구조로 계산하고 출처 태그를 단 값을 쓴다. 목업은 오픈 곡선을 가정으로 두고 매끈하게 오른다.",
    where: "SimulateEngine.tsx, api/changeup.py (포트 8010)", status: "적용됨 (엔진 서버가 켜져 있어야 함)" },
  { date: "2026-10-15", topic: "챗봇 구조 (수빈 방식 + 보강)", decision: "챗봇은 LLM 없이 근거 문장을 검색해 그대로 보여 주는 수빈 님 방식(api/cite_api.py)을 기반으로 쓴다. 보강한 것: (1) 월세·동네·외식업 비용 구성 근거 문장 추가, (2) 질문 주제를 먼저 정해 다른 주제의 문장이 끼지 않게 하는 필터, (3) 화면이 보낸 점포 입력과 시뮬레이션 결과로 즉석 문장을 만드는 POST /ask, (4) 평가 질문 40개.",
    why: "모델 호출 비용이 0원이고 숫자가 근거 문장 그대로라 틀릴 수 없다. 건희의 RAG+LLM 구조는 혜화동 가상 점포에 묶여 있어 사용자의 가게를 모른다. 처음 보는 표현에는 약하므로 모르는 질문을 모아 근거를 늘린다.",
    where: "api/ask_ext.py, pipelines/build_changeup_facts.py, web/src/mock/Chat.tsx, tests/ask_eval/", status: "적용됨 (평가 40/40, 서버는 별도로 켬: 포트 8001)" },
  { date: "2026-10-15", topic: "시뮬레이션 화면 구조와 시작 달", decision: "시뮬레이션은 전체 화면 3D에 지표 줄(현금·달·평점과 인지도·단골·직원 피로)과 영수증형 현금 기록을 두고, 매달 운영 계획·토요일 밤 대응(엔진의 밤 결정)·정산을 팝업으로 보여 준다. 시작 달은 1~12월 중 고르고, 엔진 달력에 없는 4~9월은 동네 분기 지수와 가정한 사건 확률로 채운다. 시드는 화면에서 숨기고 실행마다 무작위로 정한다.",
    why: "화면이 바뀌며 사라진 시나리오 선택지를 엔진의 밤 결정으로 되살리고, 운영 계획 변수를 − + 로 조절하게 해 달마다 지난달 결과를 보고 바꾸게 한다. 4~9월 값은 근거가 아니라 가정이다.",
    where: "SimulateEngine.tsx, sim/season.py (_calendar, _event_prob, months), sim/store_input.py (start_month), api/changeup.py (/season/start)", status: "적용됨 (4~9월 달력·사건은 가정)" },
  { date: "2026-10-15", topic: "월세 기준", decision: "한국부동산원 R-ONE 소규모 상가 1층 임대료를 쓰되, 보증금 환산분을 빼 현금 월세로 바꾸고 상권 범위(낮음~높음)를 함께 보여 준다.",
    why: "25개 구 값이 가능한 것은 R-ONE뿐이다 (서울시 실태조사는 3개 상권). 건희 레포도 같은 방식(보증금 환산 분리, 3.0/4.7/5.8M 범위)을 썼다.",
    where: "동네 분석 > 동네·드는 돈, 가게 꾸미기 현금, 열기 전 점검, 시뮬레이션 월세 출금 (model.ts guStat)", status: "적용됨" },
  { date: "2026-10-15", topic: "월세 직접 입력", decision: "사용자가 찾아 둔 매물의 평당 월세를 넣을 수 있게 하되 선택 사항으로 둔다. 넣으면 그 구에서만 쓰고 보증금과 월 고정비가 다시 계산된다.",
    why: "구 값은 상권 근사라 같은 구 안에서도 골목마다 다르다. 예비 창업자는 실제 매물을 알고 있을 수 있다.",
    where: "동네 분석 > 동네 (Analysis.tsx, Profile.rent)", status: "적용됨" },
  { date: "2026-10-15", topic: "보증금", decision: "월세 12개월분으로 바꾼다 (기존 10개월 가정).",
    why: "서울시 상가임대차 실태조사 팀 자료에서 보증금은 월세의 11~15개월분이었다. 범위 안의 값으로 정했다.",
    where: "드는 돈 (model.ts DEPOSIT_MONTHS)", status: "적용됨" },
  { date: "2026-10-15", topic: "식재료비 비율", decision: "31%를 바꾸지 않고, 서울권 음식점 평균 39.3%를 비교선으로만 보여 준다. 고기 값은 한 인분 원가에서 따로 계산하는 방식을 유지한다.",
    why: "39.3%는 술과 음료 9.5%가 들어간 서울권 음식점 전체 평균이다 (고깃집 단독 아님). 고깃값 충격은 인분 원가 방식이 정확히 반영한다. 건희 레포도 31%를 두고 정보 행으로만 표시했다.",
    where: "열기 전 점검 (Checks.tsx)", status: "적용됨" },
  { date: "2026-10-15", topic: "시뮬 엔진", decision: "건희 엔진(sim/)을 기반으로 하고, 한 달에 한 턴(6턴 = 180일) 구조를 유지한다. 연결은 정적 precompute가 아니라 파이썬 서버(FastAPI)로 한다.",
    why: "엔진이 이미 밤마다 DES를 돌리고 출처 태그가 달린 값을 쓴다. 6개월이 1~2초에 계산된다.",
    where: "sim/ (changup-sim 안의 사본), api/changeup.py (FastAPI, 포트 8010)", status: "엔진 서버 구현됨, #/engine에서 확인 가능 (시뮬레이션 탭 연결 전)" },
  { date: "2026-10-15", topic: "엔진 설계 1: 신규 오픈 시작 상태", decision: "엔진 시작 상태를 기존 점포(평점 4.2, 리뷰 180, 단골 25%)에서 신규 점포(리뷰 0, 낮은 인지도, 단골 최소)로 바꾼 오픈 모드를 둔다. 값은 가정이라 민감도 변수로 다룬다.",
    why: "예비 창업자가 처음 6개월을 묻는 서비스라 기존 점포 상태로 시작하면 첫 달 매출이 과대하다. 단골 상한은 KOSIS 재방문율 34.75%가 엔진 상한 0.35와 일치한다.",
    where: "sim/season.py new_season(opening=True), research/season_params.yaml start_new", status: "구현됨 (새 테스트 12개 통과, 화면 연결 전)" },
  { date: "2026-10-15", topic: "엔진 설계 2: 투자·대출 계층", decision: "엔진 밖에 계층을 둔다. 초기 투자(보증금, 인테리어, 설비, 권리금)와 대출 이자·원금, 사장 급여 분리를 월별 영업이익에 합쳐 현금과 투자금 회수 시점을 계산한다. 6개월 뒤 회수는 외삽이며 추정이라고 표시한다.",
    why: "엔진의 현금 2,000만원은 운영자금일 뿐 투자금 회수는 6개월 안에 보이지 않는다. 엔진 노동비에 대표자 가상 임금이 들어 있어 현금 흐름과 분리해야 한다.",
    where: "sim/venture.py", status: "구현됨 (새 테스트 12개 통과, 화면 연결 전)" },
  { date: "2026-10-15", topic: "민감도 변수", decision: "체류 시간, 대기 이탈률, 직원 처리량, 단골 형성 속도, 오픈 곡선은 고정값이 아니라 범위로 두고 결과의 변동으로 보여 준다.",
    why: "공공 통계가 없거나 논문 한 편 수준이다. 엔진은 이미 가격 탄력성을 삼각분포로 뽑는다.",
    where: "sim/sensitivity.py (확장 예정), 시뮬레이션 결과 밴드", status: "방향 결정, 구현 전" },
  { date: "2026-10-15", topic: "카페", decision: "카페 팀 자료(약한 근거 보완, 정량 데이터)는 보류한다. 고깃집 설계와 변동 사항이 끝난 뒤 카페 작업을 시작한다.",
    why: "고깃집 설계가 먼저 확정돼야 카페에 같은 구조를 옮길 수 있다.",
    where: "카페 전용 항목 표 (아래 팀 자료 대조)", status: "보류" },
  { date: "2026-10-15", topic: "챗봇 정성 기준", decision: "유튜브 인터뷰를 챗봇 답변 근거로 쓸지는 팀원이 만든 챗봇이 있어 보류한다. 나중에 다시 확인한다.",
    why: "팀원 산출물이 있다.", where: "챗봇 (Chat.tsx 또는 팀원 챗봇)", status: "보류, 다시 상기" },
];

// 지금 값이 없어 보류한 데이터. '탐색했으나 값 없음'은 찾아봤지만 공개 값이 없어 범위(민감도)로 다루는 것.
type Hold = { item: string; kind: "미탐색" | "탐색했으나 값 없음"; why: string; usedIn: string; handling: string; where: string };
const HOLDS: Hold[] = [
  { item: "정책자금 금리·한도·자격", kind: "탐색했으나 값 없음", why: "공공데이터 API가 확인되지 않았다. 소진공이 분기별(1·4·7·10월) 공고하는 값을 사람이 옮겨야 한다.",
    usedIn: "동네 분석 > 모자란 돈, 가게 꾸미기 대출 조절과 이자", handling: "지금은 대출 이자율 6% 가정과 상품 이름만 둔다. 공고문 값을 정적 파일로 넣을 예정", where: "소상공인정책자금 누리집, 신용보증재단" },
  { item: "품목별 설비·가구 단가", kind: "탐색했으나 값 없음", why: "KOSIS에 주방 1,700만원, 홀 1,367만원(서울권 평균) 총액만 있다. 공정위 정보공개서 본문 API(15125571)는 창업비용 필드가 있는지 확인하지 못했다.",
    usedIn: "동네 분석 > 드는 돈, 가게 꾸미기 가격표", handling: "총액으로 가격표 합계를 검증만 한다. 품목 단가는 가정으로 둔다", where: "공정거래위원회 가맹사업 정보공개서" },
  { item: "고깃집(육류요리 전문점) 단독 손익", kind: "탐색했으나 값 없음", why: "KOSIS 손익 표는 한식까지만 나뉜다. 육류요리 전문점은 업종 비중(17.5%)과 식재료 구매 행태 표에만 있다.",
    usedIn: "열기 전 점검(비용 구조), 동네 분석 해석", handling: "한식·서울권 값을 비교선으로 쓴다. 단독 값은 KREI 보고서 PDF 표 95~104 확인 필요", where: "KREI 외식업체 경영실태조사 통계보고서 (카페 팀원 보유)" },
  { item: "구 단위 월세·보증금", kind: "탐색했으나 값 없음", why: "R-ONE은 상권 단위(서울 59곳)다. 구 값은 상권 배정 근사이고 도봉구는 상권이 없어 채웠다.",
    usedIn: "동네 분석, 점검 본전, 시뮬레이션 월세", handling: "상권 평균 근사 + 범위 + 사용자 직접 입력(선택)", where: "R-ONE (연결됨), 서울시 상가임대차 실태조사" },
  { item: "단골 형성 속도, 오픈 곡선, 사건 확률", kind: "탐색했으나 값 없음", why: "공공 통계가 없다. 단골 상한만 KOSIS 재방문율 34.75%로 근거가 생겼다.",
    usedIn: "시뮬레이션 손님 곡선, 단골, 사건", handling: "민감도 변수(범위)로 처리", where: "원 레포 research/events.yaml, season_params.yaml (대부분 가정 표시)" },
];

// API 키별 연결 상태. 키 값은 이 파일에 넣지 않는다 (changup-sim/.env 에만 둔다). 점검일 2026-10-15.
type ApiKey = { env: string; name: string; status: "호출 확인" | "인증 실패" | "엔드포인트 미확인" | "적용 안 함"; fetches: string; usedIn: string; applied: string; note: string };
const API_KEYS: ApiKey[] = [
  { env: "RONE_KEY", name: "한국부동산원 R-ONE 상업용부동산 임대동향", status: "호출 확인",
    fetches: "소규모 상가 1층 임대료·공실률·전환율(서울 상권 59곳, 분기), 시도별 숙박·음식점업 권리금(서울 평균 5,578만원, 권리금 있는 비율 79%, 2022~2024)",
    usedIn: "동네 분석 > 드는 돈(월세, 보증금, 권리금 새 줄) / 가게 꾸미기 현금 / 열기 전 점검 본전 손님 수 / 시뮬레이션 월세 출금",
    applied: "적용됨: 평당 월세, 보증금(동네 분석, 드는 돈, 점검, 시뮬레이션). 권리금은 아직 드는 돈에 넣지 않음", note: "상권 59곳을 25개 구에 배정한 근사(도봉구는 채움). 임대료에 보증금 환산액이 섞여 있어 12개월분을 뺌" },
  { env: "KOSIS_KEY", name: "KOSIS 국가통계포털 (KREI 외식업체경영실태조사 2018~2025, 소비자물가)", status: "호출 확인",
    fetches: "업종·서울권별 매출, 영업비용 구성(식재료·인건비·임차료·이익), 개업 투자비, 인테리어·주방·홀 비용, 보증금·권리금, 객단가, 좌석·테이블, 영업시간, 근로자, 요일별 매출 비중, 경영 애로. 외식 소비자물가지수",
    usedIn: "동네 분석 > 드는 돈 / 가게 꾸미기 가격 검증 / 열기 전 점검(재료비·인건비 비율) / 시뮬레이션 비용 / 챗봇 해석",
    applied: "아직 계산에 적용하지 않음", note: "한식까지만 나뉘고 고깃집(육류요리 전문점) 손익 행은 없음. 키 끝의 = 가 빠지면 인증 오류" },
  { env: "SBIZ_STORE_KEY", name: "소상공인시장진흥공단 상가(상권)정보", status: "호출 확인",
    fetches: "행정동·구별 상가업소 목록 (업종 소분류 I20107 돼지고기 구이/찜, 좌표 포함)",
    usedIn: "동네 분석 > 동네 지도의 고깃집 수 / 경쟁 점포 밀도",
    applied: "점포 수는 이미 gu_stats.json의 pork 블록에 파일본으로 반영", note: "API로 최신 점포·좌표를 직접 받을 수 있음. 개폐업 시점은 주지 않음" },
  { env: "SEOUL_OPEN_DATA_KEY", name: "서울 열린데이터광장 (상권분석서비스, 상가 거래)", status: "호출 확인",
    fetches: "상권·행정동 추정매출(분기), 점포, 상가 부동산 거래",
    usedIn: "동네 분석 전반(매출, 점포 수, 요일·시간 비중) / 시뮬레이션 손님 곡선",
    applied: "기존 값은 내려받은 파일로 반영. 키로 같은 자료를 API 갱신 가능", note: "지수 표(VwsmSignguSelngIndex) 한 건은 서버 오류" },
  { env: "ASOS_HOURLY_KEY", name: "기상청 지상(종관, ASOS) 시간자료", status: "호출 확인",
    fetches: "서울(108) 시간별 기온·강수·습도·풍속 (전일까지)",
    usedIn: "시뮬레이션 비·한파 사건 / 열기 전 점검 날씨 충격",
    applied: "아직 적용하지 않음 (일자료는 weather_seoul.json으로 이미 반영)", note: "결제 데이터가 없어 날씨가 매출을 바꾸는 크기는 못 구함. 방향만 근사" },
  { env: "DATA_GO_KR_KEY", name: "공공데이터포털 일반 인증키 (ASOS 일자료, 특일 정보)", status: "호출 확인",
    fetches: "서울 일별 기온·강수, 공휴일·대체공휴일",
    usedIn: "시뮬레이션 날짜별 날씨와 공휴일 (weather_seoul.json, holidays.json)",
    applied: "적용 중 (pipelines/fetch_weather.py)", note: "" },
  { env: "LIVESTOCK_AUCTION_KEY", name: "축산물품질평가원 축산물경락가격정보 (제주 돼지도체 등급별)", status: "호출 확인",
    fetches: "제주 돼지도체 등급별 경락가격(일, 2023-01~)",
    usedIn: "시뮬레이션 고깃값 사건의 크기·시기 (참고용)",
    applied: "적용 안 함. 전국 돼지 경락가는 신청하지 않기로 함", note: "제주 지육 경락가라 서울 삼겹 도매가와 단계가 다름. 최근 삼겹 시세는 건희 레포의 KMTA 시계열을 씀" },
  { env: "GANGWON_LIVESTOCK_KEY", name: "강원 축산물 가격 동향 (data.go.kr)", status: "엔드포인트 미확인",
    fetches: "아직 호출하지 못함", usedIn: "시뮬레이션 고깃값 사건 (후보)",
    applied: "적용 안 함", note: "어느 데이터셋의 키인지와 요청 주소를 확인해야 함. 가격이 아닌 사육 통계일 수 있음" },
  { env: "KMA_APIHUB_KEY", name: "기상청 API허브", status: "인증 실패",
    fetches: "호출 시 401 (유효한 인증키가 아님)", usedIn: "없음 (ASOS는 data.go.kr 키로 이미 가능)",
    applied: "적용 안 함", note: "필요하면 키 상태 확인. 현재는 없어도 날씨 자료에 지장 없음" },
];

function rows(d: GuData | null): { title: string; rows: Row[] }[] {
  const seoul = d?.bbq.seoul;
  const src = d ? `서울시 상권분석서비스 ${d._meta.year}년 (${d._meta.quarters[0]}~${d._meta.quarters.at(-1)}), ${d._meta.method}` : "gu_stats.json";
  return [
    {
      title: "동네 분석",
      rows: [
        { item: "한식음식점 한 곳의 월매출", value: seoul ? `서울 평균 ${man(seoul.sales_per_store_month)}` : "", kind: "실측", source: src, note: "카드사 추정 매출을 점포 수로 나눈 평균. 잘 되는 가게가 평균을 끌어올림. 고깃집만의 값이 아님" },
        { item: "매출 지수", value: "구 평균 ÷ 서울 평균", kind: "실측", source: src },
        { item: "한식음식점 수", value: seoul ? `서울 ${seoul.stores.toLocaleString("ko-KR")}곳` : "", kind: "실측", source: src, note: "상권 영역 안의 점포만. 구 전체 점포 수가 아님" },
        { item: "하루 결제 건수", value: seoul ? `서울 평균 ${seoul.tx_per_store_day}건` : "", kind: "실측", source: src, note: "결제 1건은 손님 1명이 아니라 보통 한 팀" },
        { item: "1년 폐업률", value: seoul ? `서울 ${(seoul.closure_rate * 100).toFixed(1)}%` : "", kind: "실측", source: src, note: "2025년 폐업 점포 수 ÷ 평균 점포 수" },
        { item: "고깃집 수", value: d?.pork ? `서울 ${Object.values(d.pork.gu).reduce((n, v) => n + v.pork, 0).toLocaleString("ko-KR")}곳` : "", kind: "실측", source: d?.pork ? `${d.pork.source}, ${d.pork.snapshot} 기준, 소분류 I20107 돼지고기 구이/찜` : "", note: "구 전체의 점포 수. 매출 정보는 없음. 업종 분류는 등록 기준이라 실제 메뉴와 다를 수 있음" },
        { item: "평당 월세", value: "구마다 약 8~25만원 (현금 월세, 서울 평균 16.3)", kind: "실측", source: "한국부동산원 R-ONE 소규모 상가 1층 임대료 2026년 2분기 → rent_gu.json (pipelines/fetch_rone.py)", note: "상권 단위(서울 59곳)를 구에 배정한 근사. 환산 포함 값에서 보증금 12개월분을 뺌. 도봉구는 상권이 없어 채운 값. 사용자가 직접 입력하면 그 값 사용" },
        { item: "정책자금 목록", value: "3종", kind: "예시값", source: "Analysis.tsx LOANS", note: "종류 이름만 적은 틀. 상품명, 한도, 금리, 자격은 확인한 적 없음" },
      ],
    },
    {
      title: "여는 데 드는 돈",
      rows: [
        { item: "보증금", value: "월세 12개월분", kind: "가정", source: "model.ts DEPOSIT_MONTHS (서울시 상가임대차 실태조사 팀 자료의 11~15개월 안)", note: "개월 수는 가정, 월세는 R-ONE 근사. 권리금은 아직 드는 돈에 넣지 않음" },
        { item: "인테리어 공사", value: Object.values(GRADES).map((g) => `${g.label} 평당 ${g.perPyeong}만원`).join(", "), kind: "가정", source: "model.ts GRADES" },
        { item: "물건 가격", value: CATALOG.map((c) => `${c.name} ${c.price}`).join(", ") + " (만원)", kind: "가정", source: "model.ts CATALOG" },
        { item: "간판, 첫 재료", value: "250만원, 300만원", kind: "가정", source: "model.ts SIGN, FIRST_STOCK" },
        { item: "석 달 치 버틸 돈", value: "월 550만원 × 3", kind: "가정", source: "Analysis.tsx MONTHLY_BURN" },
      ],
    },
    {
      title: "6개월 현금 계산",
      rows: [
        { item: "자리 잡은 뒤 하루 손님 수", value: "구의 점포당 월매출 ÷ (1인 27,000원 × 26일)", kind: "실측", source: `${src} + 차용값 2개`, note: "새 가게가 그 구 한식음식점 평균만큼 손님을 받는다는 가정이 들어감. 실측 매출을 손님 수로 바꾸는 1인 금액과 영업일은 차용값" },
        { item: "손님 1인 금액", value: "고기 가격 + 8,000원 (기본 27,000원)", kind: "차용", source: "hero.json pnl ticket, t_alc + t_side" },
        { item: "재료비 비율", value: "매출의 31%", kind: "차용", source: "hero.json pnl food ÷ rev" },
        { item: "직원 1명 인건비", value: "월 199만원", kind: "차용", source: "hero.json pnl (l_pt + l_emp) ÷ servers" },
        { item: "관리비 등", value: "평당 월 12.8만원", kind: "차용", source: "hero.json pnl mgmt ÷ area_pyeong" },
        { item: "카드 수수료", value: "매출의 0.84%", kind: "차용", source: "hero.json pnl fees ÷ rev" },
        { item: "사장 생활비", value: "월 300만원", kind: "차용", source: "hero.json owner_wage" },
        { item: "오픈 곡선", value: "1~6개월째 55, 70, 82, 90, 96, 100%", kind: "가정", source: "model.ts OPEN_CURVE", note: "인터뷰 문서의 '오픈 효과' 요인을 숫자로 옮긴 임의 곡선" },
        { item: "좌석 회전", value: "좌석 1개당 하루 1.5명", kind: "가정", source: "model.ts SEAT_TURN" },
        { item: "직원 1명이 받는 손님", value: "하루 15명", kind: "가정", source: "model.ts COVERS_PER_STAFF" },
        { item: "가격 반응", value: "탄력성 −0.8", kind: "가정", source: "model.ts simulate priceFx" },
        { item: "범위", value: "손님 20% 적음, 15% 많음", kind: "가정", source: "model.ts LOW, HIGH" },
      ],
    },
    {
      title: "시뮬레이션 (하루 단위)",
      rows: [
        { item: "요일별 손님 차이", value: seoul ? `서울 평균 월~일 ${seoul.dow_share.map((v) => (v * 100).toFixed(1)).join(", ")}%` : "", kind: "실측", source: src, note: "구마다 그 구의 요일별 매출 비중을 씀" },
        { item: "분기별 손님 차이", value: seoul ? `서울 평균 1~4분기 ${seoul.quarter_index.join(", ")}` : "", kind: "실측", source: src, note: "분기 안의 달은 같은 값. 월별 차이는 자료가 없음" },
        { item: "공휴일 날짜", value: "2026년 22일, 2027년 24일", kind: "실측", source: "한국천문연구원 특일 정보 (data.go.kr 15012690), pipelines/fetch_weather.py가 받은 holidays.json" },
        { item: "공휴일의 손님 수", value: "일요일과 같다고 봄", kind: "가정", source: "sim.ts step" },
        { item: "월별 비 오는 날 비율", value: "1~12월 10, 13, 15, 20, 25, 27, 38, 38, 24, 17, 17, 14%", kind: "실측", source: "기상청 ASOS 일자료 (data.go.kr 15059093), 서울 지점 108, 2016~2025년, weather_seoul.json", note: "일강수량 1mm 이상인 날의 비율. 저녁 장사 시간에 비가 왔는지는 알 수 없음. 어느 날 비가 오는지는 이 비율로 뽑은 난수" },
        { item: "쉬는 날을 없앨 때 급여", value: "30/26배", kind: "가정", source: "model.ts staffPay" },
        { item: "하루 손익", value: "매출 − 재료비·수수료 − 한 달 고정비 ÷ 30.4", kind: "가정", source: "sim.ts step profit", note: "흑자 전환과 들인 돈 회수 시점 계산에 씀" },
        { item: "추천 배치", value: "12~30평, 테이블 수, 직원 0~6명을 모두 계산", kind: "가정", source: "model.ts recommend", note: "손님이 20% 적어도 6개월을 버티는 구성 가운데 자리 잡힌 뒤 한 달에 가장 많이 남는 것. 월세가 예시값이라 결과도 예시" },
        { item: "비 오는 날 손님", value: "−10%", kind: "차용", source: "research/shocks.yaml SH10", note: "원 레포도 가정으로 표시한 값" },
        { item: "하루 손님의 흔들림", value: "±12%", kind: "가정", source: "sim.ts step" },
        { item: "돈이 나가는 날", value: "월세 1일, 급여 10일(둘째 달부터), 생활비와 이자 25일", kind: "가정", source: "sim.ts step" },
        { item: "대출 이자", value: "연 6%, 이자만 냄", kind: "가정", source: "model.ts LOAN_RATE" },
        { item: "만족도", value: "80%에서 시작, 손님을 20% 넘게 돌려보낸 날 −0.3, 직원이 받을 수 있는 한도까지 찬 날 −0.2, 평소 +0.15", kind: "가정", source: "sim.ts step", note: "만족도가 손님 수에 주는 영향(10%p당 5%)도 가정" },
        { item: "리뷰 문구", value: "상황별 문장 12개", kind: "예시값", source: "sim.ts REVIEW_TEXT", note: "실제 리뷰가 아님" },
        { item: "폐업 규칙", value: "현금이 60일 내리 0 아래", kind: "차용", source: "기존 게임의 규칙 (README: 현금이 두 달 연속 0 아래면 폐업)" },
      ],
    },
    {
      title: "시뮬레이션의 사건",
      rows: [
        { item: "돼지고기 도매가 상승", value: "원가 +8%", kind: "차용", source: "research/events.yaml pork_up (S68, S48)" },
        { item: "근처 고깃집 개점", value: "손님 −9%", kind: "차용", source: "research/events.yaml competitor_open (S13, S20)" },
        { item: "비 오는 주간, 한파, 블로거 방문, 악성 리뷰, 알바 퇴사, 위생점검", value: "events.yaml의 크기", kind: "차용", source: "research/events.yaml", note: "원 레포가 대부분 가정으로 표시한 값" },
        { item: "선택지와 그 효과", value: "사건마다 2~3개", kind: "가정", source: "sim.ts EVENTS", note: "새로 지은 것. 근거 없음" },
        { item: "사건이 생기는 때", value: "한 달에 1개, 6~23일 사이", kind: "가정", source: "sim.ts newSim", note: "원 레포의 월별 확률은 아직 쓰지 않음" },
      ],
    },
    {
      title: "점검 기준",
      rows: [
        { item: "여유, 주의, 취약을 나누는 선", value: "항목마다 화면의 '이렇게 판단했어요'에 표시", kind: "가정", source: "model.ts checks", note: "검증한 적 없는 기준선" },
        { item: "좌석 14석당 직원 1명", value: "", kind: "가정", source: "model.ts checks" },
      ],
    },
  ];
}

type Audit = {
  generated: string;
  files: { id: string; name: string; who: string; date: string; what: string; scope: string }[];
  fill: { tab: string; feature: string; var: string; cur: string; curk: string; team: string; src: string; verdict: string; newk: string; note: string }[];
  cafe: { item: string; value: string; src: string }[];
  gaps: { pri: string; need: string; tab: string; why: string; sub: string; cand: string; eff: string }[];
  newvars: { var: string; tab: string; effect: string; src: string; need: string; rel: string }[];
  conflicts: { title: string; detail: string; action: string }[];
  counts: Record<string, number>;
};
const VERDICT_CLASS: Record<string, string> = { 채움: "실측", "부분 채움": "실측", 검증: "차용", 보강: "가정", "신규 변수": "가정", 참고: "가정", 충돌: "예시값" };

export default function Sources() {
  const [d, setD] = useState<GuData | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  type TabKey = "gogi" | "cafe" | "log" | "todo";
  const [tab, setTab] = useState<TabKey>(() => (location.hash.includes("cafe") ? "cafe" : location.hash.includes("log") ? "log" : location.hash.includes("todo") ? "todo" : "gogi"));
  const pick = (k: TabKey) => { setTab(k); window.scrollTo({ top: 0 }); };
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}mock/gu_stats.json`).then((r) => r.json()).then(setD).catch(() => setD(null)); }, []);
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}mock/team_audit.json`).then((r) => r.json()).then(setAudit).catch(() => setAudit(null)); }, []);
  const groups = rows(d);
  const all = groups.flatMap((g) => g.rows);
  const count = (k: Kind) => all.filter((r) => r.kind === k).length;
  const gus = d ? Object.entries(d.bbq.gu).sort((a, b) => b[1].sales_per_store_month - a[1].sales_per_store_month) : [];

  return (
    <main className="src">
      <p><a href="#/">ChangeUp 목업으로 돌아가기</a></p>
      <h1>출처와 근거 (운영자용)</h1>
      <p>화면에 나오는 숫자가 어디서 왔고 얼마나 믿을 수 있는지 적은 장부입니다. 업종별로 나눴습니다. 계산식은 <code>web/src/mock/model.ts</code>와
        시뮬 엔진 <code>sim/</code>에 있습니다.</p>
      <div className="src-tabs" role="tablist" aria-label="업종과 변경 기록">
        {(["gogi", "cafe", "log", "todo"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => pick(k)}>
            {k === "gogi" ? "고깃집" : k === "cafe" ? "카페" : k === "log" ? "10/16 수정사항" : "남은 작업"}
          </button>
        ))}
      </div>
      <p className="src-sub">{tab === "todo" ? "아직 하지 않은 일입니다. 담당과 함께 적었습니다." : tab === "log" ? "2026-10-16 하루 동안 바뀐 것입니다. 어떤 값과 화면이 바뀌었는지, 데이터 갭을 어떤 출처로 채웠는지, 아직 못 채운 것을 적었습니다." : tab === "gogi" ? "이 서비스의 화면이 실제로 쓰는 값입니다. 데이터 출처, 탭별 출처, 시뮬레이션 변수, 충분성 검토 순서입니다." : "카페는 아직 화면이 없습니다. 건희 레포의 카페 브랜치가 쓴 데이터, 그 갭, 팀원이 채운 것과 남은 것을 모았습니다."}</p>

      {tab === "todo" ? <SourcesTodo /> : tab === "log" ? <SourcesChanges /> : tab === "cafe" ? <SourcesCafe /> : (
        <>
          <SourcesGogi />
          <h2 id="g-appendix">부록: 기존 장부</h2>
          <p>아래는 이 페이지를 나누기 전에 쌓아 온 기록입니다. 결정은 날짜순으로 쌓고, 값 표는 화면에 나오는 숫자 단위로 나눴습니다.</p>

      <h2>결정 사항</h2>
      <p>정해진 것과 보류한 것을 날짜와 함께 남깁니다. 아래 "보류한 데이터"는 현재 값이 없어 대체값으로 동작하는 항목입니다.</p>
      <table>
        <thead><tr><th>날짜</th><th>주제</th><th>결정</th><th>이유</th><th>적용 위치</th><th>상태</th></tr></thead>
        <tbody>
          {DECISIONS.map((x, i) => (
            <tr key={i}><td>{x.date}</td><td>{x.topic}</td><td>{x.decision}</td><td>{x.why}</td><td>{x.where}</td>
              <td><b className={`k k-${x.status.startsWith("적용됨") || x.status.startsWith("구현됨") ? "실측" : x.status.startsWith("보류") ? "예시값" : "가정"}`}>{x.status}</b></td></tr>
          ))}
        </tbody>
      </table>

      <h2>보류한 데이터 (5개)</h2>
      <p><b>미탐색</b>은 아직 찾아보지 않은 것, <b>탐색했으나 값 없음</b>은 찾아봤지만 공개된 값이 없어 범위로 다루는 것입니다. 현재 5개는 모두 후자입니다.</p>
      <table>
        <thead><tr><th>데이터</th><th>구분</th><th>왜 비어 있나</th><th>쓰는 탭·기능</th><th>지금 처리</th><th>찾을 곳</th></tr></thead>
        <tbody>
          {HOLDS.map((h) => (
            <tr key={h.item}><td>{h.item}</td><td><b className="k k-가정">{h.kind}</b></td><td>{h.why}</td><td>{h.usedIn}</td><td>{h.handling}</td><td>{h.where}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>구분</h2>
      <table>
        <thead><tr><th>구분</th><th>뜻</th><th>항목 수</th></tr></thead>
        <tbody>
          {(Object.keys(KIND_NOTE) as Kind[]).map((k) => <tr key={k}><td><b className={`k k-${k}`}>{k}</b></td><td>{KIND_NOTE[k]}</td><td className="n">{count(k)}</td></tr>)}
        </tbody>
      </table>

      <h2>화면의 숫자</h2>
      {groups.map((g) => (
        <section key={g.title}>
          <h3>{g.title}</h3>
          <table>
            <thead><tr><th>항목</th><th>값</th><th>구분</th><th>출처</th><th>주의</th></tr></thead>
            <tbody>
              {g.rows.map((r) => <tr key={r.item}><td>{r.item}</td><td>{r.value}</td><td><b className={`k k-${r.kind}`}>{r.kind}</b></td><td>{r.source}</td><td>{r.note}</td></tr>)}
            </tbody>
          </table>
        </section>
      ))}

      <h2>API 키별 연결 (2026-10-15 호출 확인)</h2>
      <p>키 값은 저장소에 없고 <code>changup-sim/.env</code>에만 있습니다. 아래는 각 키로 무엇을 받을 수 있고 어느 탭의 어떤 기능에 쓰는지입니다.</p>
      <table>
        <thead><tr><th>환경변수</th><th>서비스</th><th>상태</th><th>받는 것</th><th>쓰는 탭·기능</th><th>현재 적용</th><th>주의</th></tr></thead>
        <tbody>
          {API_KEYS.map((k) => (
            <tr key={k.env}><td><code>{k.env}</code></td><td>{k.name}</td><td><b className={`k k-${k.status === "호출 확인" ? "실측" : k.status === "인증 실패" ? "예시값" : "가정"}`}>{k.status}</b></td><td>{k.fetches}</td><td>{k.usedIn}</td><td>{k.applied}</td><td>{k.note}</td></tr>
          ))}
        </tbody>
      </table>

      {d && (
        <p>연결된 서울시 자료: {d._meta.year}년 {d._meta.quarters.length}개 분기, {d._meta.generated} 생성, {d._meta.license}. 다시 만들기: <code>python -m pipelines.build_gu_stats --refresh</code>. 주의: {d._meta.caveats.join(" / ")}.</p>
      )}

      {audit && (
        <>
          <h2>팀 리서치 자료와 대조 ({audit.generated})</h2>
          <p>카페 팀과 고깃집 팀이 보낸 파일 4개를 현재 시스템의 항목과 나란히 놓았습니다. <b>아직 계산에 적용하지 않았습니다.</b> 무엇을 채울 수 있고 무엇이 남는지, 그리고 어느 탭의 어떤 기능에 쓰이는지를 적은 표입니다. 값은 팀 자료에 적힌 그대로이며 원 출처(KREI 보고서, 서울시 보고서)는 직접 열어 확인하지 않았습니다.</p>
          <table>
            <thead><tr><th>파일</th><th>보낸 팀</th><th>날짜</th><th>내용</th><th>범위와 주의</th></tr></thead>
            <tbody>{audit.files.map((f) => <tr key={f.id}><td>{f.id} {f.name}</td><td>{f.who}</td><td>{f.date}</td><td>{f.what}</td><td>{f.scope}</td></tr>)}</tbody>
          </table>
          <p>판단: {Object.entries(audit.counts).map(([k, v]) => `${k} ${v}`).join(", ")} (모두 {audit.fill.length}개 항목). 채움 = 예시값·가정을 출처 값으로 바꿀 수 있음, 검증 = 현재 값이 자료 범위 안, 보강 = 구조나 방향만 확인, 신규 변수 = 시스템에 없던 항목, 참고 = 직접 대입 불가.</p>

          <h3>탭·기능별 대조</h3>
          <table>
            <thead><tr><th>탭</th><th>쓰이는 기능</th><th>시스템 변수</th><th>현재 값</th><th>현재 구분</th><th>팀 자료 값</th><th>자료</th><th>판단</th><th>주의</th></tr></thead>
            <tbody>
              {audit.fill.map((r, i) => (
                <tr key={i}><td>{r.tab}</td><td>{r.feature}</td><td>{r.var}</td><td>{r.cur}</td><td>{r.curk}</td><td>{r.team}</td><td>{r.src}</td>
                  <td><b className={`k k-${VERDICT_CLASS[r.verdict] ?? "가정"}`}>{r.verdict}</b></td><td>{r.note}</td></tr>
              ))}
            </tbody>
          </table>

          <h3>추가로 필요한 데이터</h3>
          <table>
            <thead><tr><th>우선순위</th><th>필요한 데이터</th><th>어느 탭의 어떤 기능에 쓰이나</th><th>왜 필요한가</th><th>지금 대체값</th><th>후보 출처 (미확인 포함)</th><th>난이도</th></tr></thead>
            <tbody>{audit.gaps.map((g, i) => <tr key={i}><td>{g.pri}</td><td>{g.need}</td><td>{g.tab}</td><td>{g.why}</td><td>{g.sub}</td><td>{g.cand}</td><td>{g.eff}</td></tr>)}</tbody>
          </table>

          <h3>팀 정성 자료로 새로 넣을 수 있는 변수 (코드 변경 필요)</h3>
          <table>
            <thead><tr><th>변수</th><th>쓰이는 탭·기능</th><th>효과</th><th>근거</th><th>필요한 변경</th><th>신뢰도</th></tr></thead>
            <tbody>{audit.newvars.map((v, i) => <tr key={i}><td>{v.var}</td><td>{v.tab}</td><td>{v.effect}</td><td>{v.src}</td><td>{v.need}</td><td>{v.rel}</td></tr>)}</tbody>
          </table>

          <h3>자료끼리 어긋나거나 결정이 필요한 것</h3>
          <table>
            <thead><tr><th>항목</th><th>내용</th><th>필요한 결정</th></tr></thead>
            <tbody>{audit.conflicts.map((c, i) => <tr key={i}><td>{c.title}</td><td>{c.detail}</td><td>{c.action}</td></tr>)}</tbody>
          </table>

          <h3>카페 전용 (이번 고깃집 화면에는 쓰지 않음)</h3>
          <table>
            <thead><tr><th>항목</th><th>값</th><th>자료</th></tr></thead>
            <tbody>{audit.cafe.map((c, i) => <tr key={i}><td>{c.item}</td><td>{c.value}</td><td>{c.src}</td></tr>)}</tbody>
          </table>
        </>
      )}

      <h2>기존 레포에서 가져오지 않은 것</h2>
      <ul>
        <li>시뮬 엔진 (<code>sim/</code>): 손님 도착, 대기, 좌석 배정을 계산하는 엔진과 6개월 시즌 엔진. 목업은 단순 월별 식을 씀.</li>
        <li>대학로 4개 상권 자료 (<code>data/processed/</code>): 매출, 점포, 유동인구, 직장인구, 거주인구, 집객시설, 인허가 매칭, 생존 분석.</li>
        <li>근거 목록 (<code>ontology/sources.csv</code> 76건)과 가상 매장 입력값 (<code>research/hero_base.yaml</code>): 차용값의 원 출처는 이 두 파일에서 추적.</li>
        <li>사건 목록 (<code>research/shocks.yaml</code>, <code>events.yaml</code>, <code>calendar.yaml</code>): 월별 수요 지수와 사건 크기.</li>
      </ul>

      <h2>구별 값 (한식음식점, 상권 안)</h2>
      {gus.length === 0 ? <p>gu_stats.json을 읽지 못했습니다.</p> : (
        <table className="num">
          <thead><tr><th>구</th><th>상권 수</th><th>점포 수</th><th>점포당 월매출</th><th>하루 결제</th><th>결제 1건</th><th>저녁 비중</th><th>주말 비중</th><th>1년 폐업률</th><th>1년 개업률</th><th>매출 지수</th></tr></thead>
          <tbody>
            {gus.map(([n, v]) => (
              <tr key={n}><td>{n}</td><td>{v.trdar}</td><td>{v.stores.toLocaleString("ko-KR")}</td><td>{man(v.sales_per_store_month)}</td><td>{v.tx_per_store_day}건</td><td>{v.ticket.toLocaleString("ko-KR")}원</td>
                <td>{(v.evening_share * 100).toFixed(1)}%</td><td>{(v.weekend_share * 100).toFixed(1)}%</td><td>{(v.closure_rate * 100).toFixed(1)}%</td><td>{(v.opening_rate * 100).toFixed(1)}%</td><td>{v.demand_index.toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
        </>
      )}
    </main>
  );
}
