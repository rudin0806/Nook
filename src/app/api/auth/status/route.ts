import { readNickname } from "@/schemas/profile";
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const client = await createSupabaseRouteClient();
    const { data, error } = await client.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError")
      return NextResponse.json(
        { state: "unavailable" },
        { status: 503, headers },
      );
    return NextResponse.json(
      {
        anonymousEnabled: process.env.NOOK_ANONYMOUS_SIGN_IN_ENABLED === "true",
        userId: data.user?.id ?? null,
        nickname: readNickname(data.user?.user_metadata.nickname),
        state:
          data.user && !data.user.is_anonymous ? "signed_in" : "signed_out",
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { state: "unavailable" },
      { status: 503, headers },
    );
  }
}
