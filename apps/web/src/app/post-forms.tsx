"use client";

import type { EntityId, TransformJobResponseDto } from "@tsukeai/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, type Ref, useCallback, useEffect, useRef, useState } from "react";
import { markTimelineRefreshNeeded } from "./timeline-refresh-on-return";

type TransformKind = "post_575" | "reply_77";
type WriteTarget = "post" | "reply";
type ComposerVariant = "inline" | "sheet";
export type WriteActionState = {
  status: "idle" | "pending" | "success" | "error";
  message: string;
  jobId?: EntityId;
  target?: WriteTarget;
  canRetry?: boolean;
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
  error?: { message?: unknown; userAction?: unknown; retryPolicy?: unknown };
  job?: { error?: { message?: unknown; userAction?: unknown; retryPolicy?: unknown } };
};

const initialWriteActionState: WriteActionState = {
  status: "idle",
  message: "",
};

export function PostComposer({ variant = "inline" }: { variant?: ComposerVariant }) {
  const router = useRouter();
  const [state, setState] = useState(initialWriteActionState);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const onSuccess = useCallback(() => formRef.current?.reset(), []);
  const feedbackState = useTransformJobFeedback(
    state,
    variant === "sheet" ? router : undefined,
    onSuccess,
  );
  const formDisabled = busy || feedbackState.status === "pending";

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitWrite(event.currentTarget, "/api/posts", "post_575", "post", setState, setBusy);
  }

  async function retryPost() {
    if (!formRef.current) {
      return;
    }

    await submitWrite(formRef.current, "/api/posts", "post_575", "post", setState, setBusy);
  }

  return (
    <ComposerForm
      ref={formRef}
      ariaLabel="投稿"
      label="五七五に変換したい内容を入力"
      inputId="post-body"
      rows={8}
      placeholder="五七五に変換したい内容"
      submitLabel="投稿"
      busyLabel="投稿中..."
      busy={busy}
      disabled={formDisabled}
      state={feedbackState}
      onSubmit={submitPost}
      onRetry={retryPost}
    />
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
  const formRef = useRef<HTMLFormElement>(null);
  const onSuccess = useCallback(() => formRef.current?.reset(), []);
  const feedbackState = useTransformJobFeedback(
    state,
    variant === "sheet" ? router : undefined,
    onSuccess,
  );
  const formDisabled = busy || feedbackState.status === "pending";
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

  async function retryReply() {
    if (!formRef.current) {
      return;
    }

    await submitWrite(
      formRef.current,
      `/api/posts/${postId}/replies`,
      "reply_77",
      "reply",
      setState,
      setBusy,
    );
  }

  return (
    <ComposerForm
      ref={formRef}
      ariaLabel="返信"
      label="七七に変換したい内容を入力"
      inputId={inputId}
      rows={6}
      placeholder="七七に変換したい内容"
      submitLabel="返信"
      busyLabel="返信中..."
      busy={busy}
      disabled={formDisabled}
      state={feedbackState}
      onSubmit={submitReply}
      onRetry={retryReply}
    />
  );
}

export function ComposerForm({
  ref,
  ariaLabel,
  label,
  inputId,
  rows,
  placeholder,
  submitLabel,
  busyLabel,
  busy,
  disabled,
  state,
  onSubmit,
  onRetry,
}: {
  ref?: Ref<HTMLFormElement>;
  ariaLabel: string;
  label: string;
  inputId: string;
  rows: number;
  placeholder: string;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  disabled: boolean;
  state: WriteActionState;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRetry: () => void;
}) {
  return (
    <form ref={ref} className="composer" onSubmit={onSubmit} aria-label={ariaLabel}>
      <label htmlFor={inputId}>{label}</label>
      <textarea
        id={inputId}
        name="body"
        rows={rows}
        required
        disabled={disabled}
        placeholder={placeholder}
      />
      <button type="submit" disabled={disabled}>
        {busy ? busyLabel : state.status === "pending" ? "変換中..." : submitLabel}
      </button>
      <WriteMessage state={state} busy={disabled} onRetry={onRetry} />
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

    if (result.status === "success") {
      form.reset();
    }
  } catch (error) {
    setState({
      status: "error",
      message: toErrorMessage(error),
      canRetry: isRetryableWriteError(error),
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

    throw new ApiRequestError(
      message,
      isRetryableApiErrorBody(parseJsonResponse<ApiErrorBody>(responseText)),
    );
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

function WriteMessage({
  state,
  busy,
  onRetry,
}: {
  state: WriteActionState;
  busy: boolean;
  onRetry: () => void;
}) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <div className={`write-feedback write-feedback--${state.status}`}>
      <p
        className={`write-message write-message--${state.status}`}
        role={state.status === "error" ? "alert" : "status"}
      >
        {state.message}
      </p>
      {state.status === "error" && state.canRetry ? (
        <button className="write-retry" type="button" disabled={busy} onClick={onRetry}>
          再試行
        </button>
      ) : null}
    </div>
  );
}

type AppRouter = ReturnType<typeof useRouter>;

function useTransformJobFeedback(
  actionState: WriteActionState,
  sheetRouter?: AppRouter,
  onSuccess?: () => void,
) {
  const router = useRouter();
  const [feedbackState, setFeedbackState] = useState(actionState);
  const onSuccessRef = useRef(onSuccess);
  const handledImmediateSuccessRef = useRef(false);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  useEffect(() => {
    setFeedbackState(actionState);
  }, [actionState]);

  useEffect(() => {
    if (actionState.status !== "success") {
      handledImmediateSuccessRef.current = false;
      return;
    }

    if (handledImmediateSuccessRef.current) {
      return;
    }

    handledImmediateSuccessRef.current = true;
    onSuccessRef.current?.();

    if (sheetRouter) {
      markTimelineRefreshNeeded();
      sheetRouter.back();
    } else {
      router.refresh();
    }
  }, [actionState.status, router, sheetRouter]);

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
          onSuccessRef.current?.();
          setFeedbackState({
            status: "success",
            message: actionState.target === "reply" ? "返信しました。" : "投稿しました。",
          });
          if (sheetRouter) {
            markTimelineRefreshNeeded();
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
            canRetry: body.job.error?.userAction === "retry_later",
          });
          return;
        }

        if (attempts >= 40) {
          setFeedbackState({
            status: "error",
            message: "変換が完了しませんでした。時間をおいて再度お試しください。",
            canRetry: true,
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
            canRetry: true,
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
  }, [actionState, router, sheetRouter]);

  return feedbackState;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "投稿に失敗しました。";
}

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function isRetryableWriteError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.retryable;
}

function isRetryableApiErrorBody(body: ApiErrorBody | undefined): boolean {
  const error = body?.job?.error ?? body?.error;

  return error?.userAction === "retry_later" || error?.retryPolicy === "server_retryable";
}
