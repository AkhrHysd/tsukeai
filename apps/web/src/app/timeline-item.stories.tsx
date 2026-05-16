import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { storyPost, storyReplies, storyReply } from "../stories/fixtures";
import { ReplyThread } from "./reply-thread";
import { TimelineItemView } from "./timeline-item";

const meta = {
  title: "App/TimelineItem",
  component: TimelineItemView,
  args: {
    post: storyPost,
    replyHref: "/posts/post-story/reply",
    replyThread: <ReplyThread replies={[storyReply]} onDelete={fn()} />,
  },
  decorators: [
    (Story) => (
      <ul className="timeline-list" aria-label="公開タイムライン">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof TimelineItemView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithReplies: Story = {
  args: {
    replyThread: <ReplyThread replies={storyReplies} onDelete={fn()} />,
  },
};

export const OwnPost: Story = {
  args: {
    renderDeleteControl: (className) => (
      <button className={className} type="button">
        削除
      </button>
    ),
  },
};

export const WithoutReading: Story = {
  args: {
    post: {
      ...storyPost,
      readingText: undefined,
    },
  },
};
