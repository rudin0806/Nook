/** Liveness only: does not imply that Supabase or OpenAI credentials are set. */
export function GET() {
  return Response.json(
    { service: "nook", status: "ok", stage: "initialization" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
