import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import type { DataboxModuleManifest } from '../DataboxModuleManifest';
import type { AgentTurnResult, PodBoundLlmAgent } from './PodBoundLlmAgent';

/**
 * The voice-intent surface (CIV-B56) — the server-side half of the local voice pipeline.
 *
 * The acoustic side (whisper.wasm ASR in, Piper/Transformers.js TTS out) runs in the device shell —
 * inference never leaves the device, so only a *transcript* reaches here. This class is the boundary
 * where a spoken request becomes a pod action: it takes the ASR transcript and runs it through the
 * SAME bounded, SHACL-gated {@link PodBoundLlmAgent} loop the text path uses — a voice intent can
 * never write free-text to the pod; it can only propose, and the SHACL gate disposes.
 *
 * The pipeline validates the transcript (non-empty, bounded) so a malformed/degenerate ASR result
 * fails closed rather than driving the tool loop, and returns a speakable response plus the tool
 * outcomes for the client to render/TTS.
 */

export interface VoiceTurnResult {
  /** The assistant text the device TTS speaks back. */
  readonly spokenText: string;
  /** Tool calls the turn executed (read/assert) — surfaced for a visual trace alongside the audio. */
  readonly toolCalls: readonly { name: string; result: string }[];
  /** PROV-O activity IRI for audit. */
  readonly activityIri: string;
  /** Confidence/empty-transcript flag — `true` when the ASR result was too thin to act on. */
  readonly transcriptRejected: boolean;
}

const MAX_TRANSCRIPT_CHARS = 4_000;

export class VoiceIntentPipeline {
  public constructor(
    private readonly agent: PodBoundLlmAgent,
    /** A conservative confidence floor — below it the transcript is treated as unintelligible. */
    private readonly minTranscriptConfidence = 0.3,
  ) {}

  /**
   * Run a spoken request. `transcript` is the ASR text; `confidence` (0–1) is the recogniser's own
   * score. A blank or low-confidence transcript returns a speakable "I didn't catch that" WITHOUT
   * touching the agent/tools — a voice error never becomes a pod write.
   */
  public async speak(transcript: string, confidence = 1): Promise<VoiceTurnResult> {
    const text = transcript.trim();
    if (text.length === 0 || confidence < this.minTranscriptConfidence) {
      return {
        spokenText: 'Sorry, I didn\'t catch that — could you say it again?',
        toolCalls: [],
        activityIri: '',
        transcriptRejected: true,
      };
    }
    if (text.length > MAX_TRANSCRIPT_CHARS) {
      throw new BadRequestHttpError('Voice transcript exceeds the maximum length (fail closed).');
    }
    const result: AgentTurnResult = await this.agent.turn(text);
    return {
      spokenText: result.content,
      toolCalls: result.toolCalls,
      activityIri: result.activityIri,
      transcriptRejected: false,
    };
  }
}

/** The module manifest — `external`: the voice stack (whisper/piper/wllama) is a droppable seam. */
export const VOICE_INTENT_MODULE: DataboxModuleManifest = {
  id: 'databox-voice-intent',
  name: 'Pod-bound voice intent pipeline',
  version: '0.1.0',
  description:
    'Voice-in/voice-out assistive agent — whisper.wasm ASR + wllama + Piper TTS in the device shell; ' +
    'the transcript drives the same SHACL-gated tool loop, never free-text writes.',
  license: 'MIT',
  packaging: 'external',
  runtimeDependencies: [
    { name: '@wllama/wllama', license: 'MIT', note: 'Local WASM inference in the device shell' },
    { name: 'whisper.wasm | @xenova/transformers', license: 'MIT', note: 'On-device ASR' },
    { name: 'piper | @xenova/transformers', license: 'MIT', note: 'On-device TTS' },
  ],
  capabilities: [ 'voice-asr', 'voice-tts', 'llm-inference', 'shacl-gating' ],
  profiles: [ 'personal', 'household' ],
  routes: [],
};
