export type TankaText = string;
export type PublicTankaText = TankaText;

export type EntityId = string;
export type IsoDateTimeString = string;

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "internal_error"
  | "service_unavailable"
  | "transform_failed"
  | "transform_input_rejected"
  | "transform_limit_exceeded";

export type ApiErrorDto = {
  code: ApiErrorCode;
  message: string;
  requestId?: string;
  fieldErrors?: FieldErrorDto[];
};

export type FieldErrorDto = {
  field: string;
  message: string;
};

export type ApiErrorResponseDto = {
  error: ApiErrorDto;
};

export type BoundaryErrorCode = ApiErrorCode;
export type BoundaryFieldErrorDto = FieldErrorDto;
export type BoundaryErrorDto = ApiErrorDto;
export type BoundaryErrorResponseDto = ApiErrorResponseDto;

export const TRANSFORM_JOB_STATES = [
  "queued",
  "processing",
  "succeeded",
  "failed",
  "rejected",
] as const;

export type TransformJobState = (typeof TRANSFORM_JOB_STATES)[number];

export const TRANSFORM_TERMINAL_JOB_STATES = [
  "succeeded",
  "failed",
  "rejected",
] as const satisfies readonly TransformJobState[];

export type TransformTerminalJobState = (typeof TRANSFORM_TERMINAL_JOB_STATES)[number];

export const TRANSFORM_JOB_STATE_TRANSITIONS = [
  ["queued", "processing"],
  ["queued", "failed"],
  ["queued", "rejected"],
  ["processing", "succeeded"],
  ["processing", "failed"],
  ["processing", "rejected"],
] as const satisfies readonly (readonly [TransformJobState, TransformJobState])[];

export type TransformJobStateTransition = (typeof TRANSFORM_JOB_STATE_TRANSITIONS)[number];

export type TransformJobKind = "post_575" | "reply_77";

export const TRANSFORM_FORM_RULES = {
  post_575: [5, 7, 5],
  reply_77: [7, 7],
} as const satisfies Record<TransformJobKind, readonly number[]>;

export type TransformFormCheckReason =
  | "blank"
  | "contains_uncheckable_characters"
  | "segment_count_mismatch"
  | "mora_count_mismatch";

export type TransformFormCheckSegment = {
  text: string;
  moraCount: number;
  expectedMoraCount: number;
};

export type TransformFormCheckError = {
  reason: TransformFormCheckReason;
  message: string;
};

export type TransformFormCheckResult = {
  accepted: boolean;
  kind: TransformJobKind;
  normalizedText: PublicTankaText;
  segments: TransformFormCheckSegment[];
  errors: TransformFormCheckError[];
};

export type TransformIdempotencyScope = {
  userId: EntityId;
  kind: TransformJobKind;
  parentPostId?: EntityId;
  inputHash: string;
  clientKey: string;
};

export type TransformRetryPolicy = "server_retryable" | "client_revisable";

export type TransformUserAction = "retry_later" | "revise_input";

export type TransformPublicErrorCode = Extract<
  ApiErrorCode,
  "transform_failed" | "transform_input_rejected" | "transform_limit_exceeded"
>;

export type TransformFailureReason =
  | "timeout"
  | "rate_limited"
  | "provider_unavailable"
  | "provider_rejected"
  | "invalid_provider_response"
  | "input_limit_exceeded"
  | "output_limit_exceeded"
  | "cost_limit_exceeded"
  | "validation_failed"
  | "prompt_injection_detected"
  | "unauthorized"
  | "configuration_error";

export type TransformJobErrorDto = {
  code: TransformPublicErrorCode;
  reason: TransformFailureReason;
  message: string;
  retryPolicy: TransformRetryPolicy;
  userAction: TransformUserAction;
};

export type TransformJobObservationDto = {
  jobId: EntityId;
  state: TransformJobState;
  reason?: TransformFailureReason;
  attempts: number;
  durationMs?: number;
  estimatedCostMicros?: number;
  model?: string;
  inputHash: string;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
};

export type TransformJobDto = {
  id: EntityId;
  kind: TransformJobKind;
  state: TransformJobState;
  idempotency: TransformIdempotencyScope;
  observation: TransformJobObservationDto;
  publishedPostId?: EntityId;
  publishedReplyId?: EntityId;
  error?: TransformJobErrorDto;
};

export type TransformJobResponseDto = {
  job: TransformJobDto;
};

export type BoundaryTransformJobState = TransformJobState;
export type BoundaryTransformTerminalJobState = TransformTerminalJobState;
export type BoundaryTransformJobKind = TransformJobKind;
export type BoundaryTransformFormCheckReason = TransformFormCheckReason;
export type BoundaryTransformFormCheckSegmentDto = TransformFormCheckSegment;
export type BoundaryTransformFormCheckErrorDto = TransformFormCheckError;
export type BoundaryTransformFormCheckResultDto = TransformFormCheckResult;
export type BoundaryTransformIdempotencyScopeDto = TransformIdempotencyScope;
export type BoundaryTransformRetryPolicy = TransformRetryPolicy;
export type BoundaryTransformUserAction = TransformUserAction;
export type BoundaryTransformPublicErrorCode = TransformPublicErrorCode;
export type BoundaryTransformFailureReason = TransformFailureReason;
export type BoundaryTransformJobErrorDto = TransformJobErrorDto;
export type BoundaryTransformJobObservationDto = TransformJobObservationDto;
export type BoundaryTransformJobDto = TransformJobDto;
export type BoundaryTransformJobResponseDto = TransformJobResponseDto;

const EXPLICIT_SEGMENT_SEPARATOR_PATTERN = /[\n\r/／]+/u;
const INLINE_SEGMENT_SEPARATOR_PATTERN = /[\s　、，,。．.！？!?]+/u;
const IGNORED_FORM_CHARACTERS_PATTERN = /[\s　、，,。．.！？!?「」『』（）()［］[\]【】]/gu;
const SMALL_KANA_WITHOUT_OWN_MORA = new Set([
  "ぁ",
  "ぃ",
  "ぅ",
  "ぇ",
  "ぉ",
  "ゃ",
  "ゅ",
  "ょ",
  "ゎ",
  "ァ",
  "ィ",
  "ゥ",
  "ェ",
  "ォ",
  "ャ",
  "ュ",
  "ョ",
  "ヮ",
]);
const MORA_CHAR_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u;
const CHECKABLE_TANKA_TEXT_PATTERN =
  /^[\p{Script=Hiragana}\p{Script=Katakana}ー\s　、，,。．.！？!?「」『』（）()［］[\]【】/／]+$/u;

export function checkTransformForm(
  kind: TransformJobKind,
  text: TankaText,
): TransformFormCheckResult {
  const normalizedText = normalizeTankaText(text);
  const expectedMoraCounts = TRANSFORM_FORM_RULES[kind];
  const errors: TransformFormCheckError[] = [];

  if (normalizedText.length === 0) {
    errors.push({
      reason: "blank",
      message: "Transformed text must not be blank.",
    });
  }

  if (normalizedText.length > 0 && !CHECKABLE_TANKA_TEXT_PATTERN.test(normalizedText)) {
    errors.push({
      reason: "contains_uncheckable_characters",
      message: "Transformed text must use kana and supported tanka separators only.",
    });
  }

  const segments = splitTankaSegments(normalizedText).map((segment, index) => ({
    text: segment,
    moraCount: countJapaneseMora(segment),
    expectedMoraCount: expectedMoraCounts[index] ?? 0,
  }));

  if (segments.length !== expectedMoraCounts.length) {
    errors.push({
      reason: "segment_count_mismatch",
      message: `Transformed text must have ${expectedMoraCounts.length} segments.`,
    });
  }

  for (const [index, expectedMoraCount] of expectedMoraCounts.entries()) {
    const segment = segments[index];

    if (!segment || segment.moraCount !== expectedMoraCount) {
      errors.push({
        reason: "mora_count_mismatch",
        message: `Segment ${index + 1} must have ${expectedMoraCount} mora.`,
      });
    }
  }

  return {
    accepted: errors.length === 0,
    kind,
    normalizedText: segments.map((segment) => segment.text).join("\n"),
    segments,
    errors,
  };
}

export function normalizeTankaText(text: TankaText): PublicTankaText {
  return text
    .normalize("NFKC")
    .replaceAll(/\p{Cc}/gu, (character) =>
      character === "\n" || character === "\t" ? character : " ",
    )
    .trim();
}

export function countJapaneseMora(text: TankaText): number {
  const countableText = normalizeTankaText(text).replaceAll(IGNORED_FORM_CHARACTERS_PATTERN, "");
  let moraCount = 0;

  for (const character of countableText) {
    if (!MORA_CHAR_PATTERN.test(character)) {
      continue;
    }

    if (!SMALL_KANA_WITHOUT_OWN_MORA.has(character)) {
      moraCount += 1;
    }
  }

  return moraCount;
}

function splitTankaSegments(text: TankaText): string[] {
  const normalizedText = normalizeTankaText(text);

  if (normalizedText.length === 0) {
    return [];
  }

  const separatorPattern = EXPLICIT_SEGMENT_SEPARATOR_PATTERN.test(normalizedText)
    ? EXPLICIT_SEGMENT_SEPARATOR_PATTERN
    : INLINE_SEGMENT_SEPARATOR_PATTERN;

  return normalizedText
    .split(separatorPattern)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

export type AuthorDto = {
  id: EntityId;
  displayName: string;
  handle?: string;
};

export type PublicConversionTextDto =
  | {
      publicText: PublicTankaText;
      body?: never;
    }
  | {
      publicText?: never;
      body: PublicTankaText;
    };

export type PostDto = PublicConversionTextDto & {
  id: EntityId;
  author: AuthorDto;
  createdAt: IsoDateTimeString;
};

export type ReplyDto = PublicConversionTextDto & {
  id: EntityId;
  postId: EntityId;
  author: AuthorDto;
  createdAt: IsoDateTimeString;
};

export type TimelineItemDto = {
  post: PostDto;
  replies: ReplyDto[];
};

export type TimelineResponseDto = {
  items: TimelineItemDto[];
  nextCursor?: string;
};

export type CreatePostRequestDto = {
  body: TankaText;
};

export type CreatePostResponseDto = {
  post: PostDto;
};

export type CreateReplyRequestDto = {
  body: TankaText;
};

export type CreateReplyResponseDto = {
  reply: ReplyDto;
};

export type BoundaryEntityId = EntityId;
export type BoundaryIsoDateTimeString = IsoDateTimeString;
export type BoundaryTankaText = TankaText;
export type BoundaryPublicTankaText = PublicTankaText;
export type BoundaryAuthorDto = AuthorDto;
export type BoundaryPublicConversionTextDto = PublicConversionTextDto;
export type BoundaryPostDto = PostDto;
export type BoundaryReplyDto = ReplyDto;
export type BoundaryTimelineItemDto = TimelineItemDto;
export type BoundaryTimelineResponseDto = TimelineResponseDto;
export type BoundaryCreatePostRequestDto = CreatePostRequestDto;
export type BoundaryCreatePostResponseDto = CreatePostResponseDto;
export type BoundaryCreateReplyRequestDto = CreateReplyRequestDto;
export type BoundaryCreateReplyResponseDto = CreateReplyResponseDto;
