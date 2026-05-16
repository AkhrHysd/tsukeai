import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { FormEvent } from "react";
import { fn } from "storybook/test";
import { storyAccount } from "../stories/fixtures";
import { AuthControlsView, LoginAuthControlsView } from "./auth-controls";

const noopAuth = {
  busy: false,
  displayName: "",
  handle: "",
  supported: true,
  setDisplayName: fn(),
  setHandle: fn(),
  setMessage: fn(),
  login: fn(),
  logout: fn(),
  submitRegistration: fn((event: FormEvent<HTMLFormElement>) => event.preventDefault()),
};

const meta = {
  title: "App/Auth",
  parameters: {
    viewport: {
      defaultViewport: "responsive",
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const HeaderLoginPanel: Story = {
  render: () => (
    <AuthControlsView
      auth={noopAuth}
      mode="login"
      panelOpen={true}
      onModeChange={fn()}
      onPanelOpenChange={fn()}
    />
  ),
};

export const HeaderRegisterPanel: Story = {
  render: () => (
    <AuthControlsView
      auth={{
        ...noopAuth,
        displayName: "詠み人",
        handle: "yomibito",
      }}
      mode="register"
      panelOpen={true}
      onModeChange={fn()}
      onPanelOpenChange={fn()}
    />
  ),
};

export const HeaderLoggedIn: Story = {
  render: () => (
    <AuthControlsView
      auth={{
        ...noopAuth,
        account: storyAccount,
      }}
      mode="login"
      panelOpen={false}
      onModeChange={fn()}
      onPanelOpenChange={fn()}
    />
  ),
};

export const LoginPageRegisterError: Story = {
  render: () => (
    <LoginAuthControlsView
      auth={{
        ...noopAuth,
        displayName: "詠み人",
        message: "登録に失敗しました。もう一度お試しください。",
      }}
      mode="register"
      onModeChange={fn()}
    />
  ),
};

export const LoginPageUnsupported: Story = {
  render: () => (
    <LoginAuthControlsView
      auth={{
        ...noopAuth,
        supported: false,
      }}
      mode="login"
      onModeChange={fn()}
    />
  ),
};
