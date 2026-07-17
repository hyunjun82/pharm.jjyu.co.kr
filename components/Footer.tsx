import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-gray-500">
            약정보는 의약품 정보 제공 목적이며, 의학적 조언을 대체하지 않습니다.
          </p>
          <div className="flex gap-4 text-sm text-gray-400">
            <Link href="/" className="hover:text-gray-600">
              홈
            </Link>
            <span>|</span>
            <Link href="/about" className="hover:text-gray-600">
              작성자 소개
            </Link>
            <span>|</span>
            <span>공공데이터포털 API 활용</span>
          </div>
        </div>

        {/* 면책조항 고정 */}
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>면책조항:</strong> 본 사이트에서 제공하는 의약품 정보는
            공공데이터포털(식약처)의 공식 데이터를 기반으로 하며, 일반적인 정보
            제공 목적입니다. 의약품 복용 전 반드시{" "}
            <strong>전문의 또는 약사와 상담</strong>하시기 바랍니다. 본 사이트의
            정보는 전문적인 의학적 진단, 치료, 처방을 대체할 수 없으며, 개인의
            건강 상태에 따라 다를 수 있습니다.
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} 약정보. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
