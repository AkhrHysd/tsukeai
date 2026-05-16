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
import { type FormEvent, useEffect, useId, useState } from "react";

type AuthControlsProps = {
  initialSession: CurrentSessionResponseDto;
};

type LoginAuthControlsProps = {
  initialSession: CurrentSessionResponseDto;
};

type AuthMode = "register" | "login";
type AuthViewState = {
  account?: AccountDto;
  busy: boolean;
  displayName: string;
  handle: string;
  message?: string;
  supported: boolean;
  setDisplayName: (displayName: string) => void;
  setHandle: (handle: string) => void;
  setMessage: (message: string | undefined) => void;
  login: () => void;
  logout: () => void;
  submitRegistration: (event: FormEvent<HTMLFormElement>) => void;
};

export function AuthControls({ initialSession }: AuthControlsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [panelOpen, setPanelOpen] = useState(false);
  const auth = usePasskeyAuth({
    initialSession,
    onAuthenticated: () => {
      setPanelOpen(false);
      router.refresh();
    },
  });

  return (
    <AuthControlsView
      auth={auth}
      mode={mode}
      panelOpen={panelOpen}
      onModeChange={setMode}
      onPanelOpenChange={setPanelOpen}
    />
  );
}

export function LoginAuthControls({ initialSession }: LoginAuthControlsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const auth = usePasskeyAuth({
    initialSession,
    refreshOnMount: false,
    onAuthenticated: () => {
      router.replace("/");
      router.refresh();
    },
  });

  return <LoginAuthControlsView auth={auth} mode={mode} onModeChange={setMode} />;
}

export function AuthControlsView({
  auth,
  mode,
  panelOpen,
  onModeChange,
  onPanelOpenChange,
}: {
  auth: AuthViewState;
  mode: AuthMode;
  panelOpen: boolean;
  onModeChange: (mode: AuthMode) => void;
  onPanelOpenChange: (updater: (open: boolean) => boolean) => void;
}) {
  if (auth.account) {
    return (
      <div className="auth-controls">
        <span className="auth-controls__account">{auth.account.displayName}</span>
        <button type="button" onClick={auth.logout} disabled={auth.busy}>
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
          onModeChange("login");
          onPanelOpenChange((open) => (mode === "login" ? !open : true));
          auth.setMessage(undefined);
        }}
      >
        ログイン
      </button>
      <button
        type="button"
        onClick={() => {
          onModeChange("register");
          onPanelOpenChange((open) => (mode === "register" ? !open : true));
          auth.setMessage(undefined);
        }}
      >
        アカウント作成
      </button>
      {panelOpen ? (
        <div className="auth-panel">
          {!auth.supported ? (
            <p role="status">このブラウザではパスキーを利用できません。</p>
          ) : mode === "login" ? (
            <div className="auth-panel__body">
              <button type="button" onClick={auth.login} disabled={auth.busy}>
                パスキーでログイン
              </button>
            </div>
          ) : (
            <RegistrationFields auth={auth} className="auth-panel__body" />
          )}
          {auth.message ? <p className="auth-panel__message">{auth.message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function LoginAuthControlsView({
  auth,
  mode,
  onModeChange,
}: {
  auth: AuthViewState;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}) {
  const groupId = useId();

  return (
    <div className="login-auth">
      <fieldset className="login-auth__tabs">
        <legend className="sr-only">認証方法</legend>
        <label className="login-auth__tab">
          <input
            type="radio"
            name={`${groupId}-authMode`}
            value="login"
            checked={mode === "login"}
            onChange={() => {
              onModeChange("login");
              auth.setMessage(undefined);
            }}
          />
          <span>ログイン</span>
        </label>
        <label className="login-auth__tab">
          <input
            type="radio"
            name={`${groupId}-authMode`}
            value="register"
            checked={mode === "register"}
            onChange={() => {
              onModeChange("register");
              auth.setMessage(undefined);
            }}
          />
          <span>アカウント作成</span>
        </label>
      </fieldset>

      {!auth.supported ? (
        <p className="login-auth__message" role="status">
          このブラウザではパスキーを利用できません。
        </p>
      ) : mode === "login" ? (
        <div className="login-auth__body">
          <button
            className="login-auth__primary"
            type="button"
            onClick={auth.login}
            disabled={auth.busy}
          >
            パスキーでログイン
          </button>
        </div>
      ) : (
        <RegistrationFields
          auth={auth}
          className="login-auth__body"
          primaryClassName="login-auth__primary"
        />
      )}

      {auth.message ? (
        <p className="login-auth__message" role="alert">
          {auth.message}
        </p>
      ) : null}
    </div>
  );
}

function RegistrationFields({
  auth,
  className,
  primaryClassName,
}: {
  auth: AuthViewState;
  className: string;
  primaryClassName?: string;
}) {
  return (
    <form className={className} onSubmit={auth.submitRegistration}>
      <label>
        表示名
        <input
          name="displayName"
          value={auth.displayName}
          onChange={(event) => auth.setDisplayName(event.target.value)}
          required
          maxLength={80}
        />
      </label>
      <label>
        ハンドル
        <input
          name="handle"
          value={auth.handle}
          onChange={(event) => auth.setHandle(event.target.value)}
          placeholder="任意"
        />
      </label>
      <button className={primaryClassName} type="submit" disabled={auth.busy}>
        パスキーを登録
      </button>
    </form>
  );
}

function usePasskeyAuth({
  initialSession,
  onAuthenticated,
  refreshOnMount = true,
}: {
  initialSession: CurrentSessionResponseDto;
  onAuthenticated?: (account: AccountDto) => void;
  refreshOnMount?: boolean;
}) {
  const router = useRouter();
  const [account, setAccount] = useState<AccountDto | undefined>(
    initialSession.authenticated ? initialSession.account : undefined,
  );
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  useEffect(() => {
    if (!refreshOnMount) {
      return;
    }

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
  }, [refreshOnMount]);

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
      setDisplayName("");
      setHandle("");
      onAuthenticated?.(verification.account);
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
      onAuthenticated?.(verification.account);
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
      router.refresh();
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return {
    account,
    busy,
    displayName,
    handle,
    login,
    logout,
    message,
    setDisplayName,
    setHandle,
    setMessage,
    submitRegistration,
    supported,
  };
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
