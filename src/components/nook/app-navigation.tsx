import Link from "next/link";
import { NookIcon } from "./nook-icon";
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
  {
    id: "account",
    href: "/login",
    label: "내 정보",
    icon: "account",
    tone: "orange",
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
    </nav>
  );
}
