import type { LlmMessage, LlmToolCall } from './LlmBackend';

/**
 * PROV-O provenance for the pod-bound agent (CIV-B55): every agent cycle records a
 * semantic trace — prompt as Entity, inference as Activity, generation + tool calls as
 * derived Entities, agent bound to the actor's WebID. The log is in-memory by default;
 * callers persist `toTurtle()` into a pod log container (`/logs/agent/`).
 *
 * Deterministic by construction — the wrapper logs, never the model: the LLM cannot be
 * trusted to log its own behaviour.
 */

export interface ProvActivity {
  readonly activityIri: string;
  readonly startedAt: string;
  readonly actorWebId: string;
  readonly backend: string;
  readonly promptExcerpt: string;
  readonly toolCalls: readonly { name: string; argumentsJson: string }[];
  readonly outputIri?: string;
  readonly endedAt?: string;
}

export class ProvActivityLog {
  private readonly activities: ProvActivity[] = [];

  public constructor(private readonly baseIri: string, private readonly now: () => number = Date.now) {}

  /** Open an activity for a turn. Returns the activity IRI for `close`. */
  public open(actorWebId: string, backend: string, messages: readonly LlmMessage[]): string {
    const activityIri = `${this.baseIri}activity/${this.activities.length + 1}-${this.now()}`;
    const lastUser = [ ...messages ].reverse().find(message => message.role === 'user');
    this.activities.push({
      activityIri,
      startedAt: new Date(this.now()).toISOString(),
      actorWebId,
      backend,
      promptExcerpt: (lastUser?.content ?? '').slice(0, 280),
      toolCalls: [],
    });
    return activityIri;
  }

  /** Attach the tool calls the model emitted this cycle. */
  public recordToolCalls(activityIri: string, toolCalls: readonly LlmToolCall[]): void {
    const activity = this.find(activityIri);
    this.activities[this.activities.indexOf(activity)] = {
      ...activity,
      toolCalls: [
        ...activity.toolCalls,
        ...toolCalls.map(call => ({ name: call.name, argumentsJson: JSON.stringify(call.arguments) })),
      ],
    };
  }

  /** Close the activity with its output. */
  public close(activityIri: string, outputIri?: string): void {
    const activity = this.find(activityIri);
    this.activities[this.activities.indexOf(activity)] = {
      ...activity,
      ...outputIri === undefined ? {} : { outputIri },
      endedAt: new Date(this.now()).toISOString(),
    };
  }

  public list(): readonly ProvActivity[] {
    return [ ...this.activities ];
  }

  /** Serialize the log as PROV-O Turtle for writing to the pod log container. */
  public toTurtle(): string {
    const lines = [
      '@prefix prov: <http://www.w3.org/ns/prov#> .',
      '@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .',
      '',
    ];
    for (const activity of this.activities) {
      lines.push(
        `<${activity.activityIri}> a prov:Activity ;`,
        `  prov:wasAssociatedWith <${activity.actorWebId}> ;`,
        `  prov:startedAtTime "${activity.startedAt}"^^xsd:dateTime ;`,
        `  prov:used [ a prov:Entity ; prov:value ${JSON.stringify(activity.promptExcerpt)} ] .`,
      );
      for (const call of activity.toolCalls) {
        lines.push(
          `<${activity.activityIri}> prov:generated [`,
          `  a prov:Entity ; prov:value ${JSON.stringify(`tool:${call.name} ${call.argumentsJson}`)}`,
          `] .`,
        );
      }
      if (activity.outputIri !== undefined) {
        lines.push(`<${activity.outputIri}> a prov:Entity ; prov:wasGeneratedBy <${activity.activityIri}> .`);
      }
      if (activity.endedAt !== undefined) {
        lines.push(`<${activity.activityIri}> prov:endedAtTime "${activity.endedAt}"^^xsd:dateTime .`);
      }
    }
    return `${lines.join('\n')}\n`;
  }

  private find(activityIri: string): ProvActivity {
    const activity = this.activities.find(item => item.activityIri === activityIri);
    if (activity === undefined) {
      throw new Error(`Unknown activity ${activityIri}`);
    }
    return activity;
  }
}
