import Link from "next/link";

/** 미리보기를 켜고 끄는 자리. 화면 맨 위 한 곳뿐이다.
 *
 * 옆 단에도 같은 버튼이 있었는데, 같은 일을 하는 것이 둘이면 누르는 사람은 둘이 다른
 * 일을 한다고 읽는다. 켜는 자리와 끄는 자리가 같아야 켠 사람이 끄는 길을 찾는다.
 *
 * 켜져 있을 때는 지금 보는 것이 자기 기록이 아니라는 사실도 함께 말한다. 그 문장은
 * 미리보기일 때만 필요하므로 꺼져 있을 때는 권하는 말만 남는다.
 */
export function PreviewBand({ on }: { on: boolean }) {
  return (
    <p className="sample-band" data-on={on || undefined}>
      {on ? (
        <>
          <strong>미리보기예요</strong>
          <span>· 여기 있는 기록은 저장되지 않아요</span>
          <Link href="/">미리보기 끄기 →</Link>
        </>
      ) : (
        <>
          <span>써 보면 어떤 화면이 남는지 먼저 볼 수 있어요</span>
          <Link href="/?preview=1">미리보기 켜기 →</Link>
        </>
      )}
    </p>
  );
}
