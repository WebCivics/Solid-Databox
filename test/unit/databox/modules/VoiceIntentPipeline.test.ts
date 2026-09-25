import type { AgentTurnResult, PodBoundLlmAgent } from '../../../../src/databox/modules/llm/PodBoundLlmAgent';
import { VoiceIntentPipeline } from '../../../../src/databox/modules/llm/VoiceIntentPipeline';

/** A stub agent — the loop itself is covered by PodBoundLlmAgent.test; here we prove the boundary. */
function agent(result: AgentTurnResult, seen: string[]): PodBoundLlmAgent {
  return {
    turn: jest.fn(async(text: string): Promise<AgentTurnResult> => {
      seen.push(text);
      return result;
    }),
  } as unknown as PodBoundLlmAgent;
}

function turn(content = 'Done.'): AgentTurnResult {
  return { content, toolCalls: [{ name: 'read_pod_resource', result: '{}' }], activityIri: 'act-1', steps: 1 };
}

describe('VoiceIntentPipeline — a voice intent rides the SHACL-gated loop (CIV-B56)', (): void => {
  it('a clear transcript runs the agent and returns a speakable result.', async(): Promise<void> => {
    const seen: string[] = [];
    const pipeline = new VoiceIntentPipeline(agent(turn('Read your inbox.'), seen));
    const out = await pipeline.speak('  read my inbox  ');
    expect(seen).toEqual([ 'read my inbox' ]); // Trimmed transcript reaches the loop.
    expect(out.spokenText).toBe('Read your inbox.');
    expect(out.transcriptRejected).toBe(false);
    expect(out.activityIri).toBe('act-1');
  });

  it('a blank transcript never reaches the agent — no pod write from a noise.', async(): Promise<void> => {
    const seen: string[] = [];
    const pipeline = new VoiceIntentPipeline(agent(turn(), seen));
    const out = await pipeline.speak('   ');
    expect(seen).toEqual([]); // The agent/tools were never invoked.
    expect(out.transcriptRejected).toBe(true);
    expect(out.spokenText).toContain('didn\'t catch that');
  });

  it('a low-confidence ASR result is treated as unintelligible — agent not consulted.', async(): Promise<void> => {
    const seen: string[] = [];
    const pipeline = new VoiceIntentPipeline(agent(turn(), seen));
    const out = await pipeline.speak('gibberish', 0.1);
    expect(seen).toEqual([]);
    expect(out.transcriptRejected).toBe(true);
  });

  it('an over-long transcript fails closed rather than driving the loop.', async(): Promise<void> => {
    const pipeline = new VoiceIntentPipeline(agent(turn(), []));
    await expect(pipeline.speak('x'.repeat(4_001))).rejects.toThrow('maximum length');
  });
});
