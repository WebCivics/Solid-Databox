import React, { useState } from "react";
import { useCreate } from "../../hooks/useCreate";

const today = () => new Date().toISOString().slice(0, 10);

const initialForm = {
  org: {
    name: "Acme Pty Ltd",
    abn: "12 345 678 901",
    address: "1 Example St",
    url: "https://example.org/",
  },
  receiptId: "R-100",
  date: today(),
  currency: "AUD",
  taxPercent: "10",
  digitalReceiptUrl: "https://pod.example.org/receipts/r-100",
  lines: [
    { name: "Widget", quantity: 2, unitPrice: 5 },
    { name: "Gadget", quantity: 1, unitPrice: 9.99 },
  ],
};

const statusClass = (status: string) =>
  status === "unavailable"
    ? "bg-amber-500/15 text-amber-200 border-amber-500/40"
    : "bg-green-500/15 text-green-300 border-green-500/40";

export const ReceiptsPage = () => {
  const { mutate, isPending } = useCreate();
  const [form, setForm] = useState(initialForm);
  const [receipt, setReceipt] = useState<any>(null);
  const [error, setError] = useState("");

  const update = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  const updateOrg = (key: string, value: string) =>
    setForm((current) => ({ ...current, org: { ...current.org, [key]: value }}));
  const updateLine = (index: number, key: string, value: unknown) =>
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, position) => position === index ? { ...line, [key]: value } : line),
    }));

  const addLine = () => {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, { name: "", quantity: 1, unitPrice: 0 }],
    }));
  };

  const removeLine = (index: number) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.filter((_, position) => position !== index),
    }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    mutate(
      {
        resource: "receipt-documents",
        values: {
          ...form,
          taxPercent: form.taxPercent === "" ? undefined : Number(form.taxPercent),
          lines: form.lines.map((line) => ({
            name: line.name,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
          })),
        },
      },
      {
        onSuccess: (data) => setReceipt(data.data),
        onError: (error) => {
          setReceipt(null);
          setError(error.message);
        },
      }
    );
  };

  const nativeJob = receipt?.nativeEdgePrintJob;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl">
      <h1 className="text-3xl font-bold mb-2">Receipts</h1>
      <p className="text-slate-400 mb-8 max-w-3xl">
        Generate a portable receipt document and native-edge print job descriptor.
      </p>

      <form onSubmit={submit} className="glass-panel p-6 rounded-xl shadow-lg grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Organisation name</label>
          <input
            className="w-full glass-input p-3 rounded-lg"
            value={form.org.name}
            onChange={(event) => updateOrg("name", event.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">ABN</label>
          <input
            className="w-full glass-input p-3 rounded-lg"
            value={form.org.abn}
            onChange={(event) => updateOrg("abn", event.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Receipt ID</label>
          <input
            className="w-full glass-input p-3 rounded-lg"
            value={form.receiptId}
            onChange={(event) => update("receiptId", event.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Date</label>
          <input
            type="date"
            className="w-full glass-input p-3 rounded-lg"
            value={form.date}
            onChange={(event) => update("date", event.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Currency</label>
          <input
            className="w-full glass-input p-3 rounded-lg"
            value={form.currency}
            onChange={(event) => update("currency", event.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Tax percent</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full glass-input p-3 rounded-lg"
            value={form.taxPercent}
            onChange={(event) => update("taxPercent", event.target.value)}
          />
        </div>
        <div className="lg:col-span-2">
          <label className="block text-sm text-slate-400 mb-1">Digital receipt URL</label>
          <input
            type="url"
            className="w-full glass-input p-3 rounded-lg"
            value={form.digitalReceiptUrl}
            onChange={(event) => update("digitalReceiptUrl", event.target.value)}
            required
          />
        </div>
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Line Items</h2>
            <button type="button" className="action-btn px-3 py-2 text-xs" onClick={addLine}>
              Add Line
            </button>
          </div>
          <div className="space-y-3">
            {form.lines.map((line, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_8rem_8rem_6rem] gap-3">
                <input
                  className="glass-input p-3 rounded-lg"
                  value={line.name}
                  placeholder="Item name"
                  onChange={(event) => updateLine(index, "name", event.target.value)}
                  required
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="glass-input p-3 rounded-lg"
                  value={line.quantity}
                  onChange={(event) => updateLine(index, "quantity", event.target.value)}
                  required
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="glass-input p-3 rounded-lg"
                  value={line.unitPrice}
                  onChange={(event) => updateLine(index, "unitPrice", event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="action-btn px-3 py-2 text-xs"
                  disabled={form.lines.length === 1}
                  onClick={() => removeLine(index)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 flex justify-end">
          <button type="submit" disabled={isPending} className="action-btn px-6 py-3">
            {isPending ? "Generating..." : "Generate Receipt"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 border border-amber-500/30 bg-amber-500/10 rounded-lg px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      {receipt && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-panel p-5 rounded-xl">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Receipt</p>
              <p className="font-mono text-[#d4af37] break-all">{receipt.receiptId}</p>
            </div>
            <div className="glass-panel p-5 rounded-xl">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Subtotal</p>
              <p className="font-mono text-slate-200">{receipt.currency} {receipt.subtotal}</p>
            </div>
            <div className="glass-panel p-5 rounded-xl">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Tax</p>
              <p className="font-mono text-slate-200">{receipt.tax ?? "0.00"}</p>
            </div>
            <div className="glass-panel p-5 rounded-xl">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Total</p>
              <p className="font-mono text-white">{receipt.currency} {receipt.total}</p>
            </div>
          </div>

          <div className="glass-panel rounded-xl shadow-lg border border-white/10 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-white">Native Edge Boundary</h2>
              {nativeJob && (
                <span className={`px-2 py-1 rounded text-xs font-semibold border ${statusClass(nativeJob.status)}`}>
                  {nativeJob.status}
                </span>
              )}
            </div>
            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">QR payload</p>
                <p className="font-mono text-sm text-sky-300 break-all">{receipt.qr.payload}</p>
                <p className="mt-2 text-sm text-slate-400">{receipt.qr.caption}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Printer action</p>
                <p className="text-sm text-amber-100">{nativeJob?.unavailableReason}</p>
                <button type="button" disabled className="action-btn mt-4 px-4 py-2 text-sm">
                  Native Print Unavailable
                </button>
              </div>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-xl">
            <h2 className="text-xl font-bold text-white mb-3">Declarative Print Job</h2>
            <pre className="bg-black/40 border border-white/10 rounded-lg p-4 text-xs text-slate-200 overflow-x-auto">
              {JSON.stringify(nativeJob, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
