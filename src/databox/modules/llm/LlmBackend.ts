import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../../util/errors/InternalServerError';
import type { RemoteFetcher } from '../../personal/RemoteConsumeClient';

/**
 * The LLM backend contract (CIV-B53): the agent speaks OpenAI-style chat+tools to a
 * backend that never leaves the device/pod boundary.
 *
 *  - {@link OllamaHttpBackend} — a local Ollama daemon (`/api/chat` with `tools`) or
 *    `node-llama-cpp` behind the same shape; server-side inference on the Databox host.
 *  - The Wllama/browser path implements this contract inside the WASM worker — the agent
 *    code is identical; only the backend differs (the seam that keeps inference local
 *    regardless of where it runs).
 */

export interface LlmToolSpec {
  readonly name: string;
  readonly description: string;
  /** JSON-Schema object describing the tool's arguments. */
  readonly parameters: Record<string, unknown>;
}

export interface LlmToolCall {
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export interface LlmMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  /** For role='tool': which call this answers. */
  readonly toolCallId?: string;
  /** For assistant turns that emitted tool calls. */
  readonly toolCalls?: readonly LlmToolCall[];
}

export interface LlmResponse {
  /** Final assistant text (when no tool calls remain). */
  readonly content?: string;
  readonly toolCalls: readonly LlmToolCall[];
}

export interface LlmBackend {
  readonly name: string;
  complete: (messages: readonly LlmMessage[], tools: readonly LlmToolSpec[]) => Promise<LlmResponse>;
}

/**
 * Ollama `/api/chat` backend — local inference with native acceleration (CUDA/Metal),
 * OpenAI-compatible tool calling. The daemon runs on the Databox host; no request leaves
 * the machine. `node-llama-cpp` can be wrapped in the same contract when an in-process
 * model is preferred.
 */
export class OllamaHttpBackend implements LlmBackend {
  public readonly name = 'ollama';

  public constructor(
    baseUrl: string,
    private readonly model: string,
    private readonly fetcher: RemoteFetcher = defaultFetcher,
  ) {
    if (typeof baseUrl !== 'string' || baseUrl.trim().length === 0 || model.trim().length === 0) {
      throw new BadRequestHttpError('The Ollama backend needs a base URL and a model name.');
    }
    this.baseUrl = baseUrl.trim().replace(/\/$/u, '');
  }

  private readonly baseUrl: string;

  public async complete(
    messages: readonly LlmMessage[],
    tools: readonly LlmToolSpec[],
  ): Promise<LlmResponse> {
    const response = await this.fetcher(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: messages.map(message => ({
          role: message.role,
          content: message.content,
          ...message.toolCalls === undefined ?
              {} :
              { tool_calls: message.toolCalls.map(call => ({ function: call })) },
        })),
        tools: tools.map(spec => ({
          type: 'function',
          function: {
            name: spec.name,
            description: spec.description,
            parameters: spec.parameters,
          },
        })),
      }),
    });
    if (!response.ok) {
      throw new InternalServerError(`Ollama /api/chat returned ${response.status}.`);
    }
    const body = await response.json() as {
      message?: { content?: string; tool_calls?: { function?: { name?: string; arguments?: unknown }}[] };
    };
    const message = body.message ?? {};
    const toolCalls: LlmToolCall[] = (message.tool_calls ?? [])
      .filter((call): call is { function: { name: string; arguments: Record<string, unknown> }} =>
        typeof call.function?.name === 'string')
      .map(call => ({
        name: call.function.name,
        arguments: call.function.arguments ?? {},
      }));
    return {
      ...typeof message.content === 'string' && message.content.length > 0 ?
          { content: message.content } :
          {},
      toolCalls,
    };
  }
}

async function defaultFetcher(
  url: string,
  init?: Parameters<RemoteFetcher>[1],
): ReturnType<RemoteFetcher> {
  const response = await fetch(url, init);
  return { ok: response.ok, status: response.status, json: async(): Promise<unknown> => response.json() };
}
