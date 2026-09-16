"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { startResultView, type StartView } from "@/lib/start/client";
import { ThoughtInput } from "./thought-input";
import { ConversationRetention } from "./conversation-retention";
const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("talk"), nodeId: z.uuid() }),
  z.object({ kind: z.literal("saved"), sessionId: z.uuid() }),
  z.object({ kind: z.literal("trash") }),
  z.object({
    kind: z.literal("retention"),
    sessionId: z.uuid(),
    branches: z.array(z.object({ id: z.uuid(), text: z.string() })).max(50),
  }),
  z.object({
    kind: z.literal("draft"),
    thought: z.string().max(5000),
    result: z.unknown(),
  }),
  z.object({ kind: z.literal("legacy"), thought: z.string().max(5000) }),
]);
export function ResumePanel({
  sessionId,
  enabled,
  retention = false,
}: {
  sessionId: string;
  enabled: boolean;
  retention?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<z.infer<typeof schema> | null>(null),
    [view, setView] = useState<StartView>(),
    [error, setError] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    void fetch(
      `/api/sessions/${sessionId}/resume${retention ? "?retention=1" : ""}`,
      {
        cache: "no-store",
        signal: c.signal,
      },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return schema.parse((await r.json()).data);
      })
      .then((d) => {
        if (c.signal.aborted) return;
        if (d.kind === "talk") router.replace(`/talk/${d.nodeId}`);
        else if (d.kind === "saved") router.replace(`/drawer/${d.sessionId}`);
        else {
          if (d.kind === "draft") {
            const result = startResultView(d.result);
            if (result.kind !== "view") throw new Error();
            setView(result.view);
          }
          setData(d);
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setError(true);
      });
    return () => c.abort();
  }, [sessionId, router, retention]);
  if (error)
    return (
      <p role="alert">
        대화를 불러올 수 없어요. 로그인 상태를 확인하거나{" "}
        <Link href="/drawer">생각 더미·휴지통</Link>에서 확인해 주세요.
      </p>
    );
  if (!data) return <p role="status">대화를 불러오고 있어요…</p>;
  if (data.kind === "trash")
    return (
      <p>
        이 대화는 휴지통에 있어요.{" "}
        <Link href="/drawer?collection=trash">휴지통에서 복원하기</Link>
      </p>
    );
  if (data.kind === "retention")
    return (
      <ConversationRetention
        sessionId={data.sessionId}
        branches={data.branches}
      />
    );
  if (data.kind === "legacy" || data.kind === "draft")
    return (
      <>
        {data.kind === "legacy" && (
          <p>
            이전 버전에서 제안을 남기지 않아 그대로 복구할 수 없어요. 아래
            입력으로 새 대화를 시작할 수 있어요.
          </p>
        )}
        <ThoughtInput
          enabled={enabled}
          initialThought={data.thought}
          initialView={view}
          initialSessionId={sessionId}
        />
      </>
    );
  return null;
}
