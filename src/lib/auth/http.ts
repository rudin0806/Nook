import "server-only";
import { NextResponse } from "next/server";
import { siteOrigin } from "./policy";

export function authOrigin() {
  return siteOrigin(process.env.NOOK_SITE_URL);
}
export function authRedirect(origin: string, path: string) {
  const response = NextResponse.redirect(new URL(path, origin), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
