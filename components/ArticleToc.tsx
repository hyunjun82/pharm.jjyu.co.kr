/**
 * 본문 첫 화면 목차 — "이 글이 답하는 질문"
 * 소제목을 그대로 질문 목록으로 보여주고, 각 섹션 앵커로 이동시킨다.
 * 히어로 리드 문장과 겹치지 않도록 요약 문단은 두지 않는다.
 */

const TOC_CSS = `.art-toc{margin:24px 0 0}
.art-toc .hd{font-size:14px;font-weight:700;color:#111827;margin:0 0 10px}
.art-toc ol{list-style:none;margin:0;padding:0;display:grid;gap:7px;counter-reset:t}
@media(min-width:640px){.art-toc ol{grid-template-columns:1fr 1fr;column-gap:18px}}
.art-toc li{counter-increment:t;margin:0}
.art-toc a{display:block;font-size:14px;color:#6b7280;text-decoration:none;line-height:1.5}
.art-toc a:before{content:counter(t);display:inline-block;min-width:17px;height:17px;line-height:17px;text-align:center;font-size:10.5px;font-weight:700;color:#059669;background:#ecfdf5;border-radius:5px;margin-right:7px;vertical-align:1px}
.art-toc a:hover{color:#059669}
.art-toc .asof{margin:14px 0 0;font-size:12px;color:#9ca3af}`;

export function ArticleToc({
  items,
  asOf,
}: {
  items: { id: string; title: string }[];
  asOf?: string;
}) {
  if (items.length < 2) return null;
  return (
    <section className="art-toc">
      <style dangerouslySetInnerHTML={{ __html: TOC_CSS }} />
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5">
        <div className="hd">🔎 이 글이 답하는 질문</div>
        <ol>
          {items.map((it) => (
            <li key={it.id}>
              <a href={`#${it.id}`}>{it.title}</a>
            </li>
          ))}
        </ol>
        {asOf && <div className="asof">{asOf}</div>}
      </div>
    </section>
  );
}
