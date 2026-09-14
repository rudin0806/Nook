import { withAuthenticatedSupabase } from "@/lib/api/authenticated-handler";
import { dataResponse, problemResponse } from "@/lib/api/problem";
import { readSavedStory } from "@/lib/retention/story-query";
import { sessionIdSchema } from "@/schemas/retention";
import { storyQuerySchema } from "@/schemas/saved-story";
export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const id = sessionIdSchema.safeParse((await context.params).sessionId);
  const query = storyQuerySchema.safeParse({
    offset: new URL(request.url).searchParams.get("offset") ?? undefined,
  });
  if (!id.success || !query.success)
    return problemResponse({
      status: 400,
      code: "INVALID_QUERY",
      message: "이야기 주소를 확인해 주세요.",
    });
  return withAuthenticatedSupabase(async (client) => {
    const story = await readSavedStory(client, id.data, query.data);
    return story
      ? dataResponse(story)
      : problemResponse({
          status: 404,
          code: "SAVED_SESSION_NOT_FOUND",
          message:
            "보관 중인 이야기를 찾을 수 없어요. 생각더미에서 다시 확인해 주세요.",
        });
  });
}
