import type { AuthorDto, EntityId, IsoDateTimeString } from "@tsukeai/shared";
import Link from "next/link";
import type { ReactNode } from "react";
import { ContextMenu } from "./context-menu";
import { PoemReadingTooltip } from "./poem-reading-tooltip";

export type TimelinePostView = {
  id: EntityId;
  author: AuthorDto;
  publicText: string;
  readingText?: string;
  createdAt: IsoDateTimeString;
};

export type TimelineReplyView = {
  id: EntityId;
  author: AuthorDto;
  publicText: string;
  readingText?: string;
  createdAt: IsoDateTimeString;
  canDelete: boolean;
};

export function TimelineItemView({
  post,
  replyHref,
  renderDeleteControl,
  replyThread,
}: {
  post: TimelinePostView;
  replyHref?: string;
  renderDeleteControl?: (className: string) => ReactNode;
  replyThread?: ReactNode;
}) {
  return (
    <li className="post-item">
      <PoemReadingTooltip
        className="post-item__body"
        readingText={post.readingText}
        text={post.publicText}
      />
      <div className="post-item__meta">
        <span className="post-item__author">{post.author.displayName}</span>
        <ContextMenu
          dateTime={post.createdAt}
          formattedTime={formatTimelineTime(post.createdAt)}
          timestampLabel="投稿日時"
          triggerLabel="投稿メニュー"
        >
          {replyHref ? (
            <Link href={replyHref} className="context-menu__item">
              返歌する
            </Link>
          ) : null}
          {renderDeleteControl?.("context-menu__item context-menu__item--danger")}
        </ContextMenu>
      </div>

      {replyThread}
    </li>
  );
}

function formatTimelineTime(value: IsoDateTimeString) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}
