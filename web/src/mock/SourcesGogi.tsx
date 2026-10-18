// #/sources 의 고깃집 탭 앞부분: 쓴 출처 전체, 탭별 출처, 시뮬레이션 변수 설정, 데이터 충분성 검토.
// 결정 기록, API 키, 화면의 숫자 표 같은 기존 장부는 Sources.tsx 의 '부록'에 그대로 있다.
// 이 파일의 값은 코드(model.ts, sim/store_input.py, research/*.yaml)에서 읽은 것을 옮겨 적은 것이라, 코드가 바뀌면 같이 고친다.

import SourcesCash from "./SourcesCash";
import Fold from "./Fold";

type Via = "API 연동" | "파일 내려받기" | "건희 레포 파일" | "팀원 파일" | "직접 입력" | "우리가 정함" | "수빈 파일";
const VIA_CLASS: Record<Via, string> = { "API 연동": "실측", "파일 내려받기": "실측", "건희 레포 파일": "차용", "팀원 파일": "차용", "수빈 파일": "차용", "직접 입력": "가정", "우리가 정함": "가정" };
const Tag = ({ v }: { v: Via }) => <b className={`k k-${VIA_CLASS[v]}`}>{v}</b>;

type Src = { name: string; via: Via; how: string; file: string; tabs: string; status: string; url?: string };
const ALL: Src[] = [
  { name: "서울시 상권분석서비스 추정매출-상권 · 점포-상권 · 영역-상권 (OA-15572, OA-15577, OA-15560)", via: "파일 내려받기", how: "서울 열린데이터광장에서 연도별 파일과 shapefile 내려받기 (인증키 불필요)", file: "pipelines/build_gu_stats.py → web/public/mock/gu_stats.json", tabs: "동네 분석, 열기 전 점검, 시뮬레이션(손님 규모)", status: "연결됨", url: "https://data.seoul.go.kr/dataList/OA-15572/S/1/datasetView.do" },
  { name: "서울시 상권분석서비스 추정매출-행정동 (VwsmAdstrdSelngW, 한식 CS100001) + 소상공인 상가업소 (storeListInDong, I20107 돼지고기 구이/찜)", via: "API 연동", how: "SEOUL_OPEN_DATA_KEY, SBIZ_STORE_KEY로 행정동 423곳을 받음", file: "pipelines/build_dong_stats.py → dong_stats.json", tabs: "동네 분석(동네 선택), 시뮬레이션(분기 지수, 동네 유형), 챗봇", status: "연결됨" },
  { name: "소상공인시장진흥공단 상가(상권)정보 15083033", via: "파일 내려받기", how: "구별 돼지고기 구이(I20107) 점포 수를 집계. 원자료 zip 약 350MB는 저장소에 없음", file: "gu_stats.json의 pork 블록", tabs: "동네 분석(고깃집 수)", status: "연결됨", url: "https://www.data.go.kr/data/15083033/fileData.do" },
  { name: "서울 행정구역 경계 (통계청 2013, southkorea/seoul-maps)", via: "파일 내려받기", how: "GitHub 원본 파일. 2013년 경계라 최신과 다를 수 있음", file: "web/public/mock/seoul_gu.json", tabs: "동네 분석(지도)", status: "연결됨", url: "https://github.com/southkorea/seoul-maps" },
  { name: "한국부동산원 R-ONE 상업용부동산 임대동향 (임대료, 전환율, 권리금, 공실률)", via: "API 연동", how: "RONE_KEY. 서울 상권 59곳을 25개 구에 배정한 근사. 환산 보증금 12개월분을 빼 현금 월세로 씀", file: "pipelines/fetch_rone.py → rone_rent.json, rent_gu.json", tabs: "동네 분석(월세·보증금), 가게 꾸미기(현금), 열기 전 점검, 시뮬레이션(월세 출금), 챗봇", status: "연결됨 (권리금은 받았으나 드는 돈에 미반영)", url: "https://www.reb.or.kr/r-one/" },
  { name: "KOSIS 외식업체경영실태조사·한식산업실태조사 (농경연, orgId 114, 표 18개)", via: "API 연동", how: "KOSIS_KEY. 한식·서울권 비용 구성, 영업이익률, 개업 투자비, 객단가. 육류요리 전문점 단독 손익 행은 없음", file: "pipelines/fetch_kosis.py → kosis_food.json", tabs: "열기 전 점검(식재료비 39.3% 비교선), 챗봇(비용 구성)", status: "수집됨 (계산 미적용, 비교선과 챗봇에만 사용)", url: "https://kosis.kr/" },
  { name: "기상청 지상(ASOS) 일자료 · 한국천문연구원 특일 정보", via: "API 연동", how: "DATA_GO_KR_KEY. 서울(108) 2016~2025년 일자료를 달별 비율로 집계, 공휴일 46일", file: "pipelines/fetch_weather.py → weather_seoul.json, holidays.json", tabs: "시뮬레이션(비 오는 날, 공휴일), 열기 전 점검(날씨 충격)", status: "연결됨" },
  { name: "기상청 ASOS 시간자료 · 제주 돼지도체 경락가격", via: "API 연동", how: "ASOS_HOURLY_KEY, LIVESTOCK_AUCTION_KEY. 받아 두기만 함", file: "fetch_asos_hourly.py → asos_hourly.json, fetch_jeju_pork.py → jeju_pork.json", tabs: "없음 (계산에 쓰지 않음)", status: "수집됨 (미적용)" },
  { name: "대학로 가상 매장 입력값 research/hero_base.yaml (손님 1인 금액, 재료비 31%, 인건비, 관리비, 카드 수수료, 사장 생활비 등 97개 변수)", via: "건희 레포 파일", how: "sdic-persona-team1의 복사본. 낮음/기본/높음과 확신도(H 10, M 10, L 62)가 붙어 있음. 원 레포가 '검토 전 예시'라고 밝힘", file: "research/hero_base.yaml (+ 화면에는 model.ts 상수로 옮김)", tabs: "열기 전 점검, 시뮬레이션(엔진 내부)", status: "차용" },
  { name: "시즌 파라미터·사건·달력·충격: season_params.yaml (105개), events.yaml (사건 18종, 밤 결정 5종), calendar.yaml (10~3월), shocks.yaml", via: "건희 레포 파일", how: "복사본 그대로. 105개 중 근거 번호가 붙은 것은 13개이고 83개는 '가정' 태그", file: "research/*.yaml", tabs: "시뮬레이션", status: "차용 (그대로)" },
  { name: "시뮬 엔진 sim/ (simpy DES + numpy 시즌 엔진, 손님 도착·좌석·직원·만족도·단골·사건)", via: "건희 레포 파일", how: "복사본. 우리가 바꾼 것: 시작 달 선택과 4~9월 달력 확장(season.py), 신규 오픈 시작 상태(start_new), 점포 덮어쓰기(store_input.py), FastAPI 서버(api/changeup.py)", file: "sim/*.py, api/changeup.py", tabs: "시뮬레이션", status: "차용 + 확장" },
  { name: "근거 목록 ontology/sources.csv (S번호 76건)", via: "건희 레포 파일", how: "차용값의 원 출처를 S번호로 추적할 때 씀", file: "ontology/sources.csv", tabs: "출처 장부", status: "참조" },
  { name: "서울시 상가임대차 실태조사 2023 (3개 상권 + 서울 평균)", via: "팀원 파일", how: "카페 리서치 팀원이 보고서 수치를 옮겨 적은 '약한 근거 보완_1014.xlsx > 상권 비교'. 업종 구분 없는 1층 상가", file: "약한 근거 보완_1014.xlsx", tabs: "동네 분석(보증금 12개월분 결정의 근거)", status: "부분 확인 (원 보고서 미확인)" },
  { name: "외식업체 경영실태조사 2025 통계보고서 PDF + F&B 원자료 엑셀: 한식 육류 요리 전문점(275곳) 행. 면적·보증금·월세·권리금·투자비(인테리어·주방·홀)·좌석·영업일·객단가·손님 유입·매출·비용·영업이익, 평당 인테리어·월세 분위수", via: "팀원 파일", how: "카페 리서치 팀원이 Drive에 올림(통계보고서 PDF는 2차 업로드). PDF 표의 육류 행을 pipelines/build_gogi_krei.py가 그대로 읽고, 엑셀 원자료는 가중치로 분위수를 계산. 전국 값이며 서울만 뽑은 표는 없음", file: "외식업체_경영실태_통계보고서_2025.pdf, FB_데이터_로우데이터포함.xlsx → gogi_krei.json (저장소 밖 원본)", tabs: "내 조건(투자 중앙값), 동네 분석(매출 배율, 권리금, 제안), 가게 꾸미기(인테리어·주방·테이블 단가)", status: "연결됨" },
  { name: "서울시 상권분석서비스 2024년 추정매출·점포 파일 (성장률 계산용)", via: "파일 내려받기", how: "2025년과 같은 상권끼리 비교한 구별 매출 성장률과 개업·폐업률 변화. 행정동은 추정매출-행정동 API로 2024·2025 한식 매출 합을 비교", file: "pipelines/build_growth.py → growth.json, pipelines/build_dong_profile.py → dong_profile.json", tabs: "동네 분석(성장 지도·성장 행·제안)", status: "연결됨" },
  { name: "서울 행정동 경계 (vuski/admdongkor HangJeongDong 2023-07)", via: "파일 내려받기", how: "GitHub 원본. 구 지도와 좌표를 외곽 상자로 맞춰 0.25km 어긋날 수 있음. 상일제1·2동은 상권분석 기준에 맞춰 상일동으로 합침", file: "pipelines/build_seoul_dong.py → seoul_dong.json", tabs: "동네 분석(동네 지도)", status: "연결됨" },
  { name: "동네 면적·상주/직장인구·유동인구·아파트 평균 시가·지하철역·대학교 (카페 팀 v6 엑셀 2단계_서울 행정동 raw)", via: "팀원 파일", how: "카페용으로 모은 행정동 지표지만 업종과 무관해 고깃집 동네 분석에도 씀. 경쟁 밀도(곳/㎢), 1곳당 인구, 부촌 판단에 사용", file: "카페_시뮬레이터_입점_변수자료_v6.xlsx → cafe_dong.json → dong_profile.json", tabs: "동네 분석(경쟁 강도, 비용, '~형 상권')", status: "연결됨" },
  { name: "예비창업 정책자금 정리표 (중진공·소진공·신보·서울신보·미소금융, 출처 S1~S31)", via: "팀원 파일", how: "업계 글과 기관 안내를 모은 표. 한도·금리는 자료마다 다르게 적힌 채로 옮김. 공고 원문 확인 전", file: "예비창업 정책자금_1015.xlsx → web/src/mock/funds.ts", tabs: "동네 분석(모자란 돈)", status: "연결됨 (원문 확인 필요)" },
  { name: "Drive 자료 원문 폴더: 2023 서울시 상가임대차 실태조사 최종보고서(PDF, 이미지라 글자 추출 안 됨), 외식산업 경영형태 및 식재료 구매현황 심층분석(2019 조사), 산재보험료율, 바리스타 평가표, 오픈서베이 카페 트렌드", via: "팀원 파일", how: "2023 임대차 보고서는 읽지 못했고, 심층분석은 2019 조사라 2025 보고서와 같은 표를 쓰는 데 쓰지 않음. 나머지는 카페용", file: "Drive 카페_자료 모음/자료 원문", tabs: "없음", status: "검토만 (미사용)" },
  { name: "고깃집 유튜브 사장님 인터뷰 정성 기준 (21건 + 알바 경험자 3곳), 인터뷰 요약 20건", via: "팀원 파일", how: "고깃집 리서치 팀원이 자막을 읽고 코딩. 자기보고 자료, 팀원 검토 전 초안", file: "고깃집_정성기준.xlsx, 고깃집_사장님인터뷰.pdf", tabs: "없음 (변수 값에 쓰지 않음)", status: "참고용 (결정 보류)" },
  { name: "챗봇 근거 문장 230개: 돼지고기 소비자가격·부위별·도매·경락(KAPE 통계DB), 한국육류유통수출협회 월간 육류유통 2026년 10월호(KMTA), 생활물가지수(KOSIS), 돼지 사육 현황, 한식·카페 점포, 날씨·공휴일", via: "수빈 파일", how: "수빈 님 파이프라인이 받아 둔 JSON을 근거 문장으로 만든 것. KAPE·KMTA 값은 화면 조회·잡지 본문을 옮겨 적은 파일", file: "pipelines/build_facts.py, fetch_kosis_pork.py, fetch_asos_hourly.py → facts.json (+ kape_2026.json, kmta_2026_10.json, kosis_pork.json, pig_2026.json, pig_auction_2026.json, pork_kape_2026.json)", tabs: "챗봇", status: "연결됨 (PR #1 병합)" },
  { name: "월세·행정동·외식업 비용 구성 근거 문장", via: "우리가 정함", how: "위 R-ONE, 행정동, KOSIS 값을 문장으로 옮긴 것. 숫자는 파일 값 그대로", file: "pipelines/build_changeup_facts.py → facts_changeup.json", tabs: "챗봇", status: "연결됨" },
  { name: "사용자 입력 (구, 동네, 평수, 테이블, 직원, 자본금, 대출, 월세 직접 입력)", via: "직접 입력", how: "화면에서 입력받아 계산과 챗봇 질문에 같이 보냄", file: "Profile.tsx, Analysis.tsx, Builder.tsx, chatContext.ts", tabs: "전부", status: "—" },
  { name: "드는 돈과 점검의 단가·기준선 (인테리어 평당, 물건 가격, 간판, 첫 재료, 대출 이자, 오픈 곡선, 점검 기준선 등)", via: "우리가 정함", how: "근거 자료 없이 정한 값. 바꿔도 되는 설정값", file: "web/src/mock/model.ts", tabs: "동네 분석, 가게 꾸미기, 열기 전 점검", status: "가정" },
];

type TabRow = { item: string; source: string; via: Via; file: string };
const TABS: { title: string; note: string; rows: TabRow[] }[] = [
  {
    title: "동네 분석", note: "구와 동네를 고르고, 드는 돈과 모자란 돈을 보는 화면. 대부분 공공데이터이고 단가는 우리 가정입니다.",
    rows: [
      { item: "구별 한식 점포당 월매출, 매출 지수, 점포 수, 하루 결제, 1년 폐업률", source: "서울시 상권분석서비스 (OA-15572/15577/15560)", via: "파일 내려받기", file: "gu_stats.json" },
      { item: "구별 고깃집(돼지고기 구이/찜) 수", source: "소상공인 상가(상권)정보 15083033", via: "파일 내려받기", file: "gu_stats.json pork" },
      { item: "동네(행정동) 유형, 점포당 매출의 구 안 상대 위치, 고깃집 수", source: "추정매출-행정동 + 상가업소 API", via: "API 연동", file: "dong_stats.json" },
      { item: "평당 월세, 월세 범위(낮음~높음), 구 월세 순위", source: "한국부동산원 R-ONE", via: "API 연동", file: "rent_gu.json" },
      { item: "보증금 = 월세 12개월분", source: "서울시 상가임대차 실태조사 팀 자료의 11~15개월", via: "팀원 파일", file: "약한 근거 보완_1014 > 상권 비교 → model.ts DEPOSIT_MONTHS" },
      { item: "인테리어 평당(150/220/320만), 물건 가격표, 간판 250만, 첫 재료 300만, 석 달 버틸 돈", source: "근거 없음", via: "우리가 정함", file: "model.ts GRADES, CATALOG, SIGN, FIRST_STOCK, Analysis.tsx MONTHLY_BURN" },
      { item: "정책자금 3종, 대출 이자 연 6%", source: "근거 없음 (종류 이름만 적은 틀)", via: "우리가 정함", file: "Analysis.tsx LOANS, model.ts LOAN_RATE" },
      { item: "구 지도 모양", source: "southkorea/seoul-maps (2013)", via: "파일 내려받기", file: "seoul_gu.json" },
    ],
  },
  {
    title: "가게 꾸미기", note: "평수, 테이블, 직원을 정하는 화면. 3D 배치 규칙은 우리가 만든 것이고 가격표는 동네 분석과 같은 가정값입니다.",
    rows: [
      { item: "물건 가격표(테이블, 주방, 계산대, 키오스크, 냉장고)와 인테리어 3등급 단가", source: "근거 없음", via: "우리가 정함", file: "model.ts CATALOG, GRADES" },
      { item: "좌석 수 = 테이블 × 좌석, 직원 수 0~4", source: "화면 입력", via: "직접 입력", file: "Builder.tsx → store" },
      { item: "월세 현금 계산, 가진 돈 대비 남는 돈", source: "R-ONE 월세, 사용자 자본금·대출", via: "API 연동", file: "rent_gu.json, model.ts openingCost" },
    ],
  },
  {
    title: "열기 전 점검", note: "본전 손님 수와 나쁜 경우를 계산하는 화면. 비용 구조 대부분이 건희 레포의 대학로 가상 매장 값입니다.",
    rows: [
      { item: "손님 1인 금액 27,000원, 재료비 31%, 직원 1명 199만원, 관리비 평당 12.8만원, 카드 수수료 0.84%, 사장 생활비 300만원", source: "대학로 가상 매장 hero_base.yaml (S92 등)", via: "건희 레포 파일", file: "model.ts 상수 ← hero.json pnl" },
      { item: "월세", source: "R-ONE", via: "API 연동", file: "rent_gu.json" },
      { item: "식재료비 비교선 39.3% (서울권 음식점 평균, 술·음료 포함)", source: "KOSIS 외식업체경영실태조사 2025", via: "API 연동", file: "kosis_food.json" },
      { item: "비가 잦은 달, 공휴일 충격", source: "기상청 ASOS 일자료, 특일 정보", via: "API 연동", file: "weather_seoul.json, holidays.json" },
      { item: "비 오는 날 손님 −10%, 근처 고깃집 개점 −9% 등 충격 크기", source: "research/shocks.yaml SH10, events.yaml (원 레포도 가정 표시)", via: "건희 레포 파일", file: "model.ts SHOCKS" },
      { item: "여유·주의·취약 판단선, 좌석 14석당 직원 1명", source: "검증한 적 없는 기준선", via: "우리가 정함", file: "model.ts checks" },
    ],
  },
  {
    title: "챗봇 (궁금한 것 물어보기)", note: "LLM 없이 근거 문장을 검색해 그대로 보여 줍니다. 화면의 입력과 시뮬 결과를 같이 보내 즉석 문장을 만듭니다.",
    rows: [
      { item: "돼지고기 가격, 월별 시세, 경락가, 돼지 사육, 한식 점포, 날씨 근거 문장 230개 (카페 점포 문장 26개 포함)", source: "수빈 님 pipelines/build_facts.py (KAPE, KMTA, KOSIS, 서울시, 기상청)", via: "수빈 파일", file: "facts.json" },
      { item: "구·동네 월세, 행정동 유형, 외식업 비용 구성 근거 문장", source: "R-ONE, 행정동 통계, KOSIS", via: "우리가 정함", file: "facts_changeup.json" },
      { item: "내 가게 값 (평수, 월세, 여는 돈, 모자란 돈, 달별 결과, 본전 시점)", source: "질문과 함께 화면이 보낸 값 (ctx)", via: "직접 입력", file: "Chat.tsx → api/ask_ext.py" },
    ],
  },
];

type VarRow = { name: string; value: string; where: string; via: Via; file: string; note?: string };
type VarGroup = { title: string; intro: string; rows: VarRow[] };
const VAR_GROUPS: VarGroup[] = [
  {
    title: "A. 내 가게 입력이 엔진의 점포를 덮어쓰는 값",
    intro: "엔진은 대학로(혜화동) 25평 가상 매장 한 곳을 기준으로 맞춰져 있습니다. 아래 값만 내 입력으로 바뀌고 나머지는 기준 점포 그대로입니다 (sim/store_input.py).",
    rows: [
      { name: "평수, 테이블 수, 테이블당 좌석", value: "내 입력 (좌석 ÷ 테이블, 2~6)", where: "sto_area_pyeong, sto_tables, sto_seats_per_table", via: "직접 입력", file: "store_input.py" },
      { name: "야장(테라스)", value: "없음으로 고정", where: "sto_terrace = 0, 계획 terrace = False", via: "우리가 정함", file: "store_input.py", note: "야장을 꾸미는 화면이 없어서. 소나기 결정은 야장이 있을 때만 나옴" },
      { name: "직원", value: "교대당 알바 0~4명, 정규직 0명", where: "sto_parttimers, sto_employees = 0", via: "우리가 정함", file: "store_input.py", note: "엔진의 정규직은 서빙에 세지 않아 전부 교대 알바로 봄. 인건비 단가는 기준 점포 값(시급 × 시간)" },
      { name: "월세 (현금)", value: "구 R-ONE 평당 현금 월세 × 평수, 또는 내가 입력한 평당 월세", where: "drv_rent", via: "API 연동", file: "rent_gu.json" },
      { name: "공과금", value: "170만원 × 평수 ÷ 25", where: "cst_utilities", via: "건희 레포 파일", file: "hero_base.yaml cst_utilities 170만 (S92) 비례" },
      { name: "손님 규모", value: "동네(없으면 구) 한식 점포당 월매출 ÷ 2,578만원, 0.4~2.0배로 제한", where: "arrival_scale", via: "API 연동", file: "dong_stats.json, gu_stats.json", note: "2,578만원은 건희 레포 기준 상권 앵커. 고깃집 매출이 아니라 한식 전체이고, 새 가게가 평균 점포만큼 손님을 받는다는 가정이 들어감" },
      { name: "달력 수요 지수", value: "대학·청년 동네: 10~3월은 엔진 달력 그대로, 4~9월은 동네 분기 지수. 그 밖의 동네: 전부 분기 지수", where: "calendar.demand_index", via: "건희 레포 파일", file: "calendar.yaml + 우리 확장 (season.py _calendar)", note: "분기 안의 달은 같은 값(월 분할 자료 없음, 가정)" },
      { name: "대학가 행사 (축제 주간, 시험 주간)", value: "대학·청년 동네에만 나옴", where: "excluded_events", via: "우리가 정함", file: "store_input.py CAMPUS_ONLY_EVENTS" },
      { name: "시작 달", value: "1~12월 중 선택, 6개월", where: "store.months", via: "직접 입력", file: "season.py months()", note: "엔진 기본은 10월. 4~9월은 엔진 달력에 없어 가정으로 채움 (아래 C)" },
      { name: "시드", value: "화면에서 숨기고 실행마다 무작위 (1000~9999)", where: "seed", via: "우리가 정함", file: "SimulateEngine.tsx", note: "같은 시드는 같은 결과. 사건과 밤 결정의 추첨이 이 시드에서 나옴" },
    ],
  },
  {
    title: "B. 매달 사용자가 바꾸는 운영 계획 6개",
    intro: "엔진 계획(plan)의 키는 건희 엔진 그대로이고, 화면의 조절 범위와 − + 간격은 우리가 정했습니다. '평소'는 건희 레포의 base_plan(대학로 가상 매장 현재 운영)입니다.",
    rows: [
      { name: "삼겹살 1인분 가격", value: "15,000~25,000원, 1,000원 단위 (평소 19,000)", where: "meat_price", via: "건희 레포 파일", file: "season_params.yaml base_plan, hero_base prd_meat_price (S23, S25)" },
      { name: "교대당 알바", value: "0~4명 (평소 2)", where: "staff_per_shift", via: "건희 레포 파일", file: "base_plan" },
      { name: "마감 시간", value: "23~25시(새벽 1시) (평소 24)", where: "close_hour", via: "건희 레포 파일", file: "base_plan" },
      { name: "반찬 가짓수", value: "3~8가지 (평소 5)", where: "banchan", via: "건희 레포 파일", file: "base_plan, season_params banchan (가정)" },
      { name: "SNS 협찬 예산", value: "0~300만원, 50만원 단위 (평소 0)", where: "marketing_budget", via: "건희 레포 파일", file: "base_plan, season_params marketing (S82~S84 일부)" },
      { name: "고기 등급", value: "국내산 등 등급 선택 (평소 국내산)", where: "meat_grade", via: "건희 레포 파일", file: "season_params meat_grade (가정 3개)" },
    ],
  },
  {
    title: "C. 매달 나오는 사건과 밤 결정",
    intro: "사건은 한 달에 몇 개까지 확률로 뽑히고, 토요일 밤 결정은 달마다 2개가 시드로 뽑힙니다.",
    rows: [
      { name: "사건 18종과 월별 확률 (10~3월)", value: "돼지고기 도매가 상승·하락, 비 오는 주간, 한파, 근처 고깃집 개점·폐점, 블로거 방문, 악성 리뷰, 위생 점검 등", where: "events.yaml prob", via: "건희 레포 파일", file: "events.yaml (S68, S48, S75, S13, S20, S91 등 근거 번호가 붙은 것과 가정 혼합)" },
      { name: "사건 확률 (4~9월)", value: "근거 없음. 축제·시험·장마(비)·한파 4종은 달마다 우리가 정한 값, 나머지 사건은 가까운 계절 달(3, 10, 11월)의 값을 그대로 씀", where: "_EXT_PROB, _PROXY", via: "우리가 정함", file: "sim/season.py", note: "화면과 이 장부에 가정이라고 표시. 바꿔도 되는 설정값" },
      { name: "토요일 밤 결정 5종: 예약 없는 회식, 알바 지각, 고기 부족, 소나기, 블로거", value: "선택지 2~3개씩, 월 발생 횟수 1~2회", where: "events.yaml _night_decisions", via: "건희 레포 파일", file: "events.yaml", note: "모든 선택지와 월 횟수 태그가 '가정'. 선택은 그 달 계산에 먼저 반영" },
      { name: "신규 오픈 시작 상태", value: "리뷰 0, 낮은 인지도, 단골 최소 (기존 점포는 평점 4.2, 리뷰 180, 단골 25%)", where: "start_new", via: "우리가 정함", file: "season_params.yaml start_new (가정 3개)", note: "건희 레포에는 없고 우리가 추가. 단골 상한 0.35는 KOSIS 재방문율 34.75%와 일치" },
    ],
  },
  {
    title: "D. 엔진 내부 값 (건희 레포 그대로)",
    intro: "손님 구성, 체류 시간, 불판 교체, 만족도 가중치, 피로, 단골 형성, 인지도 같은 값은 바꾸지 않았습니다. 대학로 기준이며 대부분 가정입니다.",
    rows: [
      { name: "hero_base.yaml: 가상 매장 변수 97개", value: "낮음 / 기본 / 높음 + 확신도", where: "H 10개, M 10개, L 62개 (나머지 14개는 확신도 없음)", via: "건희 레포 파일", file: "research/hero_base.yaml" },
      { name: "season_params.yaml: 시즌 파라미터 105개", value: "근거 번호 13개(일부 가정과 섞임), 계산 8개, 화면용 1개, 가정 83개", where: "단골 형성 속도, 피로, 만족도 가중치, 반찬·직원·마케팅 효과, 폐업 규칙(60일) 등", via: "건희 레포 파일", file: "research/season_params.yaml" },
      { name: "6개월 비교선 (평소와 비교)", value: "같은 시드로 평소 계획을 150회 돌린 평균", where: "baseline_runs = 150", via: "우리가 정함", file: "api/changeup.py, 시작 달마다 새로 계산(약 20초)" },
    ],
  },
];

type Fill = { item: string; ours: string; keonhee: string; src: string; via: string };
const KEONHEE_ALREADY: Fill[] = [
  { item: "인테리어 평당", ours: "10-16 변경: 45 / 80 / 150만원 (육류 전문점 12~40평 가게의 25·50·75% 분위수 42·77·153, 응답 85곳). 예전 가정 150/220/320", keonhee: "120만원, 등급 M (3등급 단가는 잘라냄)", src: "KREI 2025 통계보고서 표32 서울권 2,848.8만원 ÷ 표12 78.5㎡", via: "changeup/lean docs/CHANGEUP-PARAMS.md" },
  { item: "주방 설비", ours: "10-16 변경: 1,500만원 (육류 전문점 주방 비용 중앙값, 응답 111곳). 건희 1,764는 평균. 예전 가정 900", keonhee: "1,764만원, M", src: "KREI 2025 표33 육류 (냉장 설비가 포함됐을 수 있음)", via: "같음" },
  { item: "4인 테이블 / 2인 테이블", ours: "10-16 변경: 113만원 / 57만원 (건희 값 채택, 육류 홀 비용 중앙값 1,388 ÷ 테이블 12개 = 116과 일치). 예전 85/60", keonhee: "113만원 / 57만원, M", src: "KREI 2025 표34 육류 ÷ 표29 좌석 56.7석", via: "같음" },
  { item: "주류 냉장고", ours: "180만원 (가정)", keonhee: "180만원, M", src: "다나와 2도어 주류 쇼케이스 141~195만원", via: "같음" },
  { item: "간판", ours: "250만원 (가정)", keonhee: "300만원, M", src: "성동구·노원구 2026 간판개선 지원 한도 업소당 300만원 (헤럴드경제)", via: "같음" },
  { item: "대출 금리", ours: "연 6% (가정)", keonhee: "연 4.25%, M", src: "ECOS 121Y006 예금은행 신규취급 중소기업대출, 2026.1~8월 평균", via: "같음" },
  { item: "육류 전문점 식재료비 비율", ours: "31% 유지 (서울권 음식점 39.3%를 비교선으로만 표시)", keonhee: "찾음: 비프랜차이즈 한식 육류 40.6% (12,075만원 ÷ 29,750만원). 건희도 '모델 판단이 필요하다'며 적용하지 않음", src: "S92 (KREI 2025) 표 3-58-3", via: "같음 (Grade pass 2026-10-14의 '찾았지만 적용 안 함')" },
  { item: "보증금 개월 수", ours: "12개월 (서울시 실태조사 11~15개월 범위)", keonhee: "10개월 유지. 통상임대료에서 보증금 환산분을 빼면 약 13.9배라는 근거도 같이 적음", src: "S55 서울시 상가임대차 실태조사 2023", via: "같음" },
  { item: "하루 1인 객단가 교차 확인, 좌석 회전, 직원 1명당 손님", ours: "27,000원, 1.5, 15명 (가정)", keonhee: "교차값만 찾음: 육류 객단가 18,694원, 좌석당 하루 1.05명, 일하는 사람 1명당 14.0명. 값 자체는 가정 유지", src: "S92, S93 (KREI 2025)", via: "같음" },
];

export default function SourcesGogi() {
  return (
    <>
      <p>고깃집은 <b>우리 화면(동네 분석 → 가게 꾸미기 → 열기 전 점검 → 시뮬레이션)</b>이 기준입니다. 구분: <Tag v="API 연동" /> 키로 API를 불러 받음, <Tag v="파일 내려받기" /> 공개 파일을 내려받음,
        <Tag v="건희 레포 파일" /> 건희 레포 파일을 복사해 씀, <Tag v="팀원 파일" /> 팀원이 정리한 엑셀·PDF, <Tag v="수빈 파일" /> 수빈 님 챗봇 파일, <Tag v="직접 입력" /> 사용자가 화면에 넣음, <Tag v="우리가 정함" /> 근거 없이 정한 값.</p>
      <ul>
        <li><a href="#g-all">1. 사용된 모든 데이터 출처</a></li>
        <li><a href="#g-tabs">2. 탭별 데이터 출처</a></li>
        <li><a href="#g-sim">3. 시뮬레이션 변수 설정</a></li>
        <li><a href="#g-enough">4. 보강이 필요한 데이터: 카페만의 문제인가, 고깃집은 충분한가</a></li>
        <li><a href="#g-appendix">부록: 결정 기록, 보류한 데이터, API 키, 화면의 숫자 표, 팀 자료 대조, 구별 값</a></li>
      </ul>

      <Fold id="g-all" title="1. 사용된 모든 데이터 출처">
      <table>
        <thead><tr><th>출처</th><th>어떻게 가져왔나</th><th>방식</th><th>파일·스크립트</th><th>쓰는 탭</th><th>상태</th></tr></thead>
        <tbody>{ALL.map((s) => (
          <tr key={s.name}><td>{s.url ? <a href={s.url} target="_blank" rel="noopener">{s.name}</a> : s.name}</td><td>{s.how}</td><td><Tag v={s.via} /></td><td>{s.file}</td><td>{s.tabs}</td><td>{s.status}</td></tr>
        ))}</tbody>
      </table>

      </Fold>

      <Fold id="g-tabs" title="2. 탭별 데이터 출처">
      {TABS.map((t) => (
        <section key={t.title}>
          <h3>{t.title}</h3>
          <p>{t.note}</p>
          <table>
            <thead><tr><th>화면의 값</th><th>출처</th><th>방식</th><th>파일</th></tr></thead>
            <tbody>{t.rows.map((r) => <tr key={r.item}><td>{r.item}</td><td>{r.source}</td><td><Tag v={r.via} /></td><td>{r.file}</td></tr>)}</tbody>
          </table>
        </section>
      ))}

      </Fold>

      <Fold id="g-sim" title="3. 시뮬레이션 변수 설정">
      <p>시뮬레이션은 <b>건희 엔진을 그대로</b> 쓰고, 내 가게 입력으로 덮어쓰는 값(A)과 매달 바꾸는 계획(B)만 우리 쪽에서 정합니다.
        사건과 밤 결정(C), 엔진 내부 값(D)은 건희 레포의 값입니다.</p>
      <p><b>유튜브 인터뷰는 시뮬레이션 변수에 들어가지 않았습니다.</b> 팀원 정성 자료(F3 유튜브 21건 + 알바 경험자 3곳, F4 인터뷰 요약 20건)는 자기보고 자료이고
        생존자 편향과 자동 자막 오인식 가능성이 있으며 팀원 검토 전 초안이라, 어떤 값에도 대입하지 않고 '새 변수 후보'로만 대조했습니다 (부록의 팀 자료 대조).
        챗봇 답변 근거로 쓸지는 팀원이 만든 챗봇이 있어 보류했고 다시 정해야 합니다. 건희 레포의 값에도 인터뷰로 확인한다고 적힌 항목이 많습니다 (확신도 L 62개).</p>
      {VAR_GROUPS.map((g) => (
        <section key={g.title}>
          <h3>{g.title}</h3>
          <p>{g.intro}</p>
          <table>
            <thead><tr><th>변수</th><th>값·범위</th><th>엔진 키</th><th>방식</th><th>파일</th><th>비고</th></tr></thead>
            <tbody>{g.rows.map((r) => (
              <tr key={r.name}><td>{r.name}</td><td>{r.value}</td><td>{r.where}</td><td><Tag v={r.via} /></td><td>{r.file}</td><td>{r.note ?? ""}</td></tr>
            ))}</tbody>
          </table>
        </section>
      ))}

      </Fold>

      <Fold id="g-enough" title="4. 보강이 필요한 데이터: 카페만의 문제인가, 고깃집은 충분한가">
      <p><b>카페만의 문제가 아니고, 고깃집도 분석은 쓸 만하지만 시뮬레이션 숫자는 아직 비교용입니다.</b> 건희 레포 최신 브랜치의 등급 정리 뒤에도
        고깃집 46개 행 중 24개가 L(가정)이고, 우리가 쓰는 엔진 내부 값도 105개 중 83개가 가정입니다. 카페 갭 106개와 같은 종류의 빈칸이 고깃집에도 있습니다.</p>

      <h3>4-1. 카페와 고깃집이 같이 가진 갭</h3>
      <table>
        <thead><tr><th>갭</th><th>카페 쪽 상태</th><th>고깃집 쪽 상태</th></tr></thead>
        <tbody>
          <tr><td>대출 금리·한도·자격</td><td>건희가 4.5%(M)로 채움, 한도와 상환 기간은 가정</td><td>우리는 6% 가정. 건희 브랜치는 4.25%(M). 정책자금 상품 정보(한도, 자격)는 양쪽 모두 없음</td></tr>
          <tr><td>보증금·권리금 (구·상권 단위)</td><td>신촌·성수 보증금은 가정, 권리금은 서울 중앙값 M</td><td>보증금 12개월은 3개 상권 근거. 권리금은 R-ONE에서 받았으나 <b>드는 돈에 아직 넣지 않음</b></td></tr>
          <tr><td>월세 정의 (R-ONE 환산임대료 vs 실태조사 1층 방문조사)</td><td>신촌이 약 2배 차이 (13.5만 vs 26.1만원/평)</td><td>같은 문제. 우리는 R-ONE을 쓰고 상권 59곳을 25개 구에 배정한 근사</td></tr>
          <tr><td>경쟁 점포 개점의 매출 영향, 별점이 수요에 주는 영향</td><td>0.92배, 별점 1점당 15% (가정)</td><td>−9% (가정), 만족도 10%p당 2.5~4.5% (환산 방식이 가정)</td></tr>
          <tr><td>단골 형성 속도, 오픈 곡선, 사건 확률</td><td>가정 (찾기 어려움 분류)</td><td>가정. 단골 상한만 KOSIS 재방문율 34.75%로 근거 있음</td></tr>
          <tr><td>가격 탄력성</td><td>1.5 (가정)</td><td>−0.81 (L, 한국 외식 값 못 찾음)</td></tr>
          <tr><td>직원 처리량, 하루 회전율</td><td>바리스타 시간당 45잔 M, 머신 처리량 L</td><td>좌석당 하루 1.5명, 직원 1명당 15명 (L, 현장 값 없음)</td></tr>
        </tbody>
      </table>

      <h3>4-2. 고깃집에만 있는 갭</h3>
      <table>
        <thead><tr><th>갭</th><th>지금 상태</th><th>영향받는 화면</th></tr></thead>
        <tbody>
          <tr><td>육류 전문점 단독 손익 (매출, 식재료비, 인건비, 임차료, 영업이익률)</td><td>경영실태조사 2025 육류 전문점 행을 확보: 연매출 34,414만원, 식재료비 42.0%, 고용인 인건비 13.7%, 임차료 6.4%, 영업이익 9.3%. 매출은 동네 분석에 <b>배율 1.18로 반영</b>. 식재료비는 대학로 가상 매장의 31%를 그대로 둠 (10-15 결정, 아래 결정 필요)</td><td>열기 전 점검(본전), 시뮬(재료비 출금), 동네 분석 해석</td></tr>
          <tr><td>설비 단가 (불판·환기 포함 테이블, 주방, 계산대)</td><td>주방 1,500만원(육류 전문점 중앙값), 테이블 113·57만원(건희 값, 홀 비용÷테이블 수와 일치)으로 <b>10-16 반영</b>. 계산대·키오스크·냉장고·간판은 아직 가정</td><td>드는 돈, 가게 꾸미기 가격표</td></tr>
          <tr><td>고기 도매가의 원가 전달, 숯·가스·전기 계절 변동</td><td>도매가 시계열은 있음(KMTA, 수빈 파일). 공과금은 월 고정, 계절 변동 자료 없음</td><td>시뮬(고깃값 사건, 월 관리비)</td></tr>
          <tr><td>회식 단체 비중, 야장 효과, 점심 영업 효과</td><td>모두 가정. 인터뷰 정성 자료에 방향만 있음</td><td>시뮬(밤 결정, 계획)</td></tr>
          <tr><td>고깃집 평균 매출 분포 (폐업한 가게 포함)</td><td>구 평균은 살아남은 가게의 값이라 새 가게에 대한 기대치로는 높게 나올 수 있음</td><td>동네 분석 해석, 시뮬 손님 규모</td></tr>
        </tbody>
      </table>

      <h3>4-3. 건희 최신 브랜치에 이미 있지만 우리 시스템에 아직 안 들어온 고깃집 값</h3>
      <p>부록의 '보류한 데이터'에서 우리가 '탐색했으나 값 없음'으로 적은 설비 단가와 육류 단독 손익 중 일부는, 건희가 10-14 오후 등급 정리에서 이미 찾았습니다
        (changeup/lean docs/CHANGEUP-PARAMS.md, 2026-10-14 Grade pass). <b>적용 여부는 아직 결정하지 않았고 이 표는 대조만 한 것입니다.</b></p>
      <table>
        <thead><tr><th>항목</th><th>우리 시스템 값</th><th>건희 최신 브랜치</th><th>근거</th><th>어디서 확인</th></tr></thead>
        <tbody>{KEONHEE_ALREADY.map((f) => <tr key={f.item}><td>{f.item}</td><td>{f.ours}</td><td>{f.keonhee}</td><td>{f.src}</td><td>{f.via}</td></tr>)}</tbody>
      </table>

      <h3>4-4. 충분한가: 쓰임별 판단</h3>
      <table>
        <thead><tr><th>쓰임</th><th>판단</th><th>이유</th></tr></thead>
        <tbody>
          <tr><td>동네 분석: 어느 동네가 어떤지 비교</td><td><b className="k k-실측">쓸 만함</b></td><td>구·행정동 매출, 점포 수, 월세, 유형은 공공데이터(H/M)이고 출처와 계산식이 있음. 단 고깃집 매출이 아니라 한식 전체이고, 월세는 구 단위 근사</td></tr>
          <tr><td>동네 분석: 드는 돈 / 모자란 돈</td><td><b className="k k-가정">부분적</b></td><td>월세·보증금, 평당 인테리어(육류 전문점 분위수), 주방·테이블 단가는 근거가 있음. 간판·첫 재료·계산대 단가는 가정. 권리금은 직접 입력(기본 0), 정책자금은 팀원 정리표(공고 원문 확인 전)</td></tr>
          <tr><td>열기 전 점검: 본전 손님 수</td><td><b className="k k-가정">부분적</b></td><td>비용 구조가 대학로 가상 매장 값이고 확신도 L이 많음. 육류 전문점 단독 비율이 없어 방향 판단용</td></tr>
          <tr><td>시뮬레이션: 달별 현금 흐름 비교 (평소 vs 내 선택)</td><td><b className="k k-가정">비교용</b></td><td>구조와 날씨·고깃값 사건은 근거가 있으나, 손님 규모(구 평균 한식 점포 가정), 오픈 곡선, 단골 속도, 사건 확률, 4~9월 달력은 가정. 절대 금액보다 '선택을 바꿨을 때 얼마나 달라지나'를 보는 용도</td></tr>
          <tr><td>시뮬레이션: 동네마다 다른 손님 구성</td><td><b className="k k-예시값">부족</b></td><td>손님 구성(20대 학생 위주), 체류 시간, 사건 목록은 아직 대학로 기준. 동네 유형별로는 달력과 행사만 바꿈</td></tr>
        </tbody>
      </table>
      <p>고깃집 설계를 마무리하려면 데이터 쪽에서 <b>① 식재료비 31%를 육류 전문점 42%로 바꿀지 결정</b>, <b>② 간판 250 vs 300, 대출 이자 6% vs 4.25% 같은 4-3의 남은 값 결정</b>,
        <b> ③ 정책자금 한도·금리를 기관 공고 원문으로 확인</b>, <b>④ 시뮬 결과를 범위(민감도)로 보여 주기</b>가 남아 있습니다. ④는 방향만 정했고 구현 전입니다.</p>
      </Fold>
      <SourcesCash />
    </>
  );
}
