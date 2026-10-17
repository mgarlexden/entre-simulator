// 동네(행정동) 분석: 경쟁 강도, 비용, 성장, 동네 특징을 한 번에 묶어 '~형 상권' 이름과 키워드, 해 볼 일을 만든다.
// 숫자는 dong_profile.json(pipelines/build_dong_profile.py), 경계는 seoul_dong.json(pipelines/build_seoul_dong.py).
// 이름·키워드·제안은 현장 조사가 아니라 아래 규칙으로 만든다. 규칙마다 근거 숫자를 같이 보여 준다(why).
import { T, dongsOf, guStat, iga, industry, kreiMean, krei, rankOf, setIndustry, type Dong, type Industry } from "./model";

export type DongProfile = {
  gu: string; name: string; code: string; stores: number; pork: number; type: string;
  shares: { weekend: number; lunch: number; evening: number; age20: number; age30: number };
  growth: number | null; age: number[] | null; area_km2: number | null; pork_km2: number | null; pork_share: number | null;
  pop_per_pork: number | null; work_pop: number | null; resident_pop: number | null; flow_day: number | null;
  apt_price: number | null; subway: number | null; univ: number | null; rent: number | null; rent_gu: number | null;
  life?: number | null; close_life?: number | null; s_life?: number | null; s_close?: number | null; change?: string | null; leisure?: number | null; // 카페 전용(build_cafe_extra.py)
  comp: "약함" | "보통" | "치열" | null; grow: "하락" | "보합" | "성장" | null; cost: "낮음" | "보통" | "높음" | null; rich: boolean; family: boolean;
};
export type Cut = {
  pork_km2: number[]; growth: number[]; apt_price_top: number; rent: number[]; age40_family: number;
  lunch_hi: number; evening_hi: number; weekend_hi: number; pork_share_hi: number; flow_hi: number;
  life?: number[]; close_life?: number[]; leisure_hi?: number;
};
export type DongGeo = { gu: string; name: string; code: string; c: [number, number]; p: [number, number]; r: number; rings: [number, number][][] }; // p, r: 글자를 놓을 가장 큰 내접원의 중심과 반지름

let PROFILES: { _meta: { cut: Cut; generated: string }; dong: DongProfile[] } | null = null;
let GEO: DongGeo[] = [];
export const setAreaData = (p: typeof PROFILES, g: DongGeo[] | null) => { PROFILES = p; GEO = g ?? []; };
export const profilesOf = (gu: string): DongProfile[] => PROFILES?.dong.filter((d) => d.gu === gu) ?? [];
export const profileOf = (gu: string, name: string): DongProfile | undefined => PROFILES?.dong.find((d) => d.gu === gu && d.name === name);
export const geoOf = (gu: string): DongGeo[] => GEO.filter((d) => d.gu === gu);
export const hasDongMap = () => GEO.length > 0 && !!PROFILES;
export const cuts = (): Cut | null => PROFILES?._meta.cut ?? null;

// ---- 동네 지도에 칠할 값 ------------------------------------------------------------------------------
export type DongMetric = "sales" | "growth" | "compete" | "cost" | "life";
type DongMetricInfo = { label: string; hint: string; fmt: (v: number) => string; high: string; low: string };
const life: DongMetricInfo = { label: "버티는 기간", hint: "영업 중인 가게의 평균 영업 개월 (서울시 상권변화지표, 업종 구분 없는 동 전체, 점포 20곳 미만은 비교 안 함)", fmt: (v) => `${v}개월`, high: "오래 버티는 동네", low: "가게가 자주 바뀌는 동네" };
const cost: DongMetricInfo = { label: "월세", hint: "평당 월세 (한국부동산원, 동네 값이 없으면 구 값)", fmt: (v) => `${v}만원`, high: "월세가 비싼 동네", low: "월세가 싼 동네" };
const DONG_METRICS_BY: Record<Industry, Record<DongMetric, DongMetricInfo>> = {
  bbq: {
    sales: { label: "매출", hint: "구 평균 대비 한식 점포당 매출 (점포 20곳 미만은 비교 안 함)", fmt: (v) => `구 평균의 ${Math.round(v * 100)}%`, high: "매출이 높은 동네", low: "매출이 낮은 동네" },
    growth: { label: "성장", hint: "한식음식점 매출이 2024년보다 늘어난 비율 (동 전체, 물가 상승 포함)", fmt: (v) => `${v > 0 ? "+" : ""}${v}%`, high: "성장이 빠른 동네", low: "성장이 느린 동네" },
    compete: { label: "경쟁", hint: "고깃집(돼지고기 구이/찜) 수 ÷ 동 면적", fmt: (v) => `${v}곳/㎢`, high: "고깃집이 많은 동네", low: "고깃집이 적은 동네" },
    cost, life,
  },
  cafe: {
    sales: { label: "매출", hint: "구 평균 대비 카페 점포당 매출, 카드 추정 (점포 20곳 미만은 비교 안 함)", fmt: (v) => `구 평균의 ${Math.round(v * 100)}%`, high: "매출이 높은 동네", low: "매출이 낮은 동네" },
    growth: { label: "흐름", hint: "연 개업률 − 연 폐업률 (점포 20곳 미만은 비교 안 함). 카페는 동네별 2024년 매출이 없어 가게 수 흐름으로 봐요", fmt: (v) => `${v > 0 ? "+" : ""}${v}%p`, high: "가게가 느는 동네", low: "가게가 주는 동네" },
    compete: { label: "경쟁", hint: "카페 수 ÷ 동 면적", fmt: (v) => `${v}곳/㎢`, high: "카페가 많은 동네", low: "카페가 적은 동네" },
    cost, life,
  },
};
export const DONG_METRICS: Record<DongMetric, DongMetricInfo> = { ...DONG_METRICS_BY.bbq };
// 업종을 바꾼다 (모델의 지표 문구와 이 파일의 동네 지도 문구를 함께). 화면이 읽기 전에 부른다.
export function useIndustry(i: Industry) { setIndustry(i); Object.assign(DONG_METRICS, DONG_METRICS_BY[i]); }
// 지도 알약에 보일 지표: 고깃집에는 영업 기간 자료가 없다
export const dongMetricKeys = (): DongMetric[] => (Object.keys(DONG_METRICS) as DongMetric[]).filter((k) => k !== "life" || industry() === "cafe");
export function dongValue(m: DongMetric, p: DongProfile, d: Dong | undefined): number | null {
  if (m === "sales") return d?.rel ?? null;
  if (m === "growth") return p.growth;
  if (m === "compete") return p.stores >= 20 ? p.pork_km2 : null;
  if (m === "life") return p.stores >= 20 ? p.life ?? null : null;
  return p.rent ?? p.rent_gu;
}

// ---- 이름, 키워드, 제안 --------------------------------------------------------------------------------
export type Chip = { label: string; tone: "good" | "mid" | "warn" };
export type Insight = {
  style: string; why: string; chips: Chip[]; keywords: string[]; actions: { text: string; why: string }[]; pros: string[]; cons: string[];
};
const sign = (v: number | null) => (v != null && v > 0 ? "+" : "");
const pct = (x: number) => `${Math.round(x * 100)}%`;
const won = (x: number) => `${Math.round(x / 1e8).toLocaleString("ko-KR")}억`;

export function insightOf(p: DongProfile): Insight | null {
  const c = cuts();
  if (!c) return null;
  const cafe = industry() === "cafe", S = T().shop, W = cafe ? "카페 매출" : "한식 매출";
  const rent = p.rent ?? p.rent_gu;
  const lunchHi = p.shares.lunch >= c.lunch_hi, eveHi = p.shares.evening >= c.evening_hi, weekHi = p.shares.weekend >= c.weekend_hi;
  const porkHi = (p.pork_share ?? 0) >= c.pork_share_hi, flowHi = (p.flow_day ?? 0) >= c.flow_hi;

  // 1) 누가 오는 동네인가 -> 이름의 뒷부분
  let base: string, baseWhy: string;
  if (p.type === "오피스") { base = "직장인 회식형"; baseWhy = `${W}의 점심 비중 ${pct(p.shares.lunch)}, 주말 ${pct(p.shares.weekend)}라 평일 낮에 몰려요`; }
  else if (p.type === "대학·청년") { base = "청년 핫플형"; baseWhy = `${W}의 20대 비중이 ${pct(p.shares.age20)}로 높아요`; }
  else if (p.rich) { base = "부촌 단골형"; baseWhy = `아파트 평균 시가 ${won(p.apt_price ?? 0)}원으로 서울 상위 15%예요`; }
  else if (p.type === "주거" || p.family) { base = "동네 가족형"; baseWhy = `주말 매출 비중 ${pct(p.shares.weekend)}${p.age ? `, 40대 비중 ${pct(p.age[3])}` : ""}로 주거지 성격이 강해요`; }
  else { base = "생활 상권형"; baseWhy = "한쪽으로 치우치지 않고 평일·주말, 낮·밤 매출이 고르게 나뉘어요"; }

  // 2) 지금 어떤 상태인가 -> 이름의 앞부분
  let lead = "";
  if (p.grow === "성장" && p.comp !== "치열") lead = "뜨는 ";
  else if (p.comp === "치열" && p.grow !== "성장") lead = "경쟁 센 ";
  else if (p.grow === "하락" && p.comp === "약함") lead = "식어가는 ";
  else if (p.grow === "성장" && p.comp === "치열") lead = "붐비는 ";

  const chips: Chip[] = [];
  if (cafe && p.change) chips.push({ label: `상권 ${p.change}`, tone: p.change === "상권확장" ? "good" : p.change === "상권축소" ? "warn" : "mid" });
  if (p.comp) chips.push({ label: `경쟁 ${p.comp}`, tone: p.comp === "약함" ? "good" : p.comp === "보통" ? "mid" : "warn" });
  if (p.grow) chips.push({ label: cafe ? `가게 수 ${p.grow === "성장" ? "증가" : p.grow === "하락" ? "감소" : "보합"}` : `매출 ${p.grow === "성장" ? "성장" : p.grow === "하락" ? "하락" : "보합"}`, tone: p.grow === "성장" ? "good" : p.grow === "보합" ? "mid" : "warn" });
  if (p.cost) chips.push({ label: `월세 ${p.cost}`, tone: p.cost === "낮음" ? "good" : p.cost === "보통" ? "mid" : "warn" });

  const keywords: string[] = [];
  if (lunchHi) keywords.push(cafe ? "점심 손님" : "점심 장사");
  if (eveHi) keywords.push(cafe ? "저녁 손님" : "저녁 2차");
  if (weekHi) keywords.push("주말 손님");
  if (p.shares.age20 >= 0.27) keywords.push("2030");
  if (p.age && p.age[3] + p.age[4] >= 0.4) keywords.push("4050 단골");
  if (flowHi || (p.subway ?? 0) >= 2) keywords.push("유동 많음");
  if (porkHi) keywords.push(`${S} 거리`);
  if (cafe && p.life != null && c.life && p.life >= c.life[1]) keywords.push("오래 버티는 상권");
  if (cafe && p.change === "상권확장") keywords.push("상권 확장");
  if (cafe && p.leisure != null && c.leisure_hi != null && p.leisure >= c.leisure_hi) keywords.push("여가·문화 소비");
  if (p.rich) keywords.push("객단가 높은 동네");
  if ((p.univ ?? 0) >= 1 && p.type === "대학·청년") keywords.push("대학가");

  // 3) 해 볼 일 (규칙 -> 근거 숫자)
  const A: { text: string; why: string; w: number }[] = [];
  const groups = krei()?.tables.inflow?.meat?.values;
  const group6 = groups ? Math.round(groups["단체(6인 이상)"]) : null;
  const pair = groups ? Math.round(groups["2~5인"]) : null;
  if (p.comp === "치열") A.push({ w: 9, text: "비슷한 가게가 많아요. 부위, 반찬, 가격대 가운데 한 가지 차별점을 먼저 정하세요.", why: `고깃집 ${p.pork_km2}곳/㎢로 서울 동네의 위쪽 3분의 1이에요` });
  if (p.cost === "높음") A.push({ w: 8, text: "월세가 높은 편이에요. 평수를 줄이거나 직원을 한 명 덜어 다달이 나가는 돈을 낮춰 보세요.", why: `평당 월세 ${rent}만원 (서울 동네 위쪽 3분의 1은 ${c.rent[1].toFixed(1)}만원 이상)` });
  if (p.grow === "성장" && p.comp !== "치열") A.push({ w: 10, text: "성장하는데 경쟁이 세지 않은 동네예요. 단골을 일찍 잡는 쪽이 유리해요.", why: `한식 매출 ${p.growth! > 0 ? "+" : ""}${p.growth}% (2024 대비), 고깃집 ${p.pork_km2 ?? "-"}곳/㎢` });
  if (p.grow === "하락") A.push({ w: 8, text: "매출이 줄어드는 동네예요. 첫 6개월 버틸 현금을 더 남겨 두세요.", why: `한식 매출 ${p.growth}% (2024 대비)` });
  if (lunchHi) A.push({ w: 6, text: "점심 손님이 많아요. 점심 한 상 메뉴를 따로 두고 영업을 낮 시간부터 여는 걸 따져 보세요.", why: `11~14시 매출 비중 ${pct(p.shares.lunch)} (서울 동네 위쪽 4분의 1은 ${pct(c.lunch_hi)} 이상)` });
  if (eveHi || p.type === "오피스") A.push({ w: 6, text: "회식 손님을 받을 단체석과 예약부터 갖추세요.", why: group6 != null ? `육류 전문점 손님의 ${group6}%가 6인 이상 단체, ${pair}%가 2~5인 (경영실태조사). 이 동네 저녁(17~24시) 매출 비중 ${pct(p.shares.evening)}` : `저녁 매출 비중 ${pct(p.shares.evening)}` });
  if ((weekHi && p.type !== "대학·청년") || p.family) A.push({ w: 5, text: "주말 가족 손님이 많아요. 4인 테이블 위주로 꾸미고 아이와 오는 손님을 생각한 구성을 해 보세요.", why: `주말 매출 비중 ${pct(p.shares.weekend)}` });
  if (p.shares.age20 >= 0.27) A.push({ w: 5, text: "20대 손님이 많아요. 2인 테이블을 늘리고 한 명 값을 낮춘 구성을 시험해 보세요.", why: `20대 매출 비중 ${pct(p.shares.age20)}` });
  if (p.rich) A.push({ w: 4, text: "집값이 높은 동네예요. 값을 낮추기보다 예약과 좋은 재료로 승부하는 쪽이 어울려요.", why: `아파트 평균 시가 ${won(p.apt_price ?? 0)}원, 서울 상위 15%` });
  if (cafe) { // 카페는 고깃집용 제안(단체석·회식·불판)이 맞지 않아 카페 규칙으로 바꾼다
    A.length = 0;
    const gs = p.growth != null ? `${sign(p.growth)}${p.growth}%p` : "";
    if (p.comp === "치열") A.push({ w: 9, text: "비슷한 카페가 많아요. 원두, 디저트, 자리 분위기 가운데 한 가지 차별점을 먼저 정하세요.", why: `카페 ${p.pork_km2}곳/㎢로 서울 동네의 위쪽 3분의 1이에요` });
    if (p.cost === "높음") A.push({ w: 8, text: "월세가 높은 편이에요. 평수를 줄이거나 직원을 한 명 덜어 다달이 나가는 돈을 낮춰 보세요.", why: `평당 월세 ${rent}만원 (서울 동네 위쪽 3분의 1은 ${c.rent[1].toFixed(1)}만원 이상)` });
    if (p.grow === "성장" && p.comp !== "치열") A.push({ w: 10, text: "가게가 늘고 있는데 경쟁이 세지 않은 동네예요. 단골을 일찍 잡는 쪽이 유리해요.", why: `개업이 폐업보다 ${gs} 많아요, 카페 ${p.pork_km2 ?? "-"}곳/㎢` });
    if (p.grow === "하락") A.push({ w: 8, text: "폐업이 개업보다 많은 동네예요. 첫 6개월 버틸 현금을 더 남겨 두세요.", why: `개업률 − 폐업률 ${gs}` });
    if (p.type === "오피스") A.push({ w: 7, text: "직장인 동네예요. 출근길과 점심 직후 주문이 빨리 나가는 동선을 먼저 잡으세요.", why: `점심 매출 비중 ${pct(p.shares.lunch)}, 주말 ${pct(p.shares.weekend)}` });
    if (lunchHi && p.type !== "오피스") A.push({ w: 6, text: "점심 직후 손님이 많아요. 점심 시간대 포장 동선과 점심 세트(음료+디저트)를 따져 보세요.", why: `11~14시 매출 비중 ${pct(p.shares.lunch)} (서울 동네 위쪽 4분의 1은 ${pct(c.lunch_hi)} 이상)` });
    if (eveHi) A.push({ w: 5, text: "저녁 손님이 많아요. 저녁까지 여는 시간과 디저트 구성을 따져 보세요.", why: `17~24시 매출 비중 ${pct(p.shares.evening)}` });
    if (weekHi || p.type === "주거") A.push({ w: 5, text: "주말 손님이 많아요. 앉을 자리와 디저트 구성을 넉넉히 두세요.", why: `주말 매출 비중 ${pct(p.shares.weekend)}` });
    if (p.shares.age20 >= 0.27) A.push({ w: 5, text: "20대 손님이 많아요. 2인 좌석을 늘리고 대표 음료 한두 가지로 시작해 보세요.", why: `20대 매출 비중 ${pct(p.shares.age20)}` });
    if (p.rich) A.push({ w: 4, text: "집값이 높은 동네예요. 값을 낮추기보다 원두와 디저트의 질로 승부하는 쪽이 어울려요.", why: `아파트 평균 시가 ${won(p.apt_price ?? 0)}원, 서울 상위 15%` });
  }
  const actions = A.sort((a, b) => b.w - a.w).slice(0, 3).map(({ text, why }) => ({ text, why }));

  // 좋은 점과 아쉬운 점: 칩과 같은 규칙, 숫자를 붙여서
  const pros: string[] = [], cons: string[] = [];
  if (p.comp === "약함") pros.push(`${iga(S)} 드물어 경쟁이 덜해요 (${p.pork_km2 ?? "-"}곳/㎢)`);
  if (p.comp === "치열") cons.push(`${iga(S)} 촘촘해 경쟁이 세요 (${p.pork_km2}곳/㎢)`);
  if (p.grow === "성장") pros.push(cafe ? `개업이 폐업보다 ${sign(p.growth)}${p.growth}%p 많아요` : `한식 매출이 ${sign(p.growth)}${p.growth}% 늘었어요 (2024 대비)`);
  if (p.grow === "하락") cons.push(cafe ? `폐업이 개업보다 ${Math.abs(p.growth ?? 0)}%p 많아요` : `한식 매출이 ${p.growth}% 줄었어요 (2024 대비)`);
  if (p.cost === "낮음") pros.push(`월세가 싼 편이에요 (평당 ${rent}만원)`);
  if (p.cost === "높음") cons.push(`월세가 비싼 편이에요 (평당 ${rent}만원)`);
  if (cafe && p.life != null && c.life && p.life >= c.life[1]) pros.push(`영업 중인 가게가 평균 ${p.life}개월째예요 (서울 ${p.s_life}개월)`);
  if (cafe && p.close_life != null && c.close_life && p.close_life <= c.close_life[0]) cons.push(`문 닫은 가게는 평균 ${p.close_life}개월 만에 닫았어요 (서울 ${p.s_close}개월)`);
  if (p.rich) pros.push("집값이 높은 동네라 소비 여력이 커요");
  if (flowHi || (p.subway ?? 0) >= 2) pros.push("오가는 사람이 많은 길목이에요");
  if (p.pop_per_pork != null && p.pop_per_pork < 150) cons.push(`${S} 1곳당 인구가 ${p.pop_per_pork}명뿐이에요`);
  return { style: `${lead}${base}`, why: baseWhy, chips, keywords: keywords.slice(0, 4), actions, pros: pros.slice(0, 3), cons: cons.slice(0, 2) };
}

// ---- 이 구에서 눈여겨볼 동네 -------------------------------------------------------------------------
export type Pick = { p: DongProfile; d: Dong | undefined; note: string };
export function picksOf(gu: string): { small: Pick[]; steady: Pick[] } {
  const ds = dongsOf(gu);
  const byName = new Map(ds.map((d) => [d.name, d]));
  const rows = profilesOf(gu).map((p) => ({ p, d: byName.get(p.name) })).filter((x) => x.p.stores >= 20);
  const small = rows
    .filter(({ p, d }) => d?.rel != null && d.rel < 1 && p.grow === "성장" && p.comp !== "치열")
    .sort((a, b) => (b.p.growth ?? 0) - (a.p.growth ?? 0)).slice(0, 3)
    .map(({ p, d }) => ({ p, d, note: industry() === "cafe" ? `매출은 구 평균의 ${Math.round(d!.rel! * 100)}%지만 개업이 폐업보다 ${p.growth}%p 많고, 경쟁은 ${p.comp}` : `매출은 구 평균의 ${Math.round(d!.rel! * 100)}%지만 ${p.growth! > 0 ? "+" : ""}${p.growth}% 크고, 경쟁은 ${p.comp}` }));
  const steady = rows
    .filter(({ p, d }) => d?.rel != null && d.rel >= 1.05 && p.grow !== "하락")
    .sort((a, b) => (b.d!.rel ?? 0) - (a.d!.rel ?? 0)).slice(0, 3)
    .map(({ p, d }) => ({ p, d, note: `매출 구 평균의 ${Math.round(d!.rel! * 100)}%, ${industry() === "cafe" ? "가게 수 흐름" : "성장"} ${p.growth! > 0 ? "+" : ""}${p.growth}${industry() === "cafe" ? "%p" : "%"}, 경쟁 ${p.comp ?? "비교 없음"}` }));
  return { small, steady };
}

export const meatSalesNote = () => {
  const a = kreiMean("pl_sales"), b = kreiMean("pl_sales", "hansik_all");
  return a && b ? { meat: a, all: b, ratio: a / b } : null;
};

// ---- 구 단위: "OO구, 이런 점이 좋아요!" ------------------------------------------------------------------
export type GuInsight = { pros: string[]; cons: string[]; chips: Chip[]; compete: "약함" | "보통" | "치열" };
export function guInsight(gu: string, names: string[]): GuInsight {
  const st = guStat(gu), n = names.length;
  const third = Math.ceil(n / 3);
  const rD = rankOf(gu, "demand", names), rG = rankOf(gu, "growth", names), rP = rankOf(gu, "pork", names), rC = rankOf(gu, "closure", names);
  const rentRank = names.filter((x) => guStat(x).rent > st.rent).length + 1; // 비싼 순
  const pros: string[] = [], cons: string[] = [], chips: Chip[] = [];
  if (rD <= third) { pros.push(industry() === "cafe" ? `카페 한 곳당 매출이 높아요 (${n}개 구 중 ${rD}번째)` : `고깃집이 속한 한식 가게의 한 곳당 매출이 높아요 (${n}개 구 중 ${rD}번째)`); chips.push({ label: "매출 상위", tone: "good" }); }
  if (rD > n - third) { cons.push(`한 곳당 매출이 낮은 편이에요 (${n}개 구 중 ${rD}번째)`); chips.push({ label: "매출 하위", tone: "warn" }); }
  if (industry() === "bbq" && st.growth != null && rG <= third && st.growth > 0) { pros.push(`매출이 2024년보다 ${st.growth}% 늘었어요 (${rG}번째)`); chips.push({ label: "성장 중", tone: "good" }); }
  if (industry() === "bbq" && st.growth != null && (rG > n - third || st.growth < -1.5)) { cons.push(`매출이 2024년보다 ${st.growth}% 줄었어요 (${rG}번째)`); chips.push({ label: "성장 둔화", tone: "warn" }); }
  if (rentRank > n - third) { pros.push(`월세가 싼 편이에요 (비싼 순 ${rentRank}번째, 평당 ${st.rent}만원)`); chips.push({ label: "월세 저렴", tone: "good" }); }
  if (rentRank <= third) { cons.push(`월세가 비싼 편이에요 (비싼 순 ${rentRank}번째, 평당 ${st.rent}만원)`); chips.push({ label: "월세 높음", tone: "warn" }); }
  if (rC > n - third) { pros.push(`폐업률이 낮아요 (${st.closure}%)`); chips.push({ label: "폐업 적음", tone: "good" }); }
  if (rC <= third) { cons.push(`폐업률이 높아요 (${st.closure}%)`); chips.push({ label: "폐업 많음", tone: "warn" }); }
  if (st.netOpen != null && st.netOpen > 0) pros.push(`개업이 폐업보다 많아 가게가 늘고 있어요 (${sign(st.netOpen)}${st.netOpen}%p)`);
  const compete: GuInsight["compete"] = rP <= third ? "치열" : rP > n - third ? "약함" : "보통";
  if (compete === "치열") { cons.push(`${iga(T().shop)} 많아요 (${st.pork.toLocaleString("ko-KR")}곳, ${rP}번째)`); chips.push({ label: "경쟁 치열", tone: "warn" }); }
  if (compete === "약함") { pros.push(`${iga(T().shop)} 적어 경쟁이 덜해요 (${st.pork.toLocaleString("ko-KR")}곳)`); chips.push({ label: "경쟁 약함", tone: "good" }); }
  if (!pros.length) pros.push("눈에 띄게 좋은 점은 없지만 서울 평균 범위예요");
  return { pros: pros.slice(0, 3), cons: cons.slice(0, 2), chips: chips.slice(0, 4), compete };
}

// 자료를 모듈 변수에 들고 있어서, 이 파일이 핫리로드로 새로 불리면 자료가 비는데 화면은 로딩 완료로 남는다. 통째로 다시 불러 맞춘다.
if (import.meta.hot) import.meta.hot.accept(() => location.reload());
