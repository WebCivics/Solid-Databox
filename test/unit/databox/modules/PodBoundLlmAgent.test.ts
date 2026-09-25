import { OxigraphModule } from '../../../../src/databox/modules/oxigraph/OxigraphModule';
import { PodBoundLlmAgent } from '../../../../src/databox/modules/llm/PodBoundLlmAgent';
import type { LlmBackend, LlmMessage, LlmToolSpec } from '../../../../src/databox/modules/llm/LlmBackend';
import { PodRdfTools } from '../../../../src/databox/modules/llm/PodRdfTools';
import { ProvActivityLog } from '../../../../src/databox/modules/llm/ProvActivityLog';

const SHAPES = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
ex:CheckInShape a sh:NodeShape ;
  sh:targetClass ex:CheckIn ;
  sh:property [ sh:path ex:siteNumber ; sh:minCount 1 ; sh:maxCount 1 ] .
`;

const WEBID = 'http://localhost:3100/person/profile/card#me';

/** A scripted backend: first call emits the scripted tool calls, then a final text reply. */
interface ScriptedPlan {
  calls: { name: string; arguments: Record<string, unknown> }[];
  reply: string;
}

function scriptedBackend(plan: ScriptedPlan): LlmBackend {
  let first = true;
  return {
    name: 'scripted',
    complete: async(messages: readonly LlmMessage[], tools: readonly LlmToolSpec[]) => {
      void tools;
      if (first) {
        first = false;
        return { toolCalls: plan.calls };
      }
      return { content: plan.reply, toolCalls: []};
    },
  };
}

function fixture(backend: LlmBackend): {
  agent: PodBoundLlmAgent;
  committed: string[];
  log: ProvActivityLog;
} {
  const committed: string[] = [];
  const log = new ProvActivityLog('http://localhost:3100/person/logs/agent/', (): number => 1_700_000_000_000);
  const tools = new PodRdfTools(
    { read: async(): Promise<{ body: string }> => ({ body: '<http://ex/a> <http://ex/b> "pod data" .' }) },
    new OxigraphModule(),
    { shapesTurtle: SHAPES, committer: { commit: async(turtle): Promise<void> => {
      committed.push(turtle);
    } }},
  );
  return { agent: new PodBoundLlmAgent(backend, tools, log, WEBID), committed, log };
}

describe('PodBoundLlmAgent', (): void => {
  it('runs a tool-call turn: query → committed assertion → provenance recorded.', async(): Promise<void> => {
    const valid = '@prefix ex: <http://example.org/> . ex:a a ex:CheckIn ; ex:siteNumber 4 .';
    const { agent, committed, log } = fixture(scriptedBackend({
      calls: [
        { name: 'query_pod_graph', arguments: { rdf: valid, sparql: 'ASK { ?s a <http://example.org/CheckIn> }' }},
        { name: 'propose_rdf_assertion', arguments: { turtle: valid }},
      ],
      reply: 'Checked you in to site 4.',
    }));
    const result = await agent.turn('Check me in to site 4');
    expect(result.content).toBe('Checked you in to site 4.');
    expect(result.toolCalls).toHaveLength(2);
    expect(committed).toHaveLength(1);
    const activity = log.list()[0];
    expect(activity.actorWebId).toBe(WEBID);
    expect(activity.toolCalls.map(call => call.name)).toEqual([ 'query_pod_graph', 'propose_rdf_assertion' ]);
    expect(log.toTurtle()).toContain('prov:Activity');
  });

  it('rejects a SHACL-violating assertion — the model proposes, the shape disposes.', async(): Promise<void> => {
    const invalid = '@prefix ex: <http://example.org/> . ex:a a ex:CheckIn .'; // No siteNumber
    const { agent, committed } = fixture(scriptedBackend({
      calls: [{ name: 'propose_rdf_assertion', arguments: { turtle: invalid }}],
      reply: 'The check-in lacked a site number.',
    }));
    const result = await agent.turn('Check me in');
    expect(committed).toHaveLength(0);
    expect(result.toolCalls[0].result).toContain('Rejected: SHACL');
  });

  it('a tool error feeds back as text and never crashes the turn.', async(): Promise<void> => {
    const { agent } = fixture(scriptedBackend({
      calls: [{ name: 'nonexistent_tool', arguments: {}}],
      reply: 'I could not use that tool.',
    }));
    const result = await agent.turn('do something');
    expect(result.toolCalls[0].result).toContain('Unknown tool');
    expect(result.content).toContain('could not');
  });

  it('terminates a runaway loop at maxSteps.', async(): Promise<void> => {
    const forever: LlmBackend = {
      name: 'loop',
      complete: async(): ReturnType<LlmBackend['complete']> =>
        ({ toolCalls: [{ name: 'read_pod_resource', arguments: { iri: 'x' }}]}),
    };
    const { agent } = fixture(forever);
    await expect(agent.turn('loop forever')).rejects.toThrow('exceeded 8 tool steps');
  });
});
