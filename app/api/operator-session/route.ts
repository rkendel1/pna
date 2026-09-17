import { NextRequest, NextResponse } from "next/server";
import { demoSessionCookie } from "@/lib/demo-auth";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;

  if (!origin || origin !== requestOrigin) {
    return Response.json({ error: "A same-origin browser session is required to enable operator mode." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(demoSessionCookie.name, demoSessionCookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}
