import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /dashboard and all nested routes under /dashboard
  if (pathname.startsWith("/dashboard")) {
    const authCookie = request.cookies.get("loglens_auth")?.value;

    if (!authCookie || authCookie !== "true") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
