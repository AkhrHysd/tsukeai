"use client";

import type { EntityId, IsoDateTimeString } from "@tsukeai/shared";
import { useRouter } from "next/navigation";
import { ReplyThread } from "./reply-thread";

type ReplyItem = {
  id: EntityId;
  author: { id: EntityId; displayName: string; handle?: string };
  publicText: string;
  createdAt: IsoDateTimeString;
  canDelete: boolean;
};

type ReplyThreadWrapperProps = {
  replies: ReplyItem[];
  deleteAction: (id: EntityId) => Promise<void>;
};

export function ReplyThreadWrapper({ replies, deleteAction }: ReplyThreadWrapperProps) {
  const router = useRouter();

  async function handleDelete(id: EntityId) {
    await deleteAction(id);
    router.refresh();
  }

  return <ReplyThread replies={replies} onDelete={handleDelete} />;
}
