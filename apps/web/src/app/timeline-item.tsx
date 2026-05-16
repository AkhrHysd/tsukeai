import type { AuthorDto, EntityId, IsoDateTimeString } from "@tsukeai/shared";
import Link from "next/link";
import type { ReactNode } from "react";

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
      <p
        className="post-item__body poem-tooltip"
        data-reading={post.readingText}
        title={post.readingText}
      >
        {post.publicText}
      </p>
      <div className="post-item__meta">
        <span className="post-item__author">{post.author.displayName}</span>
        <details className="context-menu">
          <summary className="context-menu__trigger" aria-label="投稿メニュー">
            <span aria-hidden="true">...</span>
          </summary>
          <div className="context-menu__panel">
            <time className="context-menu__info" dateTime={post.createdAt}>
              {formatTimelineTime(post.createdAt)}
            </time>
            {replyHref ? (
              <Link href={replyHref} className="context-menu__item">
                返歌する
              </Link>
            ) : null}
            {renderDeleteControl?.("context-menu__item context-menu__item--danger")}
          </div>
        </details>
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
