"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
export function SessionOrigin({ sessionId }: { sessionId: string }) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const c = new AbortController();
    void fetch(`/api/sessions/${sessionId}/origin`, {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return z
          .object({ data: z.object({ sourceSessionId: z.uuid().nullable() }) })
          .parse(await r.json()).data;
      })
      .then((d) => setId(d.sourceSessionId))
      .catch(() => {});
    return () => c.abort();
  }, [sessionId]);
  return id ? (
    <p>
      <Link href={`/resume/${id}`}>이 생각을 시작한 원래 이야기</Link>
    </p>
  ) : null;
}
