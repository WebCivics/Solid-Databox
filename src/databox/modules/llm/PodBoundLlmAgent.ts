import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import type { DataboxModuleManifest } from '../DataboxModuleManifest';
import type { LlmBackend, LlmMessage } from './LlmBackend';
import type { PodRdfTools } from './PodRdfTools';
import type { ProvActivityLog } from './ProvActivityLog';

/**
 * The pod-bound LLM agent (CIV-B53): an assistive tool-calling loop — model proposes,
 * tools execute (pod reads / ephemeral SPARQL / SHACL-gated assertions), results feed
 * back — bounded steps, PROV-O logged, and never a boundary-decision path (CIV-B30 stays
 * the deterministic boundary).
 *
 * Data isolation is structural: the backend is a {@link LlmBackend} whose only I/O is the
 * loop itself — `OllamaHttpBackend` for server-side local inference, or a Wllama-worker
 * backend implementing the same contract in the browser shell. No inference call leaves
 * the device; the tools read the pod through the injected reader, never the open web.
 */

export interface AgentTurnResult {
  /** The final assistant text. */
  readonly content: string;
  /** Tool calls executed during the turn, in order. */
  readonly toolCalls: readonly { name: string; result: string }[];
  /** PROV-O activity IRI for this turn. */
  readonly activityIri: string;
  /** How many model round-trips the turn took. */
  readonly steps: number;
}

const SYSTEM_PROMPT =
  'You are a pod-bound assistant. Use the supplied tools for all pod reads and writes; ' +
  'never assert data the tools reject; never invent RDF — a rejected proposal is final.';

export class PodBoundLlmAgent {
  public constructor(
    private readonly backend: LlmBackend,
    private readonly tools: PodRdfTools,
    private readonly provenance: ProvActivityLog,
    /** The actor this agent acts for — recorded on every PROV-O activity. */
    private readonly actorWebId: string,
    /** Hard cap on tool-call round-trips per turn — a runaway loop terminates. */
    private readonly maxSteps = 8,
  ) {}

  /** Run one user turn through the tool-calling loop. */
  public async turn(userText: string): Promise<AgentTurnResult> {
    const messages: LlmMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ];
    const activityIri = this.provenance.open(this.actorWebId, this.backend.name, messages);
    const executed: { name: string; result: string }[] = [];

    try {
      for (let step = 0; step < this.maxSteps; step += 1) {
        const response = await this.backend.complete(messages, this.tools.specs());
        if (response.toolCalls.length === 0) {
          this.provenance.close(activityIri);
          return {
            content: response.content ?? '',
            toolCalls: executed,
            activityIri,
            steps: step + 1,
          };
        }
        this.provenance.recordToolCalls(activityIri, response.toolCalls);
        messages.push({ role: 'assistant', content: response.content ?? '', toolCalls: response.toolCalls });
        for (const call of response.toolCalls) {
          let result: string;
          try {
            result = await this.tools.execute(call.name, call.arguments);
          } catch (error: unknown) {
            // Tool errors are fed back as text — the model learns the refusal, never the stack.
            result = `Tool error: ${error instanceof Error ? error.message : String(error)}`;
          }
          executed.push({ name: call.name, result });
          messages.push({ role: 'tool', content: result, toolCallId: call.name });
        }
      }
      throw new BadRequestHttpError(`Agent exceeded ${this.maxSteps} tool steps — terminating the turn.`);
    } catch (error: unknown) {
      this.provenance.close(activityIri);
      throw error;
    }
  }
}

/** The module manifest — `external`: the licensing-undecided seam, droppable from a build. */
export const LLM_AGENT_MODULE: DataboxModuleManifest = {
  id: 'databox-llm-agent',
  name: 'Pod-bound local LLM agent',
  version: '0.1.0',
  description:
    'Assistive tool-calling LLM loop bound to the pod — Ollama/node-llama-cpp server-side ' +
    'or wllama browser-side; SHACL-gated writes, PROV-O audited.',
  license: 'MIT',
  packaging: 'external',
  runtimeDependencies: [
    { name: 'ollama | node-llama-cpp | @wllama/wllama', license: 'MIT', note: 'Local inference backend — one of' },
    { name: 'shacl-engine', license: 'MIT', note: 'SHACL gate for asserted writes' },
    { name: 'n3', license: 'MIT', note: 'RDF parsing' },
    { name: 'rdf-ext', license: 'MIT', note: 'Dataset factory for the SHACL gate' },
  ],
  capabilities: [ 'llm-inference', 'rdf-tools', 'shacl-gating', 'prov-audit' ],
  profiles: [ 'personal', 'household', 'organisation' ],
  routes: [],
};
