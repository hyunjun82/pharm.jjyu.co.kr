import type { IngredientItem } from "@/lib/types";

export function IngredientTable({ items }: { items: IngredientItem[] }) {
  const main = items.filter((i) => i.type === "주성분");
  const additives = items.filter((i) => i.type === "첨가제");

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-4 py-2.5 font-semibold text-gray-700 w-[72px]">구분</th>
            <th className="px-4 py-2.5 font-semibold text-gray-700">성분명</th>
            <th className="px-4 py-2.5 font-semibold text-gray-700 hidden sm:table-cell">함량</th>
            <th className="px-4 py-2.5 font-semibold text-gray-700">어떤 역할?</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {main.map((item, i) => (
            <tr key={`m-${i}`} className="bg-emerald-50/50">
              <td className="px-4 py-2.5">
                <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  주성분
                </span>
              </td>
              <td className="px-4 py-2.5 font-medium text-gray-900">{item.name}</td>
              <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{item.amount || "-"}</td>
              <td className="px-4 py-2.5 text-gray-600">{item.role}</td>
            </tr>
          ))}
          {additives.map((item, i) => (
            <tr key={`a-${i}`}>
              <td className="px-4 py-2.5">
                <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  첨가제
                </span>
              </td>
              <td className="px-4 py-2.5 text-gray-700">{item.name}</td>
              <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{item.amount || "-"}</td>
              <td className="px-4 py-2.5 text-gray-600">{item.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
