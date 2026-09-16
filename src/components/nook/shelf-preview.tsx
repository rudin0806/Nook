"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { savedSessionListItemSchema } from "@/schemas/retention";
import { savedStorySchema } from "@/schemas/saved-story";
import { NookIcon } from "./nook-icon";
type Book = { id: string; title: string; nodes: number };
export function ShelfPreview() {
  const [guest, setGuest] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [status, setStatus] = useState("책장을 불러오고 있어요.");
  useEffect(() => {
    const c = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          "/api/sessions?collection=saved&limit=4&offset=0",
          { signal: c.signal, cache: "no-store" },
        );
        if (response.status === 401) {
          setGuest(true);
          setStatus("로그인하면 남긴 책을 볼 수 있어요.");
          return;
        }
        if (!response.ok) throw new Error();
        const { data } = z
          .object({
            data: z.object({ items: savedSessionListItemSchema.array() }),
          })
          .parse(await response.json());
        const results = await Promise.all(
          data.items.map(async (item) => {
            const r = await fetch(`/api/sessions/${item.id}/story`, {
              signal: c.signal,
              cache: "no-store",
            });
            if (!r.ok) throw new Error();
            const story = savedStorySchema.parse((await r.json()).data);
            const nodes = story.segments.flatMap((segment) => segment.nodes);
            return {
              id: item.id,
              title: nodes.at(-1)?.final_text ?? "남긴 생각",
              nodes: nodes.length,
            };
          }),
        );
        if (!c.signal.aborted) {
          setBooks(results);
          setEmpty(results.length === 0);
          setStatus(
            results.length
              ? ""
              : "아직 책장이 비어 있어요. 남긴 대화가 한 권씩 쌓여요.",
          );
        }
      } catch {
        if (!c.signal.aborted)
          setStatus(
            "책장을 불러오지 못했어요. 생각 더미에서 다시 확인해 주세요.",
          );
      }
    }
    void load();
    return () => c.abort();
  }, []);
  return (
    <section className="shelf-panel" aria-label="생각 더미 미리보기">
      <div className="panel-heading">
        <div className="panel-title-with-icon">
          <NookIcon name="pile" tone="lime" />
          <h2>생각 더미</h2>
        </div>
        <Link className="quiet-link" href="/drawer">
          전체 보기 ↗
        </Link>
      </div>
      <div className="shelf-books" hidden={!books.length}>
        {books.map((book) => (
          <Link
            key={book.id}
            href={`/drawer/${book.id}`}
            className="shelf-book"
            data-height={
              book.nodes <= 1 ? "small" : book.nodes <= 3 ? "medium" : "large"
            }
            title={book.title}
          >
            <span>{book.title}</span>
          </Link>
        ))}
      </div>
      {empty || guest ? (
        <div className="shelf-empty" role="status">
          <div className="empty-books" aria-hidden="true"><i /><i /><i /></div>
          <div><strong>{guest ? "대화를 남길 책장이에요" : "아직 책장이 비어 있어요"}</strong><p>{guest ? "로그인하면 남긴 책을 여기서 볼 수 있어요." : "남긴 대화가 한 권씩 시간순으로 쌓여요."}</p></div>
        </div>
      ) : status ? (
        <p className="shelf-status" role="status">
          {status}
        </p>
      ) : null}
    </section>
  );
}
