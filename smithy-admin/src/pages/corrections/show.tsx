import { useState, useEffect } from "react";
import { useShow, useNavigation } from "@refinedev/core";
import { useUpdate } from "../../hooks/useUpdate";

export const CorrectionShow = () => {
  const { result: record, query } = useShow({ resource: "corrections" });
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
      resource: "corrections",
      id: record.id,
      values: {
        status: disposition,
        dispositionReason: reason,
      },
    }, {
      onSuccess: () => {
        list("corrections");
      }
    });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => list("corrections")} className="text-slate-400 hover:text-white">
          ← Back to Queue
        </button>
        <h1 className="text-3xl font-bold">Adjudicate Request</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Consumer Request Details */}
        <div className="flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-xl border border-white/10 shadow-lg">
            <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Consumer Submission</h2>
            
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
                <p className="text-xs text-[#d4af37] uppercase tracking-wider mb-1 font-semibold">Target Record</p>
                <a href={record.targetRecord} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline break-all">
                  {record.targetRecord}
                </a>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-xl border border-white/10 shadow-lg">
            <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Requested Correction</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Target Field</p>
                <p className="font-mono text-sm text-slate-300">{record.field}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                  <p className="text-xs text-red-400/80 uppercase tracking-wider mb-1">Current Value</p>
                  <p className="text-sm text-red-200 line-through">{record.currentValue}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
                  <p className="text-xs text-green-400/80 uppercase tracking-wider mb-1">Requested Value</p>
                  <p className="text-sm text-green-200">{record.requestedCorrection}</p>
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
              Record Disposition
            </h2>
            <p className="text-sm text-slate-400 mb-6">Pursuant to ADR-0023, select the formal disposition for this correction request. This will emit a signed acknowledgement and optionally open a governed correction case on the source record.</p>
            
            <div className="space-y-4 mb-6">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/10 cursor-pointer hover:bg-green-500/20 transition-colors">
                <input type="radio" name="disposition" value="corrected" checked={disposition === "corrected"} onChange={(e) => setDisposition(e.target.value)} className="mt-1" />
                <div>
                  <p className="text-white font-medium text-sm">Corrected (Supersession)</p>
                  <p className="text-xs text-slate-400">Accept the correction. The source record will be superseded by the new value.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 cursor-pointer hover:bg-blue-500/20 transition-colors">
                <input type="radio" name="disposition" value="statement-associated" checked={disposition === "statement-associated"} onChange={(e) => setDisposition(e.target.value)} className="mt-1" />
                <div>
                  <p className="text-white font-medium text-sm">Statement Associated</p>
                  <p className="text-xs text-slate-400">Do not alter the source record, but durably link the consumer's statement of dispute.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10 cursor-pointer hover:bg-red-500/20 transition-colors">
                <input type="radio" name="disposition" value="no-change" checked={disposition === "no-change"} onChange={(e) => setDisposition(e.target.value)} className="mt-1" />
                <div>
                  <p className="text-white font-medium text-sm">No Change (Refused)</p>
                  <p className="text-xs text-slate-400">Refuse the correction. A formal reason and appeal route will be provided to the consumer.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-orange-500/30 bg-orange-500/10 cursor-pointer hover:bg-orange-500/20 transition-colors">
                <input type="radio" name="disposition" value="more-information-required" checked={disposition === "more-information-required"} onChange={(e) => setDisposition(e.target.value)} className="mt-1" />
                <div>
                  <p className="text-white font-medium text-sm">More Information Required</p>
                  <p className="text-xs text-slate-400">Pause the compliance clock until the consumer provides necessary evidence.</p>
                </div>
              </label>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-slate-300 mb-2">Disposition Reason / Notes</label>
              <textarea 
                className="w-full glass-input p-3 rounded-lg min-h-[100px] text-sm" 
                placeholder="Provide formal reasoning or request for evidence..."
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
