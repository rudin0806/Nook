import "../../../preview/preview.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { restartSourceSchema } from "@/schemas/recovery";
import { RestartPanel } from "@/components/nook/restart-panel";
export const dynamic = "force-dynamic";
export default async function RestartPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const source = restartSourceSchema.safeParse(await params);
  if (!source.success) notFound();
  return (
    <div className="nook-preview">
      <main id="main-content" className="preview-summary">
        <Link href="/">nook.</Link>
        <RestartPanel
          key={source.data.id}
          source={source.data}
          enabled={process.env.NOOK_START_API_ENABLED === "true"}
        />
      </main>
    </div>
  );
}
