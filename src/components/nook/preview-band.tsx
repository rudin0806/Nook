import Link from "next/link";

/** 미리보기를 켠 화면 맨 위에 붙는 한 줄.
 *
 * 어느 화면에 있든 같은 자리에 같은 문장으로 있어야, 지금 보고 있는 것이 자기 기록이
 * 아니라는 사실이 화면을 옮겨도 유지된다. 끄는 길도 여기 하나만 둔다.
 */
export function PreviewBand() {
  return (
    <p className="sample-band">
      <strong>미리보기예요</strong>
      <span>· 여기 있는 기록은 저장되지 않아요</span>
      <Link href="/">미리보기 끄기 →</Link>
    </p>
  );
}
