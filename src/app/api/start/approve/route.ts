import { handleAIRequest } from "@/lib/api/ai-http";
import { approveServerStartQuestion } from "@/lib/api/start-approval";
import { getStartEnvironment } from "@/lib/env/server";
import { approvalRequestSchema } from "@/schemas/start-api";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  return handleAIRequest(request, approvalRequestSchema, (input) =>
    approveServerStartQuestion(input, getStartEnvironment().safety),
  );
}
