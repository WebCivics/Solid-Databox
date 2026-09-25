import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  exportSolidResourcesToQualiaBackup,
  importQualiaQuinsToSolid,
} from '../../../../src/databox/modules/qualia/QualiaSolidBridge';
import type { WasmWebcivicsSolidBridge } from '../../../../src/databox/modules/qualia/QualiaSolidBridge';
import {
  loadQualiaEngine,
  WASM_WEBCIVICS_PIN,
} from '../../../../src/databox/modules/qualia/QualiaEngineLoader';

/** A stub licensed engine — records the sanctuary choice it was given. */
function stubWasm(requiresChoice: boolean): WasmWebcivicsSolidBridge & { lastChoice?: string } {
  const stub = {
    plan_sanctuary_migration_wasm: (): ReturnType<WasmWebcivicsSolidBridge['plan_sanctuary_migration_wasm']> => ({
      requires_choice: requiresChoice,
      title: 'Sanctuary data present',
      body: 'Some of your data is marked sanctuary.',
      choice_omit_label: 'Leave it behind',
      choice_reclassify_label: 'Reclassify for Solid',
      classified_note: 'Classified data never leaves Qualia.',
      sanctuary_quin_count: requiresChoice ? 3 : 0,
      classified_quin_count: 0,
    }),
    export_solid_migration_wasm: (params: { sanctuary_choice: string }): never => {
      stub.lastChoice = params.sanctuary_choice;
      return {
        manifest_jsonld: '{}',
        turtle: '@prefix : <#>. :a :b :c .',
        outcome_summary: 'exported',
      } as never;
    },
    import_solid_to_qualia_backup_wasm: (): { backup_json: string; engine_version: string } =>
      ({ backup_json: '{"schema":"webcivics.vault-backup.v1"}', engine_version: '0.0.39' }),
  } as WasmWebcivicsSolidBridge & { lastChoice?: string };
  return stub;
}

function fetchRecorder(): { fetch: typeof fetch; puts: string[] } {
  const puts: string[] = [];
  const fetchFn = (async(input: RequestInfo | URL): Promise<Response> => {
    puts.push(String(input));
    return new Response('{}', { status: 201 });
  }) as unknown as typeof fetch;
  return { fetch: fetchFn, puts };
}

describe('QualiaSolidBridge — Qualia → Solid import', (): void => {
  it('blocks with the sanctuary notice when a choice is required but not given.', async(): Promise<void> => {
    const wasm = stubWasm(true);
    const { fetch } = fetchRecorder();
    const result = await importQualiaQuinsToSolid({
      wasm,
      quins: [],
      containerUrl: 'https://pod.example/qualia-import/',
      fetch,
    });
    expect(result.blocked).toBe(true);
    expect(result.notice.requires_choice).toBe(true);
    expect(result.notice.choice_omit_label).toBe('Leave it behind');
  });

  it('imports only after an explicit sanctuary choice — never a silent default.', async(): Promise<void> => {
    const wasm = stubWasm(true);
    const { fetch, puts } = fetchRecorder();
    const result = await importQualiaQuinsToSolid({
      wasm,
      quins: [],
      sanctuaryChoice: 'omit-sanctuary',
      containerUrl: 'https://pod.example/qualia-import/',
      fetch,
    });
    expect(result.blocked).toBeUndefined();
    expect(wasm.lastChoice).toBe('omit-sanctuary');
    // The leave bundle was LDP-PUT as RDF — manifest + turtle, no quins on the pod.
    expect(puts.some(u => u.endsWith('manifest.jsonld'))).toBe(true);
    expect(puts.some(u => u.endsWith('data.ttl'))).toBe(true);
    expect(puts.some(u => u.includes('.quin'))).toBe(false);
  });
});

describe('QualiaSolidBridge — Solid → Qualia export', (): void => {
  it('returns a webcivics.vault-backup.v1 package.', (): void => {
    const wasm = stubWasm(false);
    const out = exportSolidResourcesToQualiaBackup({
      wasm,
      resources: [{ name: 'data.ttl', content_type: 'text/turtle', body: '@prefix : <#>.' }],
    });
    expect(out.backup_json).toContain('webcivics.vault-backup.v1');
  });
});

describe('QualiaEngineLoader — licensed wasm pin', (): void => {
  it('fails closed on a digest mismatch — an unpinned engine never loads.', async(): Promise<void> => {
    const dir = mkdtempSync(join(tmpdir(), 'qualia-'));
    writeFileSync(join(dir, WASM_WEBCIVICS_PIN.wasmFile), Buffer.from('tampered wasm bytes'));
    writeFileSync(join(dir, WASM_WEBCIVICS_PIN.jsFile), 'export const initSync = () => {};');
    await expect(loadQualiaEngine(dir)).rejects.toThrow('digest mismatch');
  });
});
