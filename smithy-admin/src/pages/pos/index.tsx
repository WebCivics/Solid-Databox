import { useMemo, useState } from "react";
import { CapabilityStrip, OrderLinesTable, StatusBadge } from "./shared";
import { money, orderTotal, standardIntent, usePosSnapshot } from "./operations";

const quantityFor = (cart: any[], id: string) => cart.find((line) => line.itemId === id)?.quantity ?? 0;

export const PosTerminalPage = () => {
  const { snapshot } = usePosSnapshot();
  const [section, setSection] = useState("Coffee");
  const [tableId, setTableId] = useState("bar-1");
  const [customerPod, setCustomerPod] = useState("https://customer.example/pod/receipts/current.ttl");
  const [cart, setCart] = useState([
    { itemId: "menu-flat-white", name: "Flat white", quantity: 1, unitPrice: 4.8, station: "bar" },
    { itemId: "menu-banana-bread", name: "Banana bread", quantity: 1, unitPrice: 6.5, station: "counter" },
  ]);
  const [intent, setIntent] = useState<any>(null);

  const sections = [...new Set(snapshot.menuItems.map((item: any) => item.section))] as string[];
  const visibleItems = snapshot.menuItems.filter((item: any) => item.section === section);
  const subtotal = orderTotal(cart);
  const gst = Math.round(subtotal / 11 * 100) / 100;
  const table = snapshot.tables.find((candidate: any) => candidate.id === tableId);
  const disabledEnhanced = snapshot.controlPlaneAvailable === false || snapshot.nativeEdgeAvailable === false;

  const addItem = (item: any) => {
    setCart((current) => {
      const existing = current.find((line) => line.itemId === item.id);
      if (existing) {
        return current.map((line) => line.itemId === item.id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...current, { itemId: item.id, name: item.name, quantity: 1, unitPrice: item.price, station: item.station }];
    });
  };

  const setQuantity = (itemId: string, quantity: number) => {
    setCart((current) =>
      current
        .map((line) => line.itemId === itemId ? { ...line, quantity } : line)
        .filter((line) => line.quantity > 0)
    );
  };

  const receiptIntent = useMemo(() => ({
    ...standardIntent("create-schema-order-and-receipt", snapshot),
    order: {
      type: "schema:Order",
      table: table?.label,
      customerPod,
      total: subtotal,
      taxIncluded: gst,
      lines: cart.map((line) => ({
        type: "schema:OrderItem",
        orderedItem: line.itemId,
        orderQuantity: line.quantity,
        orderItemNumber: line.name,
      })),
    },
  }), [cart, customerPod, gst, snapshot, subtotal, table?.label]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[92rem]">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-3xl font-bold mb-2">POS Terminal</h1>
          <p className="text-slate-400 max-w-3xl">Counter sale, table transfer, receipt intent and native-edge payment boundary.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="green">schema:Order</StatusBadge>
          <StatusBadge tone="green">schema:Invoice</StatusBadge>
          <StatusBadge tone={disabledEnhanced ? "amber" : "sky"}>payment terminal</StatusBadge>
        </div>
      </div>

      <CapabilityStrip snapshot={snapshot} />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_28rem] gap-5">
        <section className="glass-panel rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {sections.map((name: string) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSection(name)}
                  className={`px-3 py-2 rounded-md text-sm font-semibold border ${section === name ? "bg-[#d4af37] text-black border-[#d4af37]" : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <select className="glass-input p-2 rounded-lg text-sm" value={tableId} onChange={(event) => setTableId(event.target.value)}>
              {snapshot.tables.map((candidate: any) => (
                <option key={candidate.id} value={candidate.id} className="bg-slate-900">{candidate.label} - {candidate.zone}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
            {visibleItems.map((item: any) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addItem(item)}
                className="text-left bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors min-h-[9rem]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{item.name}</p>
                    <p className="text-xs text-slate-500 font-mono mt-1">{item.station} / {item.taxCode}</p>
                  </div>
                  <StatusBadge tone={item.stock < 8 ? "amber" : "green"}>{item.stock}</StatusBadge>
                </div>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <p className="text-lg font-bold text-[#d4af37]">{money(item.price)}</p>
                  <p className="text-xs text-slate-400 text-right">{item.allergens.length ? item.allergens.join(", ") : "no flagged allergens"}</p>
                </div>
                {quantityFor(cart, item.id) > 0 && (
                  <p className="mt-3 text-xs text-sky-300">In cart: {quantityFor(cart, item.id)}</p>
                )}
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="glass-panel rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Current Order</h2>
                <p className="text-xs text-slate-500">{table?.label} / {table?.sessionId}</p>
              </div>
              <StatusBadge tone="sky">{cart.length} lines</StatusBadge>
            </div>
            <div className="divide-y divide-white/5">
              {cart.map((line) => (
                <div key={line.itemId} className="p-4 grid grid-cols-[1fr_6rem] gap-3 items-center">
                  <div>
                    <p className="font-semibold text-white">{line.name}</p>
                    <p className="text-xs text-slate-500">{line.station} / {money(line.unitPrice)}</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    className="glass-input rounded-lg p-2 text-right"
                    value={line.quantity}
                    onChange={(event) => setQuantity(line.itemId, Number(event.target.value))}
                  />
                </div>
              ))}
            </div>
            <div className="p-4 bg-black/20 border-t border-white/10 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-400">Subtotal</span><span className="font-mono">{money(subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">GST included</span><span className="font-mono">{money(gst)}</span></div>
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(subtotal)}</span></div>
            </div>
          </section>

          <section className="glass-panel rounded-xl p-4 space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Customer receipt pod</label>
              <input className="w-full glass-input p-3 rounded-lg" value={customerPod} onChange={(event) => setCustomerPod(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="action-btn px-3 py-3" onClick={() => setIntent(receiptIntent)}>
                Write Receipt Intent
              </button>
              <button
                type="button"
                className="action-btn px-3 py-3"
                disabled={disabledEnhanced}
                title={disabledEnhanced ? "Payment capture needs the CSS/native-edge control plane." : undefined}
                onClick={() => setIntent({ ...standardIntent("capture-payment", snapshot), amount: subtotal })}
              >
                Capture Payment
              </button>
            </div>
          </section>
        </aside>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
        <section className="glass-panel rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">Open Orders</h2>
          </div>
          {snapshot.orders.map((order: any) => (
            <div key={order.id} className="border-b border-white/5 last:border-b-0">
              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{order.id} / {order.tableId}</p>
                  <p className="text-xs text-slate-500">{order.channel} / {order.notes}</p>
                </div>
                <StatusBadge tone={order.status === "needs-review" ? "amber" : "sky"}>{order.status}</StatusBadge>
              </div>
              <OrderLinesTable lines={order.lines} />
            </div>
          ))}
        </section>

        <section className="glass-panel rounded-xl p-4">
          <h2 className="text-xl font-bold text-white mb-3">Operational Intent</h2>
          <pre className="bg-black/40 border border-white/10 rounded-lg p-4 text-xs text-slate-200 overflow-x-auto min-h-[20rem]">
            {JSON.stringify(intent ?? receiptIntent, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
};
