import type { AccountDto, AuthorDto, EntityId, IsoDateTimeString } from "@tsukeai/shared";
import type { TimelinePostView, TimelineReplyView } from "../app/timeline-item";

export const storyAccount: AccountDto = {
  id: "account-story" as EntityId,
  displayName: "詠み人",
};

export const storyAuthor: AuthorDto = {
  id: "author-story" as EntityId,
  displayName: "春野",
};

export const storyOtherAuthor: AuthorDto = {
  id: "author-other" as EntityId,
  displayName: "秋山",
};

export const storyPost: TimelinePostView = {
  id: "post-story" as EntityId,
  author: storyAuthor,
  publicText: "春風や まだ名を知らぬ 花の影",
  readingText: "はるかぜや\nまだなをしらぬ\nはなのかげ",
  createdAt: "2026-05-16T12:00:00.000Z" as IsoDateTimeString,
};

export const storyReply: TimelineReplyView = {
  id: "reply-story-1" as EntityId,
  author: storyOtherAuthor,
  publicText: "夕べの道に 香り残して",
  readingText: "ゆうべのみちに\nかおりのこして",
  createdAt: "2026-05-16T12:20:00.000Z" as IsoDateTimeString,
  canDelete: false,
};

export const storyDeletableReply: TimelineReplyView = {
  id: "reply-story-2" as EntityId,
  author: storyAuthor,
  publicText: "雨待つ庭の 石もやわらぐ",
  readingText: "あめまつにわの\nいしもやわらぐ",
  createdAt: "2026-05-16T12:40:00.000Z" as IsoDateTimeString,
  canDelete: true,
};

export const storyReplies: TimelineReplyView[] = [storyReply, storyDeletableReply];
