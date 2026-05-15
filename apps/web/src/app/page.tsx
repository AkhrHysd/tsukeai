import type { AuthorDto, EntityId, IsoDateTimeString, TimelineResponseDto } from "@tsukeai/shared";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getApiBaseUrl } from "../lib/api-base-url";
import { getCurrentSession } from "../lib/current-session";
import { ReplyThreadWrapper } from "./reply-thread-wrapper";
import { TimelineRefreshOnReturn } from "./timeline-refresh-on-return";

export const dynamic = "force-dynamic";

type TimelineResult =
  | {
      status: "ready";
      timeline: PublicTimeline;
    }
  | {
      status: "unavailable";
    };

type PublicTimeline = {
  items: PublicTimelineItem[];
  nextCursor?: string;
};
type PublicTimelineItem = {
  post: PublicPost;
  replies: PublicReply[];
};
type PublicPost = {
  id: EntityId;
  author: AuthorDto;
  publicText: string;
  createdAt: IsoDateTimeString;
};
type PublicReply = {
  id: EntityId;
  postId: EntityId;
  author: AuthorDto;
  publicText: string;
  createdAt: IsoDateTimeString;
};

async function deletePublicConversion(publicConversionId: string) {
  "use server";

  await requestApi(`/api/public-conversions/${publicConversionId}`, {
    method: "DELETE",
  });
  revalidatePath("/");
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
  let responseText: string | undefined;

  try {
    responseText = await response.text();
  } catch {
    responseText = undefined;
  }

  if (!response.ok) {
    console.error("API request failed", {
      url: url.toString(),
      status: response.status,
      cfRay: response.headers.get("cf-ray"),
      contentType: response.headers.get("content-type"),
      responseText: responseText?.slice(0, 400),
    });

    throw new Error(`API request failed with ${response.status}`);
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

    const timeline = toPublicTimeline((await response.json()) as TimelineResponseDto);

    return { status: "ready", timeline };
  } catch {
    return { status: "unavailable" };
  }
}

function toPublicTimeline(timeline: TimelineResponseDto): PublicTimeline {
  return {
    items: timeline.items.map((item) => ({
      post: {
        id: item.post.id,
        author: item.post.author,
        publicText: getPublicText(item.post),
        createdAt: item.post.createdAt,
      },
      replies: item.replies.map((reply) => ({
        id: reply.id,
        postId: reply.postId,
        author: reply.author,
        publicText: getPublicText(reply),
        createdAt: reply.createdAt,
      })),
    })),
    ...(timeline.nextCursor ? { nextCursor: timeline.nextCursor } : {}),
  };
}

function getPublicText(conversion: { publicText?: string; body?: string }) {
  return conversion.publicText ?? conversion.body ?? "";
}

export default async function Home() {
  const apiBaseUrl = getApiBaseUrl();
  const [timelineResult, session] = await Promise.all([
    getPublicTimeline(apiBaseUrl),
    getCurrentSession(),
  ]);
  const currentAccount = session.authenticated ? session.account : undefined;

  return (
    <section className="timeline-page" aria-labelledby="page-title">
      <TimelineRefreshOnReturn />
      <h1 id="page-title" className="sr-only">tsukeai</h1>

      {!currentAccount ? (
        <p className="timeline-status" role="status">
          投稿・返信・削除にはログインが必要です。
        </p>
      ) : null}

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
            <li className="post-item" key={item.post.id}>
              <p className="post-item__body">{item.post.publicText}</p>
              <div className="post-item__meta">
                <span className="post-item__author">{item.post.author.displayName}</span>
                <time className="post-item__time" dateTime={item.post.createdAt}>
                  {new Intl.DateTimeFormat("ja-JP", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Tokyo",
                  }).format(new Date(item.post.createdAt))}
                </time>
                {currentAccount?.id === item.post.author.id ? (
                  <form action={deletePublicConversion.bind(null, item.post.id)}>
                    <button className="link-button" type="submit">
                      削除
                    </button>
                  </form>
                ) : null}
              </div>

              <div className="post-item__actions">
                {currentAccount ? (
                  <Link href={`/posts/${item.post.id}/reply`} className="reply-link">
                    返歌する
                  </Link>
                ) : null}
              </div>

              <ReplyThreadWrapper
                replies={item.replies.map((r) => ({
                  id: r.id,
                  author: r.author,
                  publicText: r.publicText,
                  createdAt: r.createdAt,
                  canDelete: currentAccount?.id === r.author.id,
                }))}
                deleteAction={deletePublicConversion}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
