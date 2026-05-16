import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { storyDeletableReply, storyReplies, storyReply } from "../stories/fixtures";
import { ReplyThread } from "./reply-thread";

const meta = {
  title: "App/ReplyThread",
  component: ReplyThread,
  args: {
    replies: storyReplies,
    onDelete: fn(),
  },
} satisfies Meta<typeof ReplyThread>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    replies: [],
  },
};

export const Single: Story = {
  args: {
    replies: [storyReply],
  },
};

export const Multiple: Story = {};

export const Deletable: Story = {
  args: {
    replies: [storyDeletableReply],
  },
};
