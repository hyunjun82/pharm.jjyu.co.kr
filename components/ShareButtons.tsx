"use client";

import { useState } from "react";
import { Facebook, Twitter, Instagram, Copy, Check, Share2 } from "lucide-react";

interface ShareButtonsProps {
  title: string;
}

/* ── 커스텀 SVG 아이콘 (카카오, 네이버, 스레드) ────────────── */
function KakaoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 3C6.48 3 2 6.58 2 11.04c0 2.88 1.9 5.41 4.75 6.84l-.97 3.56c-.07.26.2.47.44.33l4.26-2.82c.49.06.99.09 1.52.09 5.52 0 10-3.58 10-8S17.52 3 12 3" />
    </svg>
  );
}

function NaverIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M16.27 3h-3.42l-3.6 5.4V3H5.83v18h3.42v-5.4L12.85 21h3.42l-4.2-6.3L16.27 9V3z" />
    </svg>
  );
}

function ThreadsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12.186 24h-.007C5.461 24 .052 18.574.052 11.84v-.003C.052 5.104 5.462-.001 12.186-.001h.007c3.447 0 6.69 1.376 9.136 3.876l-2.16 2.073c-1.87-1.913-4.38-2.967-7.066-2.967h-.005c-5.14 0-9.139 4.074-9.139 9.285v.002c0 5.14 3.913 9.284 9.14 9.284h.005c2.526 0 4.83-.958 6.54-2.587l-1.473-1.665c-.18.174-.37.34-.567.498a8.098 8.098 0 0 1-4.5 1.353h-.004c-3.923 0-7.14-3.204-7.14-7.14v-.003c0-3.922 3.203-7.138 7.14-7.138h.005c1.753 0 3.4.616 4.703 1.725l.142.123a7.093 7.093 0 0 1 2.295 5.29v.003c0 2.03-.808 3.893-2.243 5.256l1.473 1.666C20.55 19.698 21.948 16.93 21.948 13.84v-.003c0-3.127-1.25-6.007-3.48-8.105A11.414 11.414 0 0 0 12.186 3z" />
    </svg>
  );
}

/* ── 공유 버튼 설정 ───────────────────────────────── */
const SHARE_PLATFORMS = [
  {
    name: "카카오톡",
    icon: KakaoIcon,
    color: "hover:bg-[#FEE500] hover:text-[#3C1E1E]",
    getUrl: (url: string, title: string) =>
      `https://story.kakao.com/share?url=${encodeURIComponent(url)}`,
  },
  {
    name: "네이버",
    icon: NaverIcon,
    color: "hover:bg-[#03C75A] hover:text-white",
    getUrl: (url: string, title: string) =>
      `https://share.naver.com/web/shareView?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    name: "페이스북",
    icon: Facebook,
    color: "hover:bg-[#1877F2] hover:text-white",
    getUrl: (url: string, title: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    name: "X",
    icon: Twitter,
    color: "hover:bg-black hover:text-white",
    getUrl: (url: string, title: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    name: "스레드",
    icon: ThreadsIcon,
    color: "hover:bg-black hover:text-white",
    getUrl: (url: string, title: string) =>
      `https://www.threads.net/intent/post?text=${encodeURIComponent(title + " " + url)}`,
  },
  {
    name: "인스타",
    icon: Instagram,
    color: "hover:bg-gradient-to-tr hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] hover:text-white",
    getUrl: null, // 인스타는 웹 공유 API 없음 → URL 복사로 대체
  },
] as const;

export function ShareButtons({ title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 폴백: 구형 브라우저
      const textarea = document.createElement("textarea");
      textarea.value = window.location.href;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = (platform: (typeof SHARE_PLATFORMS)[number]) => {
    if (platform.getUrl === null) {
      // 인스타그램: URL 복사로 대체
      handleCopy();
      return;
    }
    const url = window.location.href;
    const shareUrl = platform.getUrl(url, title);
    window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=500");
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-400 mr-1">
        <Share2 className="inline h-3.5 w-3.5 mr-1" />
        공유
      </span>
      {SHARE_PLATFORMS.map((platform) => {
        const Icon = platform.icon;
        return (
          <button
            key={platform.name}
            onClick={() => handleShare(platform)}
            className={`flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-all duration-200 ${platform.color}`}
            title={`${platform.name}에 공유`}
            aria-label={`${platform.name}에 공유`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}

      {/* URL 복사 버튼 */}
      <button
        onClick={handleCopy}
        className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 ${
          copied
            ? "border-emerald-300 bg-emerald-50 text-emerald-600"
            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        }`}
        title="URL 복사"
        aria-label="URL 복사"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>

      {copied && (
        <span className="text-xs text-emerald-600 animate-in fade-in">
          복사 완료!
        </span>
      )}
    </div>
  );
}
