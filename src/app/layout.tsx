import type { Metadata } from "next";
import "@seed-design/css/all.css";
import "./globals.css";
import "./redesign.css";

export const metadata: Metadata = {
  title: "Nook — 복잡한 생각, 말하면서 정리해요",
  description:
    "복잡한 생각, 말하면서 정리해요. 생각나는 대로 이야기하면 Nook이 지금 고민하고 있는 질문을 함께 정리합니다.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ko"
      data-seed
      data-seed-color-mode="system"
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function apply(){var t;try{t=localStorage.getItem('nook-theme-v1')}catch(e){}var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.dataset.seedColorMode=d?'dark-only':'light-only'}apply();matchMedia('(prefers-color-scheme: dark)').addEventListener('change',apply);window.addEventListener('storage',apply)})();`,
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          본문으로 바로가기
        </a>
        {children}
      </body>
    </html>
  );
}
