import React, { useEffect, useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import { useCreate } from "../../hooks/useCreate";

export const EventDispatcher = () => {
  const { mutate, isPending: isLoading } = useCreate();
  const { result: programsData } = useList({ resource: "programs" });
  const programs = useMemo(() => programsData?.data ?? [], [programsData?.data]);

  const [formData, setFormData] = useState({
    profileId: "",
    customerId: "CUST-12345",
    customerIdNamespace: "internal-crm",
    sourceSystem: "refine-admin-ui",
    eventType: "system-update",
    recordClass: "",
    legalBasis: "",
    purpose: "",
    payloadString: '{"message": "Hello from the Admin console"}',
  });
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const program = useMemo(
    () => programs.find((p: any) => p.profileId === formData.profileId),
    [programs, formData.profileId]
  );
  // The Smithy refuses a deposit whose basis/purpose are not the ones the profile
  // binds to the record class, so drive both from the program's published bindings.
  const bindings = useMemo(() => program?.recordClassBindings ?? [], [program?.recordClassBindings]);
  const binding = useMemo(
    () => bindings.find((b: any) => b.id === formData.recordClass),
    [bindings, formData.recordClass]
  );

  useEffect(() => {
    if (!formData.profileId && programs.length > 0) {
      setFormData((f) => ({ ...f, profileId: programs[0].profileId }));
    }
  }, [programs, formData.profileId]);

  // Select a record class for the chosen program, and follow its bindings.
  useEffect(() => {
    if (bindings.length === 0) return;
    setFormData((currentFormData) => {
      const current = bindings.find((b: any) => b.id === currentFormData.recordClass);
      const next = current ?? bindings[0];
      if (
        current &&
        currentFormData.legalBasis === next.legalBasis &&
        (next.purposes?.includes(currentFormData.purpose) || next.purposes?.length === 0)
      ) {
        return currentFormData;
      }
      return {
        ...currentFormData,
        recordClass: next.id,
        legalBasis: next.legalBasis,
        purpose: next.purposes?.[0] ?? "",
      };
    });
  }, [bindings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(formData.payloadString);
    } catch (parseError: any) {
      setError(`Payload must be valid JSON: ${parseError.message}`);
      return;
    }

    mutate(
      {
        resource: "source-events",
        values: {
          profileId: formData.profileId,
          sourceSystem: formData.sourceSystem,
          eventType: formData.eventType,
          sourceEventId: "MANUAL-" + Date.now(),
          customerIdNamespace: formData.customerIdNamespace,
          customerId: formData.customerId,
          recordClass: formData.recordClass,
          legalBasis: formData.legalBasis,
          purpose: formData.purpose,
          payload: parsedPayload,
        },
      },
      {
        onSuccess: (data) => setResult(data.data),
        onError: (err: any) => setError(err?.message ?? "Dispatch failed."),
      }
    );
  };

  const status = result?.status;
  const reason = result?.reconciliation?.reason;
  const ok = status === "reconciled";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Event Dispatcher</h1>
      <p className="text-slate-400 mb-8">Inject institutional source-events into a Databox stream.</p>

      <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-xl shadow-lg flex flex-col gap-4">
        {programs.length === 0 && (
          <div className="text-sm text-amber-400/90 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            No programs registered yet — use “Onboard Organization” first.
          </div>
        )}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm text-slate-400 mb-1">Program</label>
            <select
              className="w-full glass-input p-3 rounded-lg"
              value={formData.profileId}
              onChange={(e) => setFormData({ ...formData, profileId: e.target.value, recordClass: "" })}
              required
            >
              {programs.map((p: any) => (
                <option key={p.profileId} value={p.profileId} className="bg-slate-900">
                  {p.principalLegalName ? `${p.principalLegalName} — ${p.profileId}` : p.profileId}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm text-slate-400 mb-1">Record Class</label>
            <select
              className="w-full glass-input p-3 rounded-lg"
              value={formData.recordClass}
              onChange={(e) => setFormData({ ...formData, recordClass: e.target.value })}
              required
            >
              {bindings.map((b: any) => (
                <option key={b.id} value={b.id} className="bg-slate-900">
                  {b.id}
                </option>
              ))}
            </select>
            {binding?.label && <p className="text-xs text-slate-500 mt-1">{binding.label}</p>}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm text-slate-400 mb-1">Source System</label>
            <input
              className="w-full glass-input p-3 rounded-lg"
              value={formData.sourceSystem}
              onChange={(e) => setFormData({ ...formData, sourceSystem: e.target.value })}
              required
            />
            <p className="text-xs text-slate-500 mt-1">Must match the mapping's source system.</p>
          </div>
          <div className="flex-1">
            <label className="block text-sm text-slate-400 mb-1">Customer ID Namespace</label>
            <input
              className="w-full glass-input p-3 rounded-lg"
              value={formData.customerIdNamespace}
              onChange={(e) => setFormData({ ...formData, customerIdNamespace: e.target.value })}
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-slate-400 mb-1">Customer ID</label>
            <input
              className="w-full glass-input p-3 rounded-lg"
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm text-slate-400 mb-1">Event Type</label>
            <input
              className="w-full glass-input p-3 rounded-lg"
              value={formData.eventType}
              onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-slate-400 mb-1">Legal Basis</label>
            <input className="w-full glass-input p-3 rounded-lg" value={formData.legalBasis} readOnly />
            <p className="text-xs text-slate-500 mt-1">Bound to the record class by the profile.</p>
          </div>
          <div className="flex-1">
            <label className="block text-sm text-slate-400 mb-1">Purpose</label>
            <select
              className="w-full glass-input p-3 rounded-lg"
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              required
            >
              {(binding?.purposes ?? []).map((p: string) => (
                <option key={p} value={p} className="bg-slate-900">
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Payload (JSON)</label>
          <textarea
            className="w-full glass-input p-3 rounded-lg font-mono text-sm"
            rows={5}
            value={formData.payloadString}
            onChange={(e) => setFormData({ ...formData, payloadString: e.target.value })}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || programs.length === 0 || !formData.recordClass}
          className="action-btn mt-2 self-start"
        >
          {isLoading ? "Dispatching..." : "Dispatch Event"}
        </button>
      </form>

      {error && (
        <div className="mt-6 glass-panel p-6 rounded-xl border border-red-500/30">
          <h3 className="text-lg font-bold text-red-400 mb-2">Dispatch rejected</h3>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono">{error}</pre>
        </div>
      )}

      {result && (
        <div className={`mt-8 glass-panel p-6 rounded-xl ${ok ? "" : "border border-amber-500/30"}`}>
          <h3 className={`text-xl font-bold mb-4 ${ok ? "text-[#d4af37]" : "text-amber-400"}`}>
            {ok ? "Dispatch Receipt" : "Not Committed"}
          </h3>
          <p className="text-sm font-semibold text-slate-300">
            Reconciliation Status:
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ml-2 ${
                ok ? "bg-[#d4af37]/15 text-[#d4af37]" : "bg-amber-500/15 text-amber-400"
              }`}
            >
              {status ?? "unknown"}
            </span>
          </p>
          {/* A refusal is a 202 with a reason, not an HTTP error — surface it rather than an empty receipt box. */}
          {!ok && reason && (
            <p className="text-sm text-slate-400 mt-3">
              Reason: <span className="font-mono text-amber-300">{reason}</span>
            </p>
          )}
          {result.reconciliation?.acceptedResource && (
            <p className="text-xs text-slate-500 mt-3 break-all">
              Accepted resource: {result.reconciliation.acceptedResource}
            </p>
          )}
          {result.receipt?.jws && (
            <div className="bg-black/30 p-4 rounded-lg font-mono text-sm break-all max-h-40 overflow-y-auto mt-4 border border-white/10">
              {result.receipt.jws}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
