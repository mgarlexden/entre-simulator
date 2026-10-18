// 고깃집 열기 전 점검의 '이렇게 바꾸면'. 카페(cafeFixes.ts)와 같은 규칙으로 고른다: 지금 구성에서 한 가지씩만 바꿔 점검을 다시 계산하고,
// 주의·취약 카드를 한 단계 이상 올리면서 다른 카드는 하나도 나빠지지 않는 것을 최대 두 개 보여 준다(없으면 '대신'과 함께 하나).
// 고깃집은 '자리와 일손'도 앞 화면 계산(좌석 × 회전, 일하는 사람 × 손님 수)이라 엔진을 부르지 않고 바로 계산한다.
// 평수는 바꾸지 않는다. 사용자가 3D로 놓은 배치를 다시 깔아야 해서다. 직원은 시뮬레이션 엔진이 받는 최대 4명까지만 제안한다.
import { pick, type Fixes } from "./cafeFixes";
import { GRADES, ITEM, checks, fits, man, nextUid, settledNet, simulate, storeStats, tableSlots, type Check, type Grade, type Levers, type Profile, type Store } from "./model";

export type GogiMove = { id: string; label: string; store: Store; levers: Levers };
const DOWN: Partial<Record<Grade, Grade>> = { high: "mid", mid: "basic" };
const STAFF_MAX = 4;     // 시뮬레이션 엔진의 교대당 알바 상한 (SimulateEngine.tsx)
const LOAN_MORE = 2000;  // 만원, 대출을 늘려 보는 폭
const LOAN_LESS = 1000;  // 만원, 대출을 줄여 보는 폭

// 빈 테이블 자리 가운데 첫 곳에 4인 테이블(안 들어가면 2인 테이블)을 하나 놓는다. 자리가 없으면 null.
function addTable(store: Store): Store | null {
  for (const id of ["table4", "table2"]) {
    for (const t of tableSlots(store.pyeong)) {
      const c = { id, x: t.x, z: t.z, rot: 0 as const };
      if (fits(store, c)) return { ...store, items: [...store.items, { uid: nextUid(store), ...c }] };
    }
  }
  return null;
}
// 마지막에 놓은 테이블 하나를 치운다.
function removeTable(store: Store): Store {
  const last = store.items.filter((i) => ITEM[i.id].cat === "seat").reduce((a, b) => (b.uid > a.uid ? b : a));
  return { ...store, items: store.items.filter((i) => i.uid !== last.uid) };
}

export function gogiMoves(store: Store, lv: Levers): GogiMove[] {
  const out: GogiMove[] = [];
  const add = (id: string, label: string, s: Store, l: Levers) => out.push({ id, label, store: s, levers: l });
  const tables = storeStats(store).tables;
  if (lv.staff >= 1) add("staff-", `직원 ${lv.staff}명 → ${lv.staff - 1}명`, store, { ...lv, staff: lv.staff - 1 });
  if (lv.staff < STAFF_MAX) add("staff+", `직원 ${lv.staff}명 → ${lv.staff + 1}명`, store, { ...lv, staff: lv.staff + 1 });
  const more = addTable(store);
  if (more) add("table+", `테이블 ${tables}개 → ${tables + 1}개`, more, lv);
  if (tables >= 2) add("table-", `테이블 ${tables}개 → ${tables - 1}개`, removeTable(store), lv);
  const g = DOWN[store.grade];
  if (g) add("grade-", `인테리어 ${GRADES[store.grade].label} → ${GRADES[g].label}`, { ...store, grade: g }, lv);
  if (store.loan + LOAN_MORE <= 20000) add("loan+", `대출 ${man(store.loan)} → ${man(store.loan + LOAN_MORE)}`, { ...store, loan: store.loan + LOAN_MORE }, lv);
  if (store.loan > 0) add("loan-", `대출 ${man(store.loan)} → ${man(Math.max(0, store.loan - LOAN_LESS))}`, { ...store, loan: Math.max(0, store.loan - LOAN_LESS) }, lv);
  return out;
}

export function gogiFixes(profile: Profile, store: Store, lv: Levers, base: Check[]): Fixes<GogiMove> {
  const ev = gogiMoves(store, lv).map((move) => ({
    move,
    list: checks(profile, move.store, move.levers),
    settled: settledNet(simulate(profile, move.store, move.levers, []), move.store),
  }));
  return pick(base, ev);
}
