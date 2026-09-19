"use client";
import { SavedShelf } from "./saved-shelf";
import { previewBooks, PREVIEW_SAVED_AT } from "@/lib/example/preview";

/** 미리보기로 들어온 생각 더미.
 *
 * 처음에는 빈 화면으로 두었다. 미리보기를 켠 사람의 더미는 실제로 비어 있고, 가짜
 * 기록을 채우면 처음 쓴 뒤에 화면이 줄어든 것처럼 보인다는 이유였다. 그 걱정은 지금
 * 보는 것이 자기 기록이 아니라는 말을 화면이 하지 않고 있었기 때문에 생긴 것인데,
 * 위쪽 띠가 그 말을 하게 된 뒤로는 빈 화면이 오히려 "여기는 아무것도 없는 곳"이라고
 * 말해 버린다. 쓰면 무엇이 남는지 보여 주는 것이 미리보기의 일이다.
 *
 * 표본 전용 화면을 새로 만들지 않는다. 실제 책장 컴포넌트에 홈과 같은 표본을 넣고,
 * 책은 열리지 않게만 잠근다 — 보는 것은 되고 하는 것은 안 된다.
 */
export function PreviewDrawer() {
  return (
    <SavedShelf
      preview
      offset={0}
      items={previewBooks.map((book) => ({
        id: book.id,
        text: book.title,
        spine: book.title,
        date: PREVIEW_SAVED_AT,
        size: book.size,
      }))}
      formatDate={(value) =>
        new Date(value).toLocaleDateString("ko-KR", {
          timeZone: "Asia/Seoul",
          month: "long",
          day: "numeric",
        })
      }
    />
  );
}
