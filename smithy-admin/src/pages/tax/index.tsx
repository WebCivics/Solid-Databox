import { useState } from "react";

interface TaxLineItem {
  productId: string;
  category: string;
  amount: number;
  taxRate: number;
}

interface TaxLineResult {
  productId: string;
  category: string;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  taxRate: number;
  exempt: boolean;
}

interface TaxComputationResult {
  jurisdictionCode: string;
  taxInclusive: boolean;
  lines: TaxLineResult[];
  totalNet: number;
  totalTax: number;
  totalGross: number;
  exemptionApplied: boolean;
}

export const TaxPage = () => {
  const [jurisdictionCode, setJurisdictionCode] = useState("AU-GST");
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [exemptionId, setExemptionId] = useState("");
  const [lines, setLines] = useState<TaxLineItem[]>([
    { productId: "p1", category: "food", amount: 100, taxRate: 0.1 },
  ]);
  const [result, setResult] = useState<TaxComputationResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ipmsUrl = import.meta.env.VITE_CMS_URL || "http://localhost:3000/.databox/ipms";
  const ipmsToken = import.meta.env.VITE_CMS_TOKEN || "dev-control-token-at-least-32-bytes-long";

  const addLine = () => setLines([...lines, { productId: "", category: "", amount: 0, taxRate: 0.1 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof TaxLineItem, value: string | number) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: field === "amount" || field === "taxRate" ? Number(value) : value };
    setLines(updated);
  };

  const compute = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${ipmsUrl}/tax/compute`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ipmsToken}` },
        body: JSON.stringify({ jurisdictionCode, taxInclusive, exemptionId: exemptionId || undefined, lineItems: lines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to compute tax");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Tax Management</h1>
      <p className="text-slate-400 mb-8">Compute tax for line items with jurisdiction-aware rates and exemption support.</p>

      <div className="glass-panel rounded-xl p-6 mb-6 border border-white/10">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Jurisdiction Code</span>
            <input className="form-input mt-1" value={jurisdictionCode} onChange={(e) => setJurisdictionCode(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Tax Inclusive</span>
            <select className="form-input mt-1" value={String(taxInclusive)} onChange={(e) => setTaxInclusive(e.target.value === "true")}>
              <option value="false">Exclusive (add tax)</option>
              <option value="true">Inclusive (extract tax)</option>
            </select>
          </label>
          <label className="block col-span-2">
            <span className="text-slate-300 text-sm font-semibold">Exemption ID (optional)</span>
            <input className="form-input mt-1" value={exemptionId} onChange={(e) => setExemptionId(e.target.value)} placeholder="e.g. charity-exempt-001" />
          </label>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-white">Line Items</h3>
            <button onClick={addLine} className="action-btn px-3 py-1.5 text-xs">+ Add Line</button>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
              <input className="form-input col-span-3" placeholder="Product ID" value={line.productId} onChange={(e) => updateLine(i, "productId", e.target.value)} />
              <input className="form-input col-span-3" placeholder="Category" value={line.category} onChange={(e) => updateLine(i, "category", e.target.value)} />
              <input className="form-input col-span-2" type="number" placeholder="Amount" value={line.amount} onChange={(e) => updateLine(i, "amount", e.target.value)} />
              <input className="form-input col-span-2" type="number" step="0.01" placeholder="Rate" value={line.taxRate} onChange={(e) => updateLine(i, "taxRate", e.target.value)} />
              <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-300 col-span-2 text-xs">Remove</button>
            </div>
          ))}
        </div>

        <button onClick={compute} disabled={loading} className="action-btn px-6 py-2.5">
          {loading ? "Computing..." : "Compute Tax"}
        </button>
      </div>

      {error && <div className="text-red-400 mb-4">{error}</div>}

      {result && (
        <div className="glass-panel rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Results</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-slate-400 text-xs">Total Net</p>
              <p className="text-2xl font-bold text-white">{result.totalNet.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-xs">Total Tax</p>
              <p className="text-2xl font-bold text-[#d4af37]">{result.totalTax.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-xs">Total Gross</p>
              <p className="text-2xl font-bold text-white">{result.totalGross.toFixed(2)}</p>
            </div>
          </div>
          {result.exemptionApplied && (
            <p className="text-green-400 text-sm mb-2">Tax exemption applied — all lines exempted.</p>
          )}
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">Category</th>
                <th className="p-3">Net</th>
                <th className="p-3">Tax</th>
                <th className="p-3">Gross</th>
                <th className="p-3">Rate</th>
                <th className="p-3">Exempt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {result.lines.map((l, i) => (
                <tr key={i} className="hover:bg-white/5">
                  <td className="p-3 font-mono text-xs">{l.productId}</td>
                  <td className="p-3 text-slate-300">{l.category}</td>
                  <td className="p-3">{l.netAmount.toFixed(2)}</td>
                  <td className="p-3 text-[#d4af37]">{l.taxAmount.toFixed(2)}</td>
                  <td className="p-3">{l.grossAmount.toFixed(2)}</td>
                  <td className="p-3 text-slate-400">{(l.taxRate * 100).toFixed(1)}%</td>
                  <td className="p-3">{l.exempt ? <span className="text-green-400">Yes</span> : <span className="text-slate-500">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
