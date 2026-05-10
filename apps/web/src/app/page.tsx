import type { TimelineResponseDto } from "@tanka-reply-sns/shared";
import { getApiBaseUrl } from "../lib/api-base-url";

export const dynamic = "force-dynamic";

type TimelineResult =
  | {
      status: "ready";
      timeline: TimelineResponseDto;
    }
  | {
      status: "unavailable";
    };

async function getPublicTimeline(apiBaseUrl: URL): Promise<TimelineResult> {
  const timelineUrl = new URL("/api/timeline?limit=20", apiBaseUrl);

  try {
    const response = await fetch(timelineUrl, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return { status: "unavailable" };
    }

    return {
      status: "ready",
      timeline: (await response.json()) as TimelineResponseDto,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export default async function Home() {
  const apiBaseUrl = getApiBaseUrl();
  const timelineResult = await getPublicTimeline(apiBaseUrl);

  return (
    <section className="timeline-page" aria-labelledby="page-title">
      <header className="timeline-header">
        <div>
          <p className="eyebrow">公開閲覧 / SSR</p>
          <h1 id="page-title">公開タイムライン</h1>
        </div>
        <p className="lead">
          変換済みの公開句だけをサーバーで取得して表示します。
        </p>
      </header>

      {timelineResult.status === "unavailable" ? (
        <p className="timeline-status" role="status">
          タイムラインを読み込めませんでした。
        </p>
      ) : timelineResult.timeline.items.length === 0 ? (
        <p className="timeline-status" role="status">
          まだ公開句はありません。
        </p>
      ) : (
        <div className="timeline-list" role="list" aria-label="公開タイムライン">
          {timelineResult.timeline.items.map((item) => (
            <article className="post-card" key={item.post.id} role="listitem">
              <div className="post-card__header">
                <strong>{item.post.author.displayName}</strong>
                {item.post.author.handle ? (
                  <span>@{item.post.author.handle}</span>
                ) : null}
                <time dateTime={item.post.createdAt}>
                  {new Intl.DateTimeFormat("ja-JP", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Tokyo",
                  }).format(new Date(item.post.createdAt))}
                </time>
              </div>

              <p className="post-card__body">{item.post.body}</p>

              {item.replies.length > 0 ? (
                <div className="reply-list" aria-label="返信">
                  {item.replies.map((reply) => (
                    <section className="reply" key={reply.id}>
                      <div className="reply__header">
                        <strong>{reply.author.displayName}</strong>
                        {reply.author.handle ? (
                          <span>@{reply.author.handle}</span>
                        ) : null}
                      </div>
                      <p>{reply.body}</p>
                    </section>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
