import Link from "next/link";
import { NookIcon } from "./nook-icon";
import { ThemeControl } from "./theme-control";
/** 내 정보는 탭이 아니다. 진입점이 상단 탭과 헤더 오른쪽 두 곳이었고 둘이 같은 곳으로
 *  갔다. 주 메뉴는 이 제품이 오가는 두 자리(쓰기·더미)만 담고, 계정은 헤더에서 연다. */
type Destination = "write" | "saved" | "account";
const items = [
  {
    id: "write",
    href: "/",
    label: "홈",
    icon: "home",
    tone: "blue",
  },
  {
    id: "saved",
    href: "/drawer",
    label: "생각 더미",
    icon: "pile",
    tone: "lime",
  },
] as const;
export function AppNavigation({ current }: { current: Destination }) {
  return (
    <nav className="app-dock" aria-label="주 메뉴">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={current === item.id ? "page" : undefined}
        >
          <NookIcon name={item.icon} tone={item.tone} compact />
          <span>{item.label}</span>
        </Link>
      ))}
      {/* 조명은 탭이 아니라 화면 전체의 설정이라 줄 오른쪽 끝에 선다. 도시락
          격자 안에 있을 때는 읽을 것들 사이에 만질 것이 섞여 있었다. */}
      <ThemeControl compact />
    </nav>
  );
}
