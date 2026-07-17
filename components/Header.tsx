import Link from "next/link";
import { Pill } from "lucide-react";

const categories = [
  { name: "탈모약", href: "/탈모" },
  { name: "연고", href: "/연고" },
  { name: "감기약", href: "/감기" },
  { name: "진통제", href: "/진통제" },
  { name: "무좀약", href: "/무좀" },
  { name: "설사약", href: "/설사" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Pill className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-gray-900">약정보</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {categories.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              {cat.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
