import { useMemo, useState } from "react";
import { CapabilityStrip, StatusBadge } from "./shared";
import { money, orderTotal, standardIntent, usePosSnapshot } from "./operations";
import { FSANZ_ALLERGEN_CATEGORIES } from "./allergens";

const qrCells = Array.from({ length: 81 }, (_, index) => index);

const QrPreview = ({ active = true }: { active?: boolean }) => (
  <div className="bg-white rounded-lg p-3 w-44 h-44 grid grid-cols-9 gap-1">
    {qrCells.map((cell) => {
      const finder =
        cell < 3 || (cell % 9 < 3 && Math.floor(cell / 9) < 3) ||
        (cell % 9 > 5 && Math.floor(cell / 9) < 3) ||
        (cell % 9 < 3 && Math.floor(cell / 9) > 5);
      const filled = finder || (cell * 7 + 3) % 5 === 0 || (cell * 11) % 7 === 0;
      return <span key={cell} className={`${filled && active ? "bg-black" : "bg-slate-200"} rounded-[1px]`} />;
    })}
  </div>
);

export const CustomerSelfOrderPage = () => {
  const { snapshot } = usePosSnapshot();
  const [tableId, setTableId] = useState("t4");
  const [sharedProfile, setSharedProfile] = useState(true);
  const [connectVault, setConnectVault] = useState(false);
  const [selectedAllergens, setSelectedAllergens] = useState(["sesame"]);
  const [cart, setCart] = useState([
    {
      itemId: "menu-house-soda",
      name: "House soda",
      quantity: 2,
      unitPrice: 5.5,
      station: "bar",
      productResource: "https://databox.example/pods/org/catalogue/items/house-soda.ttl#item",
    },
  ]);
  const table = snapshot.tables.find((candidate: any) => candidate.id === tableId);
  const menuItems = snapshot.menuItems.filter((item: any) => item.section !== "Retail");
  const filteredItems = sharedProfile
    ? menuItems.filter((item: any) => !(item.allergens ?? []).some((allergen: string) => selectedAllergens.includes(allergen)))
    : menuItems;
  const sessionUrl = table?.orderingLandingUrl ?? `https://databox.example/order/${tableId}`;
  const selfOrderCartResource = `https://databox.example/pods/org/pos/carts/self-${tableId}.ttl#cart`;
  const selfOrderResource = `https://databox.example/pods/org/pos/orders/self-${tableId}.ttl#order`;
  const selfOrderTicketResource = `https://databox.example/pods/org/pos/tickets/self-${tableId}.ttl#ticket`;

  const toggleAllergen = (allergen: string) => {
    setSelectedAllergens((current) =>
      current.includes(allergen) ? current.filter((item) => item !== allergen) : [...current, allergen]
    );
  };

  const addItem = (item: any) => {
    setCart((current) => {
      const existing = current.find((line) => line.itemId === item.id);
      if (existing) {
        return current.map((line) => line.itemId === item.id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [
        ...current,
        {
          itemId: item.id,
          name: item.name,
          quantity: 1,
          unitPrice: item.price,
          station: item.station,
          productResource: item.solidResource,
        },
      ];
    });
  };

  const orderIntent = useMemo(() => ({
    ...standardIntent("customer-self-order-submit", snapshot),
    tableSession: sessionUrl,
    tableSessionResource: table?.sessionResource,
    wifiOnboarding: table?.onboarding,
    canonicalResources: {
      cart: selfOrderCartResource,
      order: selfOrderResource,
      ticket: selfOrderTicketResource,
      onboarding: table?.onboardingResource,
    },
    profileDisclosure: sharedProfile
      ? {
          type: "MinimalDisclosurePreference",
          disclosed: ["dietary constraint labels"],
          withheld: ["legal identity", "raw medical details", "full customer pod"],
          excludedAllergens: selectedAllergens,
        }
      : "anonymous-table-session",
    customerVaultConnection: connectVault
      ? {
          mode: "solid-vault-linked",
          connectUrl: snapshot.customerOrdering?.solidVaultConnectUrl,
          customerWebId: "https://customer.example/profile/card#me",
          customerStorage: "https://customer.example/pod/",
          disclosedClaims: ["receipt inbox", "dietary constraint labels"],
          withheldClaims: ["legal identity", "payment card details"],
        }
      : {
          mode: "anonymous-table-session",
          connectUrl: snapshot.customerOrdering?.solidVaultConnectUrl,
          disclosedClaims: sharedProfile ? ["dietary constraint labels"] : [],
          withheldClaims: ["legal identity", "raw medical details", "full customer pod"],
        },
    order: {
      type: "schema:Order",
      channel: "self-order",
      lifecycle: {
        cartState: "held",
        orderState: "held",
        ticketState: "held",
      },
      total: orderTotal(cart),
      lines: cart.map((line) => ({
        ...line,
        product: line.productResource,
        type: "schema:Offer",
      })),
    },
  }), [
    cart,
    connectVault,
    selectedAllergens,
    selfOrderCartResource,
    selfOrderResource,
    selfOrderTicketResource,
    sessionUrl,
    sharedProfile,
    snapshot,
    table?.onboarding,
    table?.onboardingResource,
    table?.sessionResource,
  ]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[92rem]">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-3xl font-bold mb-2">Customer Self-Order</h1>
          <p className="text-slate-400 max-w-3xl">Table session, Wi-Fi QR, minimal profile sharing and customer order RDF.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="green">table session</StatusBadge>
          <StatusBadge tone="green">minimal disclosure</StatusBadge>
          <StatusBadge tone={snapshot.nativeEdgeAvailable ? "sky" : "amber"}>QR renderer</StatusBadge>
        </div>
      </div>

      <CapabilityStrip snapshot={snapshot} />

      <div className="grid grid-cols-1 xl:grid-cols-[22rem_1fr_28rem] gap-5">
        <aside className="space-y-5">
          <section className="glass-panel rounded-xl p-4">
            <h2 className="text-xl font-bold text-white mb-3">Session</h2>
            <label className="block text-sm text-slate-400 mb-1">Table</label>
            <select className="w-full glass-input p-3 rounded-lg mb-4" value={tableId} onChange={(event) => setTableId(event.target.value)}>
              {snapshot.tables.map((candidate: any) => (
                <option key={candidate.id} value={candidate.id} className="bg-slate-900">{candidate.label} - {candidate.zone}</option>
              ))}
            </select>
            <div className="flex justify-center mb-4">
              <QrPreview active={Boolean(table)} />
            </div>
            <p className="font-mono text-xs text-sky-300 break-all">{sessionUrl}</p>
            <p className="font-mono text-xs text-amber-200 break-all mt-2">{table?.wifiQrUrl}</p>
            <p className="font-mono text-xs text-slate-400 break-all mt-2">{table?.onboardingResource}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone={snapshot.nativeEdgeAvailable ? "green" : "amber"}>native QR {snapshot.nativeEdgeAvailable ? "ready" : "descriptor only"}</StatusBadge>
              <StatusBadge tone="green">Solid resource</StatusBadge>
            </div>
          </section>

          <section className="glass-panel rounded-xl p-4">
            <h2 className="text-xl font-bold text-white mb-3">Profile Share</h2>
            <label className="flex items-center gap-3 glass-input p-3 rounded-lg cursor-pointer mb-3">
              <input type="checkbox" checked={sharedProfile} onChange={(event) => setSharedProfile(event.target.checked)} />
              <span className="text-sm text-slate-200">Use dietary preference VC</span>
            </label>
            <label className="flex items-center gap-3 glass-input p-3 rounded-lg cursor-pointer mb-3">
              <input type="checkbox" checked={connectVault} onChange={(event) => setConnectVault(event.target.checked)} />
              <span className="text-sm text-slate-200">Connect customer Solid vault</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {FSANZ_ALLERGEN_CATEGORIES.map((allergen) => (
                <button
                  key={allergen}
                  type="button"
                  onClick={() => toggleAllergen(allergen)}
                  className={`px-3 py-2 rounded-md text-xs font-semibold border ${selectedAllergens.includes(allergen) ? "bg-amber-500/15 text-amber-200 border-amber-500/40" : "bg-white/5 text-slate-300 border-white/10"}`}
                >
                  {allergen}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="glass-panel rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-white">Customer Menu</h2>
            <StatusBadge tone={sharedProfile ? "green" : "slate"}>{filteredItems.length} visible</StatusBadge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
            {filteredItems.map((item: any) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addItem(item)}
                className="text-left bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 min-h-[8rem]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.section} / {item.station}</p>
                  </div>
                  <p className="font-mono text-[#d4af37]">{money(item.price)}</p>
                </div>
                <p className="text-xs text-slate-400 mt-3">{item.allergens.length ? item.allergens.join(", ") : "no flagged allergens"}</p>
              </button>
            ))}
          </div>
        </main>

        <aside className="space-y-5">
          <section className="glass-panel rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-white">Cart</h2>
              <p className="font-mono text-[#d4af37]">{money(orderTotal(cart))}</p>
            </div>
            <div className="divide-y divide-white/5">
              {cart.map((line) => (
                <div key={line.itemId} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{line.name}</p>
                    <p className="text-xs text-slate-500">x{line.quantity} / {line.station}</p>
                  </div>
                  <p className="font-mono text-slate-200">{money(line.quantity * line.unitPrice)}</p>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-white/10">
              <button
                type="button"
                className="action-btn w-full py-3"
                disabled={cart.length === 0}
              >
                {snapshot.controlPlaneAvailable ? "Submit to Staff Review" : "Write Order Intent"}
              </button>
            </div>
          </section>

          <section className="glass-panel rounded-xl p-4">
            <h2 className="text-xl font-bold text-white mb-3">Canonical Resources</h2>
            <div className="space-y-2">
              <p className="font-mono text-xs text-sky-300 break-all">{selfOrderCartResource}</p>
              <p className="font-mono text-xs text-sky-300 break-all">{selfOrderResource}</p>
              <p className="font-mono text-xs text-sky-300 break-all">{selfOrderTicketResource}</p>
              <p className="font-mono text-xs text-amber-200 break-all">{snapshot.customerOrdering?.solidVaultConnectUrl}</p>
            </div>
          </section>

          <section className="glass-panel rounded-xl p-4">
            <h2 className="text-xl font-bold text-white mb-3">Portable Intent</h2>
            <pre className="bg-black/40 border border-white/10 rounded-lg p-4 text-xs text-slate-200 overflow-x-auto max-h-[30rem]">
              {JSON.stringify(orderIntent, null, 2)}
            </pre>
          </section>
        </aside>
      </div>
    </div>
  );
};
