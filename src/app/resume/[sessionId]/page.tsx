import "../../preview/preview.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppNavigation } from "@/components/nook/app-navigation";
import { ResumePanel } from "@/components/nook/resume-panel";
import { Wordmark } from "@/components/nook/wordmark";
export const dynamic = "force-dynamic";
export default async function ResumePage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ retention?: string }>;
}) {
  const id = z.uuid().safeParse((await params).sessionId);
  if (!id.success) notFound();
  return (
    <div className="nook-preview">
      <header className="preview-header">
        <Wordmark />
        <Link className="header-account" href="/login">
          내 정보
        </Link>
      </header>
      <AppNavigation current="write" />
      <main id="main-content" className="preview-summary resume-workspace">
        <ResumePanel
          retention={(await searchParams).retention === "1"}
          key={id.data}
          sessionId={id.data}
          enabled={process.env.NOOK_START_API_ENABLED === "true"}
        />
      </main>
    </div>
  );
}
