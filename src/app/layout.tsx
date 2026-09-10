import type { Metadata } from "next";
import "@seed-design/css/all.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nook — 생각을 잠시 놓아두는 곳",
  description: "답을 주는 대신, 내가 어떤 질문을 지나왔는지.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-seed data-seed-color-mode="light-only">
      <body>{children}</body>
    </html>
  );
}
