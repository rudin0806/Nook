"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { savedSessionListItemSchema } from "@/schemas/retention";
import { NookIcon } from "./nook-icon";
import { previewBooks } from "@/lib/example/preview";
type Book = { id: string; title: string; nodes: number };
export function ShelfPreview({ preview = false }: { preview?: boolean }) {
  const [guest, setGuest] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [loaded, setLoaded] = useState<Book[]>([]);
  const [status, setStatus] = useState("책장을 불러오고 있어요.");
  // 표본을 상태에 복사하면 안 된다. 토글은 클라이언트 내비게이션이라 이 컴포넌트가
  // 다시 마운트되지 않고, 초기값은 첫 마운트에서만 쓰여 미리보기를 켜도 옛 상태가
  // 그대로 남는다. 무엇을 그릴지는 매번 props에서 고른다.
  const books = preview ? previewBooks : loaded;
  useEffect(() => {
    if (preview) return;
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
        // 예전에는 책마다 story 전문을 따로 받아 마지막 질문을 꺼냈다. 책 네 권이면
        // 요청이 다섯 번이었고 그중 넷은 제목 한 줄을 얻으려고 대화 전체를 끌어왔다.
        // 이제 목록이 질문을 함께 준다.
        const results = data.items.map((item) => ({
          id: item.id,
          title: item.question ?? "남긴 생각",
          nodes: item.node_count,
        }));
        if (!c.signal.aborted) {
          setLoaded(results);
          setEmpty(results.length === 0);
          setStatus(
            results.length
              ? ""
              : "아직 책장이 비어 있어요. 대화를 남기면 책으로 표시해요.",
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
  }, [preview]);
  return (
    <section className="shelf-panel" aria-label="생각 더미 미리보기">
      <div className="panel-heading">
        <div className="panel-title-with-icon">
          <NookIcon name="pile" tone="lime" tile />
          <h2>생각 더미</h2>
        </div>
        <Link
          className="quiet-link"
          href={preview ? "/drawer?preview=1" : "/drawer"}
        >
          전체 보기
        </Link>
      </div>
      <div className="shelf-books" hidden={!books.length}>
        {books.map((book, index) => (
          <Link
            key={book.id}
            href={preview ? "/drawer?preview=1" : `/drawer/${book.id}`}
            className="shelf-book"
            // 서랍의 책과 같은 여덟 색을 돌려 쓴다. 자리로 색이 정해지므로
            // 책장 순서를 바꾸면 색도 함께 따라온다.
            data-tone={(index % 8) + 1}
            data-height={
              book.nodes <= 1 ? "small" : book.nodes <= 3 ? "medium" : "large"
            }
            title={book.title}
            aria-label={`${book.title} 펼쳐보기`}
          >
            {/* 홈의 책등은 46×78px이라 13px 세로쓰기로 다섯 글자 자리다. 한국어
                문장을 다섯 글자로 자르면 무엇을 써도 토막이 되므로 번호만 둔다.
                제목은 가리켰을 때와 읽어 주는 기계에 남는다. */}
            <span className="shelf-book-number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
          </Link>
        ))}
      </div>
      {!preview && (empty || guest) ? (
        <div className="shelf-empty">
          <div className="empty-books" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div>
            <strong>
              {guest ? "남긴 대화를 모아보세요" : "아직 책장이 비어 있어요"}
            </strong>
            <p role="status">
              {guest
                ? "로그인하면 이곳에서 다시 볼 수 있어요."
                : "대화를 남기면 이곳에 책으로 표시해요."}
            </p>
            {guest ? (
              <Link className="shelf-cta" href="/login">
                계정 연결하기
              </Link>
            ) : null}
          </div>
        </div>
      ) : !preview && status ? (
        <p className="shelf-status" role="status">
          {status}
        </p>
      ) : null}
    </section>
  );
}
