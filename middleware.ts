import { NextResponse, type NextRequest } from "next/server";
import { demoSessionCookie } from "@/lib/demo-auth";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const current = request.cookies.get(demoSessionCookie.name)?.value;

  if (current !== demoSessionCookie.value) {
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
