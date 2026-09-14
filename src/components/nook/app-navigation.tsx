import Link from "next/link";
type Destination = "write" | "saved" | "account";
const items = [
  {
    id: "write",
    href: "/",
    label: "생각 쓰기",
    path: "M5 19h4L20 8l-4-4L5 15v4Zm9-13 4 4",
  },
  {
    id: "saved",
    href: "/drawer",
    label: "생각더미",
    path: "M4 5h4v15H4V5Zm6-1h4v16h-4V4Zm7 2 3-1 3 14-3 1-3-14Z",
  },
  {
    id: "account",
    href: "/login",
    label: "내 계정",
    path: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
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
          <svg
            width="22"
            height="22"
            viewBox="0 0 26 26"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={item.path} />
          </svg>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
