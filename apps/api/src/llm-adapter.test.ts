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
    const userMessage = providerBody.messages.find((message) => message.role === "user");

    assert.match(userMessage?.content ?? "", /source_text_json: "春 の 空 123"/);
    assert.match(userMessage?.content ?? "", /Line 1: exactly 5 mora/);
    assert.match(userMessage?.content ?? "", /Line 2: exactly 7 mora/);
    assert.match(userMessage?.content ?? "", /Line 3: exactly 5 mora/);
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
