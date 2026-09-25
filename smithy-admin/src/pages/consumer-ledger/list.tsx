import { useList, useNavigation } from "@refinedev/core";

export const ConsumerLedgerList = () => {
  const { result, query } = useList({ resource: "consumer-ledger" });
  const { isLoading } = query;
  const { show } = useNavigation();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-3xl font-bold mb-2">Consumer Data Ledger</h1>
      <p className="text-slate-400 mb-8">Comprehensive inventory of consumer data held by the organization, mapped to collection sources and ODRL policies.</p>

      {isLoading ? (
        <div className="text-slate-400">Loading ledger...</div>
      ) : (
        <div className="glass-panel overflow-hidden rounded-xl shadow-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-slate-300">
              <tr>
                <th className="p-4 font-semibold">Consumer URN</th>
                <th className="p-4 font-semibold">Name / Reference</th>
                <th className="p-4 font-semibold">Total Data Points</th>
                <th className="p-4 font-semibold">Last Active</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {result?.data.map((record) => (
                <tr key={record.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-4 font-mono text-xs text-slate-400">{record.id}</td>
                  <td className="p-4 font-semibold text-white">{record.consumerName}</td>
                  <td className="p-4">
                    <span className="bg-[#d4af37]/20 text-[#d4af37] px-2 py-1 rounded-full text-xs font-bold border border-[#d4af37]/30">
                      {record.dataPoints?.length || 0} Points
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 text-xs">
                    {new Date(record.lastActive).toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => show("consumer-ledger", record.id ?? "")}
                      className="text-[#d4af37] hover:text-white transition-colors text-sm font-semibold opacity-0 group-hover:opacity-100"
                    >
                      View Inventory →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!result?.data || result.data.length === 0) && (
            <div className="p-8 text-center text-slate-500">No consumers found in ledger.</div>
          )}
        </div>
      )}
    </div>
  );
};
