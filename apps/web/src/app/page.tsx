import type {
  AuthorDto,
  EntityId,
  IsoDateTimeString,
  TimelineResponseDto,
  TransformJobResponseDto,
} from "@tsukeai/shared";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getApiBaseUrl } from "../lib/api-base-url";
import { getCurrentSession } from "../lib/current-session";
import { PostComposer, ReplyComposer } from "./post-forms";

export const dynamic = "force-dynamic";

type TimelineResult =
  | {
      status: "ready";
      timeline: PublicTimeline;
    }
  | {
      status: "unavailable";
    };

type TransformKind = "post_575" | "reply_77";
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
export type WriteActionState = {
  status: "idle" | "pending" | "success" | "error";
  message: string;
  jobId?: EntityId;
  target?: WriteTarget;
};
type WriteTarget = "post" | "reply";
type PublishedWriteResponse = {
  post?: unknown;
  reply?: unknown;
};
type ApiResponse<T> = {
  status: number;
  body: T | undefined;
};
type ApiErrorBody = {
  error?: { message?: unknown };
  job?: { error?: { message?: unknown } };
};

const WRITE_SMOKE_FIXED_PUBLIC_TEXT_ENABLED = process.env.WRITE_SMOKE_FIXED_PUBLIC_TEXT === "1";
const WRITE_SMOKE_PUBLIC_TEXT = {
  post_575: "あさひさす\nこころしずかに\nはるをまつ",
  reply_77: "ほしをかぞえて\nよるがあけゆく",
} as const satisfies Record<TransformKind, string>;

async function createPost(
  _previousState: WriteActionState,
  formData: FormData,
): Promise<WriteActionState> {
  "use server";

  return handleWriteAction(() => requestWrite("/api/posts", "post_575", "post", formData));
}

async function createReply(
  postId: string,
  _previousState: WriteActionState,
  formData: FormData,
): Promise<WriteActionState> {
  "use server";

  return handleWriteAction(() =>
    requestWrite(`/api/posts/${postId}/replies`, "reply_77", "reply", formData),
  );
}

async function deletePublicConversion(publicConversionId: string) {
  "use server";

  await requestApi(`/api/public-conversions/${publicConversionId}`, {
    method: "DELETE",
  });
  revalidatePath("/");
}

async function handleWriteAction(
  write: () => Promise<WriteActionState>,
): Promise<WriteActionState> {
  try {
    const result = await write();

    if (result.status === "success") {
      revalidatePath("/");
    }

    return result;
  } catch (error) {
    return {
      status: "error",
      message: toErrorMessage(error),
    };
  }
}

async function requestWrite(
  path: string,
  kind: TransformKind,
  target: WriteTarget,
  formData: FormData,
): Promise<WriteActionState> {
  const input = formData.get("body");

  if (typeof input !== "string" || input.trim().length === 0) {
    return {
      status: "error",
      message: "本文を入力してください。",
    };
  }

  const publicText = WRITE_SMOKE_FIXED_PUBLIC_TEXT_ENABLED
    ? WRITE_SMOKE_PUBLIC_TEXT[kind]
    : undefined;

  const response = await requestApi<PublishedWriteResponse | TransformJobResponseDto>(path, {
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

  return toWriteActionState(response, target);
}

async function requestApi<T>(path: string, init: RequestInit): Promise<ApiResponse<T>> {
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
    let message = `API request failed with ${response.status}`;

    try {
      const body = JSON.parse(responseText ?? "") as ApiErrorBody;
      const errorMessage = body.error?.message ?? body.job?.error?.message;

      if (typeof errorMessage === "string" && errorMessage.length > 0) {
        message = errorMessage;
      }
    } catch {
      // Keep the status-only message when the API does not return JSON.
    }

    throw new Error(message);
  }

  return {
    status: response.status,
    body: parseJsonResponse<T>(responseText),
  };
}

function parseJsonResponse<T>(responseText: string | undefined): T | undefined {
  if (!responseText) {
    return undefined;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    return undefined;
  }
}

function toWriteActionState(
  response: ApiResponse<PublishedWriteResponse | TransformJobResponseDto>,
  target: WriteTarget,
): WriteActionState {
  const body = response.body;
  const successMessage = target === "post" ? "投稿しました。" : "返信しました。";

  if (isPublishedWriteResponse(body, target) || isSucceededTransformJob(body, target)) {
    return {
      status: "success",
      message: successMessage,
    };
  }

  if (response.status === 202 || isActiveTransformJob(body)) {
    return {
      status: "pending",
      message: "変換中です。完了するとタイムラインに反映されます。",
      ...(isTransformJobResponse(body) ? { jobId: body.job.id } : {}),
      target,
    };
  }

  return {
    status: "success",
    message: successMessage,
  };
}

function isPublishedWriteResponse(
  body: PublishedWriteResponse | TransformJobResponseDto | undefined,
  target: WriteTarget,
): body is PublishedWriteResponse {
  if (!body || typeof body !== "object" || !("job" in body)) {
    return target === "post" ? Boolean(body?.post) : Boolean(body?.reply);
  }

  return false;
}

function isSucceededTransformJob(
  body: PublishedWriteResponse | TransformJobResponseDto | undefined,
  target: WriteTarget,
) {
  if (!isTransformJobResponse(body)) {
    return false;
  }

  return (
    body.job.state === "succeeded" ||
    (target === "post" ? Boolean(body.job.publishedPostId) : Boolean(body.job.publishedReplyId))
  );
}

function isActiveTransformJob(body: PublishedWriteResponse | TransformJobResponseDto | undefined) {
  if (!isTransformJobResponse(body)) {
    return false;
  }

  return body.job.state === "queued" || body.job.state === "processing";
}

function isTransformJobResponse(
  body: PublishedWriteResponse | TransformJobResponseDto | undefined,
): body is TransformJobResponseDto {
  return Boolean(body && typeof body === "object" && "job" in body);
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "投稿に失敗しました。";
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
      <header className="timeline-header">
        <div>
          <h1 id="page-title">公開タイムライン</h1>
        </div>
        <p className="lead">変換済みの公開句だけをサーバーで取得して表示します。</p>
      </header>

      {currentAccount ? (
        <PostComposer action={createPost} />
      ) : (
        <p className="timeline-status" role="status">
          投稿・返信・削除にはログインが必要です。
        </p>
      )}

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
                {currentAccount?.id === item.post.author.id ? (
                  <form action={deletePublicConversion.bind(null, item.post.id)}>
                    <button className="link-button" type="submit">
                      削除
                    </button>
                  </form>
                ) : null}
              </div>

              <p className="post-card__body">{item.post.publicText}</p>

              {item.replies.length > 0 ? (
                <ul className="reply-list" aria-label="返信">
                  {item.replies.map((reply) => (
                    <li className="reply" key={reply.id}>
                      <div className="reply__header">
                        <strong>{reply.author.displayName}</strong>
                        {reply.author.handle ? <span>@{reply.author.handle}</span> : null}
                        {currentAccount?.id === reply.author.id ? (
                          <form action={deletePublicConversion.bind(null, reply.id)}>
                            <button className="link-button" type="submit">
                              削除
                            </button>
                          </form>
                        ) : null}
                      </div>
                      <p>{reply.publicText}</p>
                    </li>
                  ))}
                </ul>
              ) : null}

              {currentAccount ? (
                <ReplyComposer
                  action={createReply.bind(null, item.post.id)}
                  postId={item.post.id}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
