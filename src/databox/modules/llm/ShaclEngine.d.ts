/**
 * Local type declaration for `shacl-engine` (untyped package) — declares only the surface
 * the LLM module's SHACL gate uses. Kept inside the module so an `external` packaging
 * exclusion drops it with the module.
 */
declare module 'shacl-engine' {
  import type { Dataset } from '@rdfjs/types';

  export interface ShaclValidationResult {
    readonly message?: readonly { value?: string }[];
    readonly focusNode?: { value: string };
  }

  export interface ShaclReport {
    readonly conforms: boolean;
    readonly results: readonly ShaclValidationResult[];
  }

  export class Validator {
    public constructor(shapes: Dataset, options: { factory: unknown });
    public validate(input: { dataset: Dataset }): Promise<ShaclReport>;
  }
}
