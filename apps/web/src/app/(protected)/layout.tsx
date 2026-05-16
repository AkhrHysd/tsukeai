import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentSession } from "../../lib/current-session";
import { AppShellActions } from "../app-shell-actions";
import { AuthControls } from "../auth-controls";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await getCurrentSession();

  if (!session.authenticated) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <AppShellActions initialSession={session} />
      <main className="main-content">{children}</main>
      <footer className="site-footer">
        <AuthControls initialSession={session} />
      </footer>
    </div>
  );
}
