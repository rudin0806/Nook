import Image from "next/image";
import Link from "next/link";

/** 사용자가 건넨 앱 심볼과 텍스트 로고를 조합하는 유일한 자리.
 * 다른 화면에서 다시 그리거나 글자로 대신 쓰지 않는다. */

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      className={className ? `app-wordmark ${className}` : "app-wordmark"}
      href="/"
      aria-label="Nook 홈"
    >
      {/* 링크가 이름을 갖고 있으므로 그림은 장식으로 둔다. */}
      <Image
        className="brand-symbol"
        src="/nook-symbol.png"
        alt=""
        width={102}
        height={102}
        priority
      />
      <Image
        className="brand-wordmark"
        src="/nook-wordmark.png"
        alt=""
        width={56}
        height={21}
        priority
      />
    </Link>
  );
}
