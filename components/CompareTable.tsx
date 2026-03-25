interface CompareItem {
  name: string;
  ingredient: string;
  target: string;
  period: string;
  price: string;
  caution: string;
  current?: boolean;
  href?: string;
}

export function CompareTable({ items }: { items: CompareItem[] }) {
  const headers = ["약품명", "주성분", "대상", "효과시작", "가격", "주의"];

  return (
    <div className="overflow-x-auto my-4 rounded-lg border border-gray-200">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr
              key={i}
              className={`border-b border-gray-100 last:border-0 ${
                item.current ? "bg-gray-50" : "bg-white"
              }`}
            >
              <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                {item.href ? (
                  <a
                    href={item.href}
                    className="text-emerald-600 hover:underline"
                  >
                    {item.name}
                  </a>
                ) : (
                  item.name
                )}
                {item.current && (
                  <span className="ml-1.5 inline-block rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    현재
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-gray-600">{item.ingredient}</td>
              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{item.target}</td>
              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{item.period}</td>
              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{item.price}</td>
              <td className="px-3 py-2.5 text-gray-600">{item.caution}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
