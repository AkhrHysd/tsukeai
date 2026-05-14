"use client";

import { useActionState } from "react";
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

  return (
    <form className="composer" action={formAction} aria-label="投稿">
      <label htmlFor="post-body">投稿する</label>
      <ComposerTextarea />
      <WriteSubmitButton idleLabel="投稿" pendingLabel="投稿中..." />
      <WriteMessage state={state} />
    </form>
  );
}

export function ReplyComposer({ action, postId }: ReplyComposerProps) {
  const [state, formAction] = useActionState(action, initialWriteActionState);
  const inputId = `reply-body-${postId}`;

  return (
    <form className="reply-form" action={formAction} aria-label="返信">
      <label htmlFor={inputId}>返信する</label>
      <div>
        <ReplyInput inputId={inputId} />
        <WriteSubmitButton idleLabel="返信" pendingLabel="返信中..." />
      </div>
      <WriteMessage state={state} />
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
