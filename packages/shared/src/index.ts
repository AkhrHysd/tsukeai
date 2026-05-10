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
  | "service_unavailable";

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
