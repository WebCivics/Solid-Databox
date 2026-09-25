import { Initializer } from '../../init/Initializer';

/**
 * Startup initializer for a durable authority (CIV-C10). A `Durable*` registry keeps its indexes in
 * memory but rehydrates them from the pod store — `initialize()` MUST run before first use, which is
 * exactly the startup-initializer seam: wire a `RegistryInitializer` holding the registry into the
 * deployment's `PrimaryParallelInitializer` handlers so the durable state is loaded at boot.
 */
export interface InitializableRegistry {
  initialize: () => Promise<void>;
}

export class RegistryInitializer extends Initializer {
  public constructor(private readonly registry: InitializableRegistry) {
    super();
  }

  public async handle(): Promise<void> {
    await this.registry.initialize();
  }
}
