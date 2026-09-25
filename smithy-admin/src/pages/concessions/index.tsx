import { useState } from "react";

interface ConcessionLineItem {
  productId: string;
  name: string;
  originalPrice: number;
}

interface ConcessionLineResult {
  productId: string;
  name: string;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
}

interface ConcessionPricingResult {
  groupId: string;
  discountPercent: number;
  lines: ConcessionLineResult[];
  totalOriginal: number;
  totalDiscount: number;
  totalFinal: number;
}

export const ConcessionsPage = () => {
  const [groupId, setGroupId] = useState("pensioner");
  const [discountPercent, setDiscountPercent] = useState(20);
  const [lines, setLines] = useState<ConcessionLineItem[]>([
    { productId: "p1", name: "Meal", originalPrice: 50 },
  ]);
  const [result, setResult] = useState<ConcessionPricingResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ipmsUrl = import.meta.env.VITE_CMS_URL || "http://localhost:3000/.databox/ipms";
  const ipmsToken = import.meta.env.VITE_CMS_TOKEN || "dev-control-token-at-least-32-bytes-long";

  const addLine = () => setLines([...lines, { productId: "", name: "", originalPrice: 0 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof ConcessionLineItem, value: string | number) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: field === "originalPrice" ? Number(value) : value };
    setLines(updated);
  };

  const compute = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${ipmsUrl}/concessions/pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ipmsToken}` },
        body: JSON.stringify({ groupId, discountPercent, lineItems: lines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to compute concession pricing");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Concessions</h1>
      <p className="text-slate-400 mb-8">Apply concession pricing for eligible groups (pensioners, students, veterans, etc.).</p>

      <div className="glass-panel rounded-xl p-6 mb-6 border border-white/10">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Concession Group</span>
            <select className="form-input mt-1" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="pensioner">Pensioner</option>
              <option value="student">Student</option>
              <option value="veteran">Veteran</option>
              <option value="low-income">Low Income</option>
              <option value="member">Member</option>
            </select>
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Discount %</span>
            <input className="form-input mt-1" type="number" min="0" max="100" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} />
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
              <input className="form-input col-span-5" placeholder="Name" value={line.name} onChange={(e) => updateLine(i, "name", e.target.value)} />
              <input className="form-input col-span-2" type="number" placeholder="Price" value={line.originalPrice} onChange={(e) => updateLine(i, "originalPrice", e.target.value)} />
              <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-300 col-span-2 text-xs">Remove</button>
            </div>
          ))}
        </div>

        <button onClick={compute} disabled={loading} className="action-btn px-6 py-2.5">
          {loading ? "Computing..." : "Apply Concession"}
        </button>
      </div>

      {error && <div className="text-red-400 mb-4">{error}</div>}

      {result && (
        <div className="glass-panel rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Concession Pricing Result</h3>
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
                <th className="p-3">Name</th>
                <th className="p-3">Original</th>
                <th className="p-3">Discount</th>
                <th className="p-3">Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {result.lines.map((l, i) => (
                <tr key={i} className="hover:bg-white/5">
                  <td className="p-3 font-mono text-xs">{l.productId}</td>
                  <td className="p-3 text-slate-300">{l.name}</td>
                  <td className="p-3">{l.originalPrice.toFixed(2)}</td>
                  <td className="p-3 text-[#d4af37]">{l.discountAmount.toFixed(2)}</td>
                  <td className="p-3">{l.finalPrice.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
