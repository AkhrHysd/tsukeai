"use client";

import type { EntityId, IsoDateTimeString } from "@tsukeai/shared";
import { useState } from "react";

type ReplyItem = {
  id: EntityId;
  author: { id: EntityId; displayName: string; handle?: string };
  publicText: string;
  createdAt: IsoDateTimeString;
  canDelete: boolean;
};

type ReplyThreadProps = {
  replies: ReplyItem[];
  onDelete: (id: EntityId) => void;
};

function ReplyBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const half = Math.ceil(text.length / 2);
  const preview = text.slice(0, half);
  const rest = text.slice(half);
  const needsTruncation = rest.length > 0;

  return (
    <div className="reply-body">
      <p>
        {preview}
        {needsTruncation && !expanded ? (
          <>
            <span aria-hidden="true">…</span>
            <button
              type="button"
              className="reply-expand"
              onClick={() => setExpanded(true)}
              aria-label="続きを表示"
            >
              続き
            </button>
          </>
        ) : (
          rest
        )}
      </p>
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
            <ReplyBody text={reply.publicText} />
            <div className="reply__meta">
              <span className="reply__author">{reply.author.displayName}</span>
              <time className="reply__time" dateTime={reply.createdAt}>
                {new Intl.DateTimeFormat("ja-JP", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Tokyo",
                }).format(new Date(reply.createdAt))}
              </time>
              {reply.canDelete ? (
                <button
                  type="button"
                  className="link-button reply__delete"
                  onClick={() => onDelete(reply.id)}
                >
                  削除
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <button
          type="button"
          className="reply-more"
          onClick={() => setVisibleCount((n) => n + 1)}
        >
          返信をもっと見る（あと {replies.length - visibleCount} 件）
        </button>
      ) : null}
    </div>
  );
}
