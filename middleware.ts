import { NextResponse, type NextRequest } from "next/server";
import { demoSessionCookie } from "@/lib/demo-auth";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.get(demoSessionCookie.name)) {
    response.cookies.set(demoSessionCookie.name, demoSessionCookie.value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
