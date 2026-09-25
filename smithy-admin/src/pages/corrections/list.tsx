import { useList, useNavigation } from "@refinedev/core";

export const CorrectionsList = () => {
  const { result, query } = useList({ resource: "corrections" });
  const { isLoading } = query;
  const { show } = useNavigation();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 px-2 py-1 rounded text-xs font-semibold">Pending</span>;
      case "corrected":
        return <span className="bg-green-500/20 text-green-300 border border-green-500/50 px-2 py-1 rounded text-xs font-semibold">Corrected</span>;
      case "statement-associated":
        return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/50 px-2 py-1 rounded text-xs font-semibold">Statement Associated</span>;
      case "no-change":
        return <span className="bg-red-500/20 text-red-300 border border-red-500/50 px-2 py-1 rounded text-xs font-semibold">No Change</span>;
      case "more-information-required":
        return <span className="bg-orange-500/20 text-orange-300 border border-orange-500/50 px-2 py-1 rounded text-xs font-semibold">Need More Info</span>;
      default:
        return <span className="bg-slate-500/20 text-slate-300 border border-slate-500/50 px-2 py-1 rounded text-xs font-semibold">{status}</span>;
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-3xl font-bold mb-2">Correction Requests</h1>
      <p className="text-slate-400 mb-8">Manage governed consumer data correction requests (ADR-0023).</p>

      {isLoading ? (
        <div className="text-slate-400">Loading requests...</div>
      ) : (
        <div className="glass-panel overflow-hidden rounded-xl shadow-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-slate-300">
              <tr>
                <th className="p-4 font-semibold">ID</th>
                <th className="p-4 font-semibold">Target Record</th>
                <th className="p-4 font-semibold">Requested Field</th>
                <th className="p-4 font-semibold">Due Date</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {result?.data.map((record) => (
                <tr key={record.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-4 font-mono text-xs text-slate-400">{record.id}</td>
                  <td className="p-4">
                    <div className="truncate max-w-[200px] text-white" title={record.targetRecord}>
                      {record.targetRecord}
                    </div>
                  </td>
                  <td className="p-4 text-slate-300 font-mono text-xs">{record.field}</td>
                  <td className="p-4 text-slate-400">
                    {new Date(record.dueDate).toLocaleDateString()}
                  </td>
                  <td className="p-4">{getStatusBadge(record.status)}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => show("corrections", record.id ?? "")}
                      className="text-[#d4af37] hover:text-white transition-colors text-sm font-semibold opacity-0 group-hover:opacity-100"
                    >
                      Adjudicate →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!result?.data || result.data.length === 0) && (
            <div className="p-8 text-center text-slate-500">No correction requests found.</div>
          )}
        </div>
      )}
    </div>
  );
};
