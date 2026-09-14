import { ZodError, ZodType } from "zod";

const MAX_JSON_BYTES = 8 * 1024;

export class RequestInputError extends Error {
  readonly code: string;
  readonly publicMessage: string;

  constructor(code: string, publicMessage: string) {
    super(code);
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export async function parseJson<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes = MAX_JSON_BYTES,
) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new RequestInputError(
      "JSON_CONTENT_TYPE_REQUIRED",
      "JSON 형식으로 요청해 주세요.",
    );
  }

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  }
  if (size > maxBytes) {
    throw new RequestInputError(
      "REQUEST_BODY_TOO_LARGE",
      "요청 데이터가 너무 커요.",
    );
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const body = new TextDecoder().decode(bytes);

  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new RequestInputError("INVALID_JSON", "JSON 형식을 확인해 주세요.");
  }

  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new RequestInputError(
        "INVALID_REQUEST",
        "요청 형식을 확인해 주세요.",
      );
    }
    throw error;
  }
}
