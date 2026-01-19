// app/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import "./globals.css";

import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { LogoutButton } from "@/app/components/LogoutButton";

export const metadata: Metadata = {
  title: "My Finance Hub",
  description: "Simple way to see your real financial picture",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const userId = token ? verifySessionToken(token) : null;

  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, role: true },
      })
    : null;

  return (
    <html lang="sk">
      <body>
        <header className="main-header">
          <div className="header-inner container">
            <Link href="/" className="logo">
              My Finance Hub
            </Link>

            <nav className="main-nav">
              {user ? (
                <>
                  <Link href="/dashboard" className="nav-link">
                    Dashboard
                  </Link>

                  <Link href="/wallets" className="nav-link">
                    Wallets
                  </Link>

                  <Link href="/analytics" className="nav-link">
                    Analytics
                  </Link>

                  <Link href="/account" className="nav-link">
                    Account
                  </Link>

                  {user.role === "ADMIN" ? (
                    <Link href="/admin" className="nav-link">
                      Admin
                    </Link>
                  ) : null}

                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <span className="nav-link" style={{ opacity: 0.85 }}>
                      {user.email}
                    </span>
                    <LogoutButton />
                  </div>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className="nav-link">
                    Sign in
                  </Link>
                  <Link href="/auth/register" className="nav-link nav-link--cta">
                    Create account
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="page-content container">{children}</main>

        <footer className="main-footer">
          <div className="container">
            <small>© {new Date().getFullYear()} My Finance Hub</small>
          </div>
        </footer>
      </body>
    </html>
  );
}
