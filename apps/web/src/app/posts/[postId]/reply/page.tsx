import type { EntityId } from "@tsukeai/shared";
import { getCurrentSession } from "../../../../lib/current-session";
import { ReplyComposer } from "../../../post-forms";
import { SheetCloseButton } from "../../../sheet-close-button";

export default async function ReplyPage({
  params,
}: {
  params: Promise<{ postId: EntityId }>;
}) {
  const { postId } = await params;
  const session = await getCurrentSession();

  return (
    <div className="sheet-page">
      <div className="sheet-page__inner">
        <div className="sheet-page__toolbar">
          <SheetCloseButton />
        </div>
        <h1 className="sheet-page__title">返歌する</h1>
        {session.authenticated ? (
          <ReplyComposer postId={postId} variant="sheet" />
        ) : (
          <p className="sheet-page__notice">返信にはログインが必要です。</p>
        )}
      </div>
    </div>
  );
}
