"use client";

import type { TransformJobResponseDto } from "@tsukeai/shared";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import type { WriteActionState } from "./page";

type WriteAction = (
  previousState: WriteActionState,
  formData: FormData,
) => Promise<WriteActionState>;

type PostComposerProps = {
  action: WriteAction;
};

type ReplyComposerProps = {
  action: WriteAction;
  postId: string;
};

const initialWriteActionState: WriteActionState = {
  status: "idle",
  message: "",
};

export function PostComposer({ action }: PostComposerProps) {
  const [state, formAction] = useActionState(action, initialWriteActionState);
  const feedbackState = useTransformJobFeedback(state);

  return (
    <form className="composer" action={formAction} aria-label="投稿">
      <label htmlFor="post-body">投稿する</label>
      <ComposerTextarea />
      <WriteSubmitButton idleLabel="投稿" pendingLabel="投稿中..." />
      <WriteMessage state={feedbackState} />
    </form>
  );
}

export function ReplyComposer({ action, postId }: ReplyComposerProps) {
  const [state, formAction] = useActionState(action, initialWriteActionState);
  const feedbackState = useTransformJobFeedback(state);
  const inputId = `reply-body-${postId}`;

  return (
    <form className="reply-form" action={formAction} aria-label="返信">
      <label htmlFor={inputId}>返信する</label>
      <div>
        <ReplyInput inputId={inputId} />
        <WriteSubmitButton idleLabel="返信" pendingLabel="返信中..." />
      </div>
      <WriteMessage state={feedbackState} />
    </form>
  );
}

function ComposerTextarea() {
  const { pending } = useFormStatus();

  return (
    <textarea
      id="post-body"
      name="body"
      rows={3}
      required
      disabled={pending}
      placeholder="五七五に変換したい内容"
    />
  );
}

function ReplyInput({ inputId }: { inputId: string }) {
  const { pending } = useFormStatus();

  return (
    <input
      id={inputId}
      name="body"
      required
      disabled={pending}
      placeholder="七七に変換したい内容"
    />
  );
}

function WriteSubmitButton({
  idleLabel,
  pendingLabel,
}: {
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
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

function useTransformJobFeedback(actionState: WriteActionState) {
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
          router.refresh();
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
