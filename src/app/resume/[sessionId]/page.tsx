import "../../preview/preview.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ResumePanel } from "@/components/nook/resume-panel";
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
      <main id="main-content" className="preview-summary">
        <Link href="/">홈으로</Link>
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
