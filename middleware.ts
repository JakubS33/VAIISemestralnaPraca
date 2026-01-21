import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

const enc = new TextEncoder();

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  // bez tokenu -> login
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, enc.encode(secret));

    const role = payload?.role === "ADMIN" ? "ADMIN" : "USER";
    const path = req.nextUrl.pathname;

    
    if (path.startsWith("/admin") && role !== "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if ((path.startsWith("/wallets") || path.startsWith("/dashboard")) && role === "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/wallets/:path*", "/dashboard/:path*", "/admin/:path*"],
};
