// #/sources 의 카페 탭. 건희 레포(sdic-persona-team1)의 카페 브랜치가 쓰는 데이터, 그 데이터의 갭,
// 팀원 파일 두 개가 채운 것과 남은 것을 한 곳에 모은다. 갭 목록은 pipelines/build_sources_cafe.py 가 만든
// web/public/mock/sources_cafe.json 에서 읽는다 (값은 원 파일 그대로, 반영 여부만 건희 params.yaml 과 비교한 결과).
import SourcesSummary from "./SourcesSummary";
import { useEffect, useState } from "react";
import Fold from "./Fold";

type Weak = { value: string; state: string; applied: string; note: string } | null;
type Q22 = { applied: string; value: string; note: string } | null;
type Gap = {
  pri: string; area: string; var: string; section: "상권·입지" | "매장 운영" | "그 외"; old: string; old_grade: string; gap: string;
  now: string; now_grade: string; status: string; filler: string; weak: Weak; q22: Q22; how: string; cand: string; web_note?: string; v6?: V6;
};
type V6 = { value: string; state: string; note: string } | null;
type Data = { gaps: Gap[]; counts: Record<string, number>; remain_by_section: Record<string, number> };

const BRANCHES = [
  { branch: "changeup/lean", head: "72ea1b6", when: "2026-10-14 22:28", what: "ChangeUp 웹 포트. 고깃집·카페 등급 정리(grade pass)와 params.json, 카페 경로(web/src/mock/cafe.ts)", note: "가장 최신. 카페 값의 등급 정리 결과가 여기 있음 (docs/CHANGEUP-PARAMS.md)" },
  { branch: "feat/cafe-month", head: "b8c1544", when: "2026-10-14 21:32", what: "카페 엔진 (sim/cafe/*), research/cafe/params.yaml, districts.yaml, docs/CAFE.md", note: "카페 파라미터의 원본. 10-14 21:30에 등급 정리 결과를 한 번 동기화함 (edce112)" },
  { branch: "feat/cafe", head: "de97f9c", when: "2026-10-13 17:34", what: "Unity 6 매장 꾸미기 앱 소스, Blender 카페 소품 26종", note: "화면·3D 자산. 데이터 출처 없음" },
];

type Src = { name: string; kind: string; how: string; used: string; grade: string; link?: string };
const SOURCES: Src[] = [
  { name: "서울시 상권분석서비스 추정매출-상권 2026년 2분기, 카페(CS100010)", kind: "공공데이터", how: "서울 열린데이터 OpenAPI (SEOUL_API_KEY)로 분기 전체를 받아 로컬에서 걸러냄", used: "상권별 매출, 결제 건수, 결제 1건 금액, 시간대·요일 비중 (research/cafe/districts.yaml, sim/cafe/build_districts.py가 생성)", grade: "H", link: "https://data.seoul.go.kr/dataList/OA-15572/S/1/datasetView.do" },
  { name: "서울시 상권분석서비스 점포-상권 2026년 2분기 (VwsmTrdarStorQq)", kind: "공공데이터", how: "같은 OpenAPI. 신촌·성수 점포 수는 리서치 문서 값을 params.yaml에 직접 입력", used: "상권별 점포 수, 연간 개업 수 (opens_per_year)", grade: "H", link: "https://data.seoul.go.kr/dataList/OA-15577/S/1/datasetView.do" },
  { name: "한국부동산원 R-ONE 소규모상가 1층 환산임대료 2026년 2분기 (혜화동, 신촌/이대, 뚝섬)", kind: "공공데이터", how: "접근 방법이 레포에 적혀 있지 않음 (원 출처 직접 확인 안 됨)", used: "상권별 평당 월세 (rent_per_pyeong_krw)", grade: "H" },
  { name: "한국부동산원 R-ONE 서울 숙박·음식점업 권리금 중앙값 2025 (3,990만원)", kind: "공공데이터", how: "접근 방법 미기재", used: "신촌·성수 권리금 (key_money_krw), 웹 경로의 권리금", grade: "M" },
  { name: "서울 상권 커피-음료 분기 매출 2025 (1분기 6,325억 ~ 4분기 6,864억)", kind: "공공데이터", how: "리서치 문서 §1.3 (research/2026-10-13-seoul-independent-cafe-unit-economics.md, 이 문서는 레포에 없음)", used: "분기 지수 seasonality_by_quarter 0.92 / 1.02 / 1.07 / 1.00", grade: "H" },
  { name: "농식품부·농경연 「2025 외식업체 경영실태 조사 통계보고서」 (2024년 실적, 커피전문점 n=261)", kind: "업계 조사", how: "건희가 10-14 등급 정리에서 직접 인용 (mafra.go.kr 첨부 다운로드). 같은 날 팀원도 텍스트 추출본으로 정리", used: "대표자 인건비 211만원, 대표자 근로 9.3시간, 영업일 28일, 권리금 교차 확인 3,828.6만원, 제과 원가율 39.7%, 커피 대표메뉴 4,118원, 매장·테이크아웃·배달 비중", grade: "M", link: "https://www.mafra.go.kr/bbs/home/798/595247/download.do" },
  { name: "농경연 외식업체 경영실태조사 2024 비알코올 음료점 (이투데이 2026-08-11 경유)", kind: "업계 조사 (기사 경유)", how: "기사에서 옮김", used: "업계 평균 연매출 1억 9,033만원 (수요 기준점), 비프랜차이즈 영업이익률 9.8%, 식재료비 38.9%", grade: "M", link: "https://www.etoday.co.kr/news/view/2613273" },
  { name: "오픈서베이 카페 트렌드 2023 (p.11)", kind: "업계 조사", how: "보고서 수치 입력", used: "매장 49.4% / 테이크아웃 50.6% (지출 기준)", grade: "M" },
  { name: "엠브레인 구매딥데이터 2025 (세계일보 2026-03-22 경유)", kind: "업계 조사 (기사 경유)", how: "기사에서 옮김", used: "디저트 매출 비중 18.5%", grade: "M" },
  { name: "고용노동부 고시 2025-47호(최저임금), 2025-91호(산재보험료율), 4대보험 사업주 요율(국민연금·건강보험·고용보험법 시행령)", kind: "법령·고시", how: "고시문 입력", used: "최저임금 10,320원, 사업주 보험료 합 10.8274% (장기요양 0.4724 포함), 주휴 1.2", grade: "H" },
  { name: "금융위원회 영세·중소가맹점 우대수수료율", kind: "법령·고시", how: "공시 입력", used: "카드 수수료 구간 0.40 / 1.00 / 1.15 / 1.45% (신용카드)", grade: "H" },
  { name: "부가가치세법, 상가건물 임대차보호법 시행령 제4조, 법인세법 시행규칙 별표5", kind: "법령", how: "법령 원문", used: "부가세 조기환급, 임대료 증액 상한 5%, 감가상각 내용연수 5년", grade: "H / M" },
  { name: "다나와 가격 비교 (2026-10-13·14 조회)", kind: "시장 가격", how: "쇼핑몰 목록에서 중앙값을 건희가 계산", used: "에스프레소 머신, 그라인더, 쇼케이스, 오븐, 키오스크, POS, 냉장고, 싱크, 테이블, 의자, 바 의자, 포장재 단가", grade: "M" },
  { name: "공정위 가맹사업 정보공개서 (franchise.ftc.go.kr) 커피 16개 브랜드", kind: "공공데이터", how: "건희가 10-14 조회, 3.3㎡당 인테리어 비용 중앙값 계산", used: "인테리어 평당 209만원", grade: "M" },
  { name: "한국전력 전력데이터개방포털 산업분류-법정동별 전력사용량 (KSIC 56 음식점 및 주점업, 서울 2025)", kind: "공공데이터", how: "xlsx 다운로드(로그인 불필요). 웹 경로 전용", used: "전기료 평당 1.32만원 (계약 1건당 358,971원 ÷ 평균 면적)", grade: "M" },
  { name: "한국은행 금융기관 가중평균금리 2026.8, 소진공 2026년 4/4분기 정책자금 금리", kind: "공공데이터", how: "공보·누리집 값 입력", used: "대출 금리 4.5% (4.38%와 4.72% 사이)", grade: "M" },
  { name: "\"배라\" rent model", kind: "불명", how: "레포 안에 설명 없음", used: "대학로 보증금 중앙값(평당 266만원), 대학로 권리금 4,520만원, 관리비 ㎡당 1,409원", grade: "M (정체 확인 필요)" },
  { name: "논문: Torres 2019 (UNT 석사, 주문 시간), Lu·Musalem·Olivares·Schilkrut 2013 (Management Science 59(8), 줄 이탈), Scott Rao·WBC 경기 기록 (바리스타 처리량)", kind: "논문·해외 자료", how: "수치 입력", used: "키오스크 48.9초, 계산대 58.7초, 대기 이탈 최대 10%, 바리스타 시간당 45잔", grade: "M / L (미국·해외 자료)" },
  { name: "식품외식경제 2012-06-11 (500명), 한국소비문화학회 2013 (1,030명)", kind: "자기응답 조사", how: "기사·학회 요약", used: "카페 체류 시간 1.1시간 (구간 가운데값)", grade: "M" },
  { name: "세계일보 2024-08-10 (20평 카페 전기료 월 30만원), 한성쇼케이스 블로그, AJD 인테리어 가이드, 인테리어 업체 블로그", kind: "기사·블로그 (각 1건)", how: "건희 리서치 문서 인용", used: "전기료 검산, 쇼케이스 사양, 통로 폭 0.9m, 인테리어 단가 예전 값", grade: "L / 가정" },
];

const FILES = [
  { id: "2-2 정량 데이터_1014.xlsx", date: "2026-10-13 작성, 파일 수정 10-14 00:55", who: "카페 리서치 팀원 (건희 레포를 보기 전에 정리)", what: "KREI 2025 통계보고서(커피전문점 전국)·서울시 상권분석 카페 매출·인건비/4대보험·수수료·메뉴가격·생존율·위생점검. 값이 확인된 것만 수록, 빈칸·가정 없음" },
  { id: "약한 근거 보완_1014.xlsx", date: "2026-10-14 작성, 파일 수정 10-15 09:14", who: "같은 팀원 (건희 데이터 3번 시트의 약한 근거 12개를 보고 채움)", what: "12개 변수 중 8개 채움, 1개 일부 채움, 2개 보류, 값은 없지만 근거를 확보한 것 포함. '전기 계절 지수'와 '상권 비교'(2023 서울시 상가임대차 실태조사) 시트가 같이 있음" },
];

const V6_FILE = { id: "카페_시뮬레이터_입점_변수자료_v6.xlsx", date: "2026-10-14 작성, Drive 수정 10-15 21:14", who: "같은 팀원 (Drive 카페_자료 모음)", what: "독립(비프랜차이즈) 카페만 걸러 KREI 2025 원자료에서 직접 계산한 창업 조건·비용 91개, 서울 425개 행정동 x 카페 지표 143개, 25개 구 요약, 시도·구별 비용. 건희 변수와 이름이 달라 변수 단위로 대조함" };
const STATUS_CLASS: Record<string, string> = {
  "채움 · 반영됨": "실측", "건희가 이후 직접 채움": "차용", "채움 · 아직 반영 안 됨": "가정", "채움 · 값이 충돌": "예시값",
  "일부 채움": "가정", "참고만 가능": "가정", "보류": "예시값", "남음": "예시값", "v6 자료로 채움": "실측", "v6 참고값 있음": "가정",
};

function Status({ s }: { s: string }) { return <b className={`k k-${STATUS_CLASS[s] ?? "가정"}`}>{s}</b>; }

function Branches() {
  return (
    <table>
      <thead><tr><th>브랜치</th><th>최신 커밋</th><th>커밋 시각</th><th>들어 있는 것</th><th>비고</th></tr></thead>
      <tbody>{BRANCHES.map((b) => <tr key={b.branch}><td><code>{b.branch}</code></td><td><code>{b.head}</code></td><td>{b.when}</td><td>{b.what}</td><td>{b.note}</td></tr>)}</tbody>
    </table>
  );
}

function GapRows({ rows, cols }: { rows: Gap[]; cols: "filled" | "remain" }) {
  if (cols === "remain") {
    return (
      <table>
        <thead><tr><th>우선</th><th>변수</th><th>현재 값</th><th>등급</th><th>무엇이 비어 있나</th><th>찾는 방법</th><th>후보 (미확인 포함)</th></tr></thead>
        <tbody>{rows.map((g, i) => (
          <tr key={i}><td>{g.pri}</td><td><code>{g.var}</code><br /><small>{g.area}</small></td><td>{g.now}</td><td>{g.now_grade}</td><td>{g.gap}{g.web_note ? <><br /><small>{g.web_note}</small></> : null}{g.v6 ? <><br /><small>v6 참고: {g.v6.value}</small></> : null}</td><td>{g.how}</td><td>{g.cand}</td></tr>
        ))}</tbody>
      </table>
    );
  }
  return (
    <table>
      <thead><tr><th>변수</th><th>건희 처음 값 (등급)</th><th>팀원이 찾은 값</th><th>건희 지금 값 (등급)</th><th>상태</th><th>반영·충돌 내용</th></tr></thead>
      <tbody>{rows.map((g, i) => {
        const team = g.weak?.value ?? g.q22?.value ?? g.v6?.value ?? "";
        const note = [g.weak?.note ?? g.q22?.note, g.v6 ? `v6: ${g.v6.note}` : "", g.web_note].filter(Boolean).join(" / ");
        return (
          <tr key={i}>
            <td><code>{g.var}</code><br /><small>{g.area}</small></td>
            <td>{g.old} ({g.old_grade})</td>
            <td>{team || "팀원 값 없음"}{g.filler ? <><br /><small>{g.filler}</small></> : null}</td>
            <td>{g.now || "(변수 삭제)"} ({g.now_grade || "-"})</td>
            <td><Status s={g.status} /></td>
            <td>{note}</td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}

const NEW_FROM_TEAM = [
  { item: "판매 채널 비중: 매장 64.8%, 테이크아웃 26.4%, 배달 8.8%", file: "2-2 정량 데이터_1014 > 매출·운영 (표58)", why: "건희 카페 모델에는 배달 채널이 없고 매장·테이크아웃 두 채널뿐" },
  { item: "배달앱 중개수수료 2.0 / 6.8 / 7.8% (상생안), 커피전문점 월평균 배달앱 비용 20.9만원", file: "2-2 정량 데이터_1014 > 수수료", why: "배달 채널을 넣을 때 필요. 지금 모델에 자리 없음" },
  { item: "체크카드 우대수수료율 0.15 / 0.75 / 0.90 / 1.15%", file: "2-2 정량 데이터_1014 > 수수료", why: "건희는 신용카드 요율을 전 매출에 적용(card_share 1.0, 가정). 체크·신용 비중 자료는 아직 없음" },
  { item: "커피전문점 1·3·5년 생존율 83.5 / 53.2 / 34.6% (국세청, 기사 경유)", file: "2-2 정량 데이터_1014 > 리스크·생존", why: "카페 경로의 폐업 규칙(2개월 연속 마이너스)과 비교·검증용. 원문은 기사 경유라 미확인" },
  { item: "식약처 위생점검 적발률 무인카페 0.5%, 고위험 업소 3.2%", file: "2-2 정량 데이터_1014 > 리스크·생존", why: "카페 사건 'hygiene'에 쓸 수 있으나 건희는 고깃집 카드의 2%(M)를 가져다 씀" },
  { item: "경영 애로 응답률: 식재료비 91.4%, 경쟁 심화 83.9%, 임차료 77.3%, 인건비 75.2% (외식업 전체)", file: "2-2 정량 데이터_1014 > 리스크·생존", why: "사건 확률이 아니라 방향 참고. 업종 구분 없음" },
  { item: "서울 커피-음료 시간대·요일·연령 비중, 상권 유형별(골목·발달·전통시장·관광특구) 결제 1건 금액", file: "2-2 정량 데이터_1014 > 서울_시간대·요일", why: "건희 districts.yaml이 3개 상권에 이미 같은 계열 값을 가짐. 상권 유형 단위 값은 확장 때 쓸 수 있음" },
  { item: "상권별(성수·신촌·혜화·서울 평균) 월세/㎡, 보증금/㎡, 권리금, 시설투자비, 월평균 매출/㎡ (상가임대차 실태조사 2023, 업종 무관 1층)", file: "약한 근거 보완_1014 > 상권 비교", why: "R-ONE(건희)과 정의가 달라 신촌은 월세가 약 2배 차이 (R-ONE 13.5만, 실태조사 26.1만원/평). 어느 쪽을 쓸지 결정 필요" },
];

export default function SourcesCafe() {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}mock/sources_cafe.json`).then((r) => r.json()).then(setD).catch(() => setD(null)); }, []);
  const g = d?.gaps ?? [];
  const weak = g.filter((x) => x.weak);
  const q22 = g.filter((x) => !x.weak && x.q22 && x.status.startsWith("채움") || (!x.weak && x.q22 && x.status === "참고만 가능"));
  const later = g.filter((x) => x.status === "건희가 이후 직접 채움");
  const v6rows = g.filter((x) => x.status === "v6 자료로 채움" || x.status === "v6 참고값 있음");
  const remain = (s: string) => g.filter((x) => x.section === s && (x.status === "남음" || x.status === "보류"));
  const by = (xs: Gap[]) => {
    const m = new Map<string, number>();
    xs.forEach((x) => m.set(x.how || "미분류", (m.get(x.how || "미분류") ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  return (
    <>
      <SourcesSummary industry="cafe" />
      <p>카페는 <b>건희 레포의 카페 브랜치</b>가 만든 값이 기준입니다. 이 서비스의 카페 화면은 아직 만들지 않았고(고깃집 설계가 끝난 뒤 시작),
        여기서는 데이터가 어디서 왔고 무엇이 비어 있는지만 정리합니다. 값과 출처는 건희 파일에 적힌 그대로이며 원 출처를 직접 열어 확인하지는 않았습니다.</p>

      <Fold id="c-fresh" title="1. 건희 레포 카페 브랜치 (2026-10-15 다시 fetch)">
      <p><code>git fetch --all</code> 결과 이전 확인 때와 달라진 브랜치와 새 커밋은 없었습니다. 아래 최신 커밋이 현재 기준입니다.
        갭 정리표는 10-14 01:14에 만들었고 그 뒤 10-14 오후에 건희가 카페 L 행을 다시 조사해 카페 68개 행의 H·M 등급이 19개에서 39개로 늘었기 때문에, 이 페이지는 <b>그 이후 값과 다시 대조</b>한 결과입니다.</p>
      <Branches />

      </Fold>

      <Fold id="c-sources" title="2. 건희 카페 브랜치가 쓴 데이터 출처">
      <p>research/cafe/params.yaml, districts.yaml, docs/CAFE.md, docs/CHANGEUP-PARAMS.md에 적힌 출처를 모았습니다. 등급은 건희의 기준(H 공식·원자료 / M 업계 자료·여러 판매처 일치 / L 사례 1건·자체 계산 / 가정 출처 없음)입니다.</p>
      <table>
        <thead><tr><th>출처</th><th>종류</th><th>가져온 방법</th><th>쓰인 값</th><th>등급</th></tr></thead>
        <tbody>{SOURCES.map((s) => (
          <tr key={s.name}><td>{s.link ? <a href={s.link} target="_blank" rel="noopener">{s.name}</a> : s.name}</td><td>{s.kind}</td><td>{s.how}</td><td>{s.used}</td><td>{s.grade}</td></tr>
        ))}</tbody>
      </table>

      </Fold>

      <Fold id="c-gaps" title="3. 건희 데이터의 갭 (보강이 필요한 데이터)">
      {!d ? <p>sources_cafe.json을 읽지 못했습니다.</p> : (
        <>
          <p>건희 변수 183개 중 근거가 약하거나 없어 보강이 필요한 <b>갭 {g.length}개</b>를 대상으로 했습니다 (갭 정리표 3번 시트).
            근거 분류는 공식 35, 업계·보도 23, 약한 근거 13, 가정 91, 내부 규칙 21입니다. 가정 비율이 높은 영역은 12개월 시즌(57개 중 51개), 월 운영비(34개 중 21개), 처리 능력(10개 중 6개)입니다.</p>
          <table>
            <thead><tr><th>지금 상태</th><th>개수</th><th>뜻</th></tr></thead>
            <tbody>
              {([
                ["채움 · 반영됨", "팀원이 찾은 값이 건희 값과 같거나 건희 params.yaml에 이미 들어감"],
                ["채움 · 아직 반영 안 됨", "팀원이 근거 있는 값을 찾았지만 건희 params.yaml은 옛 값 그대로"],
                ["v6 자료로 채움", "독립 카페만 걸러 계산한 v6 엑셀(Drive 카페_자료 모음)이 값을 줌"],
                ["v6 참고값 있음", "v6에 참고할 값이 있으나 변수에 바로 넣기는 어려움"],
                ["채움 · 값이 충돌", "팀원 값과 건희 값이 서로 다르고 정의도 달라 선택이 필요함"],
                ["일부 채움", "상한 검산 등 일부만 가능"],
                ["참고만 가능", "비교·검산용 값이라 변수에 바로 넣을 수 없음"],
                ["건희가 이후 직접 채움", "팀원 파일과 무관하게 건희가 10-14 등급 정리에서 M으로 올림"],
                ["보류", "팀원이 찾아봤으나 근거를 못 찾음"],
                ["남음", "아직 가정 또는 L 그대로"],
              ] as const).map(([s, t]) => (
                <tr key={s}><td><Status s={s} /></td><td className="n">{d.counts[s] ?? 0}</td><td>{t}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      </Fold>

      <Fold id="c-filled" title="4. 팀원이 채워 준 것">
      <table>
        <thead><tr><th>파일</th><th>작성</th><th>누가</th><th>내용</th></tr></thead>
        <tbody>{[...FILES, V6_FILE].map((f) => <tr key={f.id}><td><code>{f.id}</code></td><td>{f.date}</td><td>{f.who}</td><td>{f.what}</td></tr>)}</tbody>
      </table>
      {d && (
        <>
          <h3>4-1. 약한 근거 보완_1014.xlsx: 건희 약한 근거 12개 ({weak.length}행)</h3>
          <p>건희 변수 중 노란색으로 표시된 약한 근거 12개를 보고 채운 파일입니다. 12개(권리금은 신촌·성수 2행)를 건희 params.yaml과 비교하면 같은 값이 이미 들어간 것 2개, 값이 서로 다른 것 2개, 아직 반영 안 된 것 5개, 일부 채움 1개, 보류 2개입니다. 보류 중 체류 시간(dwell_h)은 팀원 쪽 근거는 없지만 건희가 같은 날 자기응답 조사 2건으로 M까지 올렸습니다.</p>
          <GapRows rows={weak} cols="filled" />
          <h3>4-2. 2-2 정량 데이터_1014.xlsx: 갭 정리표와 맞닿은 값 ({q22.length}행)</h3>
          <p>이 파일은 건희 레포를 보기 전에 정리한 것이라 갭을 겨냥하지는 않았지만, 변수와 맞닿은 값이 있습니다. 위 4-1에 이미 나온 변수는 제외했습니다.</p>
          <GapRows rows={q22} cols="filled" />
          <h3>4-3. 카페_시뮬레이터_입점_변수자료_v6.xlsx로 채워진 것 ({v6rows.length}행)</h3>
          <p>독립 카페만으로 다시 계산한 값이라 지금까지 비어 있던 <b>서울 개인카페 매출, 판매 채널 비중, 영업시간, 정책자금 한도·상환 기간</b> 등이 채워집니다. 서울 독립 카페 값은 응답 63곳, 구별 값은 구마다 1~8곳이라 표본이 작습니다.</p>
          <GapRows rows={v6rows} cols="filled" />
          <h3>4-4. 팀원 값 없이 건희가 이후 직접 채운 것 ({later.length}행)</h3>
          <p>갭 정리표를 만든 뒤 건희가 다나와·정보공개서·농경연 2025 표로 직접 올린 값입니다. 남은 갭에서 빼기 위해 같이 적습니다.</p>
          <GapRows rows={later} cols="filled" />
        </>
      )}

      </Fold>

      <Fold id="c-remain" title="5. 아직 남은 정보">
      {d && (
        <>
          <p>가정 또는 L로 남은 갭 {remain("상권·입지").length + remain("매장 운영").length + remain("그 외").length}개를 세 묶음으로 나눴습니다.
            '찾는 방법'은 갭 정리표의 분류이고, 후보 출처 중 열어 보지 못한 것은 (미확인)으로 표시돼 있습니다.</p>

          <h3>5-1. 상권·입지 ({remain("상권·입지").length}개)</h3>
          <p>동네에 따라 값이 달라지거나 동네 수요의 모양을 정하는 값입니다. 이 묶음에는 변수 목록에 없는 큰 갭이 하나 더 있습니다:
            <b> 상권 데이터가 신촌·성수 카페거리·대학로 3곳만 완성</b>되어 있어 서울 25개 구로 확장해야 합니다 (건희의 웹 포트 changeup/lean은 구 단위 R-ONE 월세와 서울시 구별 값으로 25개 구를 이미 계산하지만, 카페 엔진의 시간대 비중과 보증금은 3곳뿐).</p>
          <GapRows rows={remain("상권·입지")} cols="remain" />

          <h3>5-2. 매장 운영 ({remain("매장 운영").length}개)</h3>
          <p>가게 안에서 일어나는 일입니다: 처리 속도, 인력, 원가·설비 단가, 손님 행동(단골·별점·이탈), 마케팅·고장 같은 사건.
            찾는 방법별 개수: {by(remain("매장 운영")).map(([k, v]) => `${k} ${v}`).join(", ")}.
            <b> 인터뷰가 필요한 항목이 많고, 통계로는 찾기 어렵다고 이미 분류된 항목이 대부분입니다.</b></p>
          <GapRows rows={remain("매장 운영")} cols="remain" />

          <h3>5-3. 그 외 ({remain("그 외").length}개)</h3>
          <p>상권도 매장 운영도 아닌 시즌 규칙과 자금 설계입니다. 데이터를 구한다기보다 규칙을 정해야 하는 항목입니다.</p>
          <GapRows rows={remain("그 외")} cols="remain" />

          <h3>5-4. 팀원 파일에는 있지만 건희 변수에 자리가 없는 정보</h3>
          <p>갭이 아니라 반대 방향의 빈칸입니다. 팀원이 값을 찾았지만 카페 모델에 변수가 없어 쓰이지 못합니다.</p>
          <table>
            <thead><tr><th>정보</th><th>파일</th><th>왜 못 쓰나</th></tr></thead>
            <tbody>{NEW_FROM_TEAM.map((n) => <tr key={n.item}><td>{n.item}</td><td>{n.file}</td><td>{n.why}</td></tr>)}</tbody>
          </table>
        </>
      )}

      </Fold>

      <Fold id="c-summary" title="6. 요약: 카페를 고깃집과 같은 구조로 구현할 수 있나">
      <p><b>동네 분석, 드는 돈, 열기 전 점검은 데이터가 충분해졌고, 시뮬레이션만 아직 비교용입니다.</b> 변수 구조는 건희 엔진에 모두 있고,
        2026-10-16에 Drive의 v6 엑셀(독립 카페만 계산한 값, 서울 425개 행정동 지표)이 들어오면서 개인 카페 기준값이 채워졌습니다. 상세는 7장입니다.</p>
      <table>
        <thead><tr><th>단계</th><th>판단</th><th>이유</th></tr></thead>
        <tbody>
          <tr><td>동네 분석 (구·동네별 카페 매출, 점포 수, 경쟁, 월세)</td><td><b className="k k-실측">충분</b></td><td>25개 구 182개 변수와 425개 행정동 지표(v6)가 있음. 매출·점포·시간대는 서울시 H, 월세는 R-ONE H</td></tr>
          <tr><td>드는 돈</td><td><b className="k k-실측">충분</b></td><td>독립 카페 기준 개업 투자비 6,000만원(3,000~9,000: 인테리어 3,000, 주방 1,500, 홀 1,000), 인테리어 평당 150만원, 보증금 3,000만원, 권리금 2,500만원, 총 창업비용 1억 1,000만원(6,500~15,000)이 H. 상권별 보증금만 서울 값으로 대신함</td></tr>
          <tr><td>모자란 돈 (대출)</td><td><b className="k k-가정">대체로 충분</b></td><td>정책자금 한도 7,000만원·5년(거치 2년)·기준금리+0.6%p가 있음 (업계 글 M, 공고 원문 확인 필요)</td></tr>
          <tr><td>열기 전 점검</td><td><b className="k k-실측">충분</b></td><td>독립 카페 비용 구조(식재료 40%, 고용인 인건비 11%, 임차료 10%, 영업이익률 10%)와 객단가 5,000원, 영업일 26일이 H. 경쟁 개점 영향과 월세 인상 확률만 가정</td></tr>
          <tr><td>시뮬레이션 (6개월, 원안 12개월)</td><td><b className="k k-예시값">비교용</b></td><td>수요 기준선과 채널 비중은 채워졌으나 단골, 별점, 이탈, 마케팅, 사건 확률은 여전히 가정 (시즌 변수 57개 중 51개)</td></tr>
        </tbody>
      </table>

      <h3>기능별 데이터 현황</h3>
      <table>
        <thead><tr><th>기능</th><th>있는 데이터</th><th>부족한 데이터</th><th>채우는 방법</th></tr></thead>
        <tbody>
          <tr><td>동네 분석: 구별 카페 매출·점포 수·월세</td><td>25개 구 + 425개 행정동: 보정 점포당 월매출, 매출 지수, 건당 결제, 시간대·요일·연령 비중, 프랜차이즈 비중, 카페 밀도, 개·폐업률, 유동·직장·상주 인구, 역세권</td><td>상권 단위(골목·발달·전통시장) 지표는 아직 미사용. 집객시설·대학교 수는 갱신 의심(L)</td><td>Drive 상권 단위 CSV(이미 받음)를 같은 방식으로 집계</td></tr>
          <tr><td>드는 돈: 보증금·권리금·인테리어·장비</td><td>독립 카페 투자비·인테리어·주방·홀·보증금·권리금 분위수(H), 건희의 장비 단가(M)</td><td>신촌·성수 등 상권별 보증금 (서울 값만 있음), 전기 증설 <code>electrical</code></td><td>통계: 서울시 상가임대차 실태조사 구 단위 표</td></tr>
          <tr><td>모자란 돈: 대출</td><td>금리 4.5%(M), 한도 7,000만원, 5년(거치 2년)</td><td>정책자금 공고 원문 확인, 운전자금 개월 수 <code>working_capital_months</code></td><td>소진공 공고. 개월 수는 설계 결정</td></tr>
          <tr><td>열기 전 점검: 본전·나쁜 경우</td><td>독립 카페 비용 구조 25/50/75백분위, 인건비·4대보험·카드 수수료, 월세 인상 상한 5%</td><td>신용·체크카드 비중 <code>card_share</code>, 임대료 인상 확률 <code>rent_hike_p</code>, 경쟁 개점 영향 <code>rival_demand_mult</code></td><td>통계: 여신금융협회. 경쟁 효과는 문헌</td></tr>
          <tr><td>시뮬: 수요 (손님 수·잔 수)</td><td>서울 독립 카페 월매출 1,460만원(n=63), 객단가 5,000원, 방문 49명/일, 채널 비중 홀 71.9·포장 22.0·배달 6.2%</td><td>오픈 초기 매출 비율 <code>launch_share</code>, 동행 인원 <code>persons_per_cup</code>, 가격 탄력성 <code>price_elasticity</code></td><td>인터뷰 + 범위 처리(낮음/기본/높음)</td></tr>
          <tr><td>시뮬: 배달 채널</td><td>배달앱 중개수수료 2.0/6.8/7.8%, 점주 배달비 1,900~3,400원, 배달앱 월 비용 13.3만원(독립 중앙값), 1일 배달 17건, 배달앱 사용률 17.5%</td><td>배달이 매장 손님을 옮기는지 더하는지 (대체 vs 추가)</td><td>범위 처리. 엔진에 채널 변수 추가 필요 (건희 엔진에는 없음)</td></tr>
          <tr><td>시뮬: 처리 능력 (바리스타·머신·좌석)</td><td>바리스타 시간당 45잔(M), 주문 시간(M), 머신 상한 검산, 직원 구성·인건비(독립 알바 월 150만원, 상용 250만원)</td><td>머신 그룹별 실제 잔 수 <code>machine_cph_by_groups</code>, 주문 겸할 때 효율 <code>barista_on_pos_order_factor</code></td><td>인터뷰(바리스타), 제조사 문의</td></tr>
          <tr><td>시뮬: 월 운영비·원가</td><td>식재료·인건비·임차료·세금공과·기타비 비율과 월 금액, 원두 월 구매량 40kg, 디저트 재료 구매 금액</td><td>디저트 폐기율 <code>dessert_waste_share</code>, 수도·가스 분리 값</td><td>인터뷰</td></tr>
          <tr><td>시뮬: 단골·별점·마케팅</td><td>없음 (생존율 1·3·5년 83.5/53.2/34.6%는 검증용으로만)</td><td><code>regular_share</code>, <code>regulars_speed</code>, <code>rating_demand_per_star</code>, <code>marketing_max_lift</code></td><td>범위 처리하고 인터뷰로 방향만 확인</td></tr>
          <tr><td>시뮬: 사건 (고장·경쟁·월세 인상)</td><td>경영 애로 점수(식재료비 5.89, 경쟁 5.66, 임차료 5.28, 규제 5.26, 인건비 4.70, 7점 만점)로 사건 가중치 방향, 월세 인상 상한 5%</td><td>고장·화제 확률과 크기 <code>breakdown_p</code>, <code>viral_p</code></td><td>인터뷰(고장), 나머지는 범위 처리</td></tr>
        </tbody>
      </table>

      <h3>찾기 전에 정해야 할 것</h3>
      <table>
        <thead><tr><th>구분</th><th>항목</th><th>필요한 일</th></tr></thead>
        <tbody>
          <tr><td><Status s="채움 · 값이 충돌" /> 3건</td><td><code>dessert_food_cost_share</code> 0.30(도매가) ↔ 0.40(제과점 원가율), 신촌·성수 보증금(v6는 서울 값뿐)</td><td>정의가 달라 어느 쪽을 쓸지 건희와 결정</td></tr>
          <tr><td><Status s="채움 · 아직 반영 안 됨" /> 5건</td><td>신촌·성수 권리금, <code>electricity_anchor_20py_krw</code>, <code>vat_refund_month</code>, <code>electrical</code></td><td>근거는 이미 있음. 건희 params.yaml에 반영만 하면 됨</td></tr>
          <tr><td><Status s="v6 자료로 채움" /> 6건</td><td><code>independent_scale</code>, <code>dine_in_share</code>, <code>misc_krw</code>, 영업 시작·마감 시각, <code>loan_term_months</code></td><td>7-3의 값 차이를 보고 건희 params.yaml에 어느 값을 넣을지 결정</td></tr>
        </tbody>
      </table>

      </Fold>

      <Fold id="c-drive" title="7. Drive 자료 반영: 카페 데이터 구축 현황 (2026-10-16)">
      <p>Drive 폴더 <b>카페_자료 모음</b>과 Claude 아티팩트 '서울 카페 상권 리서치'를 검토해 카페용 데이터 묶음을 만들었습니다.
        고깃집의 <code>gu_stats.json</code>, <code>dong_stats.json</code>, <code>kosis_food.json</code>에 해당하는 파일이 카페에도 생겼습니다.</p>

      <h3>7-1. 만든 데이터 파일</h3>
      <table>
        <thead><tr><th>파일</th><th>내용</th><th>고깃집의 대응 파일</th><th>만드는 법</th></tr></thead>
        <tbody>
          <tr><td><code>web/public/mock/cafe_gu.json</code></td><td>서울 + 25개 구 x 카페 변수 182개 (매출 지수, 건당 결제, 시간대·요일·연령 비중, 프랜차이즈 비중, 개·폐업률, 유동·직장·상주 인구, 역세권, 소득 대리 지표 등). 변수마다 확신도 H/M/L과 출처</td><td><code>gu_stats.json</code></td><td rowSpan={3}><code>python -m pipelines.build_cafe_data &lt;v6 엑셀&gt;</code></td></tr>
          <tr><td><code>web/public/mock/cafe_dong.json</code></td><td>서울 425개 행정동의 카페 핵심 지표 50개와 동네 유형. 유형은 고깃집과 같은 문턱을 카페 매출 비중에 적용한 규칙 분류: 일반 242, 오피스 76, 주거 73, 대학·청년 34 (혜화동·신촌동은 대학·청년, 가산동은 오피스)</td><td><code>dong_stats.json</code></td></tr>
          <tr><td><code>web/public/mock/cafe_cost.json</code></td><td>독립 카페 창업 조건·비용 91개(낮음/기본/높음 = 매장 분포 25/50/75백분위, 확신도, 출처)와 참고값 18개, 시도별·서울 구별 월세·보증금·권리금·인건비·식재료비율</td><td><code>kosis_food.json</code> + <code>model.ts</code> 상수</td></tr>
        </tbody>
      </table>
      <p>값은 v6 엑셀에 적힌 그대로 옮기고 반올림만 했습니다. 엑셀 자체는 저장소 밖(<code>entre/</code> 폴더)에 둡니다.</p>

      <h3>7-2. Drive 자료 검토</h3>
      <table>
        <thead><tr><th>자료</th><th>담긴 것</th><th>이번에 한 일</th><th>신뢰도와 주의</th></tr></thead>
        <tbody>
          <tr><td><code>카페_시뮬레이터_입점_변수자료_v6.xlsx</code></td><td>독립 카페만 걸러 KREI 2025 원자료에서 계산한 1단계 창업 조건, 2단계 서울 행정동·25개 구 지표, 상권별 매출 패턴, 서울 외 13개 시도 덤프</td><td>위 3개 JSON으로 변환, 건희 갭 106개와 변수 단위로 대조 (4-3)</td><td>1단계는 H 위주지만 서울 독립 카페는 응답 63곳, 구별은 1~8곳. 추정매출은 카드 기반이라 실제보다 낮음(보정 배율 1.54를 적용한 열을 따로 둠)</td></tr>
          <tr><td><code>F&amp;B 데이터 (로우데이터 포함).xlsx</code></td><td>KREI 2025 외식업체 경영실태조사 원자료: 표본 2,747곳, 업종 세분류별 비율·사업체 수, 지역별 사업체 수, 소상공인 비중, 표본·모집단 raw</td><td>구조만 확인. 카페 값은 v6가 이미 이 자료에서 계산함</td><td>H. <b>한식 육류 요리 238곳이 들어 있어 고깃집 단독 손익·설비 단가 갭에 쓸 수 있음</b> (7-5)</td></tr>
          <tr><td><code>상권 관련/</code> 폴더 (서울시 상권분석서비스 원자료 CSV 49개, 지하철 역사 3개)</td><td>추정매출·점포·길단위인구·상주·직장인구·집객시설·아파트·소득소비·상권변화지표를 상권·상권배후지·행정동·자치구·서울시 단위로</td><td>내려받지 않음 (파일이 커서 최대 100MB). 행정동 단위는 v6가 이미 집계함</td><td>H. 상권 단위로 보려면 같은 방식으로 추가 집계 필요 (v6 미확보 시트에도 같은 항목)</td></tr>
          <tr><td><code>소상공인시장진흥공단_상가(상권)정보_서울_202606.csv</code></td><td>서울 상가업소 전체 (약 300MB)</td><td>내려받지 않음. v6가 카페 수·프랜차이즈·개인 카페·무인카페를 집계함</td><td>H. 카페 유형 분류는 상호명 규칙이라 오분류 가능</td></tr>
          <tr><td>Claude 아티팩트 「서울 카페 상권 리서치」</td><td>6개 상권(대학로·신촌·서울대입구·가산·망원·성수) 2021~2026 매출·점포·인구, 인허가·폐업, KOSIS 가격지수, 배달앱 사용률, 정보공개서 창업비용, 최저임금, 배달 수수료, 논문 4편, 점포 목록 12,155곳</td><td>상권 6곳 값과 비용 변수를 대조에 사용. 일부는 아래 7-4처럼 제외</td><td>1~11장은 API 직접 집계(H), 13~14장은 기사 인용(미확인 표시 있음), 15~16장은 쓰지 않음</td></tr>
        </tbody>
      </table>

      <h3>7-3. 건희 값과 v6 값이 다른 곳</h3>
      <p>서로 다른 정의에서 나온 값이라 어느 쪽이 맞는다고 단정할 수 없는 항목입니다. 반영 전에 결정이 필요합니다.</p>
      <table>
        <thead><tr><th>항목</th><th>건희 (카페 브랜치)</th><th>v6 (독립 카페)</th><th>차이의 원인과 결정</th></tr></thead>
        <tbody>
          <tr><td>서울 평균 점포당 월매출</td><td>1,082만원(2025 4분기 웹) ~ 1,164만원(2026Q2 엔진)</td><td>949만원 (카드 추정, 보정 전)</td><td>점포 수 분모가 다름으로 추정 (확인 안 함). 건희는 유사업종 점포 수, v6는 행정동 점포 수</td></tr>
          <tr><td>개인 카페 수요 기준</td><td>전국 음료점 평균 연 1억 9,033만원(프랜차이즈 포함) x 구 지수</td><td>서울 독립 월 1,460만원(n=63), 전국 독립 연 1억 3,507만원 평균 / 1억 234만원 중앙값</td><td>서울 독립 / 건희 기준 = 0.92배, 전국 독립 평균 / 건희 기준 = 0.71배. 서울 표본이 작아 0.71~0.92 범위로 둠</td></tr>
          <tr><td>판매 채널</td><td>매장 49.4% / 테이크아웃 50.6% (오픈서베이 설문, 지출 기준)</td><td>홀 71.9% / 포장 22.0% / 배달 6.2% (독립 카페 점포 매출 기준)</td><td>설문과 점포 매출은 정의가 다름. 점포 매출 기준(v6)이 시뮬 입력에 더 맞음</td></tr>
          <tr><td>권리금</td><td>3,990만원 (R-ONE 서울 숙박·음식점업 중앙값)</td><td>3,000만원 (독립 카페 중앙값, 낸 매장만). 낸 비율 서울 76.3%</td><td>낸 비율을 곱하면 기대값 약 2,290만원. 업종 범위가 달라 어느 쪽을 쓸지 결정 필요</td></tr>
          <tr><td>보증금</td><td>대학로 5,320만원(평당 266만원 환산), 신촌·성수는 가정</td><td>서울 독립 카페 3,000만원 (n=40)</td><td>상권별 값이 아니라 서울 값이라 신촌·성수 갭은 그대로</td></tr>
          <tr><td>평당 월세</td><td>R-ONE 환산임대료 혜화 19.8만원</td><td>독립 카페 서울 계약 월세 ÷ 평수 중앙값 10만원 (구별 3~23만원, 1~8곳)</td><td>환산임대료는 보증금 환산분 포함, 계약 월세는 실제 지불액. 표본이 작아 구별 비교는 참고만</td></tr>
          <tr><td>영업일 / 마감 시각</td><td>28일 (농경연 표25 평균) / 22시</td><td>26일 (중앙값) / 21시 (낮음 19, 높음 22)</td><td>평균과 중앙값, 가정과 직접 값의 차이. 기본값을 바꿀지 결정</td></tr>
          <tr><td>대표자 인건비</td><td>월 211만원 (커피전문점 평균 연 2,533만원 ÷ 12)</td><td>월 158만원 중앙값 (낮음 70, 높음 268)</td><td>평균 대 중앙값. 어느 쪽을 쓸지에 따라 월 순익이 바뀜</td></tr>
          <tr><td>식재료비율 / 영업이익률</td><td>38.9% / 9.8% (비알코올 음료점, 이투데이 경유)</td><td>40% (평균 42.2%) / 10%</td><td>거의 일치. 건희 값을 유지해도 됨</td></tr>
        </tbody>
      </table>

      <h3>7-4. 쓰지 않았거나 조심할 자료</h3>
      <ul>
        <li><b>아티팩트 15~16장(창업 비용 손익, KAMIS 재료비 시뮬레이션)은 쓰지 않았습니다.</b> 15.2의 임차료·인건비 비중(15~25%, 30~40%)이 14.5장(10~15%, 15~25%)과 다르고, 16.3의 고정비(임차료 2,500만원, 인건비 1,040만원)는 월 매출 1,456만원 규모의 카페와 맞지 않으며, 16.2는 쌈채소 같은 고깃집 재료를 카페 재료로 적었습니다.</li>
        <li><b>논문 3편(무인카페)</b>은 점주 20명, 대학생 296명 표본입니다. 가격 수용 범위와 의사결정 인사이트는 일반 카페에 그대로 옮기지 않고 참고만 합니다. 네 번째 논문(골목상권 1,090곳)의 매출 요인(외식업 수 +, 집객시설 +, 상주인구 −)은 상권 합계 매출 기준으로 보여 점포당 매출 변수로 쓰기에는 맞지 않습니다.</li>
        <li><b>6개 상권 값은 6곳뿐</b>이라 25개 구 확장에는 v6의 구·행정동 값을 씁니다. 대학로는 인허가 표본이 58곳이라 비율 해석을 조심해야 합니다.</li>
        <li><b>기사 인용 값</b>(최저임금 2027년 10,700원 미고시, 배달 수수료 상생안 현행 여부, 일회용컵 정책 시행 여부, 정책자금 한도)은 원문을 확인하지 못했다고 자료 자체가 표시한 것이 많습니다.</li>
        <li>집객시설 수·대학교 수는 2021년 이후 서울 합계가 분기마다 같은 값이라 갱신이 의심돼 확신도 L입니다.</li>
      </ul>

      <h3>7-5. 고깃집에도 쓸 수 있는 것</h3>
      <ul>
        <li><b>F&amp;B 원자료의 한식 육류 요리 238곳</b>: 고깃집 단독 손익(식재료비·인건비·임차료·영업이익률), 개업 투자비(인테리어·주방·홀), 객단가, 좌석·테이블이 같은 방식으로 계산됩니다. 고깃집 탭의 가장 큰 갭('육류 전문점 단독 손익', '설비 단가')이 여기서 채워질 수 있습니다. 아직 계산하지 않았습니다.</li>
        <li>정책자금 한도·기간·금리는 업종 무관이라 고깃집의 '모자란 돈' 갭에도 그대로 쓸 수 있습니다.</li>
      </ul>

      <h3>7-6. 남은 데이터 작업</h3>
      <table>
        <thead><tr><th>순서</th><th>일</th><th>이유</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>7-3의 충돌 항목(수요 기준, 채널 비중, 권리금, 영업일·마감) 결정</td><td>값이 이미 있으나 어느 쪽을 쓸지 정해야 건희 params.yaml과 카페 화면이 같은 값을 씀</td></tr>
          <tr><td>2</td><td>F&amp;B 원자료에서 한식 육류 요리 계산 (고깃집 갭)</td><td>고깃집의 가장 큰 갭이 채워짐</td></tr>
          <tr><td>3</td><td>상권 단위 CSV(Drive)를 행정동과 같은 방식으로 집계</td><td>골목·발달·전통시장 단위 비교</td></tr>
          <tr><td>4</td><td>카페 화면용 모델 연결: <code>cafe_gu.json</code>, <code>cafe_dong.json</code>, <code>cafe_cost.json</code>을 동네 분석·드는 돈·점검에 연결</td><td>고깃집과 같은 흐름(동네 분석, 가게 꾸미기, 점검, 시뮬)으로 구현. 3D는 후순위</td></tr>
          <tr><td>5</td><td>인터뷰와 범위 처리 대상(단골, 별점, 고장, 마케팅 등 시뮬 가정) 정리</td><td>시뮬 숫자를 비교용에서 범위로 보여 주는 수준으로</td></tr>
        </tbody>
      </table>
      </Fold>
    </>
  );
}
