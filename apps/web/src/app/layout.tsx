import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tanka Reply SNS",
  description: "短歌で返信する公開タイムライン",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
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
                <span>Tanka Reply SNS</span>
              </a>
              <nav className="site-nav" aria-label="主要ナビゲーション">
                <a href="/">タイムライン</a>
                <a href="/">投稿</a>
                <a href="/">ログイン</a>
              </nav>
            </div>
          </header>
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
