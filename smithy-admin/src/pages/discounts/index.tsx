import { useState } from "react";

interface DiscountLineItem {
  productId: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
}

interface DiscountLineResult {
  productId: string;
  name: string;
  originalLineTotal: number;
  discountAmount: number;
  finalLineTotal: number;
}

interface DiscountApplicationResult {
  code: string;
  type: string;
  valid: boolean;
  reason?: string;
  discountAmount: number;
  lines: DiscountLineResult[];
  totalOriginal: number;
  totalDiscount: number;
  totalFinal: number;
}

export const DiscountsPage = () => {
  const [code, setCode] = useState("SAVE10");
  const [discountType, setDiscountType] = useState("percentage");
  const [value, setValue] = useState(10);
  const [minSpend, setMinSpend] = useState(0);
  const [maxDiscount, setMaxDiscount] = useState(0);
  const [usageLimit, setUsageLimit] = useState(0);
  const [validFrom, setValidFrom] = useState("2025-01-01");
  const [validUntil, setValidUntil] = useState("2027-12-31");
  const [lines, setLines] = useState<DiscountLineItem[]>([
    { productId: "p1", name: "Item", category: "food", quantity: 1, unitPrice: 100 },
  ]);
  const [result, setResult] = useState<DiscountApplicationResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ipmsUrl = import.meta.env.VITE_CMS_URL || "http://localhost:3000/.databox/ipms";
  const ipmsToken = import.meta.env.VITE_CMS_TOKEN || "dev-control-token-at-least-32-bytes-long";

  const addLine = () => setLines([...lines, { productId: "", name: "", category: "", quantity: 1, unitPrice: 0 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof DiscountLineItem, value: string | number) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: field === "quantity" || field === "unitPrice" ? Number(value) : value };
    setLines(updated);
  };

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  const apply = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const discount = {
        id: "d1",
        code,
        type: discountType,
        value,
        minSpend: minSpend > 0 ? minSpend : undefined,
        maxDiscount: maxDiscount > 0 ? maxDiscount : undefined,
        usageLimit: usageLimit > 0 ? usageLimit : undefined,
        usageCount: 0,
        validFrom,
        validUntil,
        stackable: false,
      };
      const res = await fetch(`${ipmsUrl}/discounts/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ipmsToken}` },
        body: JSON.stringify({ discount, application: { code, lineItems: lines, subtotal } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply discount");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Discounts & Promotions</h1>
      <p className="text-slate-400 mb-8">Apply discount codes to line items with validation for expiry, usage limits, and category restrictions.</p>

      <div className="glass-panel rounded-xl p-6 mb-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">Discount Code</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Code</span>
            <input className="form-input mt-1" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Type</span>
            <select className="form-input mt-1" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
              <option value="quantity">Quantity (bulk)</option>
              <option value="bundle">Bundle</option>
            </select>
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Value</span>
            <input className="form-input mt-1" type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Min Spend (0=none)</span>
            <input className="form-input mt-1" type="number" value={minSpend} onChange={(e) => setMinSpend(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Max Discount (0=none)</span>
            <input className="form-input mt-1" type="number" value={maxDiscount} onChange={(e) => setMaxDiscount(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Usage Limit (0=unlimited)</span>
            <input className="form-input mt-1" type="number" value={usageLimit} onChange={(e) => setUsageLimit(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Valid From</span>
            <input className="form-input mt-1" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Valid Until</span>
            <input className="form-input mt-1" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </label>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-white">Line Items</h3>
            <button onClick={addLine} className="action-btn px-3 py-1.5 text-xs">+ Add Line</button>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
              <input className="form-input col-span-2" placeholder="Product ID" value={line.productId} onChange={(e) => updateLine(i, "productId", e.target.value)} />
              <input className="form-input col-span-3" placeholder="Name" value={line.name} onChange={(e) => updateLine(i, "name", e.target.value)} />
              <input className="form-input col-span-2" placeholder="Category" value={line.category} onChange={(e) => updateLine(i, "category", e.target.value)} />
              <input className="form-input col-span-1" type="number" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} />
              <input className="form-input col-span-2" type="number" placeholder="Price" value={line.unitPrice} onChange={(e) => updateLine(i, "unitPrice", e.target.value)} />
              <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-300 col-span-2 text-xs">Remove</button>
            </div>
          ))}
          <p className="text-slate-400 text-sm mt-2">Subtotal: <span className="text-white font-semibold">{subtotal.toFixed(2)}</span></p>
        </div>

        <button onClick={apply} disabled={loading} className="action-btn px-6 py-2.5">
          {loading ? "Applying..." : "Apply Discount"}
        </button>
      </div>

      {error && <div className="text-red-400 mb-4">{error}</div>}

      {result && (
        <div className="glass-panel rounded-xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold text-white">Result</h3>
            {result.valid ? (
              <span className="bg-green-500/20 text-green-300 border border-green-500/50 px-2 py-1 rounded text-xs font-semibold">Valid</span>
            ) : (
              <span className="bg-red-500/20 text-red-300 border border-red-500/50 px-2 py-1 rounded text-xs font-semibold">Invalid: {result.reason}</span>
            )}
          </div>
          {result.valid && (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-slate-400 text-xs">Total Original</p>
                  <p className="text-2xl font-bold text-white">{result.totalOriginal.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-400 text-xs">Total Discount</p>
                  <p className="text-2xl font-bold text-[#d4af37]">{result.totalDiscount.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-400 text-xs">Total Final</p>
                  <p className="text-2xl font-bold text-white">{result.totalFinal.toFixed(2)}</p>
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3">Original</th>
                    <th className="p-3">Discount</th>
                    <th className="p-3">Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {result.lines.map((l, i) => (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="p-3 font-mono text-xs">{l.productId}</td>
                      <td className="p-3">{l.originalLineTotal.toFixed(2)}</td>
                      <td className="p-3 text-[#d4af37]">{l.discountAmount.toFixed(2)}</td>
                      <td className="p-3">{l.finalLineTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
};
