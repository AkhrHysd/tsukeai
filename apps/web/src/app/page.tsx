import type { TimelineResponseDto } from "@tsukeai/shared";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
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

type TransformKind = "post_575" | "reply_77";

const WRITE_SMOKE_FIXED_PUBLIC_TEXT_ENABLED = process.env.WRITE_SMOKE_FIXED_PUBLIC_TEXT === "1";
const WRITE_SMOKE_PUBLIC_TEXT = {
  post_575: "あさひさす\nこころしずかに\nはるをまつ",
  reply_77: "ほしをかぞえて\nよるがあけゆく",
} as const satisfies Record<TransformKind, string>;

async function createPost(formData: FormData) {
  "use server";

  await requestWrite("/api/posts", "post_575", formData);
  revalidatePath("/");
}

async function createReply(postId: string, formData: FormData) {
  "use server";

  await requestWrite(`/api/posts/${postId}/replies`, "reply_77", formData);
  revalidatePath("/");
}

async function deletePublicConversion(publicConversionId: string) {
  "use server";

  await requestApi(`/api/public-conversions/${publicConversionId}`, {
    method: "DELETE",
  });
  revalidatePath("/");
}

async function requestWrite(path: string, kind: TransformKind, formData: FormData) {
  const input = formData.get("body");

  if (typeof input !== "string" || input.trim().length === 0) {
    return;
  }

  const publicText = WRITE_SMOKE_FIXED_PUBLIC_TEXT_ENABLED
    ? WRITE_SMOKE_PUBLIC_TEXT[kind]
    : undefined;

  await requestApi(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(
      publicText
        ? {
            publicText,
            clientKey: crypto.randomUUID(),
          }
        : {
            kind,
            input,
            clientKey: crypto.randomUUID(),
          },
    ),
  });
}

async function requestApi(path: string, init: RequestInit) {
  const apiBaseUrl = getApiBaseUrl();
  const url = new URL(path, apiBaseUrl);
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  const headersInit = new Headers(init.headers);

  headersInit.set("Accept", "application/json");

  if (cookie) {
    headersInit.set("Cookie", cookie);
  }

  const response = await fetch(url, {
    ...init,
    headers: headersInit,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `API request failed with ${response.status}`;

    try {
      const body = (await response.json()) as {
        error?: { message?: unknown };
      };
      const errorMessage = body.error?.message;

      if (typeof errorMessage === "string" && errorMessage.length > 0) {
        message = errorMessage;
      }
    } catch {
      // Keep the status-only message when the API does not return JSON.
    }

    throw new Error(message);
  }
}

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
        <p className="lead">変換済みの公開句だけをサーバーで取得して表示します。</p>
      </header>

      <form className="composer" action={createPost} aria-label="投稿">
        <label htmlFor="post-body">投稿する</label>
        <textarea
          id="post-body"
          name="body"
          rows={3}
          required
          placeholder="五七五に変換したい内容"
        />
        <button type="submit">投稿</button>
      </form>

      {timelineResult.status === "unavailable" ? (
        <p className="timeline-status" role="status">
          タイムラインを読み込めませんでした。
        </p>
      ) : timelineResult.timeline.items.length === 0 ? (
        <p className="timeline-status" role="status">
          まだ公開句はありません。
        </p>
      ) : (
        <ul className="timeline-list" aria-label="公開タイムライン">
          {timelineResult.timeline.items.map((item) => (
            <li className="post-card" key={item.post.id}>
              <div className="post-card__header">
                <strong>{item.post.author.displayName}</strong>
                {item.post.author.handle ? <span>@{item.post.author.handle}</span> : null}
                <time dateTime={item.post.createdAt}>
                  {new Intl.DateTimeFormat("ja-JP", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Tokyo",
                  }).format(new Date(item.post.createdAt))}
                </time>
                <form action={deletePublicConversion.bind(null, item.post.id)}>
                  <button className="link-button" type="submit">
                    削除
                  </button>
                </form>
              </div>

              <p className="post-card__body">{item.post.body}</p>

              {item.replies.length > 0 ? (
                <ul className="reply-list" aria-label="返信">
                  {item.replies.map((reply) => (
                    <li className="reply" key={reply.id}>
                      <div className="reply__header">
                        <strong>{reply.author.displayName}</strong>
                        {reply.author.handle ? <span>@{reply.author.handle}</span> : null}
                        <form action={deletePublicConversion.bind(null, reply.id)}>
                          <button className="link-button" type="submit">
                            削除
                          </button>
                        </form>
                      </div>
                      <p>{reply.body}</p>
                    </li>
                  ))}
                </ul>
              ) : null}

              <form
                className="reply-form"
                action={createReply.bind(null, item.post.id)}
                aria-label="返信"
              >
                <label htmlFor={`reply-body-${item.post.id}`}>返信する</label>
                <div>
                  <input
                    id={`reply-body-${item.post.id}`}
                    name="body"
                    required
                    placeholder="七七に変換したい内容"
                  />
                  <button type="submit">返信</button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
