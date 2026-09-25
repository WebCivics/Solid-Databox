import { useList, useNavigation } from "@refinedev/core";

export const AccessRequestsList = () => {
  const { result, query } = useList({ resource: "access-requests" });
  const { isLoading } = query;
  const { show } = useNavigation();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 px-2 py-1 rounded text-xs font-semibold">Pending</span>;
      case "granted":
        return <span className="bg-green-500/20 text-green-300 border border-green-500/50 px-2 py-1 rounded text-xs font-semibold">Granted</span>;
      case "refused":
        return <span className="bg-red-500/20 text-red-300 border border-red-500/50 px-2 py-1 rounded text-xs font-semibold">Refused</span>;
      default:
        return <span className="bg-slate-500/20 text-slate-300 border border-slate-500/50 px-2 py-1 rounded text-xs font-semibold">{status}</span>;
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-3xl font-bold mb-2">Subject Access Requests</h1>
      <p className="text-slate-400 mb-8">Manage governed consumer data portability and access requests (APP 12 / CDR).</p>

      {isLoading ? (
        <div className="text-slate-400">Loading requests...</div>
      ) : (
        <div className="glass-panel overflow-hidden rounded-xl shadow-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-slate-300">
              <tr>
                <th className="p-4 font-semibold">Request ID</th>
                <th className="p-4 font-semibold">Consumer URN</th>
                <th className="p-4 font-semibold">Requested Scope</th>
                <th className="p-4 font-semibold">Regulatory Basis</th>
                <th className="p-4 font-semibold">Due Date</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {result?.data.map((record) => (
                <tr key={record.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-4 font-mono text-xs text-slate-400">{record.id}</td>
                  <td className="p-4 font-mono text-xs text-slate-400">{record.consumerUrn}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {record.scope.map((s: string) => (
                        <span key={s} className="bg-white/10 px-2 py-1 rounded text-xs font-mono">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-slate-300 text-xs">{record.regulatoryBasis}</td>
                  <td className="p-4 text-slate-400 text-xs">
                    {new Date(record.dueDate).toLocaleDateString()}
                  </td>
                  <td className="p-4">{getStatusBadge(record.status)}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => show("access-requests", record.id ?? "")}
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
            <div className="p-8 text-center text-slate-500">No access requests found.</div>
          )}
        </div>
      )}
    </div>
  );
};
