"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { restartSourceViewSchema } from "@/schemas/recovery";
import { ThoughtInput } from "./thought-input";
export function RestartPanel({
  source,
  enabled,
}: {
  source: { kind: "node" | "branch" | "session"; id: string };
  enabled: boolean;
}) {
  const [data, setData] = useState<{
      question: string;
      sourceSessionId: string | null;
    } | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    void fetch(`/api/restart/${source.kind}/${source.id}`, {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return restartSourceViewSchema.parse((await r.json()).data);
      })
      .then(setData)
      .catch(() => {
        if (!c.signal.aborted) setError(true);
      });
    return () => c.abort();
  }, [source.kind, source.id]);
  if (error)
    return (
      <p role="alert">
        질문을 열 수 없어요. 로그인 상태와 원래 기록을 확인해 주세요.{" "}
        <Link href="/">홈으로</Link>
      </p>
    );
  if (!data) return <p role="status">질문을 불러오고 있어요…</p>;
  return (
    <>
      <p>
        이 질문에서 새 생각을 시작해요. 원래 기록의 보관 상태는 그대로 유지돼요.
      </p>
      {data.sourceSessionId && (
        <p>
          <Link href={`/resume/${data.sourceSessionId}`}>
            원래 이야기로 돌아가기
          </Link>
        </p>
      )}
      <ThoughtInput
        enabled={enabled}
        initialThought={data.question}
        source={source}
      />
    </>
  );
}
