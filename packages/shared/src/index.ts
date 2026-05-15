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

export const TRANSFORM_ACTIVE_JOB_STATES = [
  "queued",
  "processing",
] as const satisfies readonly TransformJobState[];

export type TransformActiveJobState = (typeof TRANSFORM_ACTIVE_JOB_STATES)[number];

export const TRANSFORM_JOB_STATE_TRANSITIONS = [
  ["queued", "processing"],
  ["queued", "failed"],
  ["queued", "rejected"],
  ["processing", "succeeded"],
  ["processing", "failed"],
  ["processing", "rejected"],
] as const satisfies readonly (readonly [TransformJobState, TransformJobState])[];

export type TransformJobStateTransition = (typeof TRANSFORM_JOB_STATE_TRANSITIONS)[number];

export function isTransformTerminalJobState(
  state: TransformJobState,
): state is TransformTerminalJobState {
  return TRANSFORM_TERMINAL_JOB_STATES.some((terminalState) => terminalState === state);
}

export function isTransformActiveJobState(
  state: TransformJobState,
): state is TransformActiveJobState {
  return TRANSFORM_ACTIVE_JOB_STATES.some((activeState) => activeState === state);
}

export function canTransitionTransformJobState(
  from: TransformJobState,
  to: TransformJobState,
): boolean {
  return TRANSFORM_JOB_STATE_TRANSITIONS.some(
    ([transitionFrom, transitionTo]) => transitionFrom === from && transitionTo === to,
  );
}

export type TransformJobKind = "post_575" | "reply_77";

export const TRANSFORM_FORM_RULES = {
  post_575: [5, 7, 5],
  reply_77: [7, 7],
} as const satisfies Record<TransformJobKind, readonly number[]>;

// 案A: 初句・結句のみ ±1（字余り）を許容。中七は「中鈍病」の観点から厳守。
// 現代短歌・俳句の慣習に準拠し、感情の高ぶりを表現する字余りを初句・結句に限って認める。
const TRANSFORM_FORM_TOLERANCES_A = {
  post_575: [1, 0, 1],
  reply_77: [1, 1],
} as const satisfies Record<TransformJobKind, readonly number[]>;

// 案B: 全句 ±1 を許容。成功率を最大化したい場合に切り替える。
// 中七の字余りも通過するため、詩的品質よりも到達率を優先する場合に使用。
// biome-ignore lint/correctness/noUnusedVariables: intentionally kept as an alternative plan; swap with TOLERANCES_A above to activate
const TRANSFORM_FORM_TOLERANCES_B = {
  post_575: [1, 1, 1],
  reply_77: [1, 1],
} as const satisfies Record<TransformJobKind, readonly number[]>;

// 使用する許容幅プランをここで切り替える（A=詩的整合性優先 / B=成功率優先）
export const TRANSFORM_FORM_TOLERANCES = TRANSFORM_FORM_TOLERANCES_A;

export type TransformFormCheckReason =
  | "blank"
  | "contains_uncheckable_characters"
  | "segment_count_mismatch"
  | "mora_count_mismatch";

export type TransformFormCheckSegment = {
  text: string;
  moraCount: number;
  expectedMoraCount: number;
  tolerance: number;
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
  | "content_policy_violation"
  | "unauthorized"
  | "configuration_error";

export const TRANSFORM_SERVER_RETRYABLE_FAILURE_REASONS = [
  "timeout",
  "rate_limited",
  "provider_unavailable",
  "invalid_provider_response",
  "configuration_error",
  // LLM quality failure: not the user's fault — retrying the same input often succeeds
  "validation_failed",
] as const satisfies readonly TransformFailureReason[];

export type TransformServerRetryableFailureReason =
  (typeof TRANSFORM_SERVER_RETRYABLE_FAILURE_REASONS)[number];

export const TRANSFORM_CLIENT_REVISABLE_FAILURE_REASONS = [
  "provider_rejected",
  "input_limit_exceeded",
  "output_limit_exceeded",
  "cost_limit_exceeded",
  "prompt_injection_detected",
  "content_policy_violation",
  "unauthorized",
] as const satisfies readonly TransformFailureReason[];

export type TransformClientRevisableFailureReason =
  (typeof TRANSFORM_CLIENT_REVISABLE_FAILURE_REASONS)[number];

export type ClassifiedTransformFailureReason =
  | TransformServerRetryableFailureReason
  | TransformClientRevisableFailureReason;

type AssertTransformFailureReasonClassification<T extends never> = T;
export type TransformFailureReasonClassificationExhaustive =
  AssertTransformFailureReasonClassification<
    Exclude<TransformFailureReason, ClassifiedTransformFailureReason>
  >;
export type TransformFailureReasonClassificationExclusive =
  AssertTransformFailureReasonClassification<
    Extract<TransformServerRetryableFailureReason, TransformClientRevisableFailureReason>
  >;

export function isTransformServerRetryableFailureReason(
  reason: TransformFailureReason,
): reason is TransformServerRetryableFailureReason {
  return TRANSFORM_SERVER_RETRYABLE_FAILURE_REASONS.some(
    (retryableReason) => retryableReason === reason,
  );
}

export function isTransformClientRevisableFailureReason(
  reason: TransformFailureReason,
): reason is TransformClientRevisableFailureReason {
  return TRANSFORM_CLIENT_REVISABLE_FAILURE_REASONS.some(
    (revisableReason) => revisableReason === reason,
  );
}

export function getTransformRetryPolicy(reason: TransformFailureReason): TransformRetryPolicy {
  if (isTransformServerRetryableFailureReason(reason)) {
    return "server_retryable";
  }

  if (isTransformClientRevisableFailureReason(reason)) {
    return "client_revisable";
  }

  const unclassifiedReason: never = reason;
  throw new Error(`Unclassified transform failure reason: ${unclassifiedReason}`);
}

export function getTransformUserAction(reason: TransformFailureReason): TransformUserAction {
  return getTransformRetryPolicy(reason) === "server_retryable" ? "retry_later" : "revise_input";
}

export function getTransformPublicErrorCode(
  reason: TransformFailureReason,
): TransformPublicErrorCode {
  if (
    reason === "input_limit_exceeded" ||
    reason === "output_limit_exceeded" ||
    reason === "cost_limit_exceeded"
  ) {
    return "transform_limit_exceeded";
  }

  if (getTransformRetryPolicy(reason) === "client_revisable") {
    return "transform_input_rejected";
  }

  return "transform_failed";
}

export type TransformJobErrorDto = {
  code: TransformPublicErrorCode;
  reason: TransformFailureReason;
  message: string;
  retryPolicy: TransformRetryPolicy;
  userAction: TransformUserAction;
};

export function createTransformJobErrorDto(
  reason: TransformFailureReason,
  message: string,
): TransformJobErrorDto {
  return {
    code: getTransformPublicErrorCode(reason),
    reason,
    message,
    retryPolicy: getTransformRetryPolicy(reason),
    userAction: getTransformUserAction(reason),
  };
}

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
export type BoundaryTransformActiveJobState = TransformActiveJobState;
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
export type BoundaryTransformServerRetryableFailureReason = TransformServerRetryableFailureReason;
export type BoundaryTransformClientRevisableFailureReason = TransformClientRevisableFailureReason;
export type BoundaryTransformJobErrorDto = TransformJobErrorDto;
export type BoundaryTransformJobObservationDto = TransformJobObservationDto;
export type BoundaryTransformJobDto = TransformJobDto;
export type BoundaryTransformJobResponseDto = TransformJobResponseDto;

export type KanjiDisplayCheckReason =
  | "blank"
  | "contains_invalid_characters"
  | "segment_count_mismatch"
  | "segment_too_long";

export type KanjiDisplayCheckError = {
  reason: KanjiDisplayCheckReason;
  message: string;
};

export type KanjiDisplayCheckResult = {
  accepted: boolean;
  kind: TransformJobKind;
  normalizedText: PublicTankaText;
  segments: string[];
  errors: KanjiDisplayCheckError[];
};

export type BoundaryKanjiDisplayCheckReason = KanjiDisplayCheckReason;
export type BoundaryKanjiDisplayCheckError = KanjiDisplayCheckError;
export type BoundaryKanjiDisplayCheckResult = KanjiDisplayCheckResult;

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
  const tolerances = TRANSFORM_FORM_TOLERANCES[kind];
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
    tolerance: tolerances[index] ?? 0,
  }));

  if (segments.length !== expectedMoraCounts.length) {
    errors.push({
      reason: "segment_count_mismatch",
      message: `Transformed text must have ${expectedMoraCounts.length} segments.`,
    });
  }

  for (const [index, expectedMoraCount] of expectedMoraCounts.entries()) {
    const segment = segments[index];
    const tolerance = tolerances[index] ?? 0;

    if (!segment || Math.abs(segment.moraCount - expectedMoraCount) > tolerance) {
      const rangeLabel =
        tolerance === 0
          ? `exactly ${expectedMoraCount}`
          : `${expectedMoraCount - tolerance}–${expectedMoraCount + tolerance}`;
      errors.push({
        reason: "mora_count_mismatch",
        message: `Segment ${index + 1} must have ${rangeLabel} mora.`,
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

const DISPLAY_TEXT_MAX_SEGMENT_CHARS = 30;
const PUBLISHABLE_TANKA_DISPLAY_PATTERN =
  /^[\p{Script=Hiragana}\p{Script=Katakana}ー\p{Script=Han}\s　、，,。．.！？!?「」『』（）()［］[\]【】/／]+$/u;

export function checkPublishedTankaDisplayForm(
  kind: TransformJobKind,
  text: TankaText,
): KanjiDisplayCheckResult {
  const normalizedText = normalizeTankaText(text);
  const expectedSegmentCount = TRANSFORM_FORM_RULES[kind].length;
  const errors: KanjiDisplayCheckError[] = [];

  if (normalizedText.length === 0) {
    errors.push({ reason: "blank", message: "Display text must not be blank." });
  }

  if (normalizedText.length > 0 && !PUBLISHABLE_TANKA_DISPLAY_PATTERN.test(normalizedText)) {
    errors.push({
      reason: "contains_invalid_characters",
      message: "Display text must use kanji, kana, and supported tanka separators only.",
    });
  }

  const segments = splitTankaSegments(normalizedText);

  if (segments.length !== expectedSegmentCount) {
    errors.push({
      reason: "segment_count_mismatch",
      message: `Display text must have ${expectedSegmentCount} segments.`,
    });
  }

  for (const [index, segment] of segments.entries()) {
    if (segment.length > DISPLAY_TEXT_MAX_SEGMENT_CHARS) {
      errors.push({
        reason: "segment_too_long",
        message: `Segment ${index + 1} must be at most ${DISPLAY_TEXT_MAX_SEGMENT_CHARS} characters.`,
      });
    }
  }

  return {
    accepted: errors.length === 0,
    kind,
    normalizedText: segments.join("\n"),
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

export type AccountDto = AuthorDto;

export type CurrentSessionResponseDto =
  | {
      authenticated: true;
      account: AccountDto;
    }
  | {
      authenticated: false;
    };

export type WebAuthnRegistrationOptionsRequestDto = {
  displayName: string;
  handle?: string;
};

export type WebAuthnRegistrationOptionsResponseDto = {
  challengeId: EntityId;
  options: unknown;
};

export type WebAuthnRegistrationVerifyRequestDto = {
  challengeId: EntityId;
  credential: unknown;
};

export type WebAuthnRegistrationVerifyResponseDto = {
  verified: true;
  account: AccountDto;
};

export type WebAuthnAuthenticationOptionsRequestDto = Record<string, never>;

export type WebAuthnAuthenticationOptionsResponseDto = {
  challengeId: EntityId;
  options: unknown;
};

export type WebAuthnAuthenticationVerifyRequestDto = {
  challengeId: EntityId;
  credential: unknown;
};

export type WebAuthnAuthenticationVerifyResponseDto = {
  verified: true;
  account: AccountDto;
};

export type PublicConversionTextDto =
  | {
      publicText: PublicTankaText;
      readingText?: PublicTankaText;
      body?: never;
    }
  | {
      publicText?: never;
      body: PublicTankaText;
      readingText?: PublicTankaText;
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
export type BoundaryAccountDto = AccountDto;
export type BoundaryCurrentSessionResponseDto = CurrentSessionResponseDto;
export type BoundaryWebAuthnRegistrationOptionsRequestDto = WebAuthnRegistrationOptionsRequestDto;
export type BoundaryWebAuthnRegistrationOptionsResponseDto = WebAuthnRegistrationOptionsResponseDto;
export type BoundaryWebAuthnRegistrationVerifyRequestDto = WebAuthnRegistrationVerifyRequestDto;
export type BoundaryWebAuthnRegistrationVerifyResponseDto = WebAuthnRegistrationVerifyResponseDto;
export type BoundaryWebAuthnAuthenticationOptionsRequestDto =
  WebAuthnAuthenticationOptionsRequestDto;
export type BoundaryWebAuthnAuthenticationOptionsResponseDto =
  WebAuthnAuthenticationOptionsResponseDto;
export type BoundaryWebAuthnAuthenticationVerifyRequestDto = WebAuthnAuthenticationVerifyRequestDto;
export type BoundaryWebAuthnAuthenticationVerifyResponseDto =
  WebAuthnAuthenticationVerifyResponseDto;
export type BoundaryPublicConversionTextDto = PublicConversionTextDto;
export type BoundaryPostDto = PostDto;
export type BoundaryReplyDto = ReplyDto;
export type BoundaryTimelineItemDto = TimelineItemDto;
export type BoundaryTimelineResponseDto = TimelineResponseDto;
export type BoundaryCreatePostRequestDto = CreatePostRequestDto;
export type BoundaryCreatePostResponseDto = CreatePostResponseDto;
export type BoundaryCreateReplyRequestDto = CreateReplyRequestDto;
export type BoundaryCreateReplyResponseDto = CreateReplyResponseDto;
