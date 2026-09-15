import { createHash, timingSafeEqual } from "node:crypto";

export type MaintenanceEnvironment = {
  CRON_SECRET?: string;
  NOOK_RETENTION_CRON_ENABLED?: string;
  VERCEL_ENV?: string;
};

/** The injected operation is never invoked before all execution gates pass. */
export async function runRetentionMaintenance(
  request: Request,
  environment: MaintenanceEnvironment,
  purge: () => Promise<unknown>,
): Promise<Response> {
  const reply = (status: number, code: string, deleted?: number) =>
    Response.json(
      { code, ...(deleted === undefined ? {} : { deleted }) },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  if (request.method !== "GET") return reply(405, "METHOD_NOT_ALLOWED");
  const secret = environment.CRON_SECRET;
  if (!secret || secret.length < 32) return reply(503, "NOT_CONFIGURED");
  const authorization = request.headers.get("authorization") ?? "";
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(authorization), hash(`Bearer ${secret}`)))
    return reply(401, "UNAUTHORIZED");
  if (
    environment.VERCEL_ENV !== "production" ||
    environment.NOOK_RETENTION_CRON_ENABLED !== "true"
  )
    return reply(503, "MAINTENANCE_DISABLED");
  try {
    const deleted = await purge();
    if (
      typeof deleted !== "number" ||
      !Number.isSafeInteger(deleted) ||
      deleted < 0
    )
      throw new Error("INVALID_RESULT");
    return reply(200, "RETENTION_COMPLETED", deleted);
  } catch {
    // Do not retry: an interrupted response may follow an already committed RPC.
    return reply(503, "RETENTION_FAILED_OR_UNKNOWN");
  }
}
