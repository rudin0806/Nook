import { withAuthenticatedSupabase } from "@/lib/api/authenticated-handler";
import { dataResponse, problemResponse } from "@/lib/api/problem";
import { deleteKeptBranchQuestion } from "@/lib/supabase/retention";
import { branchQuestionIdSchema } from "@/schemas/retention";

type RouteContext = {
  params: Promise<{ branchQuestionId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { branchQuestionId: candidate } = await context.params;
  const branchQuestionId = branchQuestionIdSchema.safeParse(candidate);
  if (!branchQuestionId.success) {
    return problemResponse({
      status: 400,
      code: "INVALID_BRANCH_QUESTION_ID",
      message: "질문 식별자를 확인해 주세요.",
    });
  }

  return withAuthenticatedSupabase(async (supabase) => {
    await deleteKeptBranchQuestion(supabase, branchQuestionId.data);
    return dataResponse({ branchQuestionId: branchQuestionId.data });
  });
}
