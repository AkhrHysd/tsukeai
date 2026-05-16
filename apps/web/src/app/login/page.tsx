import { redirect } from "next/navigation";
import { getCurrentSession } from "../../lib/current-session";
import { LoginAuthControls } from "../auth-controls";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session.authenticated) {
    redirect("/");
  }

  return (
    <main className="login-page" aria-labelledby="login-title">
      <section className="login-page__inner">
        <h1 id="login-title" className="login-page__title">
          tsukeai
        </h1>
        <LoginAuthControls initialSession={session} />
      </section>
    </main>
  );
}
