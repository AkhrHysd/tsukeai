import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkPublishedTankaDisplayForm } from "./index.ts";

describe("checkPublishedTankaDisplayForm", () => {
  describe("post_575", () => {
    it("accepts valid kanji-kana mixed 5-7-5", () => {
      const result = checkPublishedTankaDisplayForm("post_575", "朝日射す\n心静かに\n春を待つ");
      assert.equal(result.accepted, true);
      assert.deepEqual(result.segments, ["朝日射す", "心静かに", "春を待つ"]);
    });

    it("accepts kana-only fallback text", () => {
      const result = checkPublishedTankaDisplayForm(
        "post_575",
        "あさひさす\nこころしずかに\nはるをまつ",
      );
      assert.equal(result.accepted, true);
      assert.equal(result.segments.length, 3);
    });

    it("rejects blank text", () => {
      const result = checkPublishedTankaDisplayForm("post_575", "");
      assert.equal(result.accepted, false);
      assert.ok(result.errors.some((e) => e.reason === "blank"));
    });

    it("rejects text with only 2 segments", () => {
      const result = checkPublishedTankaDisplayForm("post_575", "朝日射す\n心静かに");
      assert.equal(result.accepted, false);
      assert.ok(result.errors.some((e) => e.reason === "segment_count_mismatch"));
    });

    it("rejects text with romaji", () => {
      const result = checkPublishedTankaDisplayForm("post_575", "haru wo matsu\nkaze ga fuku\naki");
      assert.equal(result.accepted, false);
      assert.ok(result.errors.some((e) => e.reason === "contains_invalid_characters"));
    });

    it("rejects text with digits", () => {
      const result = checkPublishedTankaDisplayForm("post_575", "123\n456\n789");
      assert.equal(result.accepted, false);
      assert.ok(result.errors.some((e) => e.reason === "contains_invalid_characters"));
    });

    it("rejects a segment exceeding 30 characters", () => {
      const longSegment = "春".repeat(31);
      const result = checkPublishedTankaDisplayForm(
        "post_575",
        `${longSegment}\n心静かに\n春を待つ`,
      );
      assert.equal(result.accepted, false);
      assert.ok(result.errors.some((e) => e.reason === "segment_too_long"));
    });

    it("accepts a segment exactly 30 characters long", () => {
      const maxSegment = "春".repeat(30);
      const result = checkPublishedTankaDisplayForm(
        "post_575",
        `${maxSegment}\n心静かに\n春を待つ`,
      );
      assert.ok(
        result.accepted || !result.errors.some((e) => e.reason === "segment_too_long"),
        "segment of exactly 30 chars should not trigger segment_too_long",
      );
    });

    it("normalizes newline-separated text correctly", () => {
      const result = checkPublishedTankaDisplayForm("post_575", "朝日射す\n心静かに\n春を待つ");
      assert.equal(result.normalizedText, "朝日射す\n心静かに\n春を待つ");
    });
  });

  describe("reply_77", () => {
    it("accepts valid kanji-kana mixed 7-7", () => {
      const result = checkPublishedTankaDisplayForm("reply_77", "星を数えて\n夜が明けゆく");
      assert.equal(result.accepted, true);
      assert.deepEqual(result.segments, ["星を数えて", "夜が明けゆく"]);
    });

    it("accepts kana-only fallback text", () => {
      const result = checkPublishedTankaDisplayForm("reply_77", "ほしをかぞえて\nよるがあけゆく");
      assert.equal(result.accepted, true);
      assert.equal(result.segments.length, 2);
    });

    it("rejects text with 3 segments", () => {
      const result = checkPublishedTankaDisplayForm(
        "reply_77",
        "星を数えて\n夜が明けゆく\n余分な句",
      );
      assert.equal(result.accepted, false);
      assert.ok(result.errors.some((e) => e.reason === "segment_count_mismatch"));
    });

    it("rejects emoji", () => {
      const result = checkPublishedTankaDisplayForm("reply_77", "星を数えて🌟\n夜が明けゆく");
      assert.equal(result.accepted, false);
      assert.ok(result.errors.some((e) => e.reason === "contains_invalid_characters"));
    });
  });
});
