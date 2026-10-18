// 출처 페이지의 접는 섹션. 제목(h2)을 누르면 본문이 펼쳐지고 접힌다. 기본은 접힘.
import type { ReactNode } from "react";

export default function Fold({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <details className="src-fold">
      <summary><h2 id={id}>{title}</h2></summary>
      <div className="src-fold-body">{children}</div>
    </details>
  );
}
