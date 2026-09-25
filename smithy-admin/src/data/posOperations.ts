export type PosCapabilityMode = "css-enhanced" | "portable-core";

export type PosOperationSnapshot = ReturnType<typeof createPosOperationsSnapshot>;

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();
const orgPodBase = "https://databox.example/pods/org";
const shopAppInstallUrl = "https://databox.example/apps/shop";
const solidVaultConnectUrl = "https://databox.example/connect/customer-solid-vault";

const posResource = (path: string) => `${orgPodBase}/pos/${path}`;
const tableSessionResource = (tableId: string, sessionId: string) =>
  posResource(`table-sessions/${tableId}/${sessionId}.ttl#session`);
const tableLandingUrl = (tableId: string, sessionId: string) =>
  `https://databox.example/order/${tableId}/${sessionId}`;

const canonicalOrderResources = (orderId: string) => ({
  solidCartResource: posResource(`carts/${orderId}.ttl#cart`),
  solidOrderResource: posResource(`orders/${orderId}.ttl#order`),
  solidTicketResource: posResource(`tickets/${orderId}.ttl#ticket`),
});

const createTable = (
  id: string,
  label: string,
  zone: string,
  seats: number,
  status: string,
  sessionId: string,
  orderId: string,
) => {
  const sessionResource = tableSessionResource(id, sessionId);
  const landingUrl = tableLandingUrl(id, sessionId);
  return {
    id,
    label,
    zone,
    seats,
    status,
    sessionId,
    sessionResource,
    orderId,
    orderingLandingUrl: landingUrl,
    wifiQrUrl: `${landingUrl}#wifi`,
    onboardingResource: `${sessionResource}#onboarding`,
    onboarding: {
      "@context": {
        schema: "https://schema.org/",
        solid: "http://www.w3.org/ns/solid/terms#",
        pos: "urn:solid-server:databox:ipms:pos#",
      },
      "@type": "EntryPoint",
      "@id": `${sessionResource}#onboarding`,
      url: landingUrl,
      contentUrl: `${landingUrl}.png`,
      actionPlatform: "Web",
      object: { "@id": sessionResource },
      appInstallUrl: shopAppInstallUrl,
      solidVaultConnectUrl,
      networkSsid: "Databox Shop Guest",
    },
  };
};

export const posMenuItems = [
  {
    id: "menu-flat-white",
    name: "Flat white",
    section: "Coffee",
    price: 4.8,
    taxCode: "GST",
    stock: 38,
    station: "bar",
    allergens: ["milk"],
    solidResource: "https://databox.example/pods/org/catalogue/items/flat-white.ttl#item",
  },
  {
    id: "menu-long-black",
    name: "Long black",
    section: "Coffee",
    price: 4.2,
    taxCode: "GST",
    stock: 42,
    station: "bar",
    allergens: [],
    solidResource: "https://databox.example/pods/org/catalogue/items/long-black.ttl#item",
  },
  {
    id: "menu-brekky-roll",
    name: "Brekky roll",
    section: "Kitchen",
    price: 13.5,
    taxCode: "GST",
    stock: 12,
    station: "kitchen",
    allergens: ["egg", "gluten"],
    solidResource: "https://databox.example/pods/org/catalogue/items/brekky-roll.ttl#item",
  },
  {
    id: "menu-green-bowl",
    name: "Green bowl",
    section: "Kitchen",
    price: 17.0,
    taxCode: "GST",
    stock: 9,
    station: "kitchen",
    allergens: ["sesame"],
    solidResource: "https://databox.example/pods/org/catalogue/items/green-bowl.ttl#item",
  },
  {
    id: "menu-banana-bread",
    name: "Banana bread",
    section: "Bakery",
    price: 6.5,
    taxCode: "GST",
    stock: 6,
    station: "counter",
    allergens: ["gluten", "egg"],
    solidResource: "https://databox.example/pods/org/catalogue/items/banana-bread.ttl#item",
  },
  {
    id: "menu-house-soda",
    name: "House soda",
    section: "Cold drinks",
    price: 5.5,
    taxCode: "GST",
    stock: 24,
    station: "bar",
    allergens: [],
    solidResource: "https://databox.example/pods/org/catalogue/items/house-soda.ttl#item",
  },
  {
    id: "retail-beans",
    name: "Beans 250g",
    section: "Retail",
    price: 18.0,
    taxCode: "GST",
    stock: 16,
    station: "counter",
    allergens: [],
    solidResource: "https://databox.example/pods/org/catalogue/items/beans-250g.ttl#item",
  },
  {
    id: "retail-keepcup",
    name: "Keep cup",
    section: "Retail",
    price: 22.0,
    taxCode: "GST",
    stock: 5,
    station: "counter",
    allergens: [],
    solidResource: "https://databox.example/pods/org/catalogue/items/keep-cup.ttl#item",
  },
];

export const posTables = [
  createTable("t1", "T1", "Window", 2, "ordering", "sess-window-1", "ord-1048"),
  createTable("t2", "T2", "Window", 4, "served", "sess-window-2", "ord-1044"),
  createTable("t4", "T4", "Courtyard", 6, "needs-attention", "sess-yard-4", "ord-1047"),
  createTable("bar-1", "Bar 1", "Counter", 1, "open", "sess-bar-1", ""),
];

export const posOrders = [
  {
    id: "ord-1048",
    channel: "waiter",
    tableId: "t1",
    customer: "Walk-in",
    status: "in-prep",
    createdAt: minutesAgo(9),
    notes: "No onion. Oat milk.",
    ...canonicalOrderResources("ord-1048"),
    canonicalLifecycle: {
      cartState: "submitted",
      orderState: "open",
      ticketState: "sentToFulfilment",
    },
    lines: [
      { itemId: "menu-brekky-roll", name: "Brekky roll", quantity: 2, unitPrice: 13.5, station: "kitchen" },
      { itemId: "menu-flat-white", name: "Flat white", quantity: 2, unitPrice: 4.8, station: "bar" },
    ],
  },
  {
    id: "ord-1047",
    channel: "self-order",
    tableId: "t4",
    customer: "Table session",
    status: "needs-review",
    createdAt: minutesAgo(4),
    notes: "Allergy profile shared: sesame excluded. Staff confirmation needed.",
    ...canonicalOrderResources("ord-1047"),
    canonicalLifecycle: {
      cartState: "held",
      orderState: "held",
      ticketState: "held",
    },
    vaultConnection: {
      mode: "anonymous-table-session",
      connectUrl: solidVaultConnectUrl,
      disclosedClaims: ["dietary constraint labels"],
      withheldClaims: ["legal identity", "raw medical details", "full customer pod"],
    },
    lines: [
      { itemId: "menu-green-bowl", name: "Green bowl", quantity: 1, unitPrice: 17, station: "kitchen" },
      { itemId: "menu-house-soda", name: "House soda", quantity: 2, unitPrice: 5.5, station: "bar" },
    ],
  },
  {
    id: "ord-1044",
    channel: "pos",
    tableId: "t2",
    customer: "Loyalty holder",
    status: "ready-to-pay",
    createdAt: minutesAgo(22),
    notes: "Receipt to customer pod.",
    ...canonicalOrderResources("ord-1044"),
    canonicalLifecycle: {
      cartState: "submitted",
      orderState: "paymentPending",
      ticketState: "completed",
    },
    vaultConnection: {
      mode: "solid-vault-linked",
      customerWebId: "https://riley.example/profile/card#me",
      customerStorage: "https://riley.example/pod/",
      disclosedClaims: ["receipt inbox", "loyalty identifier"],
      withheldClaims: ["legal identity", "payment card details"],
    },
    lines: [
      { itemId: "menu-long-black", name: "Long black", quantity: 1, unitPrice: 4.2, station: "bar" },
      { itemId: "retail-beans", name: "Beans 250g", quantity: 1, unitPrice: 18, station: "counter" },
    ],
  },
];

export const posPromotions = [
  {
    id: "promo-morning",
    name: "Morning coffee pair",
    status: "live",
    discountLabel: "Save 10%",
    eligibility: "schema:Order with two coffee line items before 11:00",
    displayCopy: "Two coffees, 10% off before 11",
    standardSolidRule: "<#promo-morning> a schema:Offer ; schema:eligibleQuantity 2 .",
  },
  {
    id: "promo-beans",
    name: "Retail beans add-on",
    status: "scheduled",
    discountLabel: "AUD 3 off",
    eligibility: "schema:Order including retail-beans and any prepared drink",
    displayCopy: "Add beans to any drink and save $3",
    standardSolidRule: "<#promo-beans> a schema:Offer ; schema:itemOffered <items/beans-250g.ttl#item> .",
  },
];

export const createPosOperationsSnapshot = (
  providerMode = "demo",
  capabilityMode: PosCapabilityMode = "css-enhanced",
  controlPlaneAvailable = capabilityMode === "css-enhanced"
) => ({
  id: "smithy-pos-proof",
  providerMode,
  capabilityMode,
  controlPlaneAvailable,
  nativeEdgeAvailable: false,
  realTimeAvailable: capabilityMode === "css-enhanced",
  degradationReason:
    capabilityMode === "portable-core"
      ? "Standard-Solid mode can read/write menu, cart, order, ticket, table-session and promotion RDF resources, but CSS/native-edge actions are represented as pending intents."
      : "Native-edge payment terminals, cash drawers, customer displays and printers are not attached in this UI proof.",
  solidSurfaces: [
    "schema:Menu / schema:Product catalogue resources",
    "schema:ItemList cart, schema:Order, fulfilment ticket and schema:Invoice receipt resources",
    "org:Membership customer/table/device roles",
    "ODRL/DPV promotion, purpose and receipt policy terms",
    "Solid Type Index discovery for portable module works",
  ],
  enhancedSurfaces: [
    "Payment terminal capture",
    "Cash drawer pulse",
    "Thermal printer ESC/POS job dispatch",
    "Kitchen/customer-display WebSocket push",
    "Native Wi-Fi QR and table-session device binding",
  ],
  menuItems: posMenuItems,
  tables: posTables,
  orders: posOrders,
  promotions: posPromotions,
  customerOrdering: {
    shopAppInstallUrl,
    solidVaultConnectUrl,
    networkSsid: "Databox Shop Guest",
    canonicalResourceRoles: ["cart", "order", "ticket", "shop-wifi-onboarding", "customer-vault-connection"],
  },
  customerDisplay: {
    headline: "Morning rush",
    activeOrderId: "ord-1044",
    loyaltyName: "Riley",
    receiptTarget: "https://riley.example/pod/receipts/ord-1044.ttl",
    screenUrl: "https://databox.example/devices/customer-display/front-counter",
  },
});
