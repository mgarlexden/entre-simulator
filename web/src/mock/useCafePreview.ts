// 카페 엔진 미리보기(/cafe/preview)를 입력이 바뀔 때마다(0.3초 모아서) 다시 불러온다.
// 하루 손님 수는 열기 전 점검과 같은 기준(동네 보통 카페 월매출 × 면적별 차이)에 맞춰 보낸다. 엔진 기본값(업계 평균 × 상권 지수)을
// 그대로 쓰면 같은 동네인데도 점검과 미리보기의 손님 수가 15~46% 달라져서, '자리와 일손' 판정이 점검의 다른 숫자와 어긋난다.
import { useEffect, useState } from "react";
import { cafeDistrictCode } from "./cafe";
import { areaFx, engineBody, type CafeCfg } from "./cafeChecks";
import { guStat, type Profile } from "./model";

export const ENGINE = "http://127.0.0.1:8010";
export type Preview = {
  room: { width_m: number; depth_m: number; door: { x: number; w: number } };
  layout: { id: string; type: string; x: number; z: number; rot_deg: number; fits: boolean; w: number; d: number; unassigned?: boolean }[];
  staff: { roster: { id: string; role: string; label_ko: string; x: number; z: number; fits: boolean }[]; schedule: { hour: number; orders: number; staff: number; need: number; short: boolean }[]; recommended_peak?: number };
  space: { use_pct: number; table_slots: number; bar_capacity: number; overflow: { type: string; count: number }[]; fix: { label_ko: string; patch: Record<string, number> }[] };
  seats: { total: number; table: number; bar: number };
  bottleneck: { key: string; label_ko: string; ratio: number; note_ko: string }[];
  suggestion: { label_ko: string; patch: Record<string, number>; effect_ko: string };
  capex: { total_krw: number };
  demand: { daily_customers: number; default_daily_customers: number; peak_day: string; peak_orders_per_h: number };
  rough_month: { revenue_krw: number };
};

const NET_ERR = "엔진 서버에 연결하지 못했어요. uvicorn api.changeup:app --host 127.0.0.1 --port 8010 으로 켜 주세요.";

async function post(body: object): Promise<Preview> {
  const r = await fetch(`${ENGINE}/cafe/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) throw new Error(j && typeof j.detail === "string" ? j.detail : "이 동네는 엔진 미리보기를 아직 지원하지 않아요");
  return j as Preview;
}

// 동네(엔진 코드)마다 한 번: 엔진 기본 손님 수와, 그 손님 수일 때 처리 능력으로 깎기 전의 월매출(원)
type Base = { daily: number; month: number } | null;
const BASE = new Map<string, Promise<Base>>();
function baseOf(profile: Profile, cfg: CafeCfg, code: string): Promise<Base> {
  let b = BASE.get(code);
  if (!b) {
    b = post(engineBody(profile, cfg, code)).then((p): Base => {
      const cap = Math.min(1, Math.max(0, p.bottleneck[0]?.ratio ?? 1)); // 엔진 월매출은 처리 능력 비율로 이미 깎여 있다
      const month = cap > 0 ? p.rough_month.revenue_krw / cap : 0;
      return p.demand.default_daily_customers > 0 && month > 0 ? { daily: p.demand.default_daily_customers, month } : null;
    }).catch(() => { BASE.delete(code); return null; });
    BASE.set(code, b);
  }
  return b;
}

// 점검과 같은 매출 기준의 손님 수로 엔진 미리보기를 부른다. 맞출 수 없는 동네(엔진 기본 손님 0명 등)는 엔진 기본값을 쓴다.
export async function previewFor(profile: Profile, cfg: CafeCfg): Promise<Preview> {
  const code = cafeDistrictCode(profile);
  const body = engineBody(profile, cfg, code);
  const base = await baseOf(profile, cfg, code);
  if (!base) return post(body);
  const month = guStat(profile.gu).sales * areaFx(cfg.pyeong) * 10000;
  const daily = Math.max(10, Math.min(600, Math.round((base.daily * month) / base.month)));
  return post({ ...body, daily_customers: daily });
}

export function useCafePreview(profile: Profile, cfg: CafeCfg): { data: Preview | null; err: string } {
  const [data, setData] = useState<Preview | null>(null);
  const [err, setErr] = useState("");
  const key = JSON.stringify([profile.gu, profile.dong, profile.capital, cfg]);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      previewFor(profile, cfg)
        .then((j) => { if (alive) { setData(j); setErr(""); } })
        .catch((e) => { if (alive) { setData(null); setErr(/fetch/i.test(String(e)) ? NET_ERR : String(e.message ?? e)); } });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, err };
}
