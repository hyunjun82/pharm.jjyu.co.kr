interface TimelineItem {
  period: string;
  label: string;
  desc: string;
  color: "orange" | "green" | "gray";
}

const COLOR_MAP = {
  orange: {
    bg: "#FFF7ED",
    border: "#F9731625",
    badge: "#F97316",
    text: "#7C2D12",
  },
  green: {
    bg: "#E1F5EE",
    border: "#1D9E7525",
    badge: "#1D9E75",
    text: "#064E3B",
  },
  gray: {
    bg: "#F9FAFB",
    border: "#6B728025",
    badge: "#6B7280",
    text: "#374151",
  },
};

export function TimelineCard({ items }: { items: TimelineItem[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
      {items.map((item, i) => {
        const c = COLOR_MAP[item.color];
        return (
          <div
            key={i}
            style={{
              backgroundColor: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                backgroundColor: c.badge,
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 999,
                padding: "2px 8px",
                marginBottom: 6,
              }}
            >
              {item.period}
            </span>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: c.text,
                marginBottom: 4,
              }}
            >
              {item.label}
            </div>
            <div style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.6 }}>
              {item.desc}
            </div>
          </div>
        );
      })}
    </div>
  );
}
