/**
 * Licensed QualiaDB / `wasm-webcivics` engine loader.
 *
 * LICENSE: the bridge source is CC BY-NC-ND 4.0; the loaded binary is under the
 * proprietary field-of-use license in ./QUALIA-WEBCIVICS-LICENSE.txt (digest-pinned,
 * Web Civics Databox only) — not the repo's MIT. See ./LICENSE.md.
 *
 * The Qualia engine is a SEPARATELY LICENSED dependency — it is resolved from a path
 * the deployer supplies (Qualia's pinned release) and verified against a recorded
 * SHA-256 digest before use. It is NEVER vendored into this MIT-licensed tree: this
 * loader reaches out to the engine's own licensed location, checks the pin, then
 * initialises the WASM module and returns the typed bridge surface.
 *
 * @see databox/devdocs/handoffs/AGENT-BRIEF-qualia-leave-migrate.md §3
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { InternalServerError } from '../../../util/errors/InternalServerError';
import type { WasmWebcivicsSolidBridge } from './QualiaSolidBridge';

/** The pinned `wasm-webcivics` build the Databox accepts (see the agent brief §3). */
export const WASM_WEBCIVICS_PIN = {
  wasmFile: 'qualia_webcivics_bg.wasm',
  jsFile: 'qualia.js',
  sha256: '68987faa5d53dc3c66f3a82e4adfc2cb9953faeeff027e087648b0a6c57ec2ad',
} as const;

/** The wasm exports this module requires (the leave/migrate + capability surface). */
const REQUIRED_EXPORTS = [
  'initSync',
  'list_capabilities_wasm',
  'plan_sanctuary_migration_wasm',
  'export_solid_migration_wasm',
  'import_solid_to_qualia_backup_wasm',
] as const;

/** The capability tokens the loaded engine must advertise for this module's flows. */
const REQUIRED_CAPABILITIES = [ 'solid-leave-migrate', 'solid-qualia-return' ] as const;

/** A loaded, digest-verified `wasm-webcivics` module. */
export interface LoadedQualiaEngine {
  readonly wasm: WasmWebcivicsSolidBridge & {
    list_capabilities_wasm: () => readonly string[];
  };
  /** The package directory the engine loaded from. */
  readonly packageDir: string;
  /** The verified SHA-256 of the loaded `.wasm`. */
  readonly sha256: string;
  /** The capability tokens the engine advertises. */
  readonly capabilities: readonly string[];
}

/**
 * Load the licensed `wasm-webcivics` engine from `packageDir`, verify its SHA-256
 * digest against the pin, initialise it, and check it carries the required exports and
 * capabilities. Fails closed — a digest mismatch, missing export or absent capability
 * throws rather than loading an unverified engine.
 */
export async function loadQualiaEngine(packageDir: string): Promise<LoadedQualiaEngine> {
  const wasmPath = `${packageDir}/${WASM_WEBCIVICS_PIN.wasmFile}`;
  const jsPath = `${packageDir}/${WASM_WEBCIVICS_PIN.jsFile}`;

  const wasmBytes = readFileSync(wasmPath);
  const sha256 = createHash('sha256').update(wasmBytes).digest('hex');
  if (sha256 !== WASM_WEBCIVICS_PIN.sha256) {
    throw new InternalServerError(
      `wasm-webcivics digest mismatch: ${sha256} (expected ${WASM_WEBCIVICS_PIN.sha256}) — refusing to load an unpinned engine.`,
    );
  }

  const mod = await import(pathToFileURL(jsPath).href) as Record<string, unknown>;
  for (const name of REQUIRED_EXPORTS) {
    if (typeof mod[name] !== 'function') {
      throw new InternalServerError(`wasm-webcivics is missing required export '${name}'.`);
    }
  }

  (mod.initSync as (arg: { module: Buffer }) => void)({ module: wasmBytes });
  const capabilities = (mod.list_capabilities_wasm as () => readonly string[])();
  for (const cap of REQUIRED_CAPABILITIES) {
    if (!capabilities.includes(cap)) {
      throw new InternalServerError(`wasm-webcivics lacks required capability '${cap}'.`);
    }
  }

  return {
    wasm: mod as unknown as LoadedQualiaEngine['wasm'],
    packageDir,
    sha256,
    capabilities,
  };
}
