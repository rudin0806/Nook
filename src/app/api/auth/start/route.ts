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
    // Only a tiny urlencoded provider form is accepted; no arbitrary return URL.
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
        if (size > 100) {
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
    const provider = loginProvider(new URLSearchParams(body).get("provider"));
    if (!provider)
      return problemResponse({
        status: 400,
        code: "INVALID_PROVIDER",
        message: "로그인 방법을 다시 선택해 주세요.",
      });
    const supabase = await createSupabaseRouteClient();
    const result = await startLogin(supabase.auth, provider, origin);
    if (result.kind === "existing") return authRedirect(origin, "/drawer");
    if (result.kind === "error")
      return authRedirect(origin, `/login?error=${result.reason}`);
    const store = await cookies();
    store.set(
      FLOW_COOKIE,
      JSON.stringify({
        expectedUserId: result.expectedUserId,
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
