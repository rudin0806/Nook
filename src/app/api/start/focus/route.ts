import { handleAIRequest } from "@/lib/api/ai-http";
import { selectStartFocus } from "@/lib/api/start";
import { focusRequestSchema } from "@/schemas/start-api";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  return handleAIRequest(request, focusRequestSchema, selectStartFocus);
}
