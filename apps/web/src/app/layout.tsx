import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getCurrentSession } from "../lib/current-session";
import { AuthControls } from "./auth-controls";
import "./globals.css";

export const metadata: Metadata = {
  title: "tsukeai",
  description: "短歌の句を読み合い、LLM で形を整えるコミュニケーション",
};

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
          <header className="site-header">
            <div className="site-header__inner">
              <a className="brand" href="/">
                <span className="brand__mark" aria-hidden="true">
                  た
                </span>
                <span>tsukeai</span>
              </a>
              <nav className="site-nav" aria-label="主要ナビゲーション">
                <a href="/">タイムライン</a>
                <a href="/">投稿</a>
              </nav>
              <AuthControls initialSession={session} />
            </div>
          </header>
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
