/**
 * Bidirectional Qualia ↔ Solid bridge for Solid-Databox (Node).
 *
 * Uses licensed `wasm-webcivics` for:
 * - Qualia leave/backup → Solid LDP RDF (with sanctuary choice)
 * - Solid RDF Sources → Qualia `webcivics.vault-backup.v1` package
 *
 * Pod storage remains RDF triples/quads. Quins are only in-memory for
 * SHACL / packaging — never the durable Solid store.
 *
 * @see databox/devdocs/handoffs/qualia-leave-migrate.md
 */

import { importQualiaSolidBundle, type QualiaSolidMigrationBundle } from './SolidMigrationImport';

/** Minimal surface of a loaded wasm-webcivics module. */
export interface WasmWebcivicsSolidBridge {
  plan_sanctuary_migration_wasm(params: { quins: unknown }): {
    requires_choice: boolean;
    title: string;
    body: string;
    choice_omit_label: string;
    choice_reclassify_label: string;
    classified_note: string;
    sanctuary_quin_count: number;
    classified_quin_count: number;
  };
  export_solid_migration_wasm(params: {
    quins: unknown;
    sanctuary_choice: 'omit-sanctuary' | 'reclassify-for-solid' | 'unset';
    grant_public_read?: boolean;
    owner_webid?: string;
  }): QualiaSolidMigrationBundle & {
    sanctuary_choice?: string;
    outcome_summary?: string;
    stats?: { exported: number; redacted_classified: number; redacted_restricted: number };
  };
  import_solid_to_qualia_backup_wasm(params: {
    resources: Array<{ name: string; content_type: string; body: string }>;
  }): { backup_json: string; engine_version: string };
  parse_rdf_document_wasm?(contentType: string, body: string): { quins: unknown; quin_count: number };
}

export type SanctuaryChoice = 'omit-sanctuary' | 'reclassify-for-solid';

/**
 * Import a Qualia graph (quin wire) into a Solid container.
 * Shows sanctuary notice via wasm; requires an explicit choice when needed.
 */
export async function importQualiaQuinsToSolid(opts: {
  wasm: WasmWebcivicsSolidBridge;
  quins: unknown;
  sanctuaryChoice?: SanctuaryChoice;
  containerUrl: string;
  fetch: typeof fetch;
  authorization?: string;
  ownerWebid?: string;
}): Promise<{
  notice: ReturnType<WasmWebcivicsSolidBridge['plan_sanctuary_migration_wasm']>;
  base?: string;
  outcome_summary?: string;
  blocked?: true;
}> {
  const notice = opts.wasm.plan_sanctuary_migration_wasm({ quins: opts.quins });
  if (notice.requires_choice && !opts.sanctuaryChoice) {
    return { notice, blocked: true };
  }
  const choice: SanctuaryChoice | 'unset' = opts.sanctuaryChoice
    ?? 'omit-sanctuary';
  const bundle = opts.wasm.export_solid_migration_wasm({
    quins: opts.quins,
    sanctuary_choice: notice.requires_choice ? choice : 'omit-sanctuary',
    grant_public_read: false,
    owner_webid: opts.ownerWebid,
  });
  const { base } = await importQualiaSolidBundle({
    containerUrl: opts.containerUrl,
    fetch: opts.fetch,
    authorization: opts.authorization,
    bundle,
  });
  return { notice, base, outcome_summary: bundle.outcome_summary };
}

/**
 * Import a Qualia/webcivics vault-backup JSON file into Solid.
 * Expects backup.payload.files to contain RDF text and/or quin dumps that
 * the host has already lowered to quins for `export_solid_migration_wasm`.
 */
export async function importQualiaBackupFileToSolid(opts: {
  wasm: WasmWebcivicsSolidBridge;
  backupJson: string;
  /** Pre-parsed quins from the backup (host responsibility if files are OPFS blocks). */
  quins: unknown;
  sanctuaryChoice?: SanctuaryChoice;
  containerUrl: string;
  fetch: typeof fetch;
  authorization?: string;
  ownerWebid?: string;
}): Promise<ReturnType<typeof importQualiaQuinsToSolid>> {
  // Validate schema early so Databox can reject foreign packages.
  const pkg = JSON.parse(opts.backupJson) as {
    payload?: { schema?: string };
    manifest?: { schema?: string };
  };
  const schema = pkg.payload?.schema ?? pkg.manifest?.schema;
  if (schema && schema !== 'webcivics.vault-backup.v1') {
    throw new Error(`Unsupported Qualia backup schema: ${schema}`);
  }
  return importQualiaQuinsToSolid(opts);
}

/**
 * Export Solid RDF Sources to a Qualia vault-backup JSON package
 * (for restore into Webizen Desktop / Qualia PWA).
 */
export function exportSolidResourcesToQualiaBackup(opts: {
  wasm: WasmWebcivicsSolidBridge;
  resources: Array<{ name: string; content_type: string; body: string }>;
}): { backup_json: string; engine_version: string } {
  return opts.wasm.import_solid_to_qualia_backup_wasm({ resources: opts.resources });
}
