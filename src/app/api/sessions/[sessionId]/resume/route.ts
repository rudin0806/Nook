import { z } from "zod";
import { withAuthenticatedSupabase } from "@/lib/api/authenticated-handler";
import { dataResponse, problemResponse } from "@/lib/api/problem";
import { RetentionDatabaseError } from "@/lib/supabase/retention";
import { createAdmissionContext } from "@/lib/api/ai-admission";
import { proposalResponse } from "@/engine/start-request";
import { storedStartResultSchema } from "@/schemas/recovery";
export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const id = z.uuid().safeParse((await context.params).sessionId);
  if (!id.success)
    return problemResponse({
      status: 400,
      code: "INVALID_SESSION_ID",
      message: "기록을 확인해 주세요.",
    });
  return withAuthenticatedSupabase(async (client) => {
    const settled = await client.rpc("settle_own_retention");
    if (settled.error) throw new RetentionDatabaseError(settled.error.message);
    const readParent = () =>
      client
        .from("thought_sessions")
        .select("id,user_id,status,storage_state,temporary_expires_at")
        .eq("id", id.data)
        .single();
    const parent = await readParent();
    if (
      parent.error ||
      !parent.data ||
      !["ACTIVE", "COMPLETED"].includes(parent.data.status)
    )
      throw new RetentionDatabaseError("SESSION_NOT_FOUND");
    const s = parent.data;
    if (s.storage_state === "SAVED")
      return dataResponse({ kind: "saved", sessionId: s.id });
    if (s.storage_state === "TRASHED") return dataResponse({ kind: "trash" });
    if (Date.parse(s.temporary_expires_at) <= Date.now())
      throw new RetentionDatabaseError("SESSION_NOT_FOUND");
    const retentionRequested =
      new URL(request.url).searchParams.get("retention") === "1";
    if (retentionRequested || s.status === "COMPLETED") {
      const branches = await client
        .from("branch_questions")
        .select("id,text")
        .eq("source_session_id", s.id)
        .eq("retention_state", "PENDING")
        .limit(50);
      if (branches.error) throw new Error("RECOVERY_QUERY_FAILED");
      return dataResponse({
        kind: "retention",
        sessionId: s.id,
        branches: branches.data,
      });
    }
    const nodes = await client
      .from("question_nodes")
      .select("id")
      .eq("session_id", s.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (nodes.error) throw new Error("RECOVERY_QUERY_FAILED");
    if (nodes.data.length)
      return dataResponse({ kind: "talk", nodeId: nodes.data[0].id });
    const context = await createAdmissionContext();
    if (context.userId !== s.user_id)
      throw new RetentionDatabaseError("SESSION_NOT_FOUND");
    const draft = await context.admin
      .from("start_drafts")
      .select("message_id,result")
      .eq("session_id", s.id)
      .maybeSingle();
    if (draft.error) throw new Error("RECOVERY_QUERY_FAILED");
    const raw = await client
      .from("messages")
      .select("content")
      .eq("session_id", s.id)
      .eq("kind", "RAW_THOUGHT")
      .eq("role", "USER")
      .single();
    if (raw.error) throw new Error("RECOVERY_QUERY_FAILED");
    const again = await readParent();
    if (
      again.error ||
      again.data.status !== "ACTIVE" ||
      again.data.storage_state !== "TEMPORARY" ||
      Date.parse(again.data.temporary_expires_at) <= Date.now()
    )
      throw new RetentionDatabaseError("SESSION_NOT_FOUND");
    if (!draft.data)
      return dataResponse({ kind: "legacy", thought: raw.data.content });
    const result = storedStartResultSchema.parse(draft.data.result);
    return dataResponse({
      kind: "draft",
      thought: raw.data.content,
      result: proposalResponse(
        {
          userId: s.user_id,
          sessionId: s.id,
          messageId: draft.data.message_id,
          expiresAt: Date.parse(again.data.temporary_expires_at),
        },
        result,
        context.secret,
      ),
    });
  });
}
