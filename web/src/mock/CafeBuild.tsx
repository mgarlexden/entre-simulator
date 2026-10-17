// 카페의 3단계. 가게 꾸미기(3D 배치)는 비워 두고(건희가 마무리), 그 자리에 러프한 입력(평수, 등급, 직원)과 열기 전 점검을 둔다.
import { useMemo } from "react";
import { Mark } from "./Checks";
import { CAFE_GRADES, CAFE_PYEONG, cafeEstimate, cafeOpeningCost } from "./cafe";
import { cafeChecks, cafeLayoutOf, type CafeCfg } from "./cafeChecks";
import CafeRoom3D from "./CafeRoom3D";
import { useCafePreview } from "./useCafePreview";
import { STATUS_LABEL, guStat, man, type Grade, type Profile } from "./model";

function Step({ label, v, min, max, on }: { label: string; v: number; min: number; max: number; on: (v: number) => void }) {
  return (
    <div className="cs-step"><span>{label}</span>
      <button type="button" aria-label={`${label} 줄이기`} disabled={v <= min} onClick={() => on(v - 1)}>−</button><b>{v}</b>
      <button type="button" aria-label={`${label} 늘리기`} disabled={v >= max} onClick={() => on(v + 1)}>+</button></div>
  );
}

export default function CafeBuild({ profile, cfg: cfgIn, setCfg: setCfgOut, onNext }: { profile: Profile; cfg: CafeCfg | null; setCfg: (c: CafeCfg) => void; onNext: () => void }) {
  const est = useMemo(() => cafeEstimate(profile, 3 * 550), [profile.gu, profile.capital, profile.keyMoney]); // eslint-disable-line react-hooks/exhaustive-deps
  const cfg: CafeCfg = cfgIn ?? { pyeong: est.pyeong, grade: est.grade, staff: 1 };
  const setCfg = setCfgOut;
  const pv = useCafePreview(profile, cfg);
  const lay = cafeLayoutOf(cfg);
  const { list, settled } = useMemo(() => cafeChecks(profile, cfg), [profile, cfg]);
  const open = cafeOpeningCost(cfg.pyeong, cfg.grade, profile.gu, profile.keyMoney ?? 0);
  const st = guStat(profile.gu);
  const set = (p: Partial<CafeCfg>) => setCfg({ ...cfg, ...p });
  const headline = settled <= 0
    ? <>보통 카페 기준으로는 자리가 잡혀도 한 달에 <mark>{man(-settled)}씩 줄어요.</mark></>
    : <>보통 카페 기준으로 자리가 잡히면 한 달에 <mark>{man(settled)}</mark>이 남아요.</>;

  return (
    <main className="m-checks">
      <section className="a-card" aria-label="가게 꾸미기">
        <p className="m-eyebrow">가게 꾸미기</p>
        <h1>가게 구조 미리보기</h1>
        <p className="m-sub">상자로만 그린 구조 목업이에요. 숫자를 바꾸면 엔진이 배치를 다시 계산해요. 실제 3D 꾸미기는 곧 이 위에 덮여 들어와요.</p>
        {pv.err && <p className="se-err" role="alert">{pv.err}</p>}
        {pv.data && <CafeRoom3D room={pv.data.room} layout={pv.data.layout} roster={pv.data.staff.roster} />}
        {pv.data && (
          <>
            <p className="cs-legend"><i style={{ background: "#b98a5e" }} />테이블 <i style={{ background: "#7a8da6" }} />의자 <i style={{ background: "#2b2d30" }} />머신 <i style={{ background: "#256abf" }} />키오스크 <i style={{ background: "#cfe3ee" }} />진열장 <i style={{ background: "#d64545" }} />안 들어간 것 <i style={{ background: "#35614a" }} />바리스타 <i style={{ background: "#d4a032" }} />계산 <i style={{ background: "#43648a" }} />홀 직원</p>
            <ul className="cs-hint">
              <li>좌석 {pv.data.seats.total}석 (테이블석 {pv.data.seats.table}, 바 {pv.data.seats.bar}), 공간 {Math.round(pv.data.space.use_pct)}% 사용</li>
              <li>먼저 막히는 곳: <b>{pv.data.bottleneck[0].label_ko}</b>. {pv.data.bottleneck[0].note_ko}</li>
              {pv.data.space.overflow.length > 0 && <li className="is-neg">공간이 모자라요: {pv.data.space.overflow.map((o) => `${o.type} ${o.count}개`).join(", ")}. {pv.data.space.fix[0]?.label_ko}</li>}
              {pv.data.suggestion.label_ko && <li>제안: {pv.data.suggestion.label_ko} ({pv.data.suggestion.effect_ko})</li>}
            </ul>
          </>
        )}
        <div className="m-levers">
          <label>평수 <b>{cfg.pyeong}평</b>
            <input type="range" min={10} max={30} value={cfg.pyeong} onChange={(e) => set({ pyeong: Number(e.target.value), tables: undefined, chairs: undefined })} aria-valuetext={`${cfg.pyeong}평`} />
            <small>독립 카페 면적은 4분의 1이 {CAFE_PYEONG.low}평 이하, 절반이 {CAFE_PYEONG.mid}평, 4분의 1이 {CAFE_PYEONG.high}평 이상이에요.</small>
          </label>
          <div className="cs-steps">
            <Step label="테이블" v={lay.tables} min={0} max={40} on={(v) => set({ tables: v })} />
            <Step label="의자" v={lay.chairs} min={0} max={160} on={(v) => set({ chairs: v })} />
            <Step label="바 좌석" v={lay.bar} min={0} max={30} on={(v) => set({ bar: v })} />
            <Step label="머신 그룹" v={lay.groups} min={1} max={4} on={(v) => set({ groups: v })} />
            <Step label="키오스크" v={lay.kiosks} min={0} max={3} on={(v) => set({ kiosks: v })} />
            <Step label="POS" v={lay.pos} min={1} max={3} on={(v) => set({ pos: v })} />
            <Step label="진열장" v={lay.showcase} min={0} max={1} on={(v) => set({ showcase: v })} />
            <Step label="오븐" v={lay.oven} min={0} max={1} on={(v) => set({ oven: v })} />
          </div>
          <fieldset><legend>인테리어와 설비 수준 (비용 계산용)</legend>
            {(Object.keys(CAFE_GRADES) as Grade[]).map((g) => (
              <label key={g} className="m-choice"><input type="radio" name="cgrade" checked={cfg.grade === g} onChange={() => set({ grade: g })} />
                <span>{CAFE_GRADES[g].label}<small>인테리어 평당 {CAFE_GRADES[g].interior}만원 · 머신과 설비 평당 {CAFE_GRADES[g].kitchen}만원</small></span></label>
            ))}
          </fieldset>
          <label>직원 (사장 외) <b>{cfg.staff}명</b>
            <input type="range" min={0} max={3} value={cfg.staff} onChange={(e) => set({ staff: Number(e.target.value) })} aria-valuetext={`${cfg.staff}명`} />
            <small>독립 카페는 대표 포함 평균 2~3명이 일해요 (경영실태조사). 직원 한 명은 월 {man(158)}으로 계산해요.</small>
          </label>
        </div>
      </section>

      <section className="m-checks-body" aria-labelledby="checks-h">
        <p className="m-eyebrow" id="checks-h">열기 전 점검</p>
        <h1>{headline}</h1>
        <p className="m-sub">{profile.gu}, {cfg.pyeong}평, 직원 {cfg.staff}명 기준이에요. 여는 데 {man(open.total)}이 들어요(보증금 {man(open.lines.find((l) => l.key === "deposit")?.amount ?? 0)} 포함). 바꾸면 바로 다시 계산해요.</p>
        <ul className="m-checklist">
          {list.map((c) => (
            <li key={c.key}>
              <Mark s={c.status} />
              <div>
                <h2>{c.title}<span className={`m-status is-${c.status}`}>{STATUS_LABEL[c.status]}</span></h2>
                <p>{c.line}</p>
                {c.todo && <p className="m-todo">{c.todo}</p>}
                {c.rows && (
                  <ul className="m-shockrows">
                    {c.rows.map((r) => <li key={r.label} className={r.ok ? "is-ok" : "is-weak"}><span>{r.label}</span><b>{r.value}</b></li>)}
                  </ul>
                )}
                <details><summary>이렇게 계산했어요</summary><p>{c.rule}</p></details>
              </div>
            </li>
          ))}
        </ul>
        <p className="m-aside">
          비용 구조(식재료 39.1%, 세금·공과 6.0%, 기타 5.8%, 객단가 5,704원, 임시직 월 158만원, 대표자 월 211만원)는 외식업체 경영실태조사 2025의 커피전문점 전국 평균이에요.
          프랜차이즈가 섞여 있어서 독립 카페와 다를 수 있어요. 매출은 {profile.gu}의 보통 카페(중앙값) {man(st.sales)}이고, 사장 생활비를 비용으로 뺐어요.
        </p>
        <button type="button" className="m-btn" onClick={onNext}>시뮬레이션 하러 가기</button>
      </section>
    </main>
  );
}
