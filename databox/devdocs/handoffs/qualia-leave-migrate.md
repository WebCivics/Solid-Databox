# Qualia ↔ Solid leave/migrate (Databox)

## Sanctuary choice (required UX)

Before exporting Qualia → Solid, the product **must** show the notice from
`plan_sanctuary_migration_wasm` / `SolidExporter::plan_notice` when
`requires_choice` is true:

1. **Omit sanctuary** — leave restricted/bilateral/sanctuary data behind.
2. **Reclassify for Solid** — owner changes permission structures so that data
   may leave as RDF under their control.

**Classified never leaves**, regardless of choice. Export fails closed with
`SANCTUARY_CHOICE_REQUIRED` if sanctuary is present and choice is unset.

## Bidirectional bridge (Node + licensed wasm-webcivics)

| Direction | API |
|-----------|-----|
| Qualia backup / quins → Solid | `importQualiaBackupFileToSolid` / `importQualiaQuinsToSolid` → LDP PUT |
| Solid RDF → Qualia backup | `exportSolidResourcesToQualiaBackup` → `webcivics.vault-backup.v1` |

Load wasm from Qualia’s pinned artifact (`docs/pkg/webcivics/`), **not** by
copying into this MIT tree. Treat as a commercial/licensed module dependency.

```ts
import {
  importQualiaQuinsToSolid,
  exportSolidResourcesToQualiaBackup,
} from '../src/databox/modules/qualia';

const notice = wasm.plan_sanctuary_migration_wasm({ quins });
// show notice.title / notice.body / choice labels in UI
await importQualiaQuinsToSolid({
  wasm, quins, sanctuaryChoice: 'omit-sanctuary', // or 'reclassify-for-solid'
  containerUrl, fetch, authorization,
});

const { backup_json } = exportSolidResourcesToQualiaBackup({
  wasm,
  resources: [
    { name: 'data.ttl', content_type: 'text/turtle', body: turtle },
  ],
});
// hand backup_json to Qualia Desktop / PWA restoreBackup
```

## Files

- `SolidMigrationImport.ts` — LDP PUT of leave bundle
- `QualiaSolidBridge.ts` — sanctuary-gated import + Solid→Qualia backup
