export type LlmAdapterBindings = {
  LLM_API_KEY?: string;
  LLM_BASE_URL?: string;
  LLM_MODEL?: string;
  LLM_TIMEOUT_MS?: string;
  LLM_MAX_INPUT_CHARS?: string;
  LLM_MAX_OUTPUT_TOKENS?: string;
  LLM_MAX_RETRIES?: string;
};

export type TransformKind = "post_575" | "reply_77";

export type TransformTextRequest = {
  kind: TransformKind;
  input: string;
  jobId: string;
  remainingCallBudget?: number;
};

export type TransformTextResponse = {
  text: string;
  model: string;
  attempts: number;
  durationMs: number;
};

export type LlmAdapterErrorCode =
  | "configuration_error"
  | "cost_limit_exceeded"
  | "input_limit_exceeded"
  | "output_limit_exceeded"
  | "timeout"
  | "rate_limited"
  | "provider_unavailable"
  | "provider_rejected"
  | "invalid_provider_response";

export class LlmAdapterError extends Error {
  constructor(
    readonly code: LlmAdapterErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "LlmAdapterError";
  }
}

type LlmAdapterConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxInputChars: number;
  maxOutputTokens: number;
  maxAttempts: number;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const DEFAULT_LLM_BASE_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_LLM_MODEL = "gpt-4o-mini";
const DEFAULT_LLM_TIMEOUT_MS = 8_000;
const DEFAULT_LLM_MAX_INPUT_CHARS = 1_000;
const DEFAULT_LLM_MAX_OUTPUT_TOKENS = 96;
const DEFAULT_LLM_MAX_RETRIES = 1;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 20_000;
const MIN_OUTPUT_TOKENS = 16;
const MAX_OUTPUT_TOKENS = 256;
const MIN_INPUT_CHARS = 1;
const MAX_INPUT_CHARS = 4_000;
const MIN_RETRIES = 0;
const MAX_RETRIES = 2;

export type LlmAdapter = ReturnType<typeof createLlmAdapter>;

export function createLlmAdapter(bindings: LlmAdapterBindings) {
  const config = readConfig(bindings);

  return {
    async transformText(
      request: TransformTextRequest,
    ): Promise<TransformTextResponse> {
      assertRequestWithinLimits(request, config);

      const startedAt = Date.now();
      let lastError: LlmAdapterError | undefined;
      const maxAttempts = Math.min(
        config.maxAttempts,
        request.remainingCallBudget ?? config.maxAttempts,
      );

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const text = await requestCompletion(request, config);

          return {
            text,
            model: config.model,
            attempts: attempt,
            durationMs: Date.now() - startedAt,
          };
        } catch (error) {
          const adapterError = toAdapterError(error);
          lastError = adapterError;

          if (!adapterError.retryable || attempt === maxAttempts) {
            throw adapterError;
          }
        }
      }

      throw (
        lastError ??
        new LlmAdapterError(
          "provider_unavailable",
          "LLM provider did not return a result.",
          true,
        )
      );
    },
  };
}

function readConfig(bindings: LlmAdapterBindings): LlmAdapterConfig {
  if (!bindings.LLM_API_KEY) {
    throw new LlmAdapterError(
      "configuration_error",
      "LLM_API_KEY secret is not configured.",
      false,
    );
  }

  return {
    apiKey: bindings.LLM_API_KEY,
    baseUrl: bindings.LLM_BASE_URL ?? DEFAULT_LLM_BASE_URL,
    model: bindings.LLM_MODEL ?? DEFAULT_LLM_MODEL,
    timeoutMs: readInteger(
      bindings.LLM_TIMEOUT_MS,
      DEFAULT_LLM_TIMEOUT_MS,
      MIN_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    ),
    maxInputChars: readInteger(
      bindings.LLM_MAX_INPUT_CHARS,
      DEFAULT_LLM_MAX_INPUT_CHARS,
      MIN_INPUT_CHARS,
      MAX_INPUT_CHARS,
    ),
    maxOutputTokens: readInteger(
      bindings.LLM_MAX_OUTPUT_TOKENS,
      DEFAULT_LLM_MAX_OUTPUT_TOKENS,
      MIN_OUTPUT_TOKENS,
      MAX_OUTPUT_TOKENS,
    ),
    maxAttempts:
      readInteger(
        bindings.LLM_MAX_RETRIES,
        DEFAULT_LLM_MAX_RETRIES,
        MIN_RETRIES,
        MAX_RETRIES,
      ) + 1,
  };
}

function readInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, minimum), maximum);
}

function assertRequestWithinLimits(
  request: TransformTextRequest,
  config: LlmAdapterConfig,
): void {
  if (request.input.length > config.maxInputChars) {
    throw new LlmAdapterError(
      "input_limit_exceeded",
      "Transform input exceeds the configured LLM adapter limit.",
      false,
    );
  }

  if (
    request.remainingCallBudget !== undefined &&
    (!Number.isInteger(request.remainingCallBudget) ||
      request.remainingCallBudget < 1)
  ) {
    throw new LlmAdapterError(
      "cost_limit_exceeded",
      "Transform request has no remaining LLM call budget.",
      false,
    );
  }
}

async function requestCompletion(
  request: TransformTextRequest,
  config: LlmAdapterConfig,
): Promise<string> {
  const response = await fetchWithTimeout(
    config.baseUrl,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: buildMessages(request),
        max_tokens: config.maxOutputTokens,
        temperature: 0.2,
      }),
    },
    config.timeoutMs,
  );

  if (!response.ok) {
    throw errorForProviderStatus(response.status);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const text = payload.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new LlmAdapterError(
      "invalid_provider_response",
      "LLM provider response did not include text content.",
      true,
    );
  }

  if (text.length > config.maxOutputTokens * 4) {
    throw new LlmAdapterError(
      "output_limit_exceeded",
      "LLM provider response exceeded the adapter output limit.",
      false,
    );
  }

  return text;
}

function buildMessages(request: TransformTextRequest) {
  const form =
    request.kind === "post_575"
      ? "5-7-5 の上の句"
      : "7-7 の返信句";

  return [
    {
      role: "system",
      content:
        "You transform private user input into a short Japanese tanka fragment. Return only the transformed public text.",
    },
    {
      role: "user",
      content: `job_id: ${request.jobId}\nform: ${form}\ninput:\n${request.input}`,
    },
  ];
}

async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init: NonNullable<Parameters<typeof fetch>[1]>,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new LlmAdapterError(
        "timeout",
        "LLM provider request timed out.",
        true,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function errorForProviderStatus(status: number): LlmAdapterError {
  if (status === 429) {
    return new LlmAdapterError(
      "rate_limited",
      "LLM provider rate limit was reached.",
      true,
    );
  }

  if (status >= 500) {
    return new LlmAdapterError(
      "provider_unavailable",
      "LLM provider is temporarily unavailable.",
      true,
    );
  }

  return new LlmAdapterError(
    "provider_rejected",
    "LLM provider rejected the transform request.",
    false,
  );
}

function toAdapterError(error: unknown): LlmAdapterError {
  if (error instanceof LlmAdapterError) {
    return error;
  }

  return new LlmAdapterError(
    "provider_unavailable",
    "LLM provider request failed.",
    true,
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
