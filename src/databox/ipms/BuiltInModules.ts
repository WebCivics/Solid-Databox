import { IPMS } from '../../util/Vocabularies';
import type { DataboxModuleRegistry } from './DataboxModuleRegistry';
import { MENU_MODULE_MANIFEST } from './modules/menu/Menu';
import { CASH_REGISTER_MODULE_MANIFEST } from './modules/pos/CashRegister';
import { NATIVE_POS_DEVICE_MODULE_MANIFEST } from './modules/pos/NativePosDeviceContract';
import { TABLE_SESSION_MODULE_MANIFEST } from './modules/pos/TableSession';
import { WEBSITE_SEO_MODULE_MANIFEST } from './modules/website/PublicFeedRenderer';
import { SITEMAP_ROBOTS_MODULE_MANIFEST } from './modules/website/SitemapRobots';

export function ensureBuiltIns(registry: DataboxModuleRegistry): void {
  if (!registry.get('bookings')) {
    registry.register({
      id: 'bookings',
      name: 'Bookings & Availability',
      version: '0.1.0',
      description: 'Compute free time slots and issue schema.org reservations.',
      capabilities: [ 'ipms:bookings', 'ipms:availability', 'ipms:reservation' ],
      routes: [
        'POST /.databox/ipms/bookings/availability',
        'POST /.databox/ipms/bookings/reservation/build',
      ],
      configShape: `${IPMS.namespace}BookingsConfigShape`,
      adminUi: {
        navLabel: 'Bookings',
        path: '/bookings',
      },
    });
  }
  if (!registry.isEnabled('bookings')) {
    registry.setEnabled('bookings', true);
  }

  if (!registry.get('jobs')) {
    registry.register({
      id: 'jobs',
      name: 'Jobs / Work Orders',
      version: '0.1.0',
      description: 'Production workflows (intake -> queue -> produce -> finish -> ready).',
      capabilities: [ 'ipms:jobs', 'ipms:work-orders' ],
      routes: [ 'POST /.databox/ipms/jobs/advance' ],
      configShape: `${IPMS.namespace}JobsConfigShape`,
      adminUi: { navLabel: 'Jobs', path: '/jobs' },
    });
  }
  if (!registry.isEnabled('jobs')) {
    registry.setEnabled('jobs', true);
  }

  if (!registry.get('payments')) {
    registry.register({
      id: 'payments',
      name: 'Payments & Receipts',
      version: '0.1.0',
      description: 'Payment logic including taxes, splits, subscriptions, refunds, and verifiable receipts.',
      capabilities: [ 'ipms:payments', 'ipms:receipts' ],
      routes: [
        'POST /.databox/ipms/payments/receipt/build',
        'POST /.databox/ipms/payments/refund/compute',
        'POST /.databox/ipms/payments/split/compute',
        'POST /.databox/ipms/payments/subscription/next-date',
        'POST /.databox/ipms/payments/subscription/is-due',
        'POST /.databox/ipms/payments/tax/compute',
      ],
      configShape: `${IPMS.namespace}PaymentsConfigShape`,
      adminUi: { navLabel: 'Payments', path: '/payments' },
    });
  }
  if (!registry.isEnabled('payments')) {
    registry.setEnabled('payments', true);
  }

  if (!registry.get('catalogue')) {
    registry.register({
      id: 'catalogue',
      name: 'Catalogue Variants',
      version: '0.1.0',
      description: 'Expand a product\'s options into the full variant / SKU matrix.',
      capabilities: [ 'ipms:catalogue', 'ipms:catalogue-variants' ],
      routes: [ 'POST /.databox/ipms/catalogue/variants/build' ],
      configShape: `${IPMS.namespace}CatalogueConfigShape`,
      adminUi: {
        navLabel: 'Catalogue',
        path: '/catalogue',
      },
    });
  }
  if (!registry.isEnabled('catalogue')) {
    registry.setEnabled('catalogue', true);
  }

  if (!registry.get('feeds')) {
    registry.register({
      id: 'feeds',
      name: 'RDF Feeds',
      version: '0.1.0',
      description: 'Publish the business\'s things as public machine-readable feeds (schema.org JSON-LD syndication).',
      capabilities: [ 'ipms:feeds', 'ipms:rdf-syndication' ],
      routes: [ 'POST /.databox/ipms/feeds/products/build' ],
      configShape: `${IPMS.namespace}FeedsConfigShape`,
      adminUi: {
        navLabel: 'Feeds',
        path: '/feeds',
      },
    });
  }
  if (!registry.isEnabled('feeds')) {
    registry.setEnabled('feeds', true);
  }

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
      configShape: `${IPMS.namespace}HostingConfigShape`,
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
      configShape: `${IPMS.namespace}GovernanceConfigShape`,
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
      configShape: `${IPMS.namespace}CredentialsConfigShape`,
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
      configShape: `${IPMS.namespace}ProfileConfigShape`,
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
      configShape: `${IPMS.namespace}ReceiptConfigShape`,
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
      configShape: `${IPMS.namespace}PosOrderingConfigShape`,
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
      configShape: `${IPMS.namespace}PosPromotionsDisplayConfigShape`,
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
  if (!registry.get(SITEMAP_ROBOTS_MODULE_MANIFEST.id)) {
    registry.register(SITEMAP_ROBOTS_MODULE_MANIFEST);
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
  if (!registry.isEnabled(SITEMAP_ROBOTS_MODULE_MANIFEST.id)) {
    registry.setEnabled(SITEMAP_ROBOTS_MODULE_MANIFEST.id, true);
  }
  if (!registry.isEnabled(TABLE_SESSION_MODULE_MANIFEST.id)) {
    registry.setEnabled(TABLE_SESSION_MODULE_MANIFEST.id, true);
  }

  const newModules: Record<string, {
    name: string;
    description: string;
    capabilities: string[];
    routes: string[];
    configShape: string;
    navLabel: string;
    path: string;
  }> = {
    consent: {
      name: 'Consent Management',
      description: 'DPV-shaped consent records (grant/withdraw) as JSON-LD.',
      capabilities: [ 'ipms:consent' ],
      routes: [ 'POST /.databox/ipms/consent/build' ],
      configShape: `${IPMS.namespace}ConsentConfigShape`,
      navLabel: 'Consent',
      path: '/consent',
    },
    delegation: {
      name: 'Delegation & Assisted Agency',
      description: 'Scoped, revocable delegation grants and validation.',
      capabilities: [ 'ipms:delegation' ],
      routes: [ 'POST /.databox/ipms/delegation/build', 'POST /.databox/ipms/delegation/validate' ],
      configShape: `${IPMS.namespace}DelegationConfigShape`,
      navLabel: 'Delegation',
      path: '/delegation',
    },
    emergency: {
      name: 'Emergency / Break-Glass Access',
      description: 'Break-glass access evaluation with audit trail.',
      capabilities: [ 'ipms:break-glass' ],
      routes: [ 'POST /.databox/ipms/emergency/break-glass' ],
      configShape: `${IPMS.namespace}EmergencyConfigShape`,
      navLabel: 'Emergency',
      path: '/emergency',
    },
    household: {
      name: 'Household / Domestic Collective',
      description: 'Household entity with shared stewardship members.',
      capabilities: [ 'ipms:household' ],
      routes: [ 'POST /.databox/ipms/household/build' ],
      configShape: `${IPMS.namespace}HouseholdConfigShape`,
      navLabel: 'Household',
      path: '/household',
    },
    inventory: {
      name: 'Inventory & Stock',
      description: 'Stock fulfillment checks and auditable stock records.',
      capabilities: [ 'ipms:inventory', 'ipms:stock' ],
      routes: [ 'POST /.databox/ipms/inventory/check', 'POST /.databox/ipms/inventory/record' ],
      configShape: `${IPMS.namespace}InventoryConfigShape`,
      navLabel: 'Inventory',
      path: '/inventory',
    },
    loyalty: {
      name: 'Loyalty Programs',
      description: 'Loyalty points earn/redeem transactions and records.',
      capabilities: [ 'ipms:loyalty' ],
      routes: [ 'POST /.databox/ipms/loyalty/apply', 'POST /.databox/ipms/loyalty/record' ],
      configShape: `${IPMS.namespace}LoyaltyConfigShape`,
      navLabel: 'Loyalty',
      path: '/loyalty',
    },
    orgnetwork: {
      name: 'Federated Org Networks',
      description: 'Organizational unit hierarchy with parent relationships.',
      capabilities: [ 'ipms:orgnetwork', 'ipms:org-unit' ],
      routes: [ 'POST /.databox/ipms/orgnetwork/unit' ],
      configShape: `${IPMS.namespace}OrgNetworkConfigShape`,
      navLabel: 'Org Networks',
      path: '/orgnetwork',
    },
    pricing: {
      name: 'Wholesale / B2B Pricing',
      description: 'Tiered wholesale pricing with MOQ enforcement.',
      capabilities: [ 'ipms:pricing', 'ipms:wholesale' ],
      routes: [ 'POST /.databox/ipms/pricing/wholesale' ],
      configShape: `${IPMS.namespace}PricingConfigShape`,
      navLabel: 'Pricing',
      path: '/pricing',
    },
    a11y: {
      name: 'Accessibility Audit',
      description: 'Audit media and controls for accessibility issues.',
      capabilities: [ 'ipms:a11y' ],
      routes: [ 'POST /.databox/ipms/a11y/audit' ],
      configShape: `${IPMS.namespace}A11yConfigShape`,
      navLabel: 'Accessibility',
      path: '/a11y',
    },
    business: {
      name: 'Business Hours',
      description: 'Opening hours schema.org records and open/closed checks.',
      capabilities: [ 'ipms:business-hours' ],
      routes: [ 'POST /.databox/ipms/business/hours/build', 'POST /.databox/ipms/business/hours/check' ],
      configShape: `${IPMS.namespace}BusinessHoursConfigShape`,
      navLabel: 'Business Hours',
      path: '/business',
    },
    consumer: {
      name: 'Consumer Rights',
      description: 'Data-subject access and correction requests.',
      capabilities: [ 'ipms:consumer-rights', 'ipms:access-request', 'ipms:correction-request' ],
      routes: [ 'POST /.databox/ipms/consumer/access-request', 'POST /.databox/ipms/consumer/correction-request' ],
      configShape: `${IPMS.namespace}ConsumerRightsConfigShape`,
      navLabel: 'Consumer Rights',
      path: '/consumer',
    },
    i18n: {
      name: 'Internationalization',
      description: 'Locale negotiation from Accept-Language headers.',
      capabilities: [ 'ipms:i18n', 'ipms:locale-negotiation' ],
      routes: [ 'POST /.databox/ipms/i18n/negotiate' ],
      configShape: `${IPMS.namespace}I18nConfigShape`,
      navLabel: 'i18n',
      path: '/i18n',
    },
    integration: {
      name: 'Enterprise Connectors',
      description: 'Portable connector manifest and job validation.',
      capabilities: [ 'ipms:integration', 'ipms:connector' ],
      routes: [ 'POST /.databox/ipms/integration/manifest/validate', 'POST /.databox/ipms/integration/job/validate' ],
      configShape: `${IPMS.namespace}IntegrationConfigShape`,
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
      configShape: `${IPMS.namespace}ThemingConfigShape`,
      navLabel: 'Theming',
      path: '/theming',
    },
    events: {
      name: 'Event Dispatcher',
      description: 'Dispatch and track schema.org events with attendance and status.',
      capabilities: [ 'ipms:events', 'ipms:event-dispatch' ],
      routes: [ 'POST /.databox/ipms/events/event' ],
      configShape: `${IPMS.namespace}EventsConfigShape`,
      navLabel: 'Events',
      path: '/events',
    },
    ticketing: {
      name: 'Ticketing',
      description: 'Issue and track tickets with QR codes and seat assignments.',
      capabilities: [ 'ipms:ticketing', 'ipms:tickets' ],
      routes: [ 'POST /.databox/ipms/ticketing/ticket' ],
      configShape: `${IPMS.namespace}TicketingConfigShape`,
      navLabel: 'Ticketing',
      path: '/ticketing',
    },
    provenance: {
      name: 'Provenance Tracking',
      description: 'W3C PROV-O provenance records for data lineage and audit.',
      capabilities: [ 'ipms:provenance', 'ipms:prov' ],
      routes: [ 'POST /.databox/ipms/provenance' ],
      configShape: `${IPMS.namespace}ProvenanceConfigShape`,
      navLabel: 'Provenance',
      path: '/provenance',
    },
    social: {
      name: 'Social Posts',
      description: 'Activity Streams social notes and posts.',
      capabilities: [ 'ipms:social', 'ipms:notes' ],
      routes: [ 'POST /.databox/ipms/social/note' ],
      configShape: `${IPMS.namespace}SocialConfigShape`,
      navLabel: 'Social',
      path: '/social',
    },
    records: {
      name: 'Records Management',
      description: 'Official record entries with retention and classification.',
      capabilities: [ 'ipms:records', 'ipms:record-entries' ],
      routes: [ 'POST /.databox/ipms/records/entry' ],
      configShape: `${IPMS.namespace}RecordsConfigShape`,
      navLabel: 'Records',
      path: '/records',
    },
    licensing: {
      name: 'Licensing & Permits',
      description: 'Issue licences and permits with scope and validity periods.',
      capabilities: [ 'ipms:licensing', 'ipms:licences', 'ipms:permits' ],
      routes: [ 'POST /.databox/ipms/licensing/licence', 'POST /.databox/ipms/licensing/permit' ],
      configShape: `${IPMS.namespace}LicensingConfigShape`,
      navLabel: 'Licensing',
      path: '/licensing',
    },
    reputation: {
      name: 'Reputation & Reviews',
      description: 'Aggregate ratings and reviews into reputation scores.',
      capabilities: [ 'ipms:reputation', 'ipms:reviews' ],
      routes: [ 'POST /.databox/ipms/reputation/aggregate' ],
      configShape: `${IPMS.namespace}ReputationConfigShape`,
      navLabel: 'Reputation',
      path: '/reputation',
    },
    delivery: {
      name: 'Delivery Management',
      description: 'Delivery requests with routing, tracking, and status.',
      capabilities: [ 'ipms:delivery', 'ipms:delivery-requests' ],
      routes: [ 'POST /.databox/ipms/delivery/request' ],
      configShape: `${IPMS.namespace}DeliveryConfigShape`,
      navLabel: 'Delivery',
      path: '/delivery',
    },
    access: {
      name: 'Access Control',
      description: 'Evaluate access requests against credential gate policies.',
      capabilities: [ 'ipms:access', 'ipms:credential-gate' ],
      routes: [ 'POST /.databox/ipms/access/evaluate' ],
      configShape: `${IPMS.namespace}AccessConfigShape`,
      navLabel: 'Access Control',
      path: '/access',
    },
    quotations: {
      name: 'Quotations',
      description: 'Build professional quotation documents with line items and PDF rendering.',
      capabilities: [ 'ipms:quotations', 'ipms:quotation-build' ],
      routes: [ 'POST /.databox/ipms/quotations/build' ],
      configShape: `${IPMS.namespace}QuotationsConfigShape`,
      navLabel: 'Quotations',
      path: '/quotations',
    },
    'mcp.server': {
      name: 'MCP Server',
      description: 'Model Context Protocol server for AI agent integration.',
      capabilities: [ 'ipms:mcp', 'ipms:mcp-server' ],
      routes: [ 'POST /.databox/ipms/mcp/tools/list', 'POST /.databox/ipms/mcp/tools/call' ],
      configShape: `${IPMS.namespace}McpServerConfigShape`,
      navLabel: 'MCP Server',
      path: '/mcp',
    },
    tax: {
      name: 'Tax Management',
      description: 'Tax code management (GST/VAT/Sales Tax), tax rate rules per ' +
        'category, tax-inclusive/exclusive pricing, tax exemption certificates, ' +
        'tax reports as RDF.',
      capabilities: [ 'ipms:tax', 'ipms:tax-computation', 'ipms:tax-exemption', 'ipms:tax-report' ],
      routes: [ 'POST /.databox/ipms/tax/compute', 'POST /.databox/ipms/tax/report' ],
      configShape: `${IPMS.namespace}TaxConfigShape`,
      navLabel: 'Tax',
      path: '/tax',
    },
    concessions: {
      name: 'Concessions',
      description: 'Concession rate management for eligible groups (pensioners, ' +
        'students, veterans), concession eligibility verification via VC, ' +
        'concession pricing rules at POS.',
      capabilities: [ 'ipms:concessions', 'ipms:concession-eligibility', 'ipms:concession-pricing' ],
      routes: [
        'POST /.databox/ipms/concessions/eligibility',
        'POST /.databox/ipms/concessions/pricing',
        'POST /.databox/ipms/concessions/record',
      ],
      configShape: `${IPMS.namespace}ConcessionsConfigShape`,
      navLabel: 'Concessions',
      path: '/concessions',
    },
    discounts: {
      name: 'Discounts & Promotions',
      description: 'Discount code management (promo codes, seasonal sales, flash ' +
        'deals), bulk/quantity discounts, bundle discounts, member-only ' +
        'discounts, discount stacking rules.',
      capabilities: [ 'ipms:discounts', 'ipms:discount-codes', 'ipms:promotions' ],
      routes: [ 'POST /.databox/ipms/discounts/apply', 'POST /.databox/ipms/discounts/record' ],
      configShape: `${IPMS.namespace}DiscountsConfigShape`,
      navLabel: 'Discounts',
      path: '/discounts',
    },
    donations: {
      name: 'Donations & Fundraising',
      description: 'Donation campaign management, donation intake (one-off and ' +
        'recurring), donor receipts as VCs, transparency reporting, recurring ' +
        'donation scheduling.',
      capabilities: [
        'ipms:donations',
        'ipms:donation-campaigns',
        'ipms:donation-receipts',
        'ipms:donation-transparency',
      ],
      routes: [
        'POST /.databox/ipms/donations/process',
        'POST /.databox/ipms/donations/receipt',
        'POST /.databox/ipms/donations/transparency',
      ],
      configShape: `${IPMS.namespace}DonationsConfigShape`,
      navLabel: 'Donations',
      path: '/donations',
    },
    notifications: {
      name: 'Notifications',
      description: 'Multi-channel notification management (in-app, email, SMS, ' +
        'push, LDN), channel subscriptions, priority-based dispatch, read ' +
        'tracking, topic filtering.',
      capabilities: [ 'ipms:notifications', 'ipms:notification-channels', 'ipms:notification-subscriptions' ],
      routes: [
        'POST /.databox/ipms/notifications/create',
        'POST /.databox/ipms/notifications/subscribe',
        'POST /.databox/ipms/notifications/read',
        'POST /.databox/ipms/notifications/query',
      ],
      configShape: `${IPMS.namespace}NotificationsConfigShape`,
      navLabel: 'Notifications',
      path: '/notifications',
    },
    'allergy-profile': {
      name: 'Allergy & Ingredient Safety',
      description: 'Consumer allergy/dietary profile management, retailer ingredient ' +
        'declarations with FSANZ/EU allergen categories, allergen matching ' +
        'engine, selective disclosure for secret recipes.',
      capabilities: [
        'ipms:allergy-profile',
        'ipms:ingredient-declaration',
        'ipms:allergen-matching',
        'ipms:selective-disclosure',
      ],
      routes: [
        'POST /.databox/ipms/allergy-profile/build',
        'POST /.databox/ipms/ingredients/declare',
        'POST /.databox/ipms/allergens/match',
        'POST /.databox/ipms/allergens/batch-match',
        'POST /.databox/ipms/allergens/selective-disclosure',
      ],
      configShape: `${IPMS.namespace}AllergyProfileConfigShape`,
      navLabel: 'Allergy Safety',
      path: '/allergy-safety',
    },
    'device-auth': {
      name: 'Device Identity (mTLS)',
      description: 'Device enrolment with keypair generation, mTLS client certificate ' +
        'verification, device revocation, WebID-TLS authentication for POS ' +
        'terminals, customer displays, and IoT devices.',
      capabilities: [ 'ipms:device-auth', 'ipms:device-enrolment', 'ipms:device-revocation', 'ipms:mtls' ],
      routes: [
        'POST /.databox/ipms/device-auth/enrol',
        'POST /.databox/ipms/device-auth/verify',
        'POST /.databox/ipms/device-auth/revoke',
      ],
      configShape: `${IPMS.namespace}DeviceAuthConfigShape`,
      navLabel: 'Device Auth',
      path: '/device-auth',
    },
    hr: {
      name: 'HR & Workforce',
      description: 'Employee/contractor onboarding, shift assignment, compliance ' +
        'credential tracking, payslip generation, expense claims.',
      capabilities: [
        'ipms:hr',
        'ipms:hr-onboarding',
        'ipms:hr-shifts',
        'ipms:hr-compliance',
        'ipms:hr-payroll',
        'ipms:hr-expenses',
      ],
      routes: [
        'POST /.databox/ipms/hr/onboard',
        'POST /.databox/ipms/hr/shift/assign',
        'POST /.databox/ipms/hr/compliance/track',
        'POST /.databox/ipms/hr/payslip/generate',
        'POST /.databox/ipms/hr/expense/claim',
      ],
      configShape: `${IPMS.namespace}HrConfigShape`,
      navLabel: 'HR',
      path: '/hr',
    },
    'driver-management': {
      name: 'Delivery Driver Management',
      description: 'Driver registration with zones and availability, job offer ' +
        'creation, job status tracking, dispatch matching engine.',
      capabilities: [ 'ipms:driver-management', 'ipms:driver-registration', 'ipms:job-offers', 'ipms:dispatch' ],
      routes: [
        'POST /.databox/ipms/delivery/driver/register',
        'POST /.databox/ipms/delivery/job/offer',
        'POST /.databox/ipms/delivery/job/status',
        'POST /.databox/ipms/delivery/dispatch/match',
      ],
      configShape: `${IPMS.namespace}DriverManagementConfigShape`,
      navLabel: 'Drivers',
      path: '/drivers',
    },
    print: {
      name: 'Print Shop',
      description: 'Print service catalogue, job intake with specifications, job status ' +
        'tracking through prepress/proofing/printing/finishing pipeline, ' +
        'inter-org B2B print job submission with ODRL licence enforcement.',
      capabilities: [
        'ipms:print',
        'ipms:print-services',
        'ipms:print-jobs',
        'ipms:print-inter-org',
      ],
      routes: [
        'POST /.databox/ipms/print/service/create',
        'POST /.databox/ipms/print/job/create',
        'POST /.databox/ipms/print/job/status',
        'POST /.databox/ipms/print/inter-org/submit',
      ],
      configShape: `${IPMS.namespace}PrintShopConfigShape`,
      navLabel: 'Print Shop',
      path: '/print',
    },
    'org-apps': {
      name: 'Org App Container',
      description: 'WASM/PWA container that fetches app profiles, UI modules, and per-' +
        'install licences from the IPMS. Supports local-only and remote-capable ' +
        'network scopes, per-install licence VCs, and profile-driven module ' +
        'availability.',
      capabilities: [
        'ipms:org-apps',
        'ipms:app-profiles',
        'ipms:app-licences',
        'ipms:container-boot',
        'ipms:network-scope',
      ],
      routes: [
        'POST /.databox/ipms/org-apps/profile/build',
        'POST /.databox/ipms/org-apps/licence/issue',
        'POST /.databox/ipms/org-apps/licence/validate',
        'POST /.databox/ipms/org-apps/boot',
        'POST /.databox/ipms/org-apps/network-scope/check',
      ],
      configShape: `${IPMS.namespace}OrgAppsConfigShape`,
      navLabel: 'Org Apps',
      path: '/org-apps',
    },
    barcode: {
      name: 'Barcode / QR Scanner',
      description: 'GS1-aware barcode and QR code scanning. Parses GS1 application ' +
        'identifiers (AI), validates GTIN check digits, detects symbology ' +
        '(EAN/UPC/Code-128/Code-39/QR/DataMatrix), and looks up products by ' +
        'GTIN in the catalogue.',
      capabilities: [ 'ipms:barcode', 'ipms:gs1', 'ipms:gtin', 'ipms:product-lookup' ],
      routes: [ 'POST /.databox/ipms/barcode/scan', 'POST /.databox/ipms/barcode/lookup' ],
      configShape: `${IPMS.namespace}BarcodeConfigShape`,
      navLabel: 'Barcode Scanner',
      path: '/barcode',
    },
    eftpos: {
      name: 'EFTPOS / Card Reader',
      description: 'EFTPOS terminal integration for card payments. Supports multiple ' +
        'providers (Tyro, Linkly, Westpac, CBA, NAB, ANZ, Stripe Terminal, ' +
        'Square Terminal, Sumup) via IPG/REST/SOAP/HID/SERIAL protocols. ' +
        'Handles purchase, refund, cashout, preauth, void, and settlement ' +
        'transactions.',
      capabilities: [
        'ipms:eftpos',
        'ipms:card-payment',
        'ipms:terminal-integration',
        'ipms:settlement',
      ],
      routes: [
        'POST /.databox/ipms/eftpos/transaction',
        'POST /.databox/ipms/eftpos/settlement',
        'POST /.databox/ipms/eftpos/status',
      ],
      configShape: `${IPMS.namespace}EftposConfigShape`,
      navLabel: 'EFTPOS Terminal',
      path: '/eftpos',
    },
    backups: {
      name: 'Password-Protected Backups',
      description: 'AES-256-GCM encrypted backups of IPMS resources with scrypt key ' +
        'derivation. Supports JSON-LD, Turtle, and N-Quads formats. Password-' +
        'protected with manifest generation for audit trails.',
      capabilities: [
        'ipms:backups',
        'ipms:encrypted-backup',
        'ipms:restore',
        'ipms:backup-manifest',
      ],
      routes: [
        'POST /.databox/ipms/backups/create',
        'POST /.databox/ipms/backups/restore',
        'POST /.databox/ipms/backups/manifest',
      ],
      configShape: `${IPMS.namespace}BackupConfigShape`,
      navLabel: 'Backups',
      path: '/backups',
    },
    accounting: {
      name: 'Accounting Import / Export',
      description: 'Bridge to leading accounting packages (Xero, MYOB, QuickBooks, ' +
        'Sage) with CSV, OFX, QIF, and JSON-LD format support. Exports invoices, ' +
        'payments, journal entries, tax summaries, contacts, and items. Imports ' +
        'chart of accounts, contacts, items, and opening balances.',
      capabilities: [ 'ipms:accounting', 'ipms:accounting-export', 'ipms:accounting-import', 'ipms:chart-of-accounts' ],
      routes: [ 'POST /.databox/ipms/accounting/export', 'POST /.databox/ipms/accounting/import' ],
      configShape: `${IPMS.namespace}AccountingConfigShape`,
      navLabel: 'Accounting',
      path: '/accounting',
    },
  };

  for (const [ id, mod ] of Object.entries(newModules)) {
    if (!registry.get(id)) {
      registry.register({
        id,
        name: mod.name,
        version: '0.1.0',
        description: mod.description,
        capabilities: mod.capabilities,
        routes: mod.routes,
        configShape: mod.configShape,
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
