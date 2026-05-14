import { getCurrentSession } from "../../lib/current-session";
import { PostComposer } from "../post-forms";
import { SheetCloseButton } from "../sheet-close-button";

export default async function ComposePage() {
  const session = await getCurrentSession();

  return (
    <div className="sheet-page">
      <div className="sheet-page__inner">
        <div className="sheet-page__toolbar">
          <SheetCloseButton />
        </div>
        <h1 className="sheet-page__title">歌を詠む</h1>
        {session.authenticated ? (
          <PostComposer variant="sheet" />
        ) : (
          <p className="sheet-page__notice">投稿にはログインが必要です。</p>
        )}
      </div>
    </div>
  );
}
