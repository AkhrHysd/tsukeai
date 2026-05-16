import type { EntityId } from "@tsukeai/shared";
import { ReplyComposer } from "../../../../post-forms";
import { SheetCloseButton } from "../../../../sheet-close-button";

export default async function ReplyPage({ params }: { params: Promise<{ postId: EntityId }> }) {
  const { postId } = await params;

  return (
    <div className="sheet-page">
      <div className="sheet-page__inner">
        <div className="sheet-page__toolbar">
          <SheetCloseButton />
        </div>
        <h1 className="sheet-page__title">返歌する</h1>
        <ReplyComposer postId={postId} variant="sheet" />
      </div>
    </div>
  );
}
