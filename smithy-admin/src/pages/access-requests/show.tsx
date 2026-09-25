import { useState, useEffect } from "react";
import { useShow, useNavigation } from "@refinedev/core";
import { useUpdate } from "../../hooks/useUpdate";

export const AccessRequestShow = () => {
  const { result: record, query } = useShow({ resource: "access-requests" });
  const { isLoading } = query;
  const { mutate, isPending: isUpdating } = useUpdate();
  const { list } = useNavigation();

  const [disposition, setDisposition] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (record) {
      setDisposition(record.status);
      setReason(record.dispositionReason || "");
    }
  }, [record]);

  if (isLoading) return <div className="p-8 text-slate-400">Loading request details...</div>;
  if (!record) return <div className="p-8 text-red-400">Record not found.</div>;

  const handleUpdate = () => {
    mutate({
      resource: "access-requests",
      id: record.id,
      values: {
        status: disposition,
        dispositionReason: reason,
      },
    }, {
      onSuccess: () => {
        list("access-requests");
      }
    });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => list("access-requests")} className="text-slate-400 hover:text-white">
          ← Back to Queue
        </button>
        <h1 className="text-3xl font-bold">Adjudicate Access Request</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Consumer Request Details */}
        <div className="flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-xl border border-white/10 shadow-lg">
            <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Consumer Data Request</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Request ID</p>
                <p className="font-mono text-sm text-slate-300 bg-black/30 p-2 rounded">{record.id}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Consumer URN</p>
                <p className="font-mono text-sm text-slate-300 bg-black/30 p-2 rounded">{record.consumerUrn}</p>
              </div>
              <div>
                <p className="text-xs text-[#d4af37] uppercase tracking-wider mb-1 font-semibold">Regulatory Framework</p>
                <p className="text-sm text-white">{record.regulatoryBasis}</p>
              </div>
              <div>
                <p className="text-xs text-blue-400 uppercase tracking-wider mb-1 font-semibold">Requested Scope</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {record.scope.map((s: string) => (
                    <span key={s} className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded text-sm font-mono">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Governance Disposition */}
        <div className="flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-xl border border-[#d4af37]/30 shadow-lg bg-gradient-to-b from-[#d4af37]/5 to-transparent">
            <h2 className="text-xl font-bold text-white mb-2 border-b border-white/10 pb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Adjudicate Access
            </h2>
            <p className="text-sm text-slate-400 mb-6">Authorize or refuse the release of requested information to the consumer's Databox.</p>
            
            <div className="space-y-4 mb-6">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/10 cursor-pointer hover:bg-green-500/20 transition-colors">
                <input type="radio" name="disposition" value="granted" checked={disposition === "granted"} onChange={(e) => setDisposition(e.target.value)} className="mt-1" />
                <div>
                  <p className="text-white font-medium text-sm">Access Granted</p>
                  <p className="text-xs text-slate-400">Package the requested scope and deliver the payload to the consumer's agent.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10 cursor-pointer hover:bg-red-500/20 transition-colors">
                <input type="radio" name="disposition" value="refused" checked={disposition === "refused"} onChange={(e) => setDisposition(e.target.value)} className="mt-1" />
                <div>
                  <p className="text-white font-medium text-sm">Access Refused</p>
                  <p className="text-xs text-slate-400">Refuse access. A formal legal exception (e.g., APP 12.3) must be cited.</p>
                </div>
              </label>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-slate-300 mb-2">Disposition Reason / Notes</label>
              <textarea 
                className="w-full glass-input p-3 rounded-lg min-h-[100px] text-sm" 
                placeholder="Cite specific legal exceptions if refusing access..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <button 
                onClick={handleUpdate} 
                disabled={isUpdating || disposition === "pending"} 
                className="action-btn px-6 py-2"
              >
                {isUpdating ? "Committing..." : "Commit Disposition"}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
