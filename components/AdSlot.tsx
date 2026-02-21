export function AdSlot({ id }: { id: string }) {
  return (
    <div
      id={`ad-${id}`}
      className="my-6 flex min-h-[90px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50 text-xs text-gray-400"
      data-ad-slot={id}
    >
      광고 영역
    </div>
  );
}
