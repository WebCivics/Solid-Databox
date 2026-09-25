import { timingSafeEqual } from 'node:crypto';
import type { HttpHandlerInput } from '../../server/HttpHandler';
import { HttpHandler } from '../../server/HttpHandler';
import { NotImplementedHttpError } from '../../util/errors/NotImplementedHttpError';
import type { CashRegisterStore } from './CashRegisterStore';
import { IpmsModuleRouter } from './IpmsModuleRouter';
import type { CustomerDisplayStore } from './CustomerDisplayStore';
import type { DataboxModuleRegistry } from './DataboxModuleRegistry';
import type { ModuleConfigStore } from './ModuleConfigStore';
import { setModuleEnabledFlag } from './ModuleConfigStore';
import {
  DEFAULT_CMS_DISCOVERY_PATH,
  isModuleManifestDiscoveryPath,
  isModuleManifestIndexPath,
  parseModuleManifestResourcePath,
  serializeDiscoveredModuleManifestToTurtle,
  serializeModuleManifestIndexToTurtle,
} from './ModuleManifestDiscovery';
import { registerJobsRoutes } from './modules/jobs/JobsApi';
import { registerPaymentsRoutes } from './modules/payments/PaymentsApi';
import { registerBookingsRoutes } from './modules/bookings/BookingsApi';
import { registerCatalogueRoutes } from './modules/catalogue/CatalogueApi';
import { registerFeedsRoutes } from './modules/feeds/FeedsApi';
import { registerHostingRoutes } from './modules/hosting/HostingApi';
import { registerGovernanceRoutes } from './modules/governance/GovernanceApi';
import { registerCredentialRoutes } from './modules/credentials/CredentialApi';
import { registerProfileRoutes } from './modules/profile/ProfileApi';
import { registerMenuRoutes } from './modules/menu/MenuApi';
import { registerEventsRoutes } from './modules/events/EventsApi';
import { registerTicketingRoutes } from './modules/ticketing/TicketingApi';
import { registerProvenanceRoutes } from './modules/provenance/ProvenanceApi';
import { registerSocialRoutes } from './modules/social/SocialApi';
import { registerRecordsRoutes } from './modules/records/RecordsApi';
import { registerLicensingRoutes } from './modules/licensing/LicensingApi';
import { registerReputationRoutes } from './modules/reputation/ReputationApi';
import { registerDeliveryRoutes } from './modules/delivery/DeliveryApi';
import { registerAccessRoutes } from './modules/access/AccessApi';
import { registerConsentRoutes } from './modules/consent/ConsentApi';
import { registerDelegationRoutes } from './modules/delegation/DelegationApi';
import { registerEmergencyRoutes } from './modules/emergency/EmergencyApi';
import { registerHouseholdRoutes } from './modules/household/HouseholdApi';
import { registerInventoryRoutes } from './modules/inventory/InventoryApi';
import { registerLoyaltyRoutes } from './modules/loyalty/LoyaltyApi';
import { registerOrgNetworkRoutes } from './modules/orgnetwork/OrgNetworkApi';
import { registerPricingRoutes } from './modules/pricing/PricingApi';
import { registerA11yRoutes } from './modules/a11y/A11yApi';
import { registerBusinessRoutes } from './modules/business/BusinessApi';
import { registerConsumerRoutes } from './modules/consumer/ConsumerApi';
import { registerI18nRoutes } from './modules/i18n/I18nApi';
import { registerIntegrationRoutes } from './modules/integration/IntegrationApi';
import { registerThemingRoutes } from './modules/theming/ThemingApi';
import { registerPosRoutes } from './modules/pos/PosApi';
import { registerReceiptRoutes } from './modules/receipt/ReceiptApi';
import { registerWebsiteRoutes } from './modules/website/WebsiteApi';
import { MCP_SERVER_MODULE_MANIFEST, registerMcpRoutes } from './modules/mcp/McpServerApi';
import { QUOTATION_MODULE_MANIFEST, registerQuotationsRoutes } from './modules/quotations/QuotationApi';
import { registerTaxRoutes } from './modules/tax/TaxApi';
import { registerConcessionsRoutes } from './modules/concessions/ConcessionsApi';
import { registerDiscountsRoutes } from './modules/discounts/DiscountsApi';
import { registerDonationsRoutes } from './modules/donations/DonationsApi';
import { registerNotificationsRoutes } from './modules/notifications/NotificationsApi';
import { registerAllergyProfileRoutes } from './modules/allergy-profile/AllergyProfileApi';
import { registerDeviceAuthRoutes } from './modules/device-auth/DeviceAuthApi';
import { registerHrRoutes } from './modules/hr/HrApi';
import { registerDriverManagementRoutes } from './modules/delivery/DriverManagementApi';
import { registerPrintShopRoutes } from './modules/print/PrintShopApi';
import { registerBarcodeRoutes } from './modules/barcode/BarcodeApi';
import { registerEftposRoutes } from './modules/eftpos/EftposApi';
import { registerBackupRoutes } from './modules/backups/BackupApi';
import { registerAccountingRoutes } from './modules/accounting/AccountingApi';
import { registerOrgAppRoutes } from './OrgAppApi';
import { getConfigShape } from './ModuleConfigShapes';
import { QuotationRenderer } from './modules/quotations/QuotationRenderer';
import { MENU_MODULE_MANIFEST } from './modules/menu/Menu';
import {
  CASH_REGISTER_MODULE_MANIFEST,
} from './modules/pos/CashRegister';
import { NATIVE_POS_DEVICE_MODULE_MANIFEST } from './modules/pos/NativePosDeviceContract';
import {
  TABLE_SESSION_MODULE_MANIFEST,
} from './modules/pos/TableSession';
import {
  WEBSITE_SEO_MODULE_MANIFEST,
} from './modules/website/PublicFeedRenderer';

import { exportPortableIpmsWorks, importPortableIpmsWorks } from './PortableIpmsWorks';
import type { PosOrderStore } from './PosOrderStore';
import type { PublicWebsiteStore } from './PublicWebsiteStore';
import type { TableSessionStore } from './TableSessionStore';
import type { SolidModuleManifest } from './SolidModuleManifest';
import type { VerticalProfileManifest, VerticalProfileModuleReference } from './VerticalProfile';
import {
  applyVerticalProfileBundle,
  LIGHTHOUSE_VERTICAL_PROFILES,
  validateVerticalProfileBundle,
} from './VerticalProfile';

/** A control-plane handler for one IPMS route, given the raw HTTP input. */
export type IpmsControlHandler = (input: HttpHandlerInput) => Promise<void>;

/**
 * Mounts the Databox IPMS control plane in a live CSS process (see `databox/solid-ipms-plan.md`, §5.1).
 *
 * It claims only paths at or under `routeBase` (default `/.databox/ipms`), requires a bearer control
 * token of at least 32 bytes (constant-time compared), and dispatches authorized requests through a
 * {@link IpmsModuleRouter} — the shared table modules register their routes into. It ships one built-in
 * route (`GET /modules`, the enabled-module list) so the framework is exercisable end-to-end. This
 * single-process control token is a demonstration boundary, not production operator IAM.
 */
export class IpmsHttpHandler extends HttpHandler {
  private readonly routeBase: string;
  private readonly discoveryPath: string;
  private readonly token: Buffer;
  private readonly router: IpmsModuleRouter<IpmsControlHandler>;

  public constructor(
    private readonly registry: DataboxModuleRegistry,
    controlToken: string,
    routeBase = '/.databox/ipms',
    private readonly configStore?: ModuleConfigStore,
    discoveryPath = DEFAULT_CMS_DISCOVERY_PATH,
    private readonly orderStore?: PosOrderStore,
    private readonly cashRegisterStore?: CashRegisterStore,
    private readonly customerDisplayStore?: CustomerDisplayStore,
    private readonly publicWebsiteStore?: PublicWebsiteStore,
    private readonly tableSessionStore?: TableSessionStore,
  ) {
    super();
    if (typeof controlToken !== 'string' || Buffer.byteLength(controlToken, 'utf8') < 32) {
      throw new TypeError('The Databox IPMS control plane requires a control token of at least 32 bytes.');
    }
    ensureBuiltIns(this.registry);
    this.routeBase = normalizeRouteBase(routeBase);
    this.discoveryPath = normalizeRouteBase(discoveryPath);
    this.token = Buffer.from(controlToken, 'utf8');
    this.router = new IpmsModuleRouter<IpmsControlHandler>(this.routeBase);
    // External module routes
    registerJobsRoutes(this.router);
    registerPaymentsRoutes(this.router);
    registerBookingsRoutes(this.router);
    registerCatalogueRoutes(this.router);
    registerFeedsRoutes(this.router);
    registerHostingRoutes(this.router);
    registerGovernanceRoutes(this.router);
    registerCredentialRoutes(this.router);
    registerProfileRoutes(this.router);
    registerEventsRoutes(this.router);
    registerTicketingRoutes(this.router);
    registerProvenanceRoutes(this.router);
    registerSocialRoutes(this.router);
    registerRecordsRoutes(this.router);
    registerLicensingRoutes(this.router);
    registerReputationRoutes(this.router);
    registerDeliveryRoutes(this.router);
    registerAccessRoutes(this.router);
    registerConsentRoutes(this.router);
    registerDelegationRoutes(this.router);
    registerEmergencyRoutes(this.router);
    registerHouseholdRoutes(this.router);
    registerInventoryRoutes(this.router);
    registerLoyaltyRoutes(this.router);
    registerOrgNetworkRoutes(this.router);
    registerPricingRoutes(this.router);
    registerA11yRoutes(this.router);
    registerBusinessRoutes(this.router);
    registerConsumerRoutes(this.router);
    registerI18nRoutes(this.router);
    registerIntegrationRoutes(this.router);
    registerThemingRoutes(this.router);
    registerMenuRoutes(this.router);
    registerPosRoutes(
      this.router,
      this.orderStore,
      this.cashRegisterStore,
      this.customerDisplayStore,
      this.tableSessionStore,
    );
    registerReceiptRoutes(this.router);
    registerWebsiteRoutes(this.router, this.publicWebsiteStore);

    const quotationRenderer = new QuotationRenderer();
    registerQuotationsRoutes(this.router, quotationRenderer);
    registerMcpRoutes(this.router);
    registerTaxRoutes(this.router);
    registerConcessionsRoutes(this.router);
    registerDiscountsRoutes(this.router);
    registerDonationsRoutes(this.router);
    registerNotificationsRoutes(this.router);
    registerAllergyProfileRoutes(this.router);
    registerDeviceAuthRoutes(this.router);
    registerHrRoutes(this.router);
    registerDriverManagementRoutes(this.router);
    registerPrintShopRoutes(this.router);
    registerBarcodeRoutes(this.router);
    registerEftposRoutes(this.router);
    registerBackupRoutes(this.router);
    registerAccountingRoutes(this.router);
    registerOrgAppRoutes(this.router);

    // Dynamic Module Route
    this.router.register('GET', '/modules', async({ response }): Promise<void> => {
      ensureBuiltIns(this.registry);
      writeJson(response, 200, await Promise.all(this.registry.list()
        .map(async(manifest): Promise<SolidModuleManifest & { enabled: boolean; capabilityMode: string }> => ({
          ...manifest,
          enabled: await this.enabled(manifest),
          capabilityMode: manifest.routes.length > 0 ? 'css-enhanced' : 'portable-core',
        }))));
    });
    this.router.register('GET', '/works', async({ response }): Promise<void> => {
      writeJson(response, 200, await exportPortableIpmsWorks(this.registry, this.configStore), 'application/ld+json');
    });
    this.router.register('POST', '/works/import', async({ request, response }): Promise<void> => {
      try {
        const bundle = await readJsonBody<unknown>(request);
        writeJson(
          response,
          200,
          await importPortableIpmsWorks(bundle, this.registry, this.configStore),
          'application/ld+json',
        );
      } catch (error: unknown) {
        writeJson(response, 400, {
          error: error instanceof Error ? error.message : 'Invalid IPMS works import request.',
        });
      }
    });
    this.router.register('GET', '/vertical-profiles', async({ response }): Promise<void> => {
      writeJson(response, 200, await this.verticalProfileSummaries());
    });
  }

  public async canHandle({ request }: HttpHandlerInput): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (!isModuleManifestDiscoveryPath(path, this.discoveryPath) &&
      path !== this.routeBase &&
      !path.startsWith(`${this.routeBase}/`)) {
      throw new NotImplementedHttpError('Not a Databox IPMS route.');
    }
  }

  public async handle({ request, response }: HttpHandlerInput): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (isModuleManifestDiscoveryPath(path, this.discoveryPath)) {
      await this.handleManifestDiscovery({ request, response }, path);
      return;
    }

    if (!this.authorized(request.headers.authorization)) {
      response.statusCode = 401;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.setHeader('www-authenticate', 'Bearer realm="databox-ipms"');
      response.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    response.setHeader('cache-control', 'no-store');
    const configShapeRequest = parseConfigShapeRoute(this.routeBase, request.method ?? 'GET', request.url ?? '/');
    if (configShapeRequest) {
      await this.handleConfigShape(configShapeRequest, { response });
      return;
    }
    const moduleRequest = parseModuleStateRoute(this.routeBase, request.method ?? 'GET', request.url ?? '/');
    if (moduleRequest) {
      await this.handleModuleState(moduleRequest, { request, response });
      return;
    }
    const verticalProfileRequest = parseVerticalProfileRoute(
      this.routeBase,
      request.method ?? 'GET',
      request.url ?? '/',
    );
    if (verticalProfileRequest) {
      await this.handleVerticalProfile(verticalProfileRequest, { response });
      return;
    }
    const handler = this.router.resolve(request.method ?? 'GET', request.url ?? '/');
    if (!handler) {
      writeJson(response, 404, { error: 'not-found' });
      return;
    }
    await handler({ request, response });
  }

  private async handleManifestDiscovery({ request, response }: HttpHandlerInput, path: string): Promise<void> {
    if ((request.method ?? 'GET').toUpperCase() !== 'GET') {
      writeJson(response, 405, { error: 'method-not-allowed' });
      return;
    }

    const baseUrl = requestBaseUrl(request);
    try {
      if (isModuleManifestIndexPath(path, this.discoveryPath)) {
        writeTurtle(response, 200, await serializeModuleManifestIndexToTurtle(this.registry.list(), {
          baseUrl,
          discoveryPath: this.discoveryPath,
        }));
        return;
      }

      const id = parseModuleManifestResourcePath(path, this.discoveryPath);
      const manifest = id ? this.registry.get(id) : undefined;
      if (!manifest) {
        writeJson(response, 404, { error: 'module-manifest-not-found' });
        return;
      }

      writeTurtle(response, 200, await serializeDiscoveredModuleManifestToTurtle(manifest, {
        baseUrl,
        discoveryPath: this.discoveryPath,
      }));
    } catch (error: unknown) {
      writeJson(response, 500, {
        error: error instanceof Error ? error.message : 'IPMS module manifest discovery failed.',
      });
    }
  }

  private async handleConfigShape(
    { id }: { id: string },
    { response }: Pick<HttpHandlerInput, 'response'>,
  ): Promise<void> {
    const manifest = this.registry.get(id);
    if (!manifest) {
      writeJson(response, 404, { error: 'module-not-found' });
      return;
    }
    if (!manifest.configShape) {
      writeJson(response, 404, { error: 'no-config-shape' });
      return;
    }
    const turtle = getConfigShape(manifest.configShape);
    if (!turtle) {
      writeJson(response, 404, { error: 'config-shape-not-defined', configShape: manifest.configShape });
      return;
    }
    response.setHeader('content-type', 'text/turtle; charset=utf-8');
    response.end(turtle);
  }

  private async handleModuleState(
    { method, id }: { method: string; id: string },
    { request, response }: HttpHandlerInput,
  ): Promise<void> {
    const manifest = this.registry.get(id);
    if (!manifest) {
      writeJson(response, 404, { error: 'module-not-found' });
      return;
    }

    if (method === 'GET') {
      writeJson(response, 200, await this.moduleState(manifest));
      return;
    }

    if (method !== 'PUT' && method !== 'PATCH') {
      writeJson(response, 405, { error: 'method-not-allowed' });
      return;
    }

    try {
      const body = await readJsonBody<{ enabled?: unknown; configTurtle?: unknown }>(request);
      if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
        throw new Error('Module enabled state must be a boolean.');
      }
      if (body.configTurtle !== undefined && typeof body.configTurtle !== 'string') {
        throw new Error('Module configTurtle must be a Turtle string.');
      }
      if (!this.configStore && body.configTurtle !== undefined) {
        throw new Error('Persistent module config requires a ModuleConfigStore.');
      }

      if (body.enabled !== undefined) {
        const enabled = body.enabled;
        this.registry.setEnabled(id, enabled);
        if (this.configStore) {
          const loaded = body.configTurtle ?? await this.configStore.load(id) ?? '';
          let turtle: string = loaded;
          turtle = await setModuleEnabledFlag(this.moduleStateIri(id), turtle, enabled);
          await this.configStore.save(id, turtle);
        }
      } else if (this.configStore && body.configTurtle !== undefined) {
        await this.configStore.save(id, body.configTurtle);
      }

      writeJson(response, 200, await this.moduleState(manifest));
    } catch (error: unknown) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : 'Invalid module state request.',
      });
    }
  }

  private async handleVerticalProfile(
    { method, id, action }: { method: string; id: string; action?: string },
    { response }: Pick<HttpHandlerInput, 'response'>,
  ): Promise<void> {
    const profile = LIGHTHOUSE_VERTICAL_PROFILES.find((candidate): boolean => candidate.id === id);
    if (!profile) {
      writeJson(response, 404, { error: 'vertical-profile-not-found' });
      return;
    }

    if (method === 'GET' && action === undefined) {
      writeJson(response, 200, await this.verticalProfileSummary(profile));
      return;
    }
    if (method !== 'POST' || (action !== 'preview' && action !== 'apply')) {
      writeJson(response, 405, { error: 'method-not-allowed' });
      return;
    }

    try {
      if (action === 'apply') {
        if (!this.configStore && profile.modules.some((module): boolean => module.defaultConfig !== undefined)) {
          throw new Error(`Vertical profile ${profile.id} needs a ModuleConfigStore to apply RDF defaults.`);
        }
        await applyVerticalProfileBundle(profile, this.registry, this.configStore);
      }
      writeJson(response, 200, {
        ...await this.verticalProfileSummary(profile),
        operation: action,
        persisted: action === 'apply',
        defaults: profile.modules.map((module): VerticalProfileDefaultPreview => ({
          moduleId: module.moduleId,
          enabled: module.enabledByDefault,
          contentType: module.defaultConfig?.contentType ?? 'text/turtle',
          configTurtle: module.defaultConfig?.turtle ?? '',
        })),
      });
    } catch (error: unknown) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : `Invalid vertical profile ${action} request.`,
      });
    }
  }

  private async moduleState(manifest: SolidModuleManifest):
  Promise<SolidModuleManifest & { enabled: boolean; capabilityMode: string; configTurtle?: string }> {
    const configTurtle = await this.configStore?.load(manifest.id);
    return {
      ...manifest,
      enabled: await this.enabled(manifest, configTurtle),
      capabilityMode: manifest.routes.length > 0 ? 'css-enhanced' : 'portable-core',
      ...configTurtle === undefined ? {} : { configTurtle },
    };
  }

  private async enabled(manifest: SolidModuleManifest, loadedState?: string): Promise<boolean> {
    if (!this.configStore) {
      return this.registry.isEnabled(manifest.id);
    }
    if (loadedState === undefined && await this.configStore.load(manifest.id) === undefined) {
      return this.registry.isEnabled(manifest.id);
    }
    return this.configStore.isEnabled(manifest.id);
  }

  private moduleStateIri(id: string): string {
    return `urn:solid-server:databox:ipms:module:${encodeURIComponent(id)}`;
  }

  private async verticalProfileSummaries(): Promise<VerticalProfileSummary[]> {
    return Promise.all(LIGHTHOUSE_VERTICAL_PROFILES.map(
      async(profile): Promise<VerticalProfileSummary> => this.verticalProfileSummary(profile),
    ));
  }

  private async verticalProfileSummary(profile: VerticalProfileManifest): Promise<VerticalProfileSummary> {
    const validation = validateVerticalProfileBundle(profile, this.registry);
    const modules = await Promise.all(validation.profile.modules.map(
      async(module): Promise<VerticalProfileModuleSummary> => this.verticalProfileModuleSummary(module),
    ));
    const needsConfigStore = validation.profile.modules.some((module): boolean => module.defaultConfig !== undefined);
    const canApply = validation.missingModules.length === 0 && (!needsConfigStore || this.configStore !== undefined);
    return {
      ...validation.profile,
      capabilityMode: 'css-enhanced',
      controlPlaneAvailable: true,
      canApply,
      missingModules: validation.missingModules,
      unavailableModules: modules
        .filter((module): boolean => !module.available)
        .map((module): string => module.moduleId),
      degradationReason: verticalProfileDegradationReason(canApply, validation.missingModules),
      modules,
    };
  }

  private async verticalProfileModuleSummary(module: VerticalProfileModuleReference):
  Promise<VerticalProfileModuleSummary> {
    const manifest = this.registry.get(module.moduleId);
    if (!manifest) {
      return {
        ...module,
        available: false,
        enabled: false,
        capabilityMode: 'unavailable',
        unavailableReason: 'This horizontal module is not installed in the active IPMS registry.',
      };
    }
    return {
      ...module,
      available: true,
      enabled: await this.enabled(manifest),
      capabilityMode: manifest.routes.length > 0 ? 'css-enhanced' : 'portable-core',
      manifest,
    };
  }

  private authorized(header: string | undefined): boolean {
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return false;
    }
    const presented = Buffer.from(header.slice('Bearer '.length), 'utf8');
    return presented.length === this.token.length && timingSafeEqual(presented, this.token);
  }
}

function normalizeRouteBase(value: string): string {
  const withSlash = value.startsWith('/') ? value : `/${value}`;
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}

function ensureBuiltIns(registry: DataboxModuleRegistry): void {
  if (!registry.get('hosting')) {
    registry.register({
      id: 'hosting',
      name: 'Hosting',
      version: '0.1.0',
      description: 'Guided domain, DNS and launch-configuration planning for the IPMS profile.',
      capabilities: [ 'ipms:hosting', 'ipms:dns-plan' ],
      routes: [
        'POST /.databox/ipms/hosting/plan',
        'POST /.databox/ipms/hosting/apply',
        'POST /.databox/ipms/hosting/persist',
        'POST /.databox/ipms/hosting/bind',
        'POST /.databox/ipms/hosting/artifacts',
      ],
      adminUi: {
        navLabel: 'Hosting',
        path: '/hosting',
      },
    });
  }
  if (!registry.get('governance')) {
    registry.register({
      id: 'governance',
      name: 'Governance',
      version: '0.1.0',
      description: 'Role-to-authority bindings, ODRL policy encoding, approval gates, and resolution recording.',
      capabilities: [ 'ipms:governance', 'ipms:odrl', 'ipms:approval-gate', 'ipms:resolution' ],
      routes: [
        'POST /.databox/ipms/governance/role/bind',
        'POST /.databox/ipms/governance/odrl/policy',
        'POST /.databox/ipms/governance/approval-gate',
        'POST /.databox/ipms/governance/resolution',
      ],
      adminUi: {
        navLabel: 'Governance',
        path: '/governance',
      },
    });
  }
  if (!registry.get('credentials')) {
    registry.register({
      id: 'credentials',
      name: 'Credentials',
      version: '0.1.0',
      description: 'Verifiable credential issuance, verification, and revocation lifecycle.',
      capabilities: [ 'ipms:credentials', 'ipms:vc-issuance', 'ipms:vc-verification', 'ipms:vc-revocation' ],
      routes: [
        'POST /.databox/ipms/credentials/issue',
        'POST /.databox/ipms/credentials/verify',
        'POST /.databox/ipms/credentials/revoke',
      ],
      adminUi: {
        navLabel: 'Credentials',
        path: '/credentials',
      },
    });
  }
  if (!registry.get('profile')) {
    registry.register({
      id: 'profile',
      name: 'Member Pods & Profiles',
      version: '0.1.0',
      description: 'Member/person pod provisioning, LDN inbox communication, ' +
        'bidirectional interaction, and lifecycle management.',
      capabilities: [
        'ipms:profile',
        'ipms:member-pod',
        'ipms:ldn-inbox',
        'ipms:member-interaction',
        'ipms:member-lifecycle',
      ],
      routes: [
        'POST /.databox/ipms/profile/build',
        'POST /.databox/ipms/members/provision',
        'POST /.databox/ipms/members/lifecycle',
        'POST /.databox/ipms/ldn/notification',
        'POST /.databox/ipms/ldn/inbox/create',
        'POST /.databox/ipms/ldn/send',
        'POST /.databox/ipms/members/notify',
        'POST /.databox/ipms/members/notify-organisation',
        'POST /.databox/ipms/members/access-grant',
      ],
      adminUi: {
        navLabel: 'Members',
        path: '/members',
      },
    });
  }
  if (!registry.get('receipt')) {
    registry.register({
      id: 'receipt',
      name: 'Receipt Writer',
      version: '0.1.0',
      description: 'Printable receipt documents with QR links to the consumer RDF/VC receipt in the pod.',
      capabilities: [
        'ipms:receipt-document',
        'ipms:portable-core-receipt-doc',
        'ipms:css-enhanced-receipt-build-route',
        'ipms:native-edge-print-job-descriptor',
      ],
      routes: [ 'POST /.databox/ipms/receipt/build' ],
      adminUi: {
        navLabel: 'Receipts',
        path: '/receipts',
      },
    });
  }
  if (!registry.get('pos.ordering')) {
    registry.register({
      id: 'pos.ordering',
      name: 'Point of Sale',
      version: '0.1.0',
      description:
        'Portable POS cart, order, ticket, waiter, customer self-order, payment-handoff and receipt-intent records.',
      capabilities: [
        'pos:cart',
        'pos:order-record',
        'pos:ticket-state',
        'pos:waiter-order',
        'pos:customer-self-order',
        'pos:payment-handoff',
        'ipms:portable-core-pos-ordering',
        'ipms:css-enhanced-pos-order-store',
      ],
      routes: [ 'POST /.databox/ipms/pos/orders', 'GET /.databox/ipms/pos/orders' ],
      adminUi: {
        navLabel: 'POS Terminal',
        path: '/pos',
      },
    });
  }
  if (!registry.get('pos.promotions-display')) {
    registry.register({
      id: 'pos.promotions-display',
      name: 'Promotions and Customer Display',
      version: '0.1.0',
      description:
        'Portable promotion rules, customer-facing transaction summaries, app/vault links, ' +
        'and automated display decks.',
      capabilities: [
        'pos:promotion-offer',
        'pos:customer-display',
        'pos:display-deck',
        'pos:shop-app-install-link',
        'pos:solid-vault-connect-link',
        'ipms:portable-core-customer-display',
        'ipms:css-enhanced-customer-display-store',
      ],
      routes: [ 'POST /.databox/ipms/pos/display', 'GET /.databox/ipms/pos/display' ],
      adminUi: {
        navLabel: 'Display Preview',
        path: '/pos/display',
      },
    });
  }
  if (!registry.get(NATIVE_POS_DEVICE_MODULE_MANIFEST.id)) {
    registry.register(NATIVE_POS_DEVICE_MODULE_MANIFEST);
  }
  if (!registry.get(CASH_REGISTER_MODULE_MANIFEST.id)) {
    registry.register(CASH_REGISTER_MODULE_MANIFEST);
  }
  if (!registry.get(MENU_MODULE_MANIFEST.id)) {
    registry.register(MENU_MODULE_MANIFEST);
  }
  if (!registry.get(WEBSITE_SEO_MODULE_MANIFEST.id)) {
    registry.register(WEBSITE_SEO_MODULE_MANIFEST);
  }
  if (!registry.get(QUOTATION_MODULE_MANIFEST.id)) {
    registry.register(QUOTATION_MODULE_MANIFEST);
  }
  if (!registry.get(MCP_SERVER_MODULE_MANIFEST.id)) {
    registry.register(MCP_SERVER_MODULE_MANIFEST);
  }
  if (!registry.get(TABLE_SESSION_MODULE_MANIFEST.id)) {
    registry.register(TABLE_SESSION_MODULE_MANIFEST);
  }
  if (!registry.isEnabled('hosting')) {
    registry.setEnabled('hosting', true);
  }
  if (!registry.isEnabled('governance')) {
    registry.setEnabled('governance', true);
  }
  if (!registry.isEnabled('credentials')) {
    registry.setEnabled('credentials', true);
  }
  if (!registry.isEnabled('profile')) {
    registry.setEnabled('profile', true);
  }
  if (!registry.isEnabled('receipt')) {
    registry.setEnabled('receipt', true);
  }
  if (!registry.isEnabled('pos.ordering')) {
    registry.setEnabled('pos.ordering', true);
  }
  if (!registry.isEnabled('pos.promotions-display')) {
    registry.setEnabled('pos.promotions-display', true);
  }
  if (!registry.isEnabled(NATIVE_POS_DEVICE_MODULE_MANIFEST.id)) {
    registry.setEnabled(NATIVE_POS_DEVICE_MODULE_MANIFEST.id, true);
  }
  if (!registry.isEnabled(CASH_REGISTER_MODULE_MANIFEST.id)) {
    registry.setEnabled(CASH_REGISTER_MODULE_MANIFEST.id, true);
  }
  if (!registry.isEnabled(MENU_MODULE_MANIFEST.id)) {
    registry.setEnabled(MENU_MODULE_MANIFEST.id, true);
  }
  if (!registry.isEnabled(WEBSITE_SEO_MODULE_MANIFEST.id)) {
    registry.setEnabled(WEBSITE_SEO_MODULE_MANIFEST.id, true);
  }
  if (!registry.isEnabled(TABLE_SESSION_MODULE_MANIFEST.id)) {
    registry.setEnabled(TABLE_SESSION_MODULE_MANIFEST.id, true);
  }

  const phase3Modules: Record<string, {
    name: string;
    description: string;
    capabilities: string[];
    routes: string[];
    navLabel: string;
    path: string;
  }> = {
    consent: {
      name: 'Consent Management',
      description: 'DPV-shaped consent records (grant/withdraw) as JSON-LD.',
      capabilities: [ 'ipms:consent' ],
      routes: [ 'POST /.databox/ipms/consent/build' ],
      navLabel: 'Consent',
      path: '/consent',
    },
    delegation: {
      name: 'Delegation & Assisted Agency',
      description: 'Scoped, revocable delegation grants and validation.',
      capabilities: [ 'ipms:delegation' ],
      routes: [ 'POST /.databox/ipms/delegation/build', 'POST /.databox/ipms/delegation/validate' ],
      navLabel: 'Delegation',
      path: '/delegation',
    },
    emergency: {
      name: 'Emergency / Break-Glass Access',
      description: 'Break-glass access evaluation with audit trail.',
      capabilities: [ 'ipms:break-glass' ],
      routes: [ 'POST /.databox/ipms/emergency/break-glass' ],
      navLabel: 'Emergency',
      path: '/emergency',
    },
    household: {
      name: 'Household / Domestic Collective',
      description: 'Household entity with shared stewardship members.',
      capabilities: [ 'ipms:household' ],
      routes: [ 'POST /.databox/ipms/household/build' ],
      navLabel: 'Household',
      path: '/household',
    },
    inventory: {
      name: 'Inventory & Stock',
      description: 'Stock fulfillment checks and auditable stock records.',
      capabilities: [ 'ipms:inventory', 'ipms:stock' ],
      routes: [ 'POST /.databox/ipms/inventory/check', 'POST /.databox/ipms/inventory/record' ],
      navLabel: 'Inventory',
      path: '/inventory',
    },
    loyalty: {
      name: 'Loyalty Programs',
      description: 'Loyalty points earn/redeem transactions and records.',
      capabilities: [ 'ipms:loyalty' ],
      routes: [ 'POST /.databox/ipms/loyalty/apply', 'POST /.databox/ipms/loyalty/record' ],
      navLabel: 'Loyalty',
      path: '/loyalty',
    },
    orgnetwork: {
      name: 'Federated Org Networks',
      description: 'Organizational unit hierarchy with parent relationships.',
      capabilities: [ 'ipms:orgnetwork', 'ipms:org-unit' ],
      routes: [ 'POST /.databox/ipms/orgnetwork/unit' ],
      navLabel: 'Org Networks',
      path: '/orgnetwork',
    },
    pricing: {
      name: 'Wholesale / B2B Pricing',
      description: 'Tiered wholesale pricing with MOQ enforcement.',
      capabilities: [ 'ipms:pricing', 'ipms:wholesale' ],
      routes: [ 'POST /.databox/ipms/pricing/wholesale' ],
      navLabel: 'Pricing',
      path: '/pricing',
    },
    a11y: {
      name: 'Accessibility Audit',
      description: 'Audit media and controls for accessibility issues.',
      capabilities: [ 'ipms:a11y' ],
      routes: [ 'POST /.databox/ipms/a11y/audit' ],
      navLabel: 'Accessibility',
      path: '/a11y',
    },
    business: {
      name: 'Business Hours',
      description: 'Opening hours schema.org records and open/closed checks.',
      capabilities: [ 'ipms:business-hours' ],
      routes: [ 'POST /.databox/ipms/business/hours/build', 'POST /.databox/ipms/business/hours/check' ],
      navLabel: 'Business Hours',
      path: '/business',
    },
    consumer: {
      name: 'Consumer Rights',
      description: 'Data-subject access and correction requests.',
      capabilities: [ 'ipms:consumer-rights', 'ipms:access-request', 'ipms:correction-request' ],
      routes: [ 'POST /.databox/ipms/consumer/access-request', 'POST /.databox/ipms/consumer/correction-request' ],
      navLabel: 'Consumer Rights',
      path: '/consumer',
    },
    i18n: {
      name: 'Internationalization',
      description: 'Locale negotiation from Accept-Language headers.',
      capabilities: [ 'ipms:i18n', 'ipms:locale-negotiation' ],
      routes: [ 'POST /.databox/ipms/i18n/negotiate' ],
      navLabel: 'i18n',
      path: '/i18n',
    },
    integration: {
      name: 'Enterprise Connectors',
      description: 'Portable connector manifest and job validation.',
      capabilities: [ 'ipms:integration', 'ipms:connector' ],
      routes: [ 'POST /.databox/ipms/integration/manifest/validate', 'POST /.databox/ipms/integration/job/validate' ],
      navLabel: 'Integration',
      path: '/integration',
    },
    theming: {
      name: 'Theming & Design Tokens',
      description: 'W3C DTCG design token validation, CSS compilation, and Smithy token projection.',
      capabilities: [ 'ipms:theming', 'ipms:design-tokens' ],
      routes: [
        'POST /.databox/ipms/theming/validate',
        'POST /.databox/ipms/theming/css',
        'POST /.databox/ipms/theming/smithy-tokens',
      ],
      navLabel: 'Theming',
      path: '/theming',
    },
    events: {
      name: 'Event Dispatcher',
      description: 'Dispatch and track schema.org events with attendance and status.',
      capabilities: [ 'ipms:events', 'ipms:event-dispatch' ],
      routes: [ 'POST /.databox/ipms/events/event' ],
      navLabel: 'Events',
      path: '/events',
    },
    ticketing: {
      name: 'Ticketing',
      description: 'Issue and track tickets with QR codes and seat assignments.',
      capabilities: [ 'ipms:ticketing', 'ipms:tickets' ],
      routes: [ 'POST /.databox/ipms/ticketing/ticket' ],
      navLabel: 'Ticketing',
      path: '/ticketing',
    },
    provenance: {
      name: 'Provenance Tracking',
      description: 'W3C PROV-O provenance records for data lineage and audit.',
      capabilities: [ 'ipms:provenance', 'ipms:prov' ],
      routes: [ 'POST /.databox/ipms/provenance' ],
      navLabel: 'Provenance',
      path: '/provenance',
    },
    social: {
      name: 'Social Posts',
      description: 'Activity Streams social notes and posts.',
      capabilities: [ 'ipms:social', 'ipms:notes' ],
      routes: [ 'POST /.databox/ipms/social/note' ],
      navLabel: 'Social',
      path: '/social',
    },
    records: {
      name: 'Records Management',
      description: 'Official record entries with retention and classification.',
      capabilities: [ 'ipms:records', 'ipms:record-entries' ],
      routes: [ 'POST /.databox/ipms/records/entry' ],
      navLabel: 'Records',
      path: '/records',
    },
    licensing: {
      name: 'Licensing & Permits',
      description: 'Issue licences and permits with scope and validity periods.',
      capabilities: [ 'ipms:licensing', 'ipms:licences', 'ipms:permits' ],
      routes: [ 'POST /.databox/ipms/licensing/licence', 'POST /.databox/ipms/licensing/permit' ],
      navLabel: 'Licensing',
      path: '/licensing',
    },
    reputation: {
      name: 'Reputation & Reviews',
      description: 'Aggregate ratings and reviews into reputation scores.',
      capabilities: [ 'ipms:reputation', 'ipms:reviews' ],
      routes: [ 'POST /.databox/ipms/reputation/aggregate' ],
      navLabel: 'Reputation',
      path: '/reputation',
    },
    delivery: {
      name: 'Delivery Management',
      description: 'Delivery requests with routing, tracking, and status.',
      capabilities: [ 'ipms:delivery', 'ipms:delivery-requests' ],
      routes: [ 'POST /.databox/ipms/delivery/request' ],
      navLabel: 'Delivery',
      path: '/delivery',
    },
    access: {
      name: 'Access Control',
      description: 'Evaluate access requests against credential gate policies.',
      capabilities: [ 'ipms:access', 'ipms:credential-gate' ],
      routes: [ 'POST /.databox/ipms/access/evaluate' ],
      navLabel: 'Access Control',
      path: '/access',
    },
  };

  for (const [ id, mod ] of Object.entries(phase3Modules)) {
    if (!registry.get(id)) {
      registry.register({
        id,
        name: mod.name,
        version: '0.1.0',
        description: mod.description,
        capabilities: mod.capabilities,
        routes: mod.routes,
        adminUi: {
          navLabel: mod.navLabel,
          path: mod.path,
        },
      });
    }
    if (!registry.isEnabled(id)) {
      registry.setEnabled(id, true);
    }
  }
}

function writeJson(
  response: HttpHandlerInput['response'],
  statusCode: number,
  body: unknown,
  contentType = 'application/json',
): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', `${contentType}; charset=utf-8`);
  response.end(JSON.stringify(body));
}

function writeTurtle(
  response: HttpHandlerInput['response'],
  statusCode: number,
  body: string,
): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'text/turtle; charset=utf-8');
  response.setHeader('cache-control', 'public, max-age=60');
  response.setHeader('vary', 'host, x-forwarded-proto');
  response.end(body);
}

function requestBaseUrl(request: HttpHandlerInput['request']): string {
  const absolute = absoluteRequestBaseUrl(request.url);
  if (absolute) {
    return absolute;
  }

  const host = firstHeader(request.headers.host) ?? 'localhost';
  const proto = firstHeader(request.headers['x-forwarded-proto']) ?? 'http';
  return `${proto}://${host}/`;
}

function absoluteRequestBaseUrl(url: string | undefined): string | undefined {
  if (url === undefined) {
    return;
  }
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/`;
  } catch {}
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseConfigShapeRoute(
  routeBase: string,
  method: string,
  url: string,
): { id: string } | undefined {
  if (method.toUpperCase() !== 'GET') {
    return;
  }
  const path = new URL(url, 'http://localhost').pathname;
  const prefix = `${routeBase}/modules/`;
  if (!path.startsWith(prefix)) {
    return;
  }
  const suffix = '/config-shape';
  if (!path.endsWith(suffix)) {
    return;
  }
  const encoded = path.slice(prefix.length, -suffix.length);
  if (encoded.length === 0 || encoded.includes('/')) {
    return;
  }
  try {
    return { id: decodeURIComponent(encoded) };
  } catch {}
}

function parseModuleStateRoute(
  routeBase: string,
  method: string,
  url: string,
): { method: string; id: string } | undefined {
  const path = new URL(url, 'http://localhost').pathname;
  const prefix = `${routeBase}/modules/`;
  if (!path.startsWith(prefix)) {
    return;
  }
  const encoded = path.slice(prefix.length);
  if (encoded.length === 0 || encoded.includes('/')) {
    return;
  }
  try {
    return { method: method.toUpperCase(), id: decodeURIComponent(encoded) };
  } catch {}
}

function parseVerticalProfileRoute(
  routeBase: string,
  method: string,
  url: string,
): { method: string; id: string; action?: string } | undefined {
  const path = new URL(url, 'http://localhost').pathname;
  const prefix = `${routeBase}/vertical-profiles/`;
  if (!path.startsWith(prefix)) {
    return;
  }
  const parts = path.slice(prefix.length).split('/');
  if (parts.length === 0 || parts.length > 2 || parts[0].length === 0) {
    return;
  }
  try {
    return {
      method: method.toUpperCase(),
      id: decodeURIComponent(parts[0]),
      ...parts[1] === undefined ? {} : { action: parts[1] },
    };
  } catch {}
}

interface VerticalProfileDefaultPreview {
  readonly moduleId: string;
  readonly enabled: boolean;
  readonly contentType: 'text/turtle';
  readonly configTurtle: string;
}

interface VerticalProfileModuleSummary extends VerticalProfileModuleReference {
  readonly available: boolean;
  readonly enabled: boolean;
  readonly capabilityMode: string;
  readonly manifest?: SolidModuleManifest;
  readonly unavailableReason?: string;
}

interface VerticalProfileSummary extends VerticalProfileManifest {
  readonly capabilityMode: 'css-enhanced';
  readonly controlPlaneAvailable: true;
  readonly canApply: boolean;
  readonly missingModules: readonly string[];
  readonly unavailableModules: readonly string[];
  readonly degradationReason?: string;
  readonly modules: readonly VerticalProfileModuleSummary[];
}

function verticalProfileDegradationReason(canApply: boolean, missingModules: readonly string[]): string | undefined {
  if (canApply) {
    return;
  }
  if (missingModules.length > 0) {
    return `Missing horizontal modules: ${missingModules.join(', ')}.`;
  }
  return 'Applying RDF defaults requires a ModuleConfigStore.';
}

async function readJsonBody<T>(request: HttpHandlerInput['request']): Promise<T> {
  let body = '';
  for await (const chunk of request) {
    body += requestChunkToString(chunk);
    if (Buffer.byteLength(body, 'utf8') > 65_536) {
      throw new Error('IPMS request body is too large.');
    }
  }
  if (body.trim().length === 0) {
    throw new Error('IPMS request body must be JSON.');
  }
  return JSON.parse(body) as T;
}

function requestChunkToString(chunk: unknown): string {
  if (typeof chunk === 'string') {
    return chunk;
  }
  if (Buffer.isBuffer(chunk)) {
    return chunk.toString('utf8');
  }
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk).toString('utf8');
  }
  throw new TypeError('IPMS request body contained an unsupported chunk type.');
}
