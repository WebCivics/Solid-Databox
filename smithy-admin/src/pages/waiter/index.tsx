import { useMemo, useState } from "react";
import { CapabilityStrip, OrderLinesTable, StatusBadge } from "../pos/shared";
import { money, orderTotal, standardIntent, usePosSnapshot } from "../pos/operations";

export const WaiterOrdersPage = () => {
  const { snapshot } = usePosSnapshot();
  const [activeTableId, setActiveTableId] = useState("t4");
  const [note, setNote] = useState("Allergy profile checked. Sesame excluded.");
  const [draftLines, setDraftLines] = useState([
    {
      itemId: "menu-green-bowl",
      name: "Green bowl",
      quantity: 1,
      unitPrice: 17,
      station: "kitchen",
      productResource: "https://databox.example/pods/org/catalogue/items/green-bowl.ttl#item",
    },
  ]);
  const activeTable = snapshot.tables.find((table: any) => table.id === activeTableId);
  const activeOrder = snapshot.orders.find((order: any) => order.tableId === activeTableId);
  const draftCartResource = activeOrder?.solidCartResource ?? `https://databox.example/pods/org/pos/carts/draft-${activeTableId}.ttl#cart`;
  const draftOrderResource = activeOrder?.solidOrderResource ?? `https://databox.example/pods/org/pos/orders/draft-${activeTableId}.ttl#order`;
  const draftTicketResource = activeOrder?.solidTicketResource ?? `https://databox.example/pods/org/pos/tickets/draft-${activeTableId}.ttl#ticket`;

  const tableTone = (status: string) => {
    if (status === "needs-attention") return "amber";
    if (status === "served") return "green";
    if (status === "ordering") return "sky";
    return "slate";
  };

  const addMenuItem = (item: any) => {
    setDraftLines((current) => {
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

  const setQuantity = (itemId: string, quantity: number) => {
    setDraftLines((current) =>
      current
        .map((line) => line.itemId === itemId ? { ...line, quantity } : line)
        .filter((line) => line.quantity > 0)
    );
  };

  const submitIntent = useMemo(() => ({
    ...standardIntent("waiter-submit-order", snapshot),
    targetTableSession: activeTable?.sessionId,
    tableSessionResource: activeTable?.sessionResource,
    table: activeTable?.label,
    note,
    canonicalResources: {
      cart: draftCartResource,
      order: draftOrderResource,
      ticket: draftTicketResource,
    },
    lifecycle: {
      cartState: "submitted",
      orderState: "open",
      ticketState: "sentToFulfilment",
    },
    lines: draftLines.map((line) => ({
      ...line,
      product: line.productResource,
      type: "schema:Offer",
    })),
    total: orderTotal(draftLines),
    downstream: snapshot.controlPlaneAvailable
      ? ["kitchen-display", "customer-display", "schema:Order RDF commit"]
      : ["schema:Order RDF commit only"],
  }), [
    activeTable?.label,
    activeTable?.sessionId,
    activeTable?.sessionResource,
    draftCartResource,
    draftLines,
    draftOrderResource,
    draftTicketResource,
    note,
    snapshot,
  ]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[92rem]">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-3xl font-bold mb-2">Waiter Orders</h1>
          <p className="text-slate-400 max-w-3xl">Table map, portable customer profile notice, order taking and kitchen handoff intent.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="green">org:Role staff</StatusBadge>
          <StatusBadge tone="green">ODRL purpose</StatusBadge>
          <StatusBadge tone={snapshot.realTimeAvailable ? "sky" : "amber"}>live push</StatusBadge>
        </div>
      </div>

      <CapabilityStrip snapshot={snapshot} />

      <div className="grid grid-cols-1 xl:grid-cols-[18rem_1fr_28rem] gap-5">
        <section className="glass-panel rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">Floor</h2>
            <p className="text-xs text-slate-500">Session resources are portable; device live status is enhanced.</p>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-1 gap-3 p-4">
            {snapshot.tables.map((table: any) => (
              <button
                key={table.id}
                type="button"
                onClick={() => setActiveTableId(table.id)}
                className={`text-left rounded-lg border p-4 transition-colors ${table.id === activeTableId ? "border-[#d4af37] bg-[#d4af37]/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-lg font-bold text-white">{table.label}</p>
                  <StatusBadge tone={tableTone(table.status)}>{table.status}</StatusBadge>
                </div>
                <p className="text-xs text-slate-500 mt-2">{table.zone} / {table.seats} seats</p>
                <p className="text-xs font-mono text-slate-400 mt-2 truncate">{table.sessionId}</p>
              </button>
            ))}
          </div>
        </section>

        <main className="space-y-5">
          <section className="glass-panel rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">{activeTable?.label} Draft</h2>
                <p className="text-xs text-slate-500">{activeTable?.zone} / {activeTable?.sessionId}</p>
              </div>
              <StatusBadge tone="amber">profile notice</StatusBadge>
            </div>

            <div className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Service note</label>
                <textarea
                  className="w-full glass-input p-3 rounded-lg min-h-24"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
              <div className="border border-amber-500/25 bg-amber-500/10 rounded-lg p-4 text-sm text-amber-100">
                <p className="font-semibold">Minimal profile share</p>
                <p className="mt-2 text-xs text-amber-100/80">
                  Table session disclosed dietary constraints only. Raw customer identity is not required for waiter ordering.
                </p>
              </div>
            </div>

            <div className="p-4 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
                {snapshot.menuItems.filter((item: any) => item.section !== "Retail").map((item: any) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addMenuItem(item)}
                    className="text-left bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.section} / {item.station}</p>
                      </div>
                      <p className="font-mono text-[#d4af37]">{money(item.price)}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{item.allergens.length ? `Allergens: ${item.allergens.join(", ")}` : "No flagged allergens"}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-white/10 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 border-b border-white/10 text-slate-300">
                    <tr>
                      <th className="p-3 font-semibold">Draft line</th>
                      <th className="p-3 font-semibold">Station</th>
                      <th className="p-3 font-semibold text-right">Qty</th>
                      <th className="p-3 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {draftLines.map((line) => (
                      <tr key={line.itemId}>
                        <td className="p-3 text-white">{line.name}</td>
                        <td className="p-3"><StatusBadge tone={line.station === "kitchen" ? "violet" : "sky"}>{line.station}</StatusBadge></td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            className="glass-input rounded-lg p-2 w-20 text-right"
                            value={line.quantity}
                            onChange={(event) => setQuantity(line.itemId, Number(event.target.value))}
                          />
                        </td>
                        <td className="p-3 text-right font-mono">{money(Number(line.quantity) * Number(line.unitPrice))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <section className="glass-panel rounded-xl p-4">
            <h2 className="text-xl font-bold text-white mb-3">Open Order</h2>
            {activeOrder ? (
              <>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-white">{activeOrder.id}</p>
                    <p className="text-xs text-slate-500">{activeOrder.channel} / {activeOrder.customer}</p>
                  </div>
                  <StatusBadge tone={activeOrder.status === "needs-review" ? "amber" : "sky"}>{activeOrder.status}</StatusBadge>
                </div>
                <OrderLinesTable lines={activeOrder.lines} />
                <p className="mt-3 text-sm text-slate-400">{activeOrder.notes}</p>
                <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Canonical resources</p>
                  <p className="font-mono text-xs text-sky-300 break-all">{activeOrder.solidCartResource}</p>
                  <p className="font-mono text-xs text-sky-300 break-all">{activeOrder.solidOrderResource}</p>
                  <p className="font-mono text-xs text-sky-300 break-all">{activeOrder.solidTicketResource}</p>
                </div>
              </>
            ) : (
              <p className="text-slate-500">No open order.</p>
            )}
          </section>

          <section className="glass-panel rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-xl font-bold text-white">Submit Intent</h2>
              <p className="font-mono text-[#d4af37]">{money(orderTotal(draftLines))}</p>
            </div>
            <button
              type="button"
              className="action-btn w-full py-3 mb-4"
              disabled={draftLines.length === 0}
            >
              {snapshot.controlPlaneAvailable ? "Send to Kitchen" : "Write RDF Intent"}
            </button>
            <pre className="bg-black/40 border border-white/10 rounded-lg p-4 text-xs text-slate-200 overflow-x-auto max-h-[26rem]">
              {JSON.stringify(submitIntent, null, 2)}
            </pre>
          </section>
        </aside>
      </div>
    </div>
  );
};
