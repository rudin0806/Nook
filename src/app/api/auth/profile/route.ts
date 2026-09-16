import { withAuthenticatedSupabase } from "@/lib/api/authenticated-handler";
import { parseJson } from "@/lib/api/request";
import { dataResponse, problemResponse } from "@/lib/api/problem";
import { authOrigin } from "@/lib/auth/http";
import { profileInputSchema, readNickname } from "@/schemas/profile";

export async function PATCH(request: Request) {
  let origin: string;
  try {
    origin = authOrigin();
  } catch {
    return problemResponse({
      status: 503,
      code: "AUTH_NOT_CONFIGURED",
      message: "계정 연결을 준비하고 있어요.",
    });
  }
  if (request.headers.get("origin") !== origin)
    return problemResponse({
      status: 403,
      code: "INVALID_ORIGIN",
      message: "계정 화면에서 다시 시도해 주세요.",
    });
  return withAuthenticatedSupabase(async (client) => {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user || data.user.is_anonymous)
      return problemResponse({
        status: 403,
        code: "IDENTITY_LINK_REQUIRED",
        message: "먼저 계정을 연결해 주세요.",
      });
    const input = await parseJson(request, profileInputSchema, 512);
    // Display metadata only. Never used for authorization or ownership.
    const updated = await client.auth.updateUser({
      data: { nickname: input.nickname },
    });
    if (
      updated.error ||
      readNickname(updated.data.user?.user_metadata.nickname) !== input.nickname
    )
      return problemResponse({
        status: 503,
        code: "PROFILE_UPDATE_FAILED",
        message: "닉네임을 저장하지 못했어요. 다시 시도해 주세요.",
      });
    return dataResponse({ nickname: input.nickname });
  });
}
