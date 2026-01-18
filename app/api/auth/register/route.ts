export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const email = (body.email ?? "").toString().trim().toLowerCase();
  const password = (body.password ?? "").toString();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password must have at least 6 characters." }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email already used." }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hash },
    select: { id: true, email: true },
  });

  const token = signSessionToken(user.id);

  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
