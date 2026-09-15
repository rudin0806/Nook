import "server-only";
import { NextResponse } from "next/server";
import { deploymentOrigin } from "./policy";

export function authOrigin() {
  return deploymentOrigin({
    NOOK_SITE_URL: process.env.NOOK_SITE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
  });
}
export function authRedirect(origin: string, path: string) {
  const response = NextResponse.redirect(new URL(path, origin), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
