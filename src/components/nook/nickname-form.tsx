"use client";
import { useRef, useState } from "react";
import { nicknameSchema } from "@/schemas/profile";

export function NicknameForm({ initial }: { initial: string | null }) {
  const [nickname, setNickname] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  return (
    <form
      className="nickname-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (lock.current) return;
        const parsed = nicknameSchema.safeParse(nickname);
        if (!parsed.success) {
          setNotice("1~20자의 글자, 숫자, 공백, 밑줄, 하이픈을 사용해 주세요.");
          return;
        }
        lock.current = true;
        setBusy(true);
        setNotice("");
        try {
          const response = await fetch("/api/auth/profile", {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ nickname: parsed.data }),
          });
          if (!response.ok) throw new Error();
          const body = await response.json();
          if (body.data?.nickname !== parsed.data) throw new Error();
          setSaved(parsed.data);
          setNickname(parsed.data);
          setNotice("닉네임을 저장했어요.");
        } catch {
          setNotice(
            "닉네임을 저장하지 못했어요. 연결과 로그인 상태를 확인해 주세요.",
          );
        } finally {
          lock.current = false;
          setBusy(false);
        }
      }}
    >
      <label htmlFor="nickname">닉네임</label>
      <input
        id="nickname"
        name="nickname"
        autoComplete="nickname"
        value={nickname}
        placeholder="아직 닉네임을 설정하지 않았어요"
        maxLength={20}
        disabled={busy}
        aria-describedby="nickname-help"
        onChange={(event) => setNickname(event.target.value)}
      />
      <p id="nickname-help">1~20자 · 글자, 숫자, 공백, _ 또는 -</p>
      <button type="submit" disabled={busy || nickname === saved}>
        {busy ? "저장하는 중…" : "닉네임 저장"}
      </button>
      <p role="status">{notice}</p>
    </form>
  );
}
