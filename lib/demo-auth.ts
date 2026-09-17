import type { NextRequest } from "next/server";

const DEMO_SESSION_COOKIE = "id8-demo-session";
const DEMO_SESSION_VALUE = "demo-operator";

export function ensureDemoSessionCookie(request: NextRequest) {
  return request.cookies.get(DEMO_SESSION_COOKIE)?.value === DEMO_SESSION_VALUE;
}

export function authorizeSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;

  if (!origin) {
    return "A same-origin browser session is required for this request.";
  }

  if (origin !== requestOrigin) {
    return "Cross-origin requests are not allowed.";
  }

  return null;
}

export function authorizeDemoMutation(request: NextRequest) {
  const sameOriginError = authorizeSameOriginRequest(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  if (!ensureDemoSessionCookie(request)) {
    return "An authorized demo session is required for durable state changes.";
  }

  return null;
}

export const demoSessionCookie = {
  name: DEMO_SESSION_COOKIE,
  value: DEMO_SESSION_VALUE,
};
