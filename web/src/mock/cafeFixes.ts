// 열기 전 점검의 '이렇게 바꾸면'. 지금 구성에서 한 가지씩만 바꿔 보고(직원, 평수, 인테리어 등급, 먼저 막히는 설비, 엔진의 제안)
// 점검과 엔진 미리보기를 그대로 다시 계산한다. 주의·취약 카드마다, 그 카드를 한 단계 이상 올리면서 다른 카드는 하나도 나빠지지 않는
// 것을 최대 두 개 고른다. 그런 것이 없으면 그 카드는 좋아지지만 다른 카드가 나빠지는 것 하나를 '대신'과 함께 보여 준다.
// 직원을 0명으로 줄이는 것은 제안하지 않는다. 점검은 직원 0명이면 인건비를 0원으로 보지만, 사장님 혼자서는 영업시간을 다 맡지 못해
// 엔진은 그 시간 인건비를 따로 잡는다. 그대로 두면 '직원을 없애세요'가 늘 정답처럼 나온다.
import { useEffect, useState } from "react";
import { CAFE_GRADES } from "./cafe";
import { cafeChecks, cafeLayoutOf, type CafeCfg } from "./cafeChecks";
import { previewFor, type Preview } from "./useCafePreview";
import type { Check, Grade, Profile, Status } from "./model";

export type Move = { id: string; label: string; cfg: CafeCfg };
// 고르기 규칙(pick)과 화면(CafeFixList.tsx)은 고깃집(gogiFixes.ts)도 같이 쓴다. 바꿀 내용(move)의 모양만 업종마다 다르다.
export type MoveBase = { id: string; label: string };
export type Fix<M extends MoveBase = Move> = { move: M; settled: number; better: string[]; worse: string[] };
export type Fixes<M extends MoveBase = Move> = { by: Record<string, Fix<M>[]>; trade: Record<string, Fix<M>>; none: string[] };
export type Ev<M extends MoveBase = Move> = { move: M; list: Check[]; settled: number };

const RANK: Record<Status, number> = { weak: 0, warn: 1, ok: 2 };
export const SHORT: Record<string, string> = { breakeven: "본전", fit: "자리와 일손", range: "한 달 손익", runway: "현금", payback: "회수", shock: "사건" };
const DOWN: Partial<Record<Grade, Grade>> = { high: "mid", mid: "basic" };
// 엔진 제안(patch)의 이름 → 가게 꾸미기 입력 이름
const PATCH: Record<string, keyof CafeCfg> = { chairs: "chairs", tables: "tables", bar_seats: "bar", espresso_groups: "groups", kiosks: "kiosks", pos: "pos", showcase: "showcase", oven: "oven", size_pyeong: "pyeong" };

export function movesOf(cfg: CafeCfg, pv: Preview | null): Move[] {
  const l = cafeLayoutOf(cfg);
  const out: Move[] = [];
  const add = (id: string, label: string, patch: Partial<CafeCfg>) => out.push({ id, label, cfg: { ...cfg, ...patch } });
  if (cfg.staff >= 2) add("staff-", `직원 ${cfg.staff}명 → ${cfg.staff - 1}명`, { staff: cfg.staff - 1 });
  if (cfg.staff < 3) add("staff+", `직원 ${cfg.staff}명 → ${cfg.staff + 1}명`, { staff: cfg.staff + 1 });
  if (cfg.pyeong - 3 >= 10) add("size-", `${cfg.pyeong}평 → ${cfg.pyeong - 3}평`, { pyeong: cfg.pyeong - 3, tables: undefined, chairs: undefined });
  if (cfg.pyeong + 3 <= 30) add("size+", `${cfg.pyeong}평 → ${cfg.pyeong + 3}평`, { pyeong: cfg.pyeong + 3, tables: undefined, chairs: undefined });
  const g = DOWN[cfg.grade];
  if (g) add("grade-", `인테리어 ${CAFE_GRADES[cfg.grade].label} → ${CAFE_GRADES[g].label}`, { grade: g });
  const lo = pv ? [...pv.bottleneck].sort((a, b) => a.ratio - b.ratio)[0] : undefined;
  if (lo && lo.ratio < 1.2) {
    if (lo.key === "espresso" && l.groups < 4) add("groups+", `머신 그룹 ${l.groups}개 → ${l.groups + 1}개`, { groups: l.groups + 1 });
    if (lo.key === "ordering" && l.kiosks < 3) add("kiosk+", `키오스크 ${l.kiosks}대 → ${l.kiosks + 1}대`, { kiosks: l.kiosks + 1 });
  }
  // 엔진이 미리보기에서 내놓는 제안(예: 빈 자리에 의자 채우기)도 같은 기준으로 따져 본다
  const patch: Partial<CafeCfg> = {};
  let ok = true;
  for (const [k, v] of Object.entries(pv?.suggestion?.patch ?? {})) {
    if (k === "staff_peak") { if (v - 1 >= 1 && v - 1 <= 3) patch.staff = v - 1; else ok = false; continue; }
    const f = PATCH[k];
    if (!f || (f === "pyeong" && (v < 10 || v > 30))) { ok = false; continue; }
    (patch as Record<string, number>)[f] = v;
  }
  if (ok && Object.keys(patch).length && pv?.suggestion.label_ko) add("engine", pv.suggestion.label_ko, patch);
  const seen = new Set([JSON.stringify(cfg)]);
  return out.filter((m) => { const k = JSON.stringify(m.cfg); if (seen.has(k)) return false; seen.add(k); return true; });
}

export function pick<M extends MoveBase>(base: Check[], ev: Ev<M>[]): Fixes<M> {
  const rank = (l: Check[]) => Object.fromEntries(l.map((c) => [c.key, RANK[c.status]])) as Record<string, number>;
  const b = rank(base), keys = Object.keys(b);
  const scored = ev.map((e) => {
    const r = rank(e.list);
    return {
      e, r,
      known: keys.every((k) => k in r), // 엔진을 못 불러 '자리와 일손'을 다시 못 본 후보는 쓰지 않는다
      better: keys.filter((k) => r[k] > b[k]),
      worse: keys.filter((k) => r[k] < b[k]),
      total: keys.reduce((n, k) => n + (r[k] ?? 0), 0),
    };
  }).filter((x) => x.known);
  const out: Fixes<M> = { by: {}, trade: {}, none: [] };
  const toFix = (x: (typeof scored)[number]): Fix<M> => ({ move: x.e.move, settled: x.e.settled, better: x.better.map((k) => SHORT[k] ?? k), worse: x.worse.map((k) => SHORT[k] ?? k) });
  for (const c of base) {
    if (c.status === "ok") continue;
    const up = scored.filter((x) => x.r[c.key] > b[c.key]);
    const clean = up.filter((x) => x.worse.length === 0)
      .sort((x, y) => y.r[c.key] - x.r[c.key] || y.total - x.total || y.e.settled - x.e.settled);
    if (clean.length) { out.by[c.key] = clean.slice(0, 2).map(toFix); continue; }
    const t = [...up].sort((x, y) => x.worse.length - y.worse.length || y.total - x.total || y.e.settled - x.e.settled)[0];
    if (t) out.trade[c.key] = toFix(t); else out.none.push(c.key);
  }
  return out;
}

// 후보마다 엔진 미리보기를 다시 부르고(동네 미리보기 한 번에 수십 ms) 점검을 다시 계산한다. 엔진이 없으면 제안도 내지 않는다.
export function useCafeFixes(profile: Profile, cfg: CafeCfg, pv: Preview | null, base: Check[]): Fixes | null {
  const [res, setRes] = useState<{ key: string; fx: Fixes } | null>(null);
  const key = JSON.stringify([profile.gu, profile.dong, profile.capital, profile.keyMoney, cfg, pv ? base.map((c) => `${c.key}:${c.status}`) : null]);
  useEffect(() => {
    if (!pv) return;
    let alive = true;
    const t = setTimeout(() => {
      Promise.all(movesOf(cfg, pv).map(async (move): Promise<Ev> => {
        const p = await previewFor(profile, move.cfg).catch(() => null);
        const r = cafeChecks(profile, move.cfg, p);
        return { move, list: p ? r.list : [], settled: r.settled };
      })).then((ev) => { if (alive) setRes({ key, fx: pick(base, ev) }); });
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [key, pv]); // eslint-disable-line react-hooks/exhaustive-deps
  return res && res.key === key ? res.fx : null;
}
