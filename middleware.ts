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
    await jwtVerify(token, enc.encode(secret));
    return NextResponse.next();
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/wallets/:path*", "/dashboard/:path*"],
};
