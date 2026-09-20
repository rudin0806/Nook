import {
  authReturnPath,
  loginPath,
  signupPath,
  RETURN_COOKIE,
} from "@/lib/auth/return-path";
import { startLogin } from "@/lib/auth/start";
import { cookies } from "next/headers";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { problemResponse } from "@/lib/api/problem";
import { authOrigin, authRedirect } from "@/lib/auth/http";
import {
  FLOW_COOKIE,
  FLOW_SECONDS,
  isSameOriginPost,
  loginProvider,
} from "@/lib/auth/policy";

export async function POST(request: Request) {
  let origin: string;
  try {
    origin = authOrigin();
  } catch {
    return problemResponse({
      status: 503,
      code: "AUTH_NOT_CONFIGURED",
      message: "로그인 연결을 준비하고 있어요.",
    });
  }
  if (!isSameOriginPost(request, origin))
    return problemResponse({
      status: 403,
      code: "INVALID_ORIGIN",
      message: "이 화면에서 다시 로그인해 주세요.",
    });
  try {
    // Only a bounded provider form and allowlisted return destination are accepted.
    if (
      !request.headers
        .get("content-type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      return problemResponse({
        status: 400,
        code: "INVALID_PROVIDER",
        message: "로그인 방법을 다시 선택해 주세요.",
      });
    const reader = request.body?.getReader();
    let body = "";
    if (reader) {
      const decoder = new TextDecoder();
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 512) {
          await reader.cancel();
          return problemResponse({
            status: 400,
            code: "INVALID_PROVIDER",
            message: "로그인 방법을 다시 선택해 주세요.",
          });
        }
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
    }
    const form = new URLSearchParams(body);
    const returnTo = authReturnPath(form.get("returnTo"));
    const provider = loginProvider(form.get("provider"));
    if (!provider)
      return problemResponse({
        status: 400,
        code: "INVALID_PROVIDER",
        message: "로그인 방법을 다시 선택해 주세요.",
      });
    // 로그인과 가입이 다른 화면이 되면서 이 문도 둘로 갈린다.
    //
    // 가입은 그대로다 — 개인정보 보호법 제22조에 따라 동의는 계정이 생기기 전에
    // 받으므로, 체크를 건너뛴 클라이언트는 제공자에게도 닿지 못한다.
    //
    // 로그인은 이미 동의한 사람이 쓰는 문이라 체크박스를 다시 묻지 않는다. 대신
    // **동의를 기록하지도 않는다.** 동의 기록이 없는 채로 들어오면
    // `consentOutcome(null)`이 `reconsent`라서 홈·대화·서랍의 게이트가 그 사람을
    // `/consent`로 보낸다. 계정을 지우지 않으므로, 가입 때 기록이 실패해 기록만
    // 없는 기존 회원의 기록을 날릴 위험이 없다.
    const signup = form.get("intent") !== "login";
    if (signup && form.get("agreed") !== "on")
      return authRedirect(origin, signupPath(returnTo, "consent"));
    const supabase = await createSupabaseRouteClient();
    const result = await startLogin(supabase.auth, provider, origin);
    if (result.kind === "existing") return authRedirect(origin, returnTo);
    if (result.kind === "error")
      return authRedirect(origin, loginPath(returnTo, result.reason));
    const store = await cookies();
    store.set(RETURN_COOKIE, returnTo, {
      httpOnly: true,
      secure: origin.startsWith("https:"),
      sameSite: "lax",
      path: "/",
      maxAge: 1800,
    });
    store.set(
      FLOW_COOKIE,
      JSON.stringify({
        expectedUserId: result.expectedUserId,
        returnTo,
        agreed: signup,
        expiresAt: Date.now() + FLOW_SECONDS * 1000,
      }),
      {
        httpOnly: true,
        secure: origin.startsWith("https:"),
        sameSite: "lax",
        path: "/",
        maxAge: FLOW_SECONDS,
      },
    );
    return authRedirect(origin, result.url);
  } catch {
    return authRedirect(origin, "/login?error=start");
  }
}
