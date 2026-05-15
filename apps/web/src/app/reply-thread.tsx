"use client";

import type { EntityId, IsoDateTimeString } from "@tsukeai/shared";
import { useState } from "react";

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
      <p className="poem-tooltip" data-reading={readingText} title={readingText}>
        {text}
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
            <ReplyBody text={reply.publicText} readingText={reply.readingText} />
            <div className="reply__meta">
              <span className="reply__author">{reply.author.displayName}</span>
              <details className="context-menu context-menu--reply">
                <summary className="context-menu__trigger" aria-label="返歌メニュー">
                  <span aria-hidden="true">...</span>
                </summary>
                <div className="context-menu__panel">
                  <time className="context-menu__info" dateTime={reply.createdAt}>
                    {formatReplyTime(reply.createdAt)}
                  </time>
                  {reply.canDelete ? (
                    <button
                      type="button"
                      className="context-menu__item context-menu__item--danger"
                      onClick={() => onDelete(reply.id)}
                    >
                      削除
                    </button>
                  ) : null}
                </div>
              </details>
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
