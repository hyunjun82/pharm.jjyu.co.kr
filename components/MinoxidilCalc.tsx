"use client";

import { useState } from "react";

/**
 * 미녹시딜 4개월 비용 계산기
 * ------------------------------------------------------------------
 * 국내 허가된 바르는 미녹시딜 82종을 성별 · 농도 · 제형 · 기간 조건으로
 * 계산해 "실제로 사야 하는 병 수" 기준 총비용을 보여준다.
 *
 * 근거
 *  - 용법: 식약처 허가사항. 남성 1일 2mL, 여성 1일 1.3mL 한도.
 *  - pid 가 있는 22종은 판매처에서 확인한 실측가,
 *    나머지 60종은 동일 용량·동일 농도 제품의 통상 판매가(기준가).
 *  - 가격 데이터 기준일: 2026-07-27
 */

const AS_OF = "2026년 7월 27일";
const ALL_URL = "https://pharm.jjyu.co.kr/탈모/가격비교/";

type Item = {
  n: string;          // 표시 이름
  p: number;          // 1개 가격(원)
  v: number;          // 1개 용량(mL 또는 g)
  c: number | null;   // 농도(%) — 미표기는 null
  f: string;          // 제형
  s: string;          // 사이트 내부 슬러그
  pid: string | null; // 판매처 상품 id — 없으면 기준가
};

const PRODUCTS: Item[] = [
  { n: "판시딜액 5% 240ml", p: 24000, v: 240, c: 5, f: "액", s: "판시딜액", pid: "p1445" },
  { n: "동성 미녹시딜액 3% 200ml", p: 21000, v: 200, c: 3, f: "액", s: "동성미녹시딜3", pid: "p407" },
  { n: "판시딜액 3% 200ml", p: 25000, v: 200, c: 3, f: "액", s: "판시딜액3", pid: "p1951" },
  { n: "두피나액 30ml", p: 4500, v: 30, c: null, f: "액", s: "두피나액", pid: "p687" },
  { n: "마이녹실액 5% 리필용 360ml", p: 55000, v: 360, c: 5, f: "액", s: "마이녹실액5리필", pid: "p1279" },
  { n: "케라시딜액 360ml", p: 62000, v: 360, c: 5, f: "액", s: "케라시딜", pid: "p817" },
  { n: "마이모닉액 240ml", p: 42000, v: 240, c: 5, f: "액", s: "마이모닉", pid: "p1393" },
  { n: "케라티모액 360ml", p: 65000, v: 360, c: 5, f: "액", s: "케라티모", pid: "p746" },
  { n: "케라시딜액 300ml", p: 55000, v: 300, c: 5, f: "액", s: "케라시딜", pid: "p387" },
  { n: "케라시딜액 240ml", p: 45000, v: 240, c: 5, f: "액", s: "케라시딜", pid: "p677" },
  { n: "마이녹실액 3% 180ml", p: 35000, v: 180, c: 3, f: "액", s: "마이녹실액3", pid: "p1671" },
  { n: "케라티모액 180ml", p: 35000, v: 180, c: 5, f: "액", s: "케라티모", pid: "p1244" },
  { n: "케라시딜액 150ml", p: 30000, v: 150, c: 5, f: "액", s: "케라시딜", pid: "p575" },
  { n: "미녹시딜 5% 60ml", p: 14000, v: 60, c: 5, f: "액", s: "미녹시딜", pid: "p135" },
  { n: "나녹시딜액 5% 60ml", p: 14000, v: 60, c: 5, f: "액", s: "나녹시딜", pid: "p1852" },
  { n: "카필러스 폼 에어로솔 미녹시딜 5% 60g", p: 15000, v: 60, c: 5, f: "폼", s: "카필러스폼", pid: "p1468" },
  { n: "미녹시딜바이그루트액3% 60ml", p: 15000, v: 60, c: 3, f: "액", s: "미녹시딜바이그루트액3", pid: null },
  { n: "마이녹실겔 3% 60ml", p: 15000, v: 60, c: 3, f: "겔", s: "마이녹실겔", pid: null },
  { n: "모리모리액 3% 60ml", p: 15000, v: 60, c: 3, f: "액", s: "모리모리액3", pid: null },
  { n: "다모녹실액 3% 60ml", p: 15000, v: 60, c: 3, f: "액", s: "다모녹실액3", pid: null },
  { n: "헤르겐스칼프액 2% 60ml", p: 15000, v: 60, c: 2, f: "액", s: "헤르겐스칼프액2", pid: null },
  { n: "넥스모액 2% 60ml", p: 15000, v: 60, c: 2, f: "액", s: "넥스모액2", pid: null },
  { n: "모바린액 2% 60ml", p: 15000, v: 60, c: 2, f: "액", s: "모바린액2", pid: null },
  { n: "헤어메드액 2% 60ml", p: 15000, v: 60, c: 2, f: "액", s: "헤어메드액2", pid: null },
  { n: "레나시딜액 2% 60ml", p: 15000, v: 60, c: 2, f: "액", s: "레나시딜액2", pid: null },
  { n: "신신미녹시딜액 2% 60ml", p: 15000, v: 60, c: 2, f: "액", s: "신신미녹시딜액2", pid: null },
  { n: "케이녹시액 2% 60ml", p: 15000, v: 60, c: 2, f: "액", s: "케이녹시액2", pid: null },
  { n: "마이모닉액 60ml", p: 15000, v: 60, c: 5, f: "액", s: "마이모닉", pid: "p1070" },
  { n: "마이딜액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "마이딜액", pid: null },
  { n: "백일후애액 5% 60ml", p: 18000, v: 60, c: 5, f: "액", s: "백일후애액", pid: null },
  { n: "마이녹실액 5% 60ml", p: 18000, v: 60, c: 5, f: "액", s: "마이녹실액", pid: null },
  { n: "판시딜 미녹시딜 5% 외용액 60ml", p: 18000, v: 60, c: 5, f: "액", s: "판시딜", pid: null },
  { n: "메디녹실액 5% 60ml", p: 18000, v: 60, c: 5, f: "액", s: "메디녹실액", pid: null },
  { n: "모바린액 5% 60ml", p: 18000, v: 60, c: 5, f: "액", s: "모바린액", pid: null },
  { n: "모바린겔 5% 60ml", p: 18000, v: 60, c: 5, f: "겔", s: "모바린겔", pid: null },
  { n: "미녹시딜바이그루트액 5% 60ml", p: 18000, v: 60, c: 5, f: "액", s: "미녹시딜바이그루트액5", pid: null },
  { n: "미녹시딜바이그루트겔 5% 60ml", p: 18000, v: 60, c: 5, f: "겔", s: "미녹시딜바이그루트겔5", pid: null },
  { n: "모리모리액 5% 60ml", p: 18000, v: 60, c: 5, f: "액", s: "모리모리액5", pid: null },
  { n: "마이녹스액 5% 60ml", p: 18000, v: 60, c: 5, f: "액", s: "마이녹스액5", pid: null },
  { n: "레나시딜액 5% 60ml", p: 18000, v: 60, c: 5, f: "액", s: "레나시딜액5", pid: null },
  { n: "다모녹실액 5% 60ml", p: 18000, v: 60, c: 5, f: "액", s: "다모녹실액5", pid: null },
  { n: "남탈렌액 5% 60ml", p: 18000, v: 60, c: 5, f: "액", s: "남탈렌액5", pid: null },
  { n: "볼두민액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "볼두민액3", pid: null },
  { n: "헤르겐스칼프액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "헤르겐스칼프액3", pid: null },
  { n: "헤어메드액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "헤어메드액3", pid: null },
  { n: "넥스모액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "넥스모액3", pid: null },
  { n: "레나시딜액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "레나시딜액3", pid: null },
  { n: "남탈렌액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "남탈렌액3", pid: null },
  { n: "마이녹스액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "마이녹스액3", pid: null },
  { n: "케이녹시액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "케이녹시액3", pid: null },
  { n: "신신미녹시딜액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "신신미녹시딜액3", pid: null },
  { n: "나니녹실액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "나니녹실액3", pid: null },
  { n: "그루녹시딜액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "그루녹시딜액3", pid: null },
  { n: "바로나실액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "바로나실액3", pid: null },
  { n: "백일후애액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "백일후애액3", pid: null },
  { n: "모바린액 3% 60ml", p: 18000, v: 60, c: 3, f: "액", s: "모바린액3", pid: null },
  { n: "복합마이녹실 60ml", p: 18000, v: 60, c: null, f: "액", s: "복합마이녹실", pid: "p190" },
  { n: "목시딜액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "목시딜액", pid: null },
  { n: "볼두민액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "볼두민액", pid: null },
  { n: "나녹시딜액 3% 60ml", p: 20000, v: 60, c: 3, f: "액", s: "나녹시딜액3", pid: null },
  { n: "모바렌액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "모바렌액", pid: null },
  { n: "라코빈액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "라코빈액5", pid: null },
  { n: "닥터방스카파시딜액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "닥터방스카파시딜액5", pid: null },
  { n: "헤르겐스칼프액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "헤르겐스칼프액5", pid: null },
  { n: "헤어메드액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "헤어메드액5", pid: null },
  { n: "다모실겔 5% 60ml", p: 20000, v: 60, c: 5, f: "겔", s: "다모실겔5", pid: null },
  { n: "모리나액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "모리나액5", pid: null },
  { n: "신신미녹시딜액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "신신미녹시딜액5", pid: null },
  { n: "리겐솔액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "리겐솔액5", pid: null },
  { n: "나니녹실액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "나니녹실액5", pid: null },
  { n: "그루녹시딜액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "그루녹시딜액5", pid: null },
  { n: "바로나실액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "바로나실액5", pid: null },
  { n: "리드녹실액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "리드녹실액5", pid: null },
  { n: "케어모액 5% 60ml", p: 20000, v: 60, c: 5, f: "액", s: "케어모액5", pid: null },
  { n: "마이녹실 폼 에어로솔 5% 60g", p: 20000, v: 60, c: 5, f: "폼", s: "마이녹실폼5", pid: "p1726" },
  { n: "복합마이녹실액 60ml", p: 22000, v: 60, c: null, f: "액", s: "복합마이녹실액", pid: null },
  { n: "나녹시딜액 5% 60ml", p: 25000, v: 60, c: 5, f: "액", s: "나녹시딜액", pid: null },
  { n: "로게인액 5% 60ml", p: 25000, v: 60, c: 5, f: "액", s: "로게인액5", pid: null },
  { n: "로게인겔 2% 60ml", p: 28000, v: 60, c: 2, f: "겔", s: "로게인겔2", pid: null },
  { n: "두피앤액 30ml", p: 15000, v: 30, c: 2, f: "액", s: "두피앤액", pid: "p645" },
  { n: "미녹시폼 에어로솔 미녹시딜 5% 60g 3캔(총 180g)", p: 40000, v: 180, c: 5, f: "폼", s: "미녹시폼", pid: "p1588" },
  { n: "로게인 폼 5% 60g 3개입(총 180g)", p: 67000, v: 180, c: 5, f: "폼", s: "로게인", pid: "p285" },
];

const REAL_COUNT = PRODUCTS.filter((x) => x.pid).length;
const STD_COUNT = PRODUCTS.length - REAL_COUNT;

const CSS = `.mnx-calc{border:1px solid #e5e7eb;border-radius:14px;padding:16px 16px 14px;background:#fff;margin:4px 0 6px}
.mnx-head{display:flex;flex-direction:column;gap:2px;margin-bottom:14px}
.mnx-head b{font-size:15.5px;color:#111827}
.mnx-head span{font-size:12.5px;color:#9ca3af}
.mnx-row{display:flex;align-items:center;gap:10px;margin-bottom:9px;flex-wrap:wrap}
.mnx-lab{font-size:13px;color:#6b7280;width:38px;flex-shrink:0}
.mnx-chips{display:flex;gap:6px;flex-wrap:wrap}
.mnx-chip{font-size:13.5px;padding:6px 13px;border-radius:99px;border:1px solid #e5e7eb;background:#fff;color:#4b5563;cursor:pointer;font-family:inherit;transition:.12s}
.mnx-chip:hover{border-color:#d1d5db}
.mnx-chip.on{background:#111827;border-color:#111827;color:#fff;font-weight:600}
.mnx-out{margin-top:14px;padding-top:14px;border-top:1px solid #f3f4f6}
.mnx-big{font-size:13px;color:#6b7280;margin-bottom:2px}
.mnx-amt{font-size:29px;font-weight:800;color:#111827;letter-spacing:-.03em;line-height:1.25}
.mnx-amt small{font-size:15px;font-weight:600;color:#6b7280;margin-left:3px}
.mnx-sub{font-size:13.5px;color:#6b7280;margin-top:5px}
.mnx-save{margin-top:11px;padding:10px 12px;background:#f9fafb;border-radius:9px;font-size:13.5px;color:#374151;line-height:1.6}
.mnx-save b{color:#111827}
.mnx-list{margin-top:12px}
.mnx-item{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:9px 0;border-top:1px solid #f3f4f6;font-size:14px}
.mnx-item .nm{color:#374151}
.mnx-item .pr{color:#111827;font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums}
.mnx-item .pl{color:#9ca3af;font-size:12.5px}
.mnx-note{font-size:12px;color:#9ca3af;margin-top:11px;line-height:1.6}
@media(max-width:520px){.mnx-lab{width:100%}.mnx-amt{font-size:25px}}
.mnx-cta{display:block;margin-top:13px;padding:14px 16px;border-radius:12px;background:#059669;color:#fff!important;text-decoration:none;text-align:center;font-weight:700;font-size:15.5px;line-height:1.4;box-shadow:0 4px 14px rgba(5,150,105,.25);transition:.15s}
.mnx-cta:hover{background:#047857;transform:translateY(-1px);box-shadow:0 6px 18px rgba(5,150,105,.32)}
.mnx-lt{font-size:12.5px;color:#9ca3af;margin:4px 0 2px}
a.mnx-item{text-decoration:none;color:inherit}
a.mnx-item:hover .nm{color:#059669}
.mnx-item .nm em{font-style:normal;background:#111827;color:#fff;font-size:11px;padding:1px 6px;border-radius:99px;margin-right:5px;vertical-align:1px}
.mnx-tag{font-size:10.5px;font-weight:600;padding:1px 5px;border-radius:4px;margin-left:5px;vertical-align:1px;letter-spacing:-.01em}
.mnx-tag.real{background:#ecfdf5;color:#047857}
.mnx-tag.std{background:#f3f4f6;color:#9ca3af}
.mnx-warn{margin:10px 0;padding:10px 12px;border-radius:10px;background:#fffbeb;border:1px solid #fcd34d;color:#92400e;font-size:13px;line-height:1.6}`;

const won = (n: number) => n.toLocaleString("ko-KR");
const buyUrl = (x: Item) =>
  x.pid ? `https://barkiri.com/products/${x.pid}` : ALL_URL;
const innerUrl = (x: Item) =>
  `https://pharm.jjyu.co.kr/탈모/${encodeURIComponent(x.s)}/`;
const unitOf = (x: Item) => (x.f === "액" ? "mL" : "g");

type Row = Item & {
  per: number;
  permg: number | null;
  cnt: number;
  tot: number;
  real: boolean;
};

const CHIPS = {
  성별: [
    { v: "m", label: "남성" },
    { v: "f", label: "여성" },
  ],
  농도: [
    { v: "any", label: "상관없음" },
    { v: "2", label: "2%" },
    { v: "3", label: "3%" },
    { v: "5", label: "5%" },
  ],
  제형: [
    { v: "any", label: "상관없음" },
    { v: "액", label: "액" },
    { v: "겔", label: "겔" },
    { v: "폼", label: "폼" },
  ],
  기간: [
    { v: "4", label: "4개월" },
    { v: "6", label: "6개월" },
    { v: "12", label: "1년" },
  ],
} as const;

type GroupKey = keyof typeof CHIPS;

function Tag({ real }: { real: boolean }) {
  return real ? (
    <span className="mnx-tag real">실측</span>
  ) : (
    <span className="mnx-tag std">기준가</span>
  );
}

export function MinoxidilCalc() {
  const [sex, setSex] = useState("m");
  const [conc, setConc] = useState("5");
  const [form, setForm] = useState("any");
  const [months, setMonths] = useState("4");

  const state: Record<GroupKey, string> = {
    성별: sex,
    농도: conc,
    제형: form,
    기간: months,
  };

  const pick = (g: GroupKey, v: string) => {
    if (g === "성별") {
      setSex(v);
      // 성별을 바꾸면 국내 허가 구성에 맞춰 농도 기본값도 같이 옮긴다
      setConc(v === "f" ? "3" : "5");
      return;
    }
    if (g === "농도") setConc(v);
    if (g === "제형") setForm(v);
    if (g === "기간") setMonths(v);
  };

  // 식약처 허가 용법: 남성 1일 2mL, 여성 1일 1.3mL
  const perDay = sex === "f" ? 1.3 : 2;
  const need = perDay * Number(months) * 30;

  const filtered = PRODUCTS.filter(
    (x) =>
      (conc === "any" || String(x.c) === conc) &&
      (form === "any" || x.f === form)
  );

  const chips = (
    <>
      {(Object.keys(CHIPS) as GroupKey[]).map((g) => (
        <div className="mnx-row" key={g}>
          <span className="mnx-lab">{g}</span>
          <div className="mnx-chips">
            {CHIPS[g].map((o) => (
              <button
                type="button"
                key={o.v}
                className={`mnx-chip${state[g] === o.v ? " on" : ""}`}
                aria-pressed={state[g] === o.v}
                onClick={() => pick(g, o.v)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );

  const shell = (body: React.ReactNode) => (
    <div className="mnx-calc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mnx-head">
        <b>내 조건으로 넉 달 비용 계산하기</b>
        <span>국내 바르는 미녹시딜 {PRODUCTS.length}종 기준</span>
      </div>
      {chips}
      <div className="mnx-out">{body}</div>
    </div>
  );

  if (!filtered.length) {
    return shell(
      <div className="mnx-sub">
        그 조건에 맞는 제품이 없어요. 농도나 제형을 상관없음으로 바꿔 보세요.
      </div>
    );
  }

  const rows: Row[] = filtered.map((x) => {
    const mg = x.c ? x.v * x.c * 10 : null;
    const cnt = Math.ceil(need / x.v); // 실제로 사야 하는 병 수
    return {
      ...x,
      per: x.p / x.v,
      permg: mg ? x.p / mg : null,
      cnt,
      tot: cnt * x.p,
      real: !!x.pid,
    };
  });

  const byTot = [...rows].sort((a, b) => a.tot - b.tot || a.per - b.per);
  const byPer = [...rows].sort((a, b) => a.per - b.per);
  const byMg = rows
    .filter((x) => x.permg !== null)
    .sort((a, b) => (a.permg as number) - (b.permg as number));

  const lo = byTot[0];
  const hi = byTot[byTot.length - 1];
  // 폼·겔만 골랐을 때는 g, 그 외에는 mL로 단위를 표기한다
  const U = form === "폼" || form === "겔" ? "g" : "mL";

  return shell(
    <>
      <div className="mnx-big">
        {months}개월이면 {won(Math.round(need))}
        {U} 필요해요 · 하루 {perDay}
        {U} 기준
      </div>
      <div className="mnx-amt">
        {won(lo.tot)}
        <small>원부터</small>
      </div>
      <div className="mnx-sub">
        {lo.n}을(를) <b>{lo.cnt}개</b> 사면 되는 금액이에요. 남는 양까지 포함한
        값이라 단가 순위와 총액 순위는 다를 수 있어요.
      </div>

      {sex === "f" && (
        <div className="mnx-warn">
          여성은 허가 용법이 하루 1.3mL라 필요량을 그 기준으로 잡았어요.
          {conc === "3" &&
            " 국내엔 3%·2% 제품이 여성용으로 나와 있어 농도도 3%로 맞춰 뒀어요. 직접 바꿀 수도 있어요."}
        </div>
      )}

      {hi.tot > lo.tot * 1.2 && (
        <div className="mnx-save">
          같은 조건에서 제일 비싼 걸 고르면 <b>{won(hi.tot)}원</b>이에요.{" "}
          {conc !== "any" && "농도가 같은데도 "}
          <b>{won(hi.tot - lo.tot)}원</b> 차이가 나요.
        </div>
      )}

      {lo.pid ? (
        <a
          className="mnx-cta"
          href={buyUrl(lo)}
          rel="noopener noreferrer nofollow"
          target="_blank"
        >
          {lo.n} 최저가 바로가기
        </a>
      ) : (
        <div className="mnx-warn">
          이 제품은 연결된 판매처 페이지가 없어요. 표시된 1개 {won(lo.p)}원은
          동일 용량·동일 농도 제품의 통상 판매가예요. 약국에서 직접 확인해야
          해요.
        </div>
      )}

      <div className="mnx-list">
        <div className="mnx-lt">
          ① {months}개월 총비용 싼 순 — 실제 사야 하는 병 수 기준
        </div>
        {byTot.slice(0, 4).map((x, k) => (
          <a className="mnx-item" href={innerUrl(x)} key={x.n}>
            <span className="nm">
              {k === 0 && <em>1위</em>} {x.n}
              <Tag real={x.real} />
            </span>
            <span className="pr">
              {won(x.tot)}원{" "}
              <span className="pl">
                {x.cnt}개 · 1{unitOf(x)} {won(Math.round(x.per))}원
              </span>
            </span>
          </a>
        ))}
      </div>

      {byPer[0].n !== byTot[0].n && (
        <div className="mnx-save">
          1{unitOf(byPer[0])} 단가만 보면 <b>{byPer[0].n}</b>이 제일 싸지만,
          남는 양까지 돈으로 치면 총액은 <b>{byTot[0].n}</b>이 더 적게 들어요.
        </div>
      )}

      {byMg.length > 1 && (
        <div className="mnx-list">
          <div className="mnx-lt">② 미녹시딜 1mg당 싼 순 — 성분 기준</div>
          {byMg.slice(0, 4).map((x, k) => (
            <a className="mnx-item" href={innerUrl(x)} key={x.n}>
              <span className="nm">
                {k === 0 && <em>1위</em>} {x.n}
                <Tag real={x.real} />
              </span>
              <span className="pr">
                {won(x.p)}원{" "}
                <span className="pl">
                  1mg {(x.permg as number).toFixed(2)}원
                </span>
              </span>
            </a>
          ))}
        </div>
      )}

      <a className="mnx-cta" href={ALL_URL}>
        📋 탈모약 415종 가격비교
      </a>

      <div className="mnx-note">
        국내 바르는 미녹시딜 {PRODUCTS.length}종 기준이에요. 그중{" "}
        <b>{REAL_COUNT}종은 판매처에서 확인한 실측가</b>, 나머지 {STD_COUNT}종은
        동일 용량·농도 제품의 통상 판매가로 채운 기준가예요. 목록에 구분해
        표시했어요. 농도 미표기 3종(두피나액·복합마이녹실 2종)은 성분 기준
        순위에서 제외했어요. 폼·겔 제품은 mL 대신 g 기준이고, 3개입·3캔 묶음은
        총 용량으로 계산했어요. 약국 실거래가는 다를 수 있고 전국 최저가는
        아니에요. 일반의약품이라 약국 방문 구매만 가능해요. 가격 데이터 기준일은{" "}
        {AS_OF}이에요.
      </div>
    </>
  );
}
