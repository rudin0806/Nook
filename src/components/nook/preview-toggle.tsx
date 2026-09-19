import Link from "next/link";

/** 미리보기를 켜고 끄는 한 개의 스위치.
 *
 * 상태를 주소에 두므로 링크 하나면 된다 — 자바스크립트가 아직 안 붙었어도 눌리고,
 * 새로고침해도 유지되며, 깊은 화면으로 그대로 따라간다. 같은 자리에서 켜고 끄기
 * 때문에 켠 사람이 끄는 길을 찾지 못하는 일이 없다.
 */
export function PreviewToggle({ on }: { on: boolean }) {
  return (
    <p className="preview-toggle">
      <Link href={on ? "/" : "/?preview=1"} aria-pressed={on}>
        {on ? "미리보기 끄기" : "써 보면 어떤 화면인지 미리보기"}
      </Link>
    </p>
  );
}
