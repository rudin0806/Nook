import { EmptyArt } from "./empty-art";

/** 미리보기로 들어온 생각 더미.
 *
 * 표본 목록을 지어 넣지 않는다. 미리보기는 아직 아무것도 쓰지 않은 사람이 보는
 * 화면이고, 그 사람의 더미는 실제로 비어 있다. 가짜 기록을 채워 두면 처음 쓴 뒤에
 * 화면이 줄어든 것처럼 보인다.
 */
export function PreviewDrawerEmpty() {
  return (
    <div className="collection-empty">
      <EmptyArt kind="books" />
      <strong>아직 쌓인 이야기가 없어요</strong>
      <p>대화를 남기면 한 권씩 여기에 모여요.</p>
    </div>
  );
}
