export type ReleaseCheck = {
  name: string;
  passed: boolean;
  status: number | null;
  reason: string;
};
/** Public GET probes only; sends no identity, secrets or user content. Not an end-to-end test. */
export async function checkRelease(
  candidate: string,
  send: typeof fetch = fetch,
): Promise<ReleaseCheck[]> {
  const url = new URL(candidate);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))
    )
  )
    throw new Error("INVALID_RELEASE_ORIGIN");
  const probes = [
    { name: "liveness", path: "/api/health", expected: 200 },
    {
      name: "restart-route",
      path: "/api/restart/node/not-a-uuid",
      expected: 400,
    },
    {
      name: "resume-route",
      path: "/api/sessions/not-a-uuid/resume",
      expected: 400,
    },
    { name: "recovery-auth-boundary", path: "/api/recovery", expected: 401 },
  ];
  return Promise.all(
    probes.map(async (p) => {
      try {
        const r = await send(url.origin + p.path, {
          method: "GET",
          redirect: "manual",
          credentials: "omit",
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        const body: unknown = await r.json();
        const record =
          body !== null && typeof body === "object"
            ? (body as Record<string, unknown>)
            : {};
        const error =
          record.error !== null && typeof record.error === "object"
            ? (record.error as Record<string, unknown>)
            : {};
        const shape =
          p.name === "liveness"
            ? record.service === "nook" && record.status === "ok"
            : typeof error.code === "string";
        const passed =
          r.status === p.expected &&
          shape &&
          (r.headers.get("cache-control") ?? "").includes("no-store");
        return {
          name: p.name,
          passed,
          status: r.status,
          reason: passed
            ? "passed"
            : r.status === 503
              ? "configuration_unavailable"
              : "unexpected_response",
        };
      } catch {
        return {
          name: p.name,
          passed: false,
          status: null,
          reason: "unavailable_or_invalid_json",
        };
      }
    }),
  );
}
