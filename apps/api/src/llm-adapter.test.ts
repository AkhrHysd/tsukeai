import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  createLlmAdapter,
  normalizeLlmInputForTest,
  normalizeProviderOutputForTest,
} from "./llm-adapter.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("LLM adapter normalization", () => {
  it("normalizes source input only before sending it to the provider", async () => {
    let providerBody:
      | { messages: Array<{ role: string; content: string }>; temperature: number }
      | undefined;
    globalThis.fetch = (async (_input, init) => {
      providerBody = JSON.parse(String(init?.body));

      return jsonResponse({
        choices: [{ message: { content: "あさひさす\nこころしずかに\nはるをまつ" } }],
      });
    }) as typeof fetch;

    await createLlmAdapter(testBindings()).transformText({
      kind: "post_575",
      input: "　春\t\tの\u0000　空\r\n  １２３  ",
      jobId: "job-1",
    });

    assert.ok(providerBody);
    const systemMessage = providerBody.messages.find((message) => message.role === "system");
    const userMessage = providerBody.messages.find((message) => message.role === "user");

    assert.match(systemMessage?.content ?? "", /grounded in the source text/);
    assert.match(
      systemMessage?.content ?? "",
      /Do NOT add a season, weather, sky, wind, flower, moon/,
    );
    assert.match(
      systemMessage?.content ?? "",
      /only when it follows from the source text or parent post context/,
    );
    assert.match(userMessage?.content ?? "", /source_text_json: "春 の 空 123"/);
    assert.match(userMessage?.content ?? "", /Line 1: 4–6 \(ideally 5\) mora/);
    assert.match(userMessage?.content ?? "", /Line 2: exactly 7 mora/);
    assert.match(userMessage?.content ?? "", /Line 3: 4–6 \(ideally 5\) mora/);
    assert.equal(providerBody.temperature, 0);
  });

  it("repairs invalid provider output on a later attempt", async () => {
    const providerOutputs = ["あさひ\nこころ\nはる", "あさひさす\nこころしずかに\nはるをまつ"];
    const prompts: string[] = [];
    const temperatures: number[] = [];
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        messages: Array<{ role: string; content: string }>;
        temperature: number;
      };
      prompts.push(body.messages.at(-1)?.content ?? "");
      temperatures.push(body.temperature);
      const content = providerOutputs.shift();

      return jsonResponse({
        choices: [{ message: { content } }],
      });
    }) as typeof fetch;

    const result = await createLlmAdapter(testBindings({ LLM_MAX_RETRIES: "1" })).transformText({
      kind: "post_575",
      input: "春の空",
      jobId: "job-2",
    });

    assert.equal(result.text, "あさひさす\nこころしずかに\nはるをまつ");
    assert.equal(result.attempts, 2);
    assert.match(prompts[1] ?? "", /Repair task:/);
    assert.match(prompts[1] ?? "", /validation_errors:/);
    assert.match(prompts[1] ?? "", /Change only the words needed/);
    assert.deepEqual(temperatures, [0, 0.2]);
  });

  it("builds reply prompts around the parent 5-7-5 without asking for a full tanka", async () => {
    let providerBody:
      | { messages: Array<{ role: string; content: string }>; temperature: number }
      | undefined;
    globalThis.fetch = (async (_input, init) => {
      providerBody = JSON.parse(String(init?.body));

      return jsonResponse({
        choices: [{ message: { content: "ゆめはさめず\nあけゆくそらかな" } }],
      });
    }) as typeof fetch;

    const result = await createLlmAdapter(testBindings()).transformText({
      kind: "reply_77",
      input: "まだ夢の余韻がある",
      jobId: "job-reply-1",
      parentPost: {
        id: "post-1",
        publicText: "朝日射す\n心静かに\n春を待つ",
      },
    });

    assert.equal(result.text, "ゆめはさめず\nあけゆくそらかな");
    assert.ok(providerBody);
    const systemMessage = providerBody.messages.find((message) => message.role === "system");
    const userMessage = providerBody.messages.find((message) => message.role === "user");

    assert.match(systemMessage?.content ?? "", /7-7 with allowed variation/);
    assert.match(userMessage?.content ?? "", /Line 1: 6–8 \(ideally 7\) mora/);
    assert.match(userMessage?.content ?? "", /Line 2: 6–8 \(ideally 7\) mora/);
    assert.match(userMessage?.content ?? "", /DO NOT repeat or rewrite it/);
    assert.match(userMessage?.content ?? "", /ONLY the missing 7-7 lower phrase/);
    assert.match(userMessage?.content ?? "", /discard the first three lines/);
    assert.doesNotMatch(userMessage?.content ?? "", /Line 3:/);
  });

  it("passes original source orthography to kanji display conversion", async () => {
    let providerBody: { messages: Array<{ role: string; content: string }> } | undefined;
    globalThis.fetch = (async (_input, init) => {
      providerBody = JSON.parse(String(init?.body));

      return jsonResponse({
        choices: [{ message: { content: "花をみる\n夢にかえる\n春の風" } }],
      });
    }) as typeof fetch;

    const result = await createLlmAdapter(testBindings()).kanjiDisplayText({
      kind: "post_575",
      kanaText: "はなをみる\nゆめにかえる\nはるのかぜ",
      sourceText: "花を見るより　ゆめにかえる",
      jobId: "job-kanji-1",
    });

    assert.equal(result.text, "花をみる\n夢にかえる\n春の風");
    assert.ok(providerBody);
    const systemMessage = providerBody.messages.find((message) => message.role === "system");
    const userMessage = providerBody.messages.find((message) => message.role === "user");

    assert.match(systemMessage?.content ?? "", /preserve the user's original orthography/);
    assert.match(systemMessage?.content ?? "", /keep that word in hiragana/);
    assert.match(userMessage?.content ?? "", /source_text_json: "花を見るより ゆめにかえる"/);
    assert.match(userMessage?.content ?? "", /orthography preference reference/);
    assert.match(userMessage?.content ?? "", /kanji\/kana\/okurigana choices/);
  });

  it("cleans common provider output noise before validation", () => {
    const normalized = normalizeProviderOutputForTest(
      "post_575",
      "1. 「あさひさす」 [5]\n- こころ　しずかに\n。\n・ はるをまつ",
    );

    assert.equal(normalized, "あさひさす\nこころしずかに\nはるをまつ");
  });

  it("normalizes whitespace, control characters, and full-width ASCII in LLM input", () => {
    assert.equal(
      normalizeLlmInputForTest("　春\tの\u0000空\r\nＡＢＣ  １２３　"),
      "春 の 空 ABC 123",
    );
  });
});

function testBindings(overrides: Record<string, string> = {}) {
  return {
    LLM_API_KEY: "test-key",
    LLM_BASE_URL: "https://provider.example.test/v1/chat/completions",
    LLM_MODEL: "test-model",
    ...overrides,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
