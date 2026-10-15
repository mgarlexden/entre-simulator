// #/sources 의 카페 탭. 건희 레포(sdic-persona-team1)의 카페 브랜치가 쓰는 데이터, 그 데이터의 갭,
// 팀원 파일 두 개가 채운 것과 남은 것을 한 곳에 모은다. 갭 목록은 pipelines/build_sources_cafe.py 가 만든
// web/public/mock/sources_cafe.json 에서 읽는다 (값은 원 파일 그대로, 반영 여부만 건희 params.yaml 과 비교한 결과).
import { useEffect, useState } from "react";

type Weak = { value: string; state: string; applied: string; note: string } | null;
type Q22 = { applied: string; value: string; note: string } | null;
type Gap = {
  pri: string; area: string; var: string; section: "상권·입지" | "매장 운영" | "그 외"; old: string; old_grade: string; gap: string;
  now: string; now_grade: string; status: string; filler: string; weak: Weak; q22: Q22; how: string; cand: string; web_note?: string;
};
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

const STATUS_CLASS: Record<string, string> = {
  "채움 · 반영됨": "실측", "건희가 이후 직접 채움": "차용", "채움 · 아직 반영 안 됨": "가정", "채움 · 값이 충돌": "예시값",
  "일부 채움": "가정", "참고만 가능": "가정", "보류": "예시값", "남음": "예시값",
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
          <tr key={i}><td>{g.pri}</td><td><code>{g.var}</code><br /><small>{g.area}</small></td><td>{g.now}</td><td>{g.now_grade}</td><td>{g.gap}{g.web_note ? <><br /><small>{g.web_note}</small></> : null}</td><td>{g.how}</td><td>{g.cand}</td></tr>
        ))}</tbody>
      </table>
    );
  }
  return (
    <table>
      <thead><tr><th>변수</th><th>건희 처음 값 (등급)</th><th>팀원이 찾은 값</th><th>건희 지금 값 (등급)</th><th>상태</th><th>반영·충돌 내용</th></tr></thead>
      <tbody>{rows.map((g, i) => {
        const team = g.weak?.value ?? g.q22?.value ?? "";
        const note = g.weak?.note ?? g.q22?.note ?? g.web_note ?? "";
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
  const remain = (s: string) => g.filter((x) => x.section === s && (x.status === "남음" || x.status === "보류"));
  const by = (xs: Gap[]) => {
    const m = new Map<string, number>();
    xs.forEach((x) => m.set(x.how || "미분류", (m.get(x.how || "미분류") ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  return (
    <>
      <p>카페는 <b>건희 레포의 카페 브랜치</b>가 만든 값이 기준입니다. 이 서비스의 카페 화면은 아직 만들지 않았고(고깃집 설계가 끝난 뒤 시작),
        여기서는 데이터가 어디서 왔고 무엇이 비어 있는지만 정리합니다. 값과 출처는 건희 파일에 적힌 그대로이며 원 출처를 직접 열어 확인하지는 않았습니다.</p>

      <h2 id="c-fresh">1. 건희 레포 카페 브랜치 (2026-10-15 다시 fetch)</h2>
      <p><code>git fetch --all</code> 결과 이전 확인 때와 달라진 브랜치와 새 커밋은 없었습니다. 아래 최신 커밋이 현재 기준입니다.
        갭 정리표는 10-14 01:14에 만들었고 그 뒤 10-14 오후에 건희가 카페 L 행을 다시 조사해 카페 68개 행의 H·M 등급이 19개에서 39개로 늘었기 때문에, 이 페이지는 <b>그 이후 값과 다시 대조</b>한 결과입니다.</p>
      <Branches />

      <h2 id="c-sources">2. 건희 카페 브랜치가 쓴 데이터 출처</h2>
      <p>research/cafe/params.yaml, districts.yaml, docs/CAFE.md, docs/CHANGEUP-PARAMS.md에 적힌 출처를 모았습니다. 등급은 건희의 기준(H 공식·원자료 / M 업계 자료·여러 판매처 일치 / L 사례 1건·자체 계산 / 가정 출처 없음)입니다.</p>
      <table>
        <thead><tr><th>출처</th><th>종류</th><th>가져온 방법</th><th>쓰인 값</th><th>등급</th></tr></thead>
        <tbody>{SOURCES.map((s) => (
          <tr key={s.name}><td>{s.link ? <a href={s.link} target="_blank" rel="noopener">{s.name}</a> : s.name}</td><td>{s.kind}</td><td>{s.how}</td><td>{s.used}</td><td>{s.grade}</td></tr>
        ))}</tbody>
      </table>

      <h2 id="c-gaps">3. 건희 데이터의 갭 (보강이 필요한 데이터)</h2>
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

      <h2 id="c-filled">4. 팀원이 채워 준 것</h2>
      <table>
        <thead><tr><th>파일</th><th>작성</th><th>누가</th><th>내용</th></tr></thead>
        <tbody>{FILES.map((f) => <tr key={f.id}><td><code>{f.id}</code></td><td>{f.date}</td><td>{f.who}</td><td>{f.what}</td></tr>)}</tbody>
      </table>
      {d && (
        <>
          <h3>4-1. 약한 근거 보완_1014.xlsx: 건희 약한 근거 12개 ({weak.length}행)</h3>
          <p>건희 변수 중 노란색으로 표시된 약한 근거 12개를 보고 채운 파일입니다. 12개(권리금은 신촌·성수 2행)를 건희 params.yaml과 비교하면 같은 값이 이미 들어간 것 2개, 값이 서로 다른 것 2개, 아직 반영 안 된 것 5개, 일부 채움 1개, 보류 2개입니다. 보류 중 체류 시간(dwell_h)은 팀원 쪽 근거는 없지만 건희가 같은 날 자기응답 조사 2건으로 M까지 올렸습니다.</p>
          <GapRows rows={weak} cols="filled" />
          <h3>4-2. 2-2 정량 데이터_1014.xlsx: 갭 정리표와 맞닿은 값 ({q22.length}행)</h3>
          <p>이 파일은 건희 레포를 보기 전에 정리한 것이라 갭을 겨냥하지는 않았지만, 변수와 맞닿은 값이 있습니다. 위 4-1에 이미 나온 변수는 제외했습니다.</p>
          <GapRows rows={q22} cols="filled" />
          <h3>4-3. 팀원 값 없이 건희가 이후 직접 채운 것 ({later.length}행)</h3>
          <p>갭 정리표를 만든 뒤 건희가 다나와·정보공개서·농경연 2025 표로 직접 올린 값입니다. 남은 갭에서 빼기 위해 같이 적습니다.</p>
          <GapRows rows={later} cols="filled" />
        </>
      )}

      <h2 id="c-remain">5. 아직 남은 정보</h2>
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

      <h2 id="c-summary">6. 요약: 카페를 고깃집과 같은 구조로 구현할 수 있나, 팀원이 더 찾을 것</h2>
      <p><b>구현은 가능하지만 시뮬레이션 숫자는 아직 비교용입니다.</b> 변수 구조는 건희 엔진에 모두 있고, 건희 웹 포트(changeup/lean)에는 카페 경로가 구현돼 있습니다.
        부족한 것은 변수가 아니라 값의 근거입니다.</p>
      <table>
        <thead><tr><th>단계</th><th>판단</th><th>이유</th></tr></thead>
        <tbody>
          <tr><td>동네 분석 (구별 카페 매출, 점포 수, 월세)</td><td><b className="k k-실측">충분</b></td><td>서울시 카페 매출과 R-ONE 월세가 H 등급이고 25개 구를 계산함</td></tr>
          <tr><td>드는 돈</td><td><b className="k k-실측">대체로 충분</b></td><td>장비·가구·인테리어·권리금이 M. 신촌·성수 보증금과 전기 증설만 약함</td></tr>
          <tr><td>열기 전 점검</td><td><b className="k k-가정">부분적</b></td><td>인건비·수수료·원가는 M~H. 경쟁 개점 영향과 고장 확률은 가정</td></tr>
          <tr><td>시뮬레이션 (12개월)</td><td><b className="k k-예시값">부족</b></td><td>시즌 변수 57개 중 51개가 가정. 단골, 별점, 이탈, 마케팅 효과에 근거가 없음</td></tr>
        </tbody>
      </table>

      <h3>기능별 데이터 현황</h3>
      <table>
        <thead><tr><th>기능</th><th>있는 데이터</th><th>부족한 데이터</th><th>채우는 방법</th></tr></thead>
        <tbody>
          <tr><td>동네 분석: 구별 카페 매출·점포 수·월세</td><td>서울시 카페 매출·점포(H), R-ONE 월세(H), 25개 구</td><td>서울 개인카페(비프랜차이즈) 매출 <code>independent_scale</code>. 상권 시간대 비중은 3곳뿐</td><td>통계: KREI 비프랜차이즈×서울 교차표, 소상공인실태조사(MDIS)</td></tr>
          <tr><td>드는 돈: 보증금·권리금·인테리어·장비</td><td>장비·가구·인테리어·포장재 단가(M), 서울 권리금 중앙값(M)</td><td>신촌·성수 보증금 <code>deposit_per_pyeong_krw</code>, 전기 증설 <code>electrical</code>, 상권별 권리금(근거는 있으나 미반영)</td><td>통계: 서울시 상가임대차 실태조사 구 단위 표. 반영은 건희 params.yaml</td></tr>
          <tr><td>모자란 돈: 대출</td><td>금리 4.5%(M)</td><td>한도·상환 기간 <code>loan_term_months</code>, 운전자금 개월 수</td><td>통계: 소진공 정책자금 공고. 개월 수는 설계 결정</td></tr>
          <tr><td>열기 전 점검: 본전·나쁜 경우</td><td>인건비·4대보험·카드 수수료(H~M), 대표자 인건비(M), 월세 인상 상한 5%(H)</td><td>신용·체크카드 비중 <code>card_share</code>, 임대료 인상 확률 <code>rent_hike_p</code>, 경쟁 개업 비율 <code>rival_nearby_share</code>, 경쟁 개점 영향 <code>rival_demand_mult</code></td><td>통계: 여신금융협회, 상권별 개업 수로 계산, 경쟁 효과 문헌</td></tr>
          <tr><td>시뮬: 수요 (손님 수·잔 수)</td><td>업계 평균 매출·결제 1건 금액·시간대 비중(M~H), 결제당 잔 수 1.6(M)</td><td>오픈 초기 매출 비율 <code>launch_share</code>, 동행 인원 <code>persons_per_cup</code>, 가격 탄력성 <code>price_elasticity</code></td><td>인터뷰 + 범위 처리(낮음/기본/높음)</td></tr>
          <tr><td>시뮬: 처리 능력 (바리스타·머신·좌석)</td><td>바리스타 시간당 45잔(M), 주문 시간(M), 머신 상한 검산</td><td>머신 그룹별 실제 잔 수 <code>machine_cph_by_groups</code>, 바리스타 인원 <code>baristas_by_groups</code>, 주문 겸할 때 효율 <code>barista_on_pos_order_factor</code></td><td>인터뷰(바리스타), 제조사 문의, 현장 관찰</td></tr>
          <tr><td>시뮬: 월 운영비·원가</td><td>디저트 원가율, 포장재, 관리비, 전기(웹 경로 M)</td><td>수도·가스 <code>water_gas_krw</code>(가스), 기타 경비 <code>misc_krw</code>, 디저트 폐기율 <code>dessert_waste_share</code></td><td>인터뷰, KREI 기타비용으로 교체 결정</td></tr>
          <tr><td>시뮬: 단골·별점·마케팅</td><td>없음 (전부 가정)</td><td><code>regular_share</code>, <code>regulars_speed</code>, <code>rating_demand_per_star</code>, <code>marketing_max_lift</code></td><td>찾기 어려움: 범위 처리하고 인터뷰로 방향만 확인</td></tr>
          <tr><td>시뮬: 사건 (고장·화제·월세 인상)</td><td>월세 인상 상한(H)</td><td><code>breakdown_p</code>, <code>viral_p</code>, <code>viral_demand_mult</code> 등 확률·크기</td><td>인터뷰(고장), 나머지는 범위 처리</td></tr>
        </tbody>
      </table>

      <h3>찾기 전에 정해야 할 것</h3>
      <table>
        <thead><tr><th>구분</th><th>항목</th><th>필요한 일</th></tr></thead>
        <tbody>
          <tr><td><Status s="채움 · 값이 충돌" /> 5건</td><td><code>independent_scale</code> 0.72 ↔ 건희의 업계 평균 방식, <code>dessert_food_cost_share</code> 0.30 ↔ 0.40, 신촌·성수 보증금, <code>dine_in_share</code> 64.8% ↔ 49.4%</td><td>정의가 달라 어느 쪽을 쓸지 건희와 결정</td></tr>
          <tr><td><Status s="채움 · 아직 반영 안 됨" /> 6건</td><td><code>misc_krw</code>, 신촌·성수 권리금, <code>electricity_anchor_20py_krw</code>, <code>vat_refund_month</code>, <code>electrical</code></td><td>근거는 이미 있음. 건희 params.yaml에 반영만 하면 됨</td></tr>
        </tbody>
      </table>
    </>
  );
}
