"use client";

import type { EntityId, TransformJobResponseDto } from "@tsukeai/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

type TransformKind = "post_575" | "reply_77";
type WriteTarget = "post" | "reply";
type ComposerVariant = "inline" | "sheet";
type WriteActionState = {
  status: "idle" | "pending" | "success" | "error";
  message: string;
  jobId?: EntityId;
  target?: WriteTarget;
};
type PublishedWriteResponse = {
  post?: unknown;
  reply?: unknown;
};
type ApiResponse<T> = {
  status: number;
  body: T | undefined;
};
type ApiErrorBody = {
  error?: { message?: unknown };
  job?: { error?: { message?: unknown } };
};

const initialWriteActionState: WriteActionState = {
  status: "idle",
  message: "",
};

export function PostComposer({ variant = "inline" }: { variant?: ComposerVariant }) {
  const router = useRouter();
  const [state, setState] = useState(initialWriteActionState);
  const [busy, setBusy] = useState(false);
  const feedbackState = useTransformJobFeedback(state, variant === "sheet" ? router : undefined);

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitWrite(event.currentTarget, "/api/posts", "post_575", "post", setState, setBusy);
  }

  return (
    <form className="composer" onSubmit={submitPost} aria-label="投稿">
      <label htmlFor="post-body">五七五に変換したい内容を入力</label>
      <textarea
        id="post-body"
        name="body"
        rows={8}
        required
        disabled={busy}
        placeholder="五七五に変換したい内容"
      />
      <button type="submit" disabled={busy}>
        {busy ? "投稿中..." : "投稿"}
      </button>
      <WriteMessage state={feedbackState} />
    </form>
  );
}

export function ReplyComposer({
  postId,
  variant = "inline",
}: {
  postId: EntityId;
  variant?: ComposerVariant;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialWriteActionState);
  const [busy, setBusy] = useState(false);
  const feedbackState = useTransformJobFeedback(state, variant === "sheet" ? router : undefined);
  const inputId = `reply-body-${postId}`;

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitWrite(
      event.currentTarget,
      `/api/posts/${postId}/replies`,
      "reply_77",
      "reply",
      setState,
      setBusy,
    );
  }

  return (
    <form className="composer" onSubmit={submitReply} aria-label="返信">
      <label htmlFor={inputId}>七七に変換したい内容を入力</label>
      <textarea
        id={inputId}
        name="body"
        rows={6}
        required
        disabled={busy}
        placeholder="七七に変換したい内容"
      />
      <button type="submit" disabled={busy}>
        {busy ? "返信中..." : "返信"}
      </button>
      <WriteMessage state={feedbackState} />
    </form>
  );
}

async function submitWrite(
  form: HTMLFormElement,
  path: string,
  kind: TransformKind,
  target: WriteTarget,
  setState: (state: WriteActionState) => void,
  setBusy: (busy: boolean) => void,
) {
  if (form.dataset.busy === "true") {
    return;
  }

  form.dataset.busy = "true";
  setBusy(true);
  setState(initialWriteActionState);

  try {
    const result = await requestWrite(path, kind, target, new FormData(form));

    setState(result);

    if (result.status === "success" || result.status === "pending") {
      form.reset();
    }
  } catch (error) {
    setState({
      status: "error",
      message: toErrorMessage(error),
    });
  } finally {
    delete form.dataset.busy;
    setBusy(false);
  }
}

async function requestWrite(
  path: string,
  kind: TransformKind,
  target: WriteTarget,
  formData: FormData,
): Promise<WriteActionState> {
  const input = formData.get("body");

  if (typeof input !== "string" || input.trim().length === 0) {
    return {
      status: "error",
      message: "本文を入力してください。",
    };
  }

  const response = await requestApi<PublishedWriteResponse | TransformJobResponseDto>(path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      kind,
      input,
      clientKey: crypto.randomUUID(),
    }),
  });

  return toWriteActionState(response, target);
}

async function requestApi<T>(path: string, init: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
  });
  const responseText = await response.text().catch(() => undefined);

  if (!response.ok) {
    let message = `リクエストに失敗しました（${response.status}）。`;

    try {
      const body = JSON.parse(responseText ?? "") as ApiErrorBody;
      const errorMessage = body.error?.message ?? body.job?.error?.message;

      if (typeof errorMessage === "string" && errorMessage.length > 0) {
        message = errorMessage;
      }
    } catch {
      // Keep the status-only message when the API does not return JSON.
    }

    throw new Error(message);
  }

  return {
    status: response.status,
    body: parseJsonResponse<T>(responseText),
  };
}

function parseJsonResponse<T>(responseText: string | undefined): T | undefined {
  if (!responseText) {
    return undefined;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    return undefined;
  }
}

function toWriteActionState(
  response: ApiResponse<PublishedWriteResponse | TransformJobResponseDto>,
  target: WriteTarget,
): WriteActionState {
  const body = response.body;
  const successMessage = target === "post" ? "投稿しました。" : "返信しました。";

  if (isPublishedWriteResponse(body, target) || isSucceededTransformJob(body, target)) {
    return {
      status: "success",
      message: successMessage,
    };
  }

  if (response.status === 202 || isActiveTransformJob(body)) {
    return {
      status: "pending",
      message: "変換中です。完了するとタイムラインに反映されます。",
      ...(isTransformJobResponse(body) ? { jobId: body.job.id } : {}),
      target,
    };
  }

  return {
    status: "success",
    message: successMessage,
  };
}

function isPublishedWriteResponse(
  body: PublishedWriteResponse | TransformJobResponseDto | undefined,
  target: WriteTarget,
): body is PublishedWriteResponse {
  if (!body || typeof body !== "object" || !("job" in body)) {
    return target === "post" ? Boolean(body?.post) : Boolean(body?.reply);
  }

  return false;
}

function isSucceededTransformJob(
  body: PublishedWriteResponse | TransformJobResponseDto | undefined,
  target: WriteTarget,
) {
  if (!isTransformJobResponse(body)) {
    return false;
  }

  return (
    body.job.state === "succeeded" ||
    (target === "post" ? Boolean(body.job.publishedPostId) : Boolean(body.job.publishedReplyId))
  );
}

function isActiveTransformJob(body: PublishedWriteResponse | TransformJobResponseDto | undefined) {
  if (!isTransformJobResponse(body)) {
    return false;
  }

  return body.job.state === "queued" || body.job.state === "processing";
}

function isTransformJobResponse(
  body: PublishedWriteResponse | TransformJobResponseDto | undefined,
): body is TransformJobResponseDto {
  return Boolean(body && typeof body === "object" && "job" in body);
}

function WriteMessage({ state }: { state: WriteActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <p
      className={`write-message write-message--${state.status}`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

type AppRouter = ReturnType<typeof useRouter>;

function useTransformJobFeedback(actionState: WriteActionState, sheetRouter?: AppRouter) {
  const router = useRouter();
  const [feedbackState, setFeedbackState] = useState(actionState);

  useEffect(() => {
    setFeedbackState(actionState);
  }, [actionState]);

  useEffect(() => {
    if (actionState.status !== "pending" || !actionState.jobId) {
      return;
    }

    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function pollJob() {
      attempts += 1;

      try {
        const response = await fetch(`/api/transform-jobs/${actionState.jobId}`, {
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Transform job lookup failed with ${response.status}`);
        }

        const body = (await response.json()) as TransformJobResponseDto;

        if (body.job.state === "succeeded") {
          setFeedbackState({
            status: "success",
            message: actionState.target === "reply" ? "返信しました。" : "投稿しました。",
          });
          if (sheetRouter) {
            sheetRouter.back();
          } else {
            router.refresh();
          }
          return;
        }

        if (body.job.state === "failed" || body.job.state === "rejected") {
          setFeedbackState({
            status: "error",
            message:
              body.job.error?.message ??
              "変換に失敗しました。内容を見直してもう一度お試しください。",
          });
          router.refresh();
          return;
        }

        if (attempts >= 40) {
          setFeedbackState({
            status: "error",
            message: "変換が完了しませんでした。時間をおいて再度お試しください。",
          });
          return;
        }

        timeoutId = setTimeout(pollJob, 1500);
      } catch {
        if (abortController.signal.aborted) {
          return;
        }

        if (attempts >= 3) {
          setFeedbackState({
            status: "error",
            message: "変換状態を確認できませんでした。時間をおいて再度お試しください。",
          });
          return;
        }

        timeoutId = setTimeout(pollJob, 1500);
      }
    }

    timeoutId = setTimeout(pollJob, 1500);

    return () => {
      abortController.abort();

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [actionState, router]);

  return feedbackState;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "投稿に失敗しました。";
}
