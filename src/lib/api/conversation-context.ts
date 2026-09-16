import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  conversationSnapshotSchema,
  conversationViewSchema,
  type ConversationSnapshot,
} from "@/schemas/conversation";
import { z } from "zod";

export async function loadConversation(auth: SupabaseClient, nodeId: string) {
  z.uuid().parse(nodeId);
  const entry = await auth
    .from("question_nodes")
    .select("session_id")
    .eq("id", nodeId)
    .single();
  if (entry.error) throw new Error("CONVERSATION_NOT_FOUND");
  const sessionId = z.uuid().parse(entry.data.session_id);
  const [sr, gr, rr, mr, pr] = await Promise.all([
    auth
      .from("thought_sessions")
      .select("id,status,storage_state,past_probe_count,temporary_expires_at")
      .eq("id", sessionId)
      .single(),
    auth
      .from("segments")
      .select("id,ordinal,node_count,turn_count,branch_count,anchor_node_id")
      .eq("session_id", sessionId)
      .order("ordinal", { ascending: false })
      .limit(1)
      .single(),
    auth
      .from("conversation_runtime")
      .select(
        "version,mode,pending,last_question_type,carryover,dismissed_closure",
      )
      .eq("session_id", sessionId)
      .maybeSingle(),
    auth
      .from("messages")
      .select("id,role,kind,content,sequence_no,segment_id,created_at")
      .eq("session_id", sessionId)
      .order("sequence_no", { ascending: true })
      .limit(201),
    auth
      .from("branch_questions")
      .select("id,text,source_session_id,retention_state")
      .or(`source_session_id.eq.${sessionId},retention_state.eq.KEPT`)
      .order("created_at", { ascending: false })
      .limit(51),
  ]);
  if (sr.error || gr.error || rr.error || mr.error || pr.error)
    throw new Error("CONVERSATION_READ_FAILED");
  if (sr.data.storage_state !== "TEMPORARY")
    throw new Error("CONVERSATION_NOT_ACTIVE");
  if (
    sr.data.storage_state === "TEMPORARY" &&
    Date.parse(sr.data.temporary_expires_at) <= Date.now()
  )
    throw new Error("CONVERSATION_EXPIRED");
  const nr = await auth
    .from("question_nodes")
    .select("id,segment_id,ordinal,ai_proposed_text,final_text,approved_at")
    .eq("session_id", sessionId)
    .eq("segment_id", gr.data.id)
    .order("ordinal", { ascending: true })
    .limit(5);
  if (nr.error) throw new Error("CONVERSATION_READ_FAILED");
  const nodes = nr.data ?? [];
  if (gr.data.anchor_node_id) {
    const anchor = await auth
      .from("question_nodes")
      .select("id,segment_id,ordinal,ai_proposed_text,final_text,approved_at")
      .eq("session_id", sessionId)
      .eq("id", gr.data.anchor_node_id)
      .single();
    if (anchor.error) throw new Error("CONVERSATION_READ_FAILED");
    nodes.unshift(anchor.data);
  }
  if (!nodes.length) throw new Error("CONVERSATION_APPROVAL_REQUIRED");
  const cr = await auth
    .from("clarifications")
    .select("id,node_id,text")
    .eq("session_id", sessionId)
    .eq("status", "ACTIVE")
    .in(
      "node_id",
      nodes.map((n) => n.id),
    )
    .order("created_at", { ascending: true })
    .limit(65);
  if (cr.error) throw new Error("CONVERSATION_READ_FAILED");
  return conversationSnapshotSchema.parse({
    session: sr.data,
    segment: gr.data,
    current: nodes.at(-1),
    path: nodes,
    messages: mr.data,
    clarifications: cr.data,
    pile: pr.data,
    state:
      sr.data.status === "COMPLETED"
        ? {
            version: rr.data?.version ?? 0,
            mode: "FINISHED",
            pending: null,
            last_question_type: null,
            carryover: [],
          }
        : (rr.data ?? {
            version: 0,
            mode: "READY",
            pending: null,
            last_question_type: null,
            carryover: [],
          }),
  });
}
export function conversationView(s: ConversationSnapshot) {
  const pathSegments = new Set(s.path.map((node) => node.segment_id));
  const visibleMessages = s.messages.filter((message) =>
    pathSegments.has(message.segment_id),
  );
  const nodes = s.path.map((node) => {
    const segmentMessages = visibleMessages.filter(
      (message) => message.segment_id === node.segment_id,
    );
    const startMessage =
      node.ordinal === 1
        ? segmentMessages[0]
        : segmentMessages
            .filter(
              (message) =>
                message.kind === "SHIFT_PROPOSAL" &&
                message.content === node.ai_proposed_text &&
                Date.parse(message.created_at) <= Date.parse(node.approved_at),
            )
            .at(-1);
    if (!startMessage) throw new Error("CONVERSATION_NODE_MESSAGE_NOT_FOUND");
    return {
      id: node.id,
      question: node.final_text,
      messageId: startMessage.id,
      current: node.id === s.current.id,
    };
  });
  return conversationViewSchema.parse({
    sessionId: s.session.id,
    version: s.state.version,
    mode: s.state.mode,
    currentQuestion: s.current.final_text,
    nodes,
    pending: s.state.pending,
    messages: visibleMessages,
    clarifications: s.clarifications.slice(-3),
    branches: s.pile.filter(
      (p) =>
        p.source_session_id === s.session.id && p.retention_state === "PENDING",
    ),
  });
}
