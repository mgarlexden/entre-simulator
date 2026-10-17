// #/engine: 건희 엔진(sim.season)을 점포 입력으로 돌려 보는 확인용 화면. 실행 중인 엔진 서버(api/changeup.py, 8010)가 필요하다.
// 아직 시뮬레이션 탭에 연결하기 전이라 목업 흐름과 별개다. 결과 숫자는 엔진이 계산한 값이고, 목업(sim.ts)과 다르다.
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PROFILE, guStat, man, openingCost, recommend, setGuData, setRentData, setRentInput, storeStats, type GuData, type RentData } from "./model";
import "./sources.css";

const API = "http://127.0.0.1:8010";

type Month = {
  month: number; label: string; demand_index: number; events: { id: string; label: string; group: string }[];
  kpis: Record<string, number>; p10: { revenue: number; op: number }; p90: { revenue: number; op: number };
};
type Row = { month: number; op: number; cash_op: number; interest: number; principal: number; net: number; cash: number; cum_recovered: number };
type Run = {
  months: Month[]; closed: boolean; closed_reason: string | null;
  ledger: { rows: Row[]; start_cash: number; end_cash: number; lowest_cash: number; lowest_month: number; spent: number; deposit: number;
    payback: { month: number | null; estimated: boolean; within_engine: boolean; run_rate: number | null; reason: string }; note: string };
};

const won = (x: number) => Math.round(x / 1e4); // 원 → 만원
const fmt = (n: number) => n.toLocaleString("ko-KR");

export default function Engine() {
  const [ready, setReady] = useState(false);
  const [gus, setGus] = useState<string[]>([]);
  const [gu, setGu] = useState("마포구");
  const [capital, setCapital] = useState(12000);
  const [loan, setLoan] = useState(2000);
  const [draw, setDraw] = useState(200);
  const [seed, setSeed] = useState(42);
  const [opening, setOpening] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [health, setHealth] = useState<string>("확인 중");

  useEffect(() => {
    const get = (f: string) => fetch(`${import.meta.env.BASE_URL}mock/${f}`).then((r) => r.json());
    Promise.all([get("gu_stats.json"), get("rent_gu.json").catch(() => null)]).then(([d, r]: [GuData, RentData | null]) => {
      setGuData(d); setRentData(r); setGus(Object.keys(d.bbq.gu)); setReady(true);
    }).catch(() => setReady(true));
    fetch(`${API}/health`).then((r) => r.json()).then((h) => setHealth(`연결됨 (${h.engine})`)).catch(() => setHealth("엔진 서버에 연결되지 않음 (uvicorn api.changeup:app --port 8010)"));
  }, []);

  const input = useMemo(() => {
    if (!ready) return null;
    setRentInput(null);
    const profile = { ...DEFAULT_PROFILE, gu, capital };
    const plan = recommend(profile);
    const st = guStat(gu);
    const cost = openingCost(plan.store, gu);
    const s = storeStats(plan.store);
    return { plan, st, cost, s };
  }, [ready, gu, capital]);

  const go = async () => {
    if (!input) return;
    setBusy(true); setErr(""); setRun(null);
    const invest: Record<string, number> = {};
    for (const l of input.cost.lines) invest[l.key] = l.amount * 1e4;
    const body = {
      seed, opening, own_capital: capital * 1e4, owner_draw: draw * 1e4, invest,
      loan: loan > 0 ? { principal: loan * 1e4, annual_rate: 0.06, term_months: 60, grace_months: 60 } : null,
      store: {
        gu_sales_man: input.st.salesHansik, pyeong: input.plan.store.pyeong, tables: Math.max(1, input.s.tables), seats: input.s.seats,
        cash_rent_man_per_pyeong: input.st.rent, staff: input.plan.staff, price: 19000, baseline_runs: 150,
        quarter_index: input.st.qidx, area_type: input.st.areaType ?? "일반",
      },
      band_runs: 20,
    };
    try {
      const r = await fetch(`${API}/season/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      setRun(await r.json());
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const L = run?.ledger;
  const pts = L ? [L.start_cash, ...L.rows.map((r) => r.cash)] : [];
  const lo = Math.min(0, ...pts), hi = Math.max(...pts, 1);
  const W = 560, H = 160;
  const X = (i: number) => 24 + (i * (W - 48)) / Math.max(1, pts.length - 1);
  const Y = (v: number) => 12 + ((hi - v) / (hi - lo || 1)) * (H - 36);

  return (
    <main className="src">
      <p><a href="#/">ChangeUp 목업으로 돌아가기</a> · <a href="#/sources">출처와 근거</a></p>
      <h1>엔진 확인 (건희 엔진으로 6개월)</h1>
      <p>점포 입력을 엔진에 넣어 6개월(10월~3월)을 돌린 결과입니다. 목업 시뮬레이션과 다른 계산이고 아직 시뮬레이션 탭에는 연결하지 않았습니다.
        엔진은 혜화동 25평 점포를 기준으로 맞춰져 있어, 평수·테이블·월세·손님 규모만 입력대로 바꾸고 달력과 사건은 대학로 기준 그대로입니다.</p>
      <p><b>엔진 서버:</b> {health}</p>

      <h2>입력</h2>
      <div className="eng-form">
        <label>구
          <select value={gu} onChange={(e) => setGu(e.target.value)}>{gus.map((g) => <option key={g}>{g}</option>)}</select>
        </label>
        <label>가진 돈 (만원)<input type="number" value={capital} min={0} step={500} onChange={(e) => setCapital(+e.target.value)} /></label>
        <label>대출 (만원, 연 6%, 이자만)<input type="number" value={loan} min={0} step={500} onChange={(e) => setLoan(+e.target.value)} /></label>
        <label>사장 생활비 (만원/월)<input type="number" value={draw} min={0} step={50} onChange={(e) => setDraw(+e.target.value)} /></label>
        <label>시드<input type="number" value={seed} onChange={(e) => setSeed(+e.target.value)} /></label>
        <label className="eng-check"><input type="checkbox" checked={opening} onChange={(e) => setOpening(e.target.checked)} /> 신규 오픈 (리뷰 0, 단골 5%에서 시작)</label>
      </div>
      {input && (
        <p>앱이 추천한 가게: {input.plan.store.pyeong}평, 테이블 {input.s.tables}개, {input.s.seats}석, 직원 {input.plan.staff}명 · 평당 월세 {input.st.rent}만원
          ({input.st.rentSrc}) · 한식 점포 월매출 {man(input.st.sales)} · 여는 데 {man(input.cost.total)} (보증금 {man(input.cost.lines.find((l) => l.key === "deposit")?.amount ?? 0)} 포함)</p>
      )}
      <p><button type="button" className="eng-btn" onClick={go} disabled={!ready || busy}>{busy ? "엔진이 계산 중이에요 (새 점포는 20초쯤)" : "엔진으로 6개월 돌리기"}</button></p>
      {err && <p className="eng-err">{err}</p>}

      {run && L && (
        <>
          <h2>결과</h2>
          <p>
            {run.closed ? <b>폐업 ({run.closed_reason === "cash" ? "현금이 두 달 연속 바닥" : "매출 부진"})으로 끝났어요. </b> : null}
            시작 현금 <b>{fmt(won(L.start_cash))}만원</b> → 6개월 뒤 <b>{fmt(won(L.end_cash))}만원</b>, 가장 낮았던 때 {fmt(won(L.lowest_cash))}만원
            ({L.lowest_month > 0 ? `${L.lowest_month}개월째` : "시작 시점"}).{" "}
            {L.payback.month === null
              ? <>투자금 {fmt(won(L.spent))}만원은 <b>되찾지 못해요</b> ({L.payback.reason}).</>
              : <>쓴 돈 {fmt(won(L.spent))}만원은 <b>{L.payback.month}개월째</b>에 되찾아요{L.payback.estimated ? " (6개월 뒤를 마지막 3개월 평균으로 이어 붙인 추정)" : ""}.</>}
          </p>
          <svg viewBox={`0 0 ${W} ${H}`} className="eng-chart" role="img" aria-label="월말 현금">
            <line x1="24" x2={W - 24} y1={Y(0)} y2={Y(0)} stroke="#9aa7bb" strokeDasharray="4 4" />
            <polyline fill="none" stroke="#256abf" strokeWidth="2.5" points={pts.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} />
            {pts.map((v, i) => (
              <g key={i}><circle cx={X(i)} cy={Y(v)} r="4" fill="#256abf" />
                <text x={X(i)} y={Y(v) - 8} fontSize="11" textAnchor="middle" fill="#1a2a44">{fmt(won(v))}</text>
                <text x={X(i)} y={H - 6} fontSize="11" textAnchor="middle" fill="#5b6b82">{i === 0 ? "시작" : `${i}개월`}</text></g>
            ))}
          </svg>
          <table>
            <thead><tr><th>달</th><th>사건</th><th>매출</th><th>영업이익</th><th>이익 범위 (p10~p90)</th><th>손님</th><th>이자</th><th>사장 생활비 반영 현금 변화</th><th>월말 현금</th></tr></thead>
            <tbody>
              {run.months.map((m, i) => {
                const r = L.rows[i];
                return (
                  <tr key={m.month}>
                    <td>{m.label}</td>
                    <td>{m.events.map((e) => e.label).join(", ") || "-"}</td>
                    <td>{fmt(won(m.kpis.revenue))}만</td>
                    <td>{fmt(won(m.kpis.op))}만</td>
                    <td>{fmt(won(m.p10.op))} ~ {fmt(won(m.p90.op))}만</td>
                    <td>{fmt(Math.round(m.kpis.covers))}명</td>
                    <td>{fmt(won(r.interest))}만</td>
                    <td>{fmt(won(r.net))}만</td>
                    <td>{fmt(won(r.cash))}만</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="m-src">영업이익은 엔진이 대표자 가상 임금 300만원을 뺀 값이에요. 현금 변화는 그 임금을 되돌리고 사장 생활비와 이자를 뺀 값이에요. 시드를 바꾸면 사건과 손님 흐름이 달라져요.</p>
        </>
      )}
    </main>
  );
}
