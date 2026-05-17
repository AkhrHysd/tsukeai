"use client";

import type { EntityId, IsoDateTimeString } from "@tsukeai/shared";
import { useState } from "react";
import { ContextMenu } from "./context-menu";
import { PoemReadingTooltip } from "./poem-reading-tooltip";

type ReplyItem = {
  id: EntityId;
  author: { id: EntityId; displayName: string; handle?: string };
  publicText: string;
  readingText?: string;
  createdAt: IsoDateTimeString;
  canDelete: boolean;
};

type ReplyThreadProps = {
  replies: ReplyItem[];
  onDelete: (id: EntityId) => void;
};

function formatReplyTime(value: IsoDateTimeString) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function ReplyBody({ text, readingText }: { text: string; readingText?: string }) {
  return (
    <div className="reply-body">
      <PoemReadingTooltip readingText={readingText} text={text} />
    </div>
  );
}

export function ReplyThread({ replies, onDelete }: ReplyThreadProps) {
  const [visibleCount, setVisibleCount] = useState(1);

  if (replies.length === 0) {
    return null;
  }

  const visible = replies.slice(0, visibleCount);
  const hasMore = visibleCount < replies.length;

  return (
    <div className="reply-thread">
      <ul className="reply-list" aria-label="返信">
        {visible.map((reply) => (
          <li className="reply" key={reply.id}>
            <ReplyBody text={reply.publicText} readingText={reply.readingText} />
            <div className="reply__meta">
              <span className="reply__author">{reply.author.displayName}</span>
              <ContextMenu
                dateTime={reply.createdAt}
                formattedTime={formatReplyTime(reply.createdAt)}
                timestampLabel="返歌日時"
                triggerLabel="返歌メニュー"
              >
                {reply.canDelete ? (
                  <button
                    type="button"
                    className="context-menu__item context-menu__item--danger"
                    onClick={() => onDelete(reply.id)}
                  >
                    削除
                  </button>
                ) : null}
              </ContextMenu>
            </div>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <button type="button" className="reply-more" onClick={() => setVisibleCount((n) => n + 1)}>
          返信をもっと見る（あと {replies.length - visibleCount} 件）
        </button>
      ) : null}
    </div>
  );
}
