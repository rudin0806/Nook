import Image from "next/image";
import Link from "next/link";

/** The one place the mark is built. It was previously written out at six call
 * sites, three of which still carried a lowercase "nook" and a coloured full
 * stop, which is how the dot kept coming back. Do not inline it again.
 *
 * 마크는 받은 파일 그대로다. 앞서 색과 기하를 재서 다시 그렸더니 원본과 미묘하게
 * 달랐다 — 재현보다 원본이 낫다.
 *
 * 파일의 잉크는 `#212027` 고정이라 조명을 끄면 배경에 묻힌다. 그래서 잉크 픽셀만
 * `--nook-ink`(다크)로 갈아 끼운 짝을 함께 두고 테마에 따라 바꾼다. 세 브랜드 색은
 * 양쪽 다 그대로다.
 */
const WIDTH = 108;
const HEIGHT = 64;

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      className={className ? `app-wordmark ${className}` : "app-wordmark"}
      href="/"
      aria-label="Nook 홈"
    >
      {/* 링크가 이름을 갖고 있으므로 그림은 장식으로 둔다. */}
      <Image
        className="logo-mark logo-mark-light"
        src="/nook-logo.png"
        alt=""
        width={WIDTH}
        height={HEIGHT}
        priority
      />
      <Image
        className="logo-mark logo-mark-dark"
        src="/nook-logo-dark.png"
        alt=""
        width={WIDTH}
        height={HEIGHT}
        priority
      />
    </Link>
  );
}
