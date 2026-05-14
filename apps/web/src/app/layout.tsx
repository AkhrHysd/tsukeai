import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getCurrentSession } from "../lib/current-session";
import { AppShellActions } from "./app-shell-actions";
import { AuthControls } from "./auth-controls";
import "./globals.css";

export const metadata: Metadata = {
  title: "tsukeai",
  description: "短歌の句を読み合い、LLM で形を整えるコミュニケーション",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await getCurrentSession();

  return (
    <html lang="ja">
      <body>
        <div className="app-shell">
          <AppShellActions initialSession={session} />
          <main className="main-content">{children}</main>
          <footer className="site-footer">
            <AuthControls initialSession={session} />
          </footer>
        </div>
      </body>
    </html>
  );
}
