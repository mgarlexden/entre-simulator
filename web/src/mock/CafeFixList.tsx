// 열기 전 점검 카드 아래의 '이렇게 바꾸면'(카페와 고깃집 공통): 무엇을 바꾸는지, 자리가 잡힌 뒤 한 달 손익이 어떻게 되는지, 좋아지는(또는 나빠지는) 카드, [적용].
import { iga, man } from "./model";
import type { Fix, MoveBase } from "./cafeFixes";
import "./cafe-fixes.css";

const won = (n: number) => `${n >= 0 ? "+" : "−"}${man(Math.abs(n))}`;

function Row<M extends MoveBase>({ f, settled, onApply, trade }: { f: Fix<M>; settled: number; onApply: (f: Fix<M>) => void; trade?: boolean }) {
  return (
    <div className="cf-row" role="listitem">
      <div>
        <b>{f.move.label}</b>
        <span>한 달 {won(settled)} → {won(f.settled)}{f.better.length ? ` · ${iga(f.better.join("·"))} 좋아져요` : ""}</span>
        {trade && f.worse.length > 0 && <span className="cf-trade">대신 {iga(f.worse.join("·"))} 나빠져요</span>}
      </div>
      <button type="button" className="cf-apply" onClick={() => onApply(f)} aria-label={`${f.move.label} 적용하기`}>적용</button>
    </div>
  );
}

const NONE = "한 가지만 바꿔서는 나아지지 않아요. 동네 분석에서 월세가 낮은 동네를 골라 보거나, 여러 가지를 함께 바꿔 보세요.";

export default function CafeFixList<M extends MoveBase>({ fixes, trade, none, settled, onApply, noneText = NONE }: { fixes?: Fix<M>[]; trade?: Fix<M>; none: boolean; settled: number; onApply: (f: Fix<M>) => void; noneText?: string }) {
  if (!fixes?.length && !trade && !none) return null;
  return (
    <div className="cf-box">
      <p className="cf-head">{fixes?.length ? "이렇게 바꾸면" : trade ? "한 가지만 바꾸면 이렇게 돼요" : "이렇게 바꾸면"}</p>
      {fixes?.length ? <div className="cf-list" role="list">{fixes.map((f) => <Row key={f.move.id} f={f} settled={settled} onApply={onApply} />)}</div>
        : trade ? <div className="cf-list" role="list"><Row f={trade} settled={settled} onApply={onApply} trade /></div>
          : <p className="cf-none">{noneText}</p>}
    </div>
  );
}
