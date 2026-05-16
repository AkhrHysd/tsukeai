import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { FormEvent } from "react";
import { fn } from "storybook/test";
import { ComposerForm, type WriteActionState } from "./post-forms";

const states = {
  idle: { status: "idle", message: "" },
  pending: {
    status: "pending",
    message: "変換中です。完了するとタイムラインに反映されます。",
  },
  success: { status: "success", message: "投稿しました。" },
  error: {
    status: "error",
    message: "変換に失敗しました。内容を見直してもう一度お試しください。",
  },
  retryableError: {
    status: "error",
    message: "変換状態を確認できませんでした。時間をおいて再度お試しください。",
    canRetry: true,
  },
} satisfies Record<string, WriteActionState>;

const meta = {
  title: "App/Composer",
  component: ComposerForm,
  args: {
    ariaLabel: "投稿",
    label: "五七五に変換したい内容を入力",
    inputId: "storybook-post-body",
    rows: 8,
    placeholder: "五七五に変換したい内容",
    submitLabel: "投稿",
    busyLabel: "投稿中...",
    busy: false,
    disabled: false,
    state: states.idle,
    onSubmit: fn((event: FormEvent<HTMLFormElement>) => event.preventDefault()),
    onRetry: fn(),
  },
} satisfies Meta<typeof ComposerForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Pending: Story = {
  args: {
    disabled: true,
    state: states.pending,
  },
};

export const Success: Story = {
  args: {
    state: states.success,
  },
};

// biome-ignore lint/suspicious/noShadowRestrictedNames: Storybook story export keeps the stable story id.
export const Error: Story = {
  args: {
    state: states.error,
  },
};

export const RetryableError: Story = {
  args: {
    state: states.retryableError,
  },
};

export const ReplyComposer: Story = {
  args: {
    ariaLabel: "返信",
    label: "七七に変換したい内容を入力",
    inputId: "storybook-reply-body",
    rows: 6,
    placeholder: "七七に変換したい内容",
    submitLabel: "返信",
    busyLabel: "返信中...",
  },
};
