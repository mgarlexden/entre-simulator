// 카페 시뮬레이션 (4단계). 고깃집 시뮬레이션(SimulateEngine.tsx)과 같은 구조: 전체 화면 3D 위에 지표 줄, 왼쪽 현금 그래프와 운영 계획,
// 아래 재생 바, 시작·운영 계획·정산·결과는 팝업. 엔진은 건희 카페 월별 모델(sim/cafe, 포트 8010 /cafe/season)이다.
// 엔진은 손님 한 명씩이 아니라 시간대별 주문·처리 능력을 계산하므로, 영업 장면은 하루 시간대를 따라 의자가 차고 비는 모습으로 보여 준다.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { profileOf } from "./area";
import { areaFx, engineBody, type CafeCfg } from "./cafeChecks";
import CafeRoom3D from "./CafeRoom3D";
import { ENGINE, type Preview } from "./useCafePreview";
import { guStat, man, type Profile } from "./model";
import "./simulate-engine.css";
import "./cafe-sim.css";

const wman = (krw: number) => man(krw / 10000);
const sgn = (krw: number) => `${krw >= 0 ? "+" : "−"}${man(Math.abs(krw / 10000))}`;
const tone = (v: number) => (v < 0 ? "neg" : "pos");

type Hours = "short" | "standard" | "long";
type Staff = "lean" | "standard" | "generous";
type Dec = { price_change_pct: number; hours: Hours; staff_policy: Staff; marketing_krw: number; dessert: boolean };
const HOURS_KO: Record<Hours, string> = { short: "짧게 (11~20시)", standard: "기본 (10~22시)", long: "길게 (8~23시)" };
const STAFF_KO: Record<Staff, string> = { lean: "빠듯하게", standard: "기본", generous: "넉넉하게" };
const HOURS_ORDER: Hours[] = ["short", "standard", "long"], STAFF_ORDER: Staff[] = ["lean", "standard", "generous"];

type Lever = { key: string; label: string; hint: string; text: (d: Dec) => string; can: (d: Dec, s: -1 | 1) => boolean; move: (d: Dec, s: -1 | 1) => Dec };
const LEVERS: Lever[] = [
  { key: "price", label: "가격 조정", hint: "이번 달에 메뉴 가격을 한 번 바꿔요. 올리면 손님이 줄고 객단가가 늘어요.",
    text: (d) => (d.price_change_pct === 0 ? "그대로" : `${d.price_change_pct > 0 ? "+" : ""}${d.price_change_pct}%`),
    can: (d, s) => d.price_change_pct + s * 5 >= -20 && d.price_change_pct + s * 5 <= 30, move: (d, s) => ({ ...d, price_change_pct: d.price_change_pct + s * 5 }) },
  { key: "hours", label: "영업시간", hint: "길게 열면 손님을 더 받지만 일하는 시간(인건비)이 늘어요.",
    text: (d) => HOURS_KO[d.hours], can: (d, s) => HOURS_ORDER.indexOf(d.hours) + s >= 0 && HOURS_ORDER.indexOf(d.hours) + s < 3,
    move: (d, s) => ({ ...d, hours: HOURS_ORDER[HOURS_ORDER.indexOf(d.hours) + s] }) },
  { key: "staff", label: "직원 운영", hint: "빠듯하면 인건비가 줄지만 바쁜 시간에 손님이 돌아가요.",
    text: (d) => STAFF_KO[d.staff_policy], can: (d, s) => STAFF_ORDER.indexOf(d.staff_policy) + s >= 0 && STAFF_ORDER.indexOf(d.staff_policy) + s < 3,
    move: (d, s) => ({ ...d, staff_policy: STAFF_ORDER[STAFF_ORDER.indexOf(d.staff_policy) + s] }) },
  { key: "marketing", label: "마케팅", hint: "한 달 광고·SNS 비용이에요. 늘리면 알려지는 데 도움이 돼요.",
    text: (d) => (d.marketing_krw ? `월 ${wman(d.marketing_krw)}` : "없음"), can: (d, s) => d.marketing_krw + s * 500_000 >= 0 && d.marketing_krw + s * 500_000 <= 5_000_000,
    move: (d, s) => ({ ...d, marketing_krw: d.marketing_krw + s * 500_000 }) },
  { key: "dessert", label: "디저트", hint: "디저트를 팔면 객단가가 늘지만 폐기와 준비 시간이 생겨요.",
    text: (d) => (d.dessert ? "판매" : "안 팔아요"), can: (d, s) => (s > 0 ? !d.dessert : d.dessert), move: (d, s) => ({ ...d, dessert: s > 0 }) },
];
const planKey = (l: Lever): keyof Dec => (l.key === "price" ? "price_change_pct" : l.key === "hours" ? "hours" : l.key === "staff" ? "staff_policy" : l.key === "marketing" ? "marketing_krw" : "dessert");

type Month = {
  month: number; calendar_month: number; status: "open" | "closed" | "finished"; owner_note_ko: string;
  decisions: Dec & { price_level: number };
  kpi: { revenue_krw: number; op_krw: number; cash_krw: number; customers: number; walkaways: number; walkaway_share: number; rating: number; regulars: number };
  pnl: { revenue_krw: number; lines: { key: string; item_ko: string; krw: number }[]; op_krw: number };
  cash: { start_krw: number; op_krw: number; depreciation_addback_krw: number; loan_interest_krw: number; loan_principal_krw: number; vat_refund_krw: number; end_krw: number };
  events: { key: string; label_ko: string; effect_ko: string }[];
  waterfall: { steps: { key: string; label_ko: string; krw: number }[] };
  closure: { closed: boolean; reason_ko: string };
  state_token: string;
};
type Row = { hour: number; orders: number; staff: number; need: number; short: boolean };
type View = "intro" | "plan" | "settle" | "report" | null; // null = 영업 장면 재생 중

function Kpis({ items }: { items: { label: string; value: string; tone?: string; main?: boolean }[] }) {
  return <dl className="sx-kpis">{items.map((x) => <div key={x.label} className={x.main ? "main" : ""}><dt>{x.label}</dt><dd className={x.tone}>{x.value}</dd></div>)}</dl>;
}
function Metric({ label, tip, children }: { label: string; tip: string; children: string }) {
  return <div className="sx-metric" tabIndex={0}><span className="sx-mt"><span className="sx-k">{label}</span><b>{children}</b></span><span className="sx-tip" role="tooltip">{tip}</span></div>;
}
function Stepper({ lv, plan, prev, set }: { lv: Lever; plan: Dec; prev?: Dec; set: (d: Dec) => void }) {
  const k = planKey(lv);
  const changed = lv.key === "price" ? plan.price_change_pct !== 0 : prev != null && prev[k] !== plan[k];
  const id = `cs-${lv.key}`;
  return (
    <div className={`sx-step${changed ? " is-changed" : ""}`}>
      <div className="sx-step-t"><span id={id} className="sx-step-l">{lv.label}</span><small>{lv.hint}</small>{changed && lv.key !== "price" && <small className="sx-step-prev">지난달 {lv.text(prev!)}</small>}</div>
      <div className="sx-step-c">
        <button type="button" aria-label={`${lv.label} 낮추기`} disabled={!lv.can(plan, -1)} onClick={() => set(lv.move(plan, -1))}>−</button>
        <output aria-labelledby={id}>{lv.text(plan)}</output>
        <button type="button" aria-label={`${lv.label} 높이기`} disabled={!lv.can(plan, 1)} onClick={() => set(lv.move(plan, 1))}>+</button>
      </div>
    </div>
  );
}
function Cash({ start, months }: { start: number; months: Month[] }) {
  const pts = [start, ...months.map((m) => m.kpi.cash_krw)];
  const lo = Math.min(0, ...pts), hi = Math.max(1, ...pts), W = 340, H = 120;
  const x = (i: number) => 10 + (i * (W - 20)) / 12, y = (v: number) => 8 + ((hi - v) / Math.max(1, hi - lo)) * (H - 22);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cs-chart" role="img" aria-label="남은 현금">
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="cs-zero" />
      <polyline fill="none" className="cs-line" points={pts.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
      {pts.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" className={v < 0 ? "cs-dot is-neg" : "cs-dot"} />)}
    </svg>
  );
}

export default function CafeSim({ profile, cfg, onBack }: { profile: Profile; cfg: CafeCfg; onBack: () => void }) {
  const code = profile.dong && profile.dong.gu === profile.gu ? profileOf(profile.gu, profile.dong.name)?.code : undefined;
  const body = useMemo(() => code ? engineBody(profile, cfg, String(code)) : null, [code, cfg, profile.capital]); // eslint-disable-line react-hooks/exhaustive-deps
  const [top, setTop] = useState(108);
  const [start, setStart] = useState<any>(null);
  const [pv, setPv] = useState<Preview | null>(null);
  const [months, setMonths] = useState<Month[]>([]);
  const [token, setToken] = useState("");
  const [startMonth, setStartMonth] = useState(3);
  const [plan, setPlan] = useState<Dec>({ price_change_pct: 0, hours: "standard", staff_policy: "standard", marketing_krw: 0, dessert: true });
  const [view, setView] = useState<View>("intro");
  const [hourIdx, setHourIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fast, setFast] = useState(false);
  const [chartOpen, setChartOpen] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const daily = useRef<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => { const n = document.querySelector(".m-mocknote") ?? document.querySelector(".m-top"); setTop(Math.round(n ? n.getBoundingClientRect().bottom : 108)); };
    measure(); addEventListener("resize", measure); return () => removeEventListener("resize", measure);
  }, []);

  const post = async (path: string, b: unknown) => {
    const r = await fetch(`${ENGINE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    const j = await r.json();
    if (!r.ok) throw new Error(typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j));
    return j;
  };
  const netErr = (e: any) => (/fetch/i.test(String(e)) ? "엔진 서버에 연결하지 못했어요. uvicorn api.changeup:app --host 127.0.0.1 --port 8010 으로 켜 주세요." : String(e.message ?? e));

  // 미리보기(배치, 시간대 주문)와 중앙값 기준 손님 수. 엔진의 기본 수요는 업종 평균 × 동네 지수라 앞 화면의 중앙값 기준과 달라서,
  // 기본 수요 대비 '이 동네 보통 카페의 매출' 비율로 손님 수를 정해 엔진에 넘긴다(daily_customers).
  useEffect(() => {
    if (!body) return;
    setErr("");
    post("/cafe/preview", body).then((p0) => {
      const ratio = (guStat(profile.gu).sales * areaFx(cfg.pyeong) * 10000) / p0.rough_month.revenue_krw;
      daily.current = Math.min(600, Math.max(10, Math.round(p0.demand.default_daily_customers * ratio)));
      return post("/cafe/preview", { ...body, daily_customers: daily.current });
    }).then(setPv).catch((e) => setErr(netErr(e)));
  }, [body]); // eslint-disable-line react-hooks/exhaustive-deps

  const sched: Row[] = pv?.staff.schedule ?? [];
  const maxOrders = Math.max(1, ...sched.map((r) => r.orders));
  const last = months[months.length - 1];
  const over = !!last && last.status !== "open";

  // 영업 장면: 하루 시간대를 한 칸씩 지나며 의자가 차고 빈다
  useEffect(() => {
    if (view !== null || !playing || sched.length === 0) return;
    const t = setTimeout(() => {
      if (hourIdx >= sched.length - 1) { setPlaying(false); setView("settle"); } else setHourIdx(hourIdx + 1);
    }, fast ? 250 : 800);
    return () => clearTimeout(t);
  }, [view, playing, fast, hourIdx, sched.length]);

  const begin = () => {
    if (!body || daily.current == null) return;
    setBusy(true); setErr("");
    post("/cafe/season", { ...body, daily_customers: daily.current, start_month: startMonth })
      .then((s) => { setStart(s); setToken(s.state_token); setMonths([]); setReport(null); setPlan({ price_change_pct: 0, hours: s.decisions.hours, staff_policy: s.decisions.staff_policy, marketing_krw: 0, dessert: true }); setView("plan"); })
      .catch((e) => setErr(netErr(e))).finally(() => setBusy(false));
  };
  const play = async () => {
    setBusy(true); setErr("");
    try {
      const m: Month = await post("/cafe/season/month", { state_token: token, month_index: months.length, ...plan });
      setMonths([...months, m]); setToken(m.state_token); setPlan({ ...plan, price_change_pct: 0 });
      setHourIdx(0); setPlaying(true); setView(null);
    } catch (e: any) { setErr(netErr(e)); }
    setBusy(false);
  };
  const toReport = async () => {
    setView("report");
    try { setReport(await post("/cafe/season/report", { state_token: token })); } catch (e: any) { setErr(netErr(e)); }
  };
  const nextAfterSettle = () => (over ? toReport() : setView("plan"));
  const restart = () => { setMonths([]); setStart(null); setReport(null); setView("intro"); setErr(""); };

  if (!body) return (
    <main className="m-area"><section className="m-panel a-card">
      <h1>동네를 먼저 골라 주세요</h1>
      <p>카페 시뮬레이션은 행정동 단위로 돌아가요. 동네 분석에서 지도의 동네를 누르거나 목록에서 고르면 돼요.</p>
      <button type="button" className="a-back" onClick={onBack}>← 열기 전 점검으로</button>
    </section></main>
  );

  const startCash: number = start ? start.start.cash_krw : 0;
  const cur = last;
  const prevPlan = months.length > 1 ? months[months.length - 2].decisions : undefined;
  const occupancy = view === null && sched[hourIdx] ? (sched[hourIdx].orders / maxOrders) * 0.9 : 0;
  const nextMonth: number = cur ? (cur.calendar_month % 12) + 1 : start?.start_month ?? startMonth;
  const place = `${profile.gu} ${profile.dong?.name ?? ""}`;

  return (
    <div className="sx-root" style={{ top }}>
      <div className="sx-canvas">
        {pv ? <CafeRoom3D room={pv.room} layout={pv.layout} roster={view === null ? pv.staff.roster : []} occupancy={occupancy} height="fill" /> : <p className="m-loading">엔진을 부르는 중이에요</p>}
      </div>

      <header className="sx-hud">
        <Metric label="현금" tip="문을 열고 남은 운영자금이에요. 매달 영업이익, 대출 상환, 부가세 환급이 더해지고 빠져요.">{wman(cur ? cur.kpi.cash_krw : startCash)}</Metric>
        <Metric label="달" tip="시작 달부터 12개월을 한 달씩 진행해요.">{cur ? `${cur.calendar_month}월 · ${cur.month}/12` : start ? `${start.start_month}월 시작` : `${startMonth}월 시작`}</Metric>
        <Metric label="별점" tip="손님이 남긴 별점이에요. 새 가게는 처음엔 낮게 시작하고 단골이 쌓이면 올라가요 (가정).">{cur ? `★ ${cur.kpi.rating.toFixed(1)}` : "-"}</Metric>
        <Metric label="단골" tip="다시 오는 손님 수예요. 새 가게는 0에서 시작해요 (가정).">{cur ? String(Math.round(cur.kpi.regulars)) : "-"}</Metric>
        <Metric label="시간대" tip="영업 장면에서 지금 보는 시간이에요. 의자가 찬 정도는 그 시간 주문 수를 따라요.">{view === null && sched[hourIdx] ? `${sched[hourIdx].hour}시` : "-"}</Metric>
      </header>

      <button type="button" className="sx-ctoggle" aria-expanded={chartOpen} onClick={() => setChartOpen((v) => !v)}>{chartOpen ? "현금 그래프 접기" : "현금 그래프 펴기"}</button>
      <div className="sx-leftcol">
        {chartOpen && start && (
          <aside className="sx-chartpanel" aria-label="남은 현금 그래프">
            <p className="sx-panel-h"><span>남은 현금</span><b>{wman(cur ? cur.kpi.cash_krw : startCash)}</b></p>
            <Cash start={startCash} months={months} />
            <small>빨간 점선은 0원이에요. 점은 한 달이 끝난 때의 현금이에요.</small>
          </aside>
        )}
        {cur && (view === null || view === "settle") && (
          <aside className="sx-planpanel" aria-label={`${cur.calendar_month}월 운영 계획`}>
            <p className="sx-panel-h"><span>{cur.calendar_month}월 운영 계획</span></p>
            <dl>
              {LEVERS.map((lv) => {
                const k = planKey(lv); const d = cur.decisions;
                const changed = lv.key === "price" ? false : prevPlan != null && prevPlan[k] !== d[k];
                return <div key={lv.key} className={changed ? "is-changed" : undefined}><dt>{lv.label}</dt><dd>{lv.key === "price" ? `개업가의 ${Math.round(d.price_level * 100)}%` : lv.text(d)}</dd></div>;
              })}
            </dl>
            {months.length > 1 && <small><i aria-hidden="true" />파란색은 지난달과 달라진 조건이에요.</small>}
          </aside>
        )}
      </div>

      {view === null && cur && sched[hourIdx] && (
        <div className="sx-bar" role="toolbar" aria-label="재생 조작">
          <button type="button" onClick={() => setPlaying((p) => !p)}>{playing ? "멈춤" : "재생"}</button>
          <button type="button" onClick={() => setFast((f) => !f)} aria-pressed={fast}>빠르게</button>
          <button type="button" onClick={() => { setPlaying(false); setView("settle"); }}>이 달 끝으로</button>
          <span>{cur.calendar_month}월 하루 · {sched[hourIdx].hour}시 · 주문 {Math.round(sched[hourIdx].orders)}건{sched[hourIdx].short ? " · 일손 부족" : ""}</span>
        </div>
      )}

      {view !== null && (
        <div className="sx-modal" role="dialog" aria-modal="true">
          <div className={`sx-pop sx-pop-${view}`}>
            {view === "intro" && (
              <>
                <div className="sx-scroll">
                  <h1>{place}에서 12개월</h1>
                  <Kpis items={[
                    { label: "가게", value: `${cfg.pyeong}평 · ${pv?.seats.total ?? "-"}석` },
                    { label: "평당 월세", value: `${guStat(profile.gu).rent}만원` },
                    { label: "여는 데 드는 돈 (엔진)", value: pv ? wman(pv.capex.total_krw) : "-" },
                    { label: "가진 돈", value: man(profile.capital), main: true },
                  ]} />
                  <section className="sx-sec">
                    <h2>이렇게 진행돼요</h2>
                    <ol className="sx-flow">
                      <li><b>운영 계획</b><span>달마다 가격·영업시간·직원·마케팅·디저트를 정해요.</span></li>
                      <li><b>영업</b><span>엔진이 그달을 계산하고 하루 시간대를 따라 의자가 차고 비는 모습을 보여 줘요.</span></li>
                      <li><b>정산</b><span>매출·비용과 달라진 이유를 확인해요.</span></li>
                    </ol>
                    <p className="sx-note">새로 연 가게로 시작해요. 별점과 단골이 없어서 처음엔 자리가 잡힌 달보다 매출이 낮아요. 매출 기준은 동네 분석의 중앙값과 맞췄어요.</p>
                  </section>
                  <label className="sx-field">시작할 달
                    <select value={startMonth} onChange={(e) => setStartMonth(+e.target.value)}>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}</select>
                  </label>
                  {err && <p className="se-err" role="alert">{err}</p>}
                </div>
                <footer className="sx-foot">
                  <button type="button" className="se-btn" onClick={begin} disabled={busy || !pv}>{busy ? "준비하는 중이에요" : "문 열기"}</button>
                  <button type="button" className="se-link" onClick={onBack}>가게 꾸미기로 돌아가기</button>
                </footer>
              </>
            )}

            {view === "plan" && (
              <>
                <div className="sx-scroll">
                  <h1>{nextMonth}월 운영 계획</h1>
                  <div className="sx-split">
                    <section className="sx-left" aria-label="지난달 결과">
                      <h2>{cur ? `${cur.calendar_month}월 결과` : "처음 여는 달이에요"}</h2>
                      {cur ? (
                        <Kpis items={[
                          { label: "영업이익", value: sgn(cur.kpi.op_krw), tone: tone(cur.kpi.op_krw), main: true },
                          { label: "매출", value: wman(cur.kpi.revenue_krw) },
                          { label: "손님", value: `${cur.kpi.customers.toLocaleString("ko-KR")}명` },
                          { label: "별점", value: `★ ${cur.kpi.rating.toFixed(1)}` },
                        ]} />
                      ) : <p className="sx-note">자리가 잡힌 달 기준 매출은 {wman(start.baseline.revenue_krw)}, 영업이익은 {sgn(start.baseline.op_krw)}이에요. 새 가게는 이보다 낮게 시작해요.</p>}
                      {cur && <p className="sx-note">{cur.owner_note_ko}</p>}
                    </section>
                    <section className="sx-right" aria-label="이번 달 운영 계획">
                      <h2>{nextMonth}월에 이렇게 할게요</h2>
                      <div className="sx-steps">{LEVERS.map((lv) => <Stepper key={lv.key} lv={lv} plan={plan} prev={cur ? { ...plan, ...cur.decisions, price_change_pct: 0 } : undefined} set={setPlan} />)}</div>
                      <p className="sx-note">가격은 이번 달에 한 번 바꾸는 폭이고, 나머지는 바꾸기 전까지 이어져요.</p>
                    </section>
                  </div>
                  {err && <p className="se-err" role="alert">{err}</p>}
                </div>
                <footer className="sx-foot">
                  <button type="button" className="se-btn" onClick={play} disabled={busy}>{busy ? "엔진이 계산 중이에요" : `${nextMonth}월 시작`}</button>
                </footer>
              </>
            )}

            {view === "settle" && cur && (
              <>
                <div className="sx-scroll">
                  <h1>{cur.calendar_month}월 정산</h1>
                  <Kpis items={[
                    { label: "영업이익", value: sgn(cur.kpi.op_krw), tone: tone(cur.kpi.op_krw), main: true },
                    { label: "매출", value: wman(cur.kpi.revenue_krw) },
                    { label: "월말 현금", value: wman(cur.kpi.cash_krw) },
                    { label: "돌아간 손님", value: `${cur.kpi.walkaways.toLocaleString("ko-KR")}명 (${Math.round(cur.kpi.walkaway_share * 100)}%)` },
                  ]} />
                  <p className="sx-note">{cur.owner_note_ko}</p>
                  {cur.events.length > 0 && <p className="sx-note"><b>이달의 사건:</b> {cur.events.map((e) => `${e.label_ko} (${e.effect_ko})`).join(", ")}</p>}
                  <div className="sx-split">
                    <section className="sx-sec"><h2>손익</h2>
                      <table className="sx-table"><tbody>
                        <tr><th>매출</th><td>{wman(cur.pnl.revenue_krw)}</td></tr>
                        {cur.pnl.lines.filter((l) => l.krw !== 0).map((l) => <tr key={l.key}><th>{l.item_ko}</th><td>−{wman(l.krw)}</td></tr>)}
                        <tr><th>영업이익</th><td className={tone(cur.pnl.op_krw)}>{sgn(cur.pnl.op_krw)}</td></tr>
                      </tbody></table>
                    </section>
                    <section className="sx-sec"><h2>지난달과 달라진 이유</h2>
                      <ul className="sx-wf">{cur.waterfall.steps.filter((s) => Math.abs(s.krw) >= 10000).map((s) => <li key={s.key}><span>{s.label_ko}</span><b className={tone(s.krw)}>{sgn(s.krw)}</b></li>)}</ul>
                      <p className="sx-note">현금 변화: 영업이익 {sgn(cur.cash.op_krw)}, 감가상각 되돌림 +{wman(cur.cash.depreciation_addback_krw)}, 대출 이자 −{wman(cur.cash.loan_interest_krw)}, 원금 −{wman(cur.cash.loan_principal_krw)}{cur.cash.vat_refund_krw ? `, 부가세 환급 +${wman(cur.cash.vat_refund_krw)}` : ""}.</p>
                    </section>
                  </div>
                  {cur.closure.closed && <p className="se-err">가게를 닫았어요. {cur.closure.reason_ko}</p>}
                </div>
                <footer className="sx-foot">
                  <button type="button" className="se-btn" onClick={nextAfterSettle}>{over ? "전체 결과 보기" : `${nextMonth}월 운영 계획 정하기`}</button>
                </footer>
              </>
            )}

            {view === "report" && (
              <>
                <div className="sx-scroll">
                  <h1>{months.length}개월 결과</h1>
                  {!report ? <p>계산 중이에요.</p> : (
                    <>
                      <Kpis items={[
                        { label: "마지막 현금", value: wman(report.end_cash_krw), main: true },
                        { label: "누적 영업이익", value: sgn(report.cumulative_op_krw), tone: tone(report.cumulative_op_krw) },
                        { label: "가장 좋았던 달", value: `${report.best_month.calendar_month}월 ${sgn(report.best_month.op_krw)}` },
                        { label: "가장 나빴던 달", value: `${report.worst_month.calendar_month}월 ${sgn(report.worst_month.op_krw)}` },
                      ]} />
                      <p className="sx-note">{report.survived ? "12개월을 버텼어요. " : <b>가게를 닫게 됐어요. </b>}{report.summary_ko}</p>
                      <section className="sx-sec"><h2>남은 현금</h2><Cash start={startCash} months={months} /></section>
                      <section className="sx-sec"><h2>월별</h2>
                        <table className="sx-table"><thead><tr><th>달</th><th>매출</th><th>영업이익</th><th>월말 현금</th></tr></thead>
                          <tbody>{report.months.map((x: any) => <tr key={x.month}><td>{x.calendar_month}월</td><td>{wman(x.revenue_krw)}</td><td className={tone(x.op_krw)}>{sgn(x.op_krw)}</td><td>{wman(x.cash_krw)}</td></tr>)}</tbody></table>
                      </section>
                    </>
                  )}
                  {err && <p className="se-err" role="alert">{err}</p>}
                </div>
                <footer className="sx-foot">
                  <button type="button" className="se-btn" onClick={restart}>처음부터 다시</button>
                  <button type="button" className="se-link" onClick={onBack}>가게 꾸미기로</button>
                  <small>엔진은 건희의 카페 월별 모델이에요. 별점·단골·사건 크기는 가정값이에요.</small>
                </footer>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
