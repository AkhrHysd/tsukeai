import { getApiBaseUrl } from "../lib/api-base-url";

export const dynamic = "force-dynamic";

const previewPosts = [
  {
    body: "雨上がり 画面の奥で 返歌待つ",
    meta: "公開タイムライン",
  },
  {
    body: "ひとことを 五七五七七に ほどきなおす",
    meta: "SSR shell",
  },
  {
    body: "朝の窓 API の向こう 息をする",
    meta: "API ready",
  },
];

export default function Home() {
  const apiBaseUrl = getApiBaseUrl();

  return (
    <section className="hero" aria-labelledby="page-title">
      <div className="hero__copy">
        <p className="eyebrow">公開閲覧 / SSR</p>
        <h1 id="page-title">短歌で返信するタイムライン</h1>
        <p className="lead">
          未ログインでも読める公開ビューを、Next.js App Router のサーバーコンポーネントで描画します。
        </p>
      </div>

      <div className="system-strip">
        API base URL is read on the server: <strong>{apiBaseUrl.href}</strong>
      </div>

      <div className="timeline-preview" aria-label="タイムラインのプレビュー">
        {previewPosts.map((post) => (
          <article className="post-card" key={post.body}>
            <p>{post.body}</p>
            <small>{post.meta}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
