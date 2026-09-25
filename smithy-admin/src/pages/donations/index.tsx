import { useState } from "react";

interface DonationResult {
  donationId: string;
  campaignId: string;
  donorId: string;
  amount: number;
  currency: string;
  frequency: string;
  anonymous: boolean;
  newRaisedTotal: number;
  progressPercent: number;
}

export const DonationsPage = () => {
  const [campaignId, setCampaignId] = useState("camp-001");
  const [campaignName, setCampaignName] = useState("Building Fund");
  const [targetAmount, setTargetAmount] = useState(10000);
  const [raisedAmount, setRaisedAmount] = useState(3000);
  const [currency, setCurrency] = useState("AUD");
  const [deadline, setDeadline] = useState("2027-12-31");
  const [donorId, setDonorId] = useState("donor-001");
  const [amount, setAmount] = useState(500);
  const [frequency, setFrequency] = useState("one-off");
  const [anonymous, setAnonymous] = useState(false);
  const [dedication, setDedication] = useState("");
  const [result, setResult] = useState<DonationResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ipmsUrl = import.meta.env.VITE_CMS_URL || "http://localhost:3000/.databox/ipms";
  const ipmsToken = import.meta.env.VITE_CMS_TOKEN || "dev-control-token-at-least-32-bytes-long";

  const donate = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const campaign = {
        id: campaignId,
        name: campaignName,
        description: "",
        targetAmount,
        raisedAmount,
        currency,
        deadline,
        active: true,
      };
      const donation = {
        campaignId,
        donorId,
        amount,
        currency,
        frequency,
        anonymous,
        dedication: dedication || undefined,
      };
      const res = await fetch(`${ipmsUrl}/donations/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ipmsToken}` },
        body: JSON.stringify({ campaign, donation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process donation");
      setResult(data);
      setRaisedAmount(data.newRaisedTotal);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = targetAmount > 0 ? Math.min(100, Math.round((raisedAmount / targetAmount) * 100)) : 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Donations & Fundraising</h1>
      <p className="text-slate-400 mb-8">Process donations against campaigns, track progress, and generate receipts.</p>

      <div className="glass-panel rounded-xl p-6 mb-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">Campaign</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Campaign ID</span>
            <input className="form-input mt-1" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Campaign Name</span>
            <input className="form-input mt-1" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Currency</span>
            <input className="form-input mt-1" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} />
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Target Amount</span>
            <input className="form-input mt-1" type="number" value={targetAmount} onChange={(e) => setTargetAmount(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Raised Amount</span>
            <input className="form-input mt-1" type="number" value={raisedAmount} onChange={(e) => setRaisedAmount(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Deadline</span>
            <input className="form-input mt-1" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400">Progress</span>
            <span className="text-white font-semibold">{raisedAmount.toFixed(2)} / {targetAmount.toFixed(2)} {currency} ({progressPercent}%)</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3">
            <div className="bg-[#d4af37] h-3 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <h3 className="text-lg font-semibold text-white mb-4 mt-6">Donation</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Donor ID</span>
            <input className="form-input mt-1" value={donorId} onChange={(e) => setDonorId(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Amount</span>
            <input className="form-input mt-1" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Frequency</span>
            <select className="form-input mt-1" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="one-off">One-off</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>
          </label>
          <label className="block col-span-2">
            <span className="text-slate-300 text-sm font-semibold">Dedication (optional)</span>
            <input className="form-input mt-1" value={dedication} onChange={(e) => setDedication(e.target.value)} placeholder="In memory of..." />
          </label>
          <label className="flex items-center gap-2 mt-6">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            <span className="text-slate-300 text-sm">Anonymous donation</span>
          </label>
        </div>

        <button onClick={donate} disabled={loading} className="action-btn px-6 py-2.5">
          {loading ? "Processing..." : "Process Donation"}
        </button>
      </div>

      {error && <div className="text-red-400 mb-4">{error}</div>}

      {result && (
        <div className="glass-panel rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Donation Processed</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-slate-400 text-xs">Donation ID</p>
              <p className="font-mono text-sm text-white">{result.donationId}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Amount</p>
              <p className="text-xl font-bold text-[#d4af37]">{result.amount.toFixed(2)} {result.currency}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">New Raised Total</p>
              <p className="text-lg font-bold text-white">{result.newRaisedTotal.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Progress</p>
              <p className="text-lg font-bold text-white">{result.progressPercent}%</p>
            </div>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 mb-2">
            <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${result.progressPercent}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};
