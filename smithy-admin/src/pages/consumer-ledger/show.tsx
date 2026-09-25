import { useShow, useNavigation } from "@refinedev/core";

export const ConsumerLedgerShow = () => {
  const { result: record, query } = useShow({ resource: "consumer-ledger" });
  const { isLoading } = query;
  const { list } = useNavigation();

  if (isLoading) return <div className="p-8 text-slate-400">Loading ledger details...</div>;
  if (!record) return <div className="p-8 text-red-400">Ledger not found.</div>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => list("consumer-ledger")} className="text-slate-400 hover:text-white">
          ← Back to Ledger
        </button>
        <h1 className="text-3xl font-bold">Consumer Data Inventory</h1>
      </div>

      <div className="glass-panel p-8 rounded-xl border border-white/10 shadow-lg mb-8 bg-gradient-to-br from-white/5 to-transparent">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-[#d4af37]/20 border-2 border-[#d4af37]/50 flex items-center justify-center">
            <span className="text-[#d4af37] font-bold text-xl">{record.consumerName.charAt(0)}</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{record.consumerName}</h2>
            <p className="font-mono text-sm text-slate-400 mt-1">{record.id}</p>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Retained Data Points</h3>
      <p className="text-sm text-slate-400 mb-6">The following data points are currently held by the organization for this consumer, subject to the mapped ODRL policies.</p>

      <div className="grid grid-cols-1 gap-4">
        {record.dataPoints.map((dp: any, idx: number) => (
          <div key={idx} className="glass-panel p-5 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="font-mono text-sm text-[#d4af37] font-semibold">{dp.field}</p>
              <p className="text-lg text-white mt-1">{dp.value}</p>
            </div>
            
            <div className="flex flex-col md:items-end gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 uppercase tracking-wider text-xs">Source System</span>
                <span className="bg-white/10 px-2 py-0.5 rounded text-slate-300">{dp.source}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 uppercase tracking-wider text-xs">Policy Basis</span>
                <span className="bg-blue-500/10 border border-blue-500/20 text-blue-300 px-2 py-0.5 rounded">{dp.policy}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
