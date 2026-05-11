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

export type TransformTerminalJobState =
  (typeof TRANSFORM_TERMINAL_JOB_STATES)[number];

export const TRANSFORM_JOB_STATE_TRANSITIONS = [
  ["queued", "processing"],
  ["queued", "failed"],
  ["queued", "rejected"],
  ["processing", "succeeded"],
  ["processing", "failed"],
  ["processing", "rejected"],
] as const satisfies readonly (readonly [TransformJobState, TransformJobState])[];

export type TransformJobStateTransition =
  (typeof TRANSFORM_JOB_STATE_TRANSITIONS)[number];

export type TransformJobKind = "post_575" | "reply_77";

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

export type AuthorDto = {
  id: EntityId;
  displayName: string;
  handle?: string;
};

export type PostDto = {
  id: EntityId;
  author: AuthorDto;
  body: PublicTankaText;
  createdAt: IsoDateTimeString;
};

export type ReplyDto = {
  id: EntityId;
  postId: EntityId;
  author: AuthorDto;
  body: PublicTankaText;
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
