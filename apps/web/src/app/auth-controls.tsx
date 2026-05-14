"use client";

import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import type {
  AccountDto,
  CurrentSessionResponseDto,
  WebAuthnAuthenticationOptionsResponseDto,
  WebAuthnRegistrationOptionsResponseDto,
} from "@tsukeai/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

type AuthControlsProps = {
  initialSession: CurrentSessionResponseDto;
};

type AuthMode = "register" | "login";

export function AuthControls({ initialSession }: AuthControlsProps) {
  const router = useRouter();
  const [account, setAccount] = useState<AccountDto | undefined>(
    initialSession.authenticated ? initialSession.account : undefined,
  );
  const [mode, setMode] = useState<AuthMode>("login");
  const [panelOpen, setPanelOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshSession() {
      try {
        const response = await fetch("/api/sessions/current", {
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          return;
        }

        const session = (await response.json()) as CurrentSessionResponseDto;

        if (!cancelled) {
          setAccount(session.authenticated ? session.account : undefined);
        }
      } catch {
        // Keep the server-rendered state when session refresh is unavailable.
      }
    }

    refreshSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supported || busy) {
      return;
    }

    setBusy(true);
    setMessage(undefined);

    try {
      const optionsResponse = await postJson<WebAuthnRegistrationOptionsResponseDto>(
        "/api/auth/registration/options",
        {
          displayName,
          handle: handle || undefined,
        },
      );
      const credential = await startRegistration({
        optionsJSON: optionsResponse.options as Parameters<
          typeof startRegistration
        >[0]["optionsJSON"],
      });
      const verification = await postJson<{ account: AccountDto }>(
        "/api/auth/registration/verify",
        {
          challengeId: optionsResponse.challengeId,
          credential,
        },
      );

      setAccount(verification.account);
      setPanelOpen(false);
      setDisplayName("");
      setHandle("");
      router.refresh();
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    if (!supported || busy) {
      return;
    }

    setBusy(true);
    setMessage(undefined);

    try {
      const optionsResponse = await postJson<WebAuthnAuthenticationOptionsResponseDto>(
        "/api/auth/authentication/options",
        {},
      );
      const credential = await startAuthentication({
        optionsJSON: optionsResponse.options as Parameters<
          typeof startAuthentication
        >[0]["optionsJSON"],
      });
      const verification = await postJson<{ account: AccountDto }>(
        "/api/auth/authentication/verify",
        {
          challengeId: optionsResponse.challengeId,
          credential,
        },
      );

      setAccount(verification.account);
      setPanelOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setMessage(undefined);

    try {
      await fetch("/api/sessions/current", {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });
      setAccount(undefined);
      setPanelOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (account) {
    return (
      <div className="auth-controls">
        <span className="auth-controls__account">{account.displayName}</span>
        <button type="button" onClick={logout} disabled={busy}>
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <div className="auth-controls">
      <button
        type="button"
        onClick={() => {
          setMode("login");
          setPanelOpen((open) => (mode === "login" ? !open : true));
          setMessage(undefined);
        }}
      >
        ログイン
      </button>
      <button
        type="button"
        onClick={() => {
          setMode("register");
          setPanelOpen((open) => (mode === "register" ? !open : true));
          setMessage(undefined);
        }}
      >
        アカウント作成
      </button>
      {panelOpen ? (
        <div className="auth-panel">
          {!supported ? (
            <p role="status">このブラウザではパスキーを利用できません。</p>
          ) : mode === "login" ? (
            <div className="auth-panel__body">
              <button type="button" onClick={login} disabled={busy}>
                パスキーでログイン
              </button>
            </div>
          ) : (
            <form className="auth-panel__body" onSubmit={submitRegistration}>
              <label>
                表示名
                <input
                  name="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  maxLength={80}
                />
              </label>
              <label>
                ハンドル
                <input
                  name="handle"
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                  placeholder="任意"
                />
              </label>
              <button type="submit" disabled={busy}>
                パスキーを登録
              </button>
            </form>
          )}
          {message ? <p className="auth-panel__message">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => undefined)) as
      | { error?: { message?: string } }
      | undefined;

    throw new Error(error?.error?.message ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "認証に失敗しました。";
}
