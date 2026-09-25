import React, { useEffect, useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import { useCreate } from "../../hooks/useCreate";

/**
 * Generate an ephemeral holder keypair. The Smithy binds the connection credential
 * to an EC P-256 public key (ES256) and thumbprints `{crv, kty, x, y}` per RFC 7638,
 * so only those members are sent.
 */
async function generateHolderJwk() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y };
}

export const MappingsSimulator = () => {
  const { mutate, isPending: isLoading } = useCreate();
  const { result: programsData } = useList({ resource: "programs" });
  const programs = useMemo(() => programsData?.data ?? [], [programsData?.data]);

  const [formData, setFormData] = useState({
    profileId: "",
    customerIdNamespace: "internal-crm",
    customerId: "CUST-12345",
    pairwiseWebId: "https://consumer-pod.example/profile/card#test",
  });
  const [holderJwk, setHolderJwk] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Default to the first registered program rather than a placeholder the Smithy would reject.
  useEffect(() => {
    if (!formData.profileId && programs.length > 0) {
      setFormData((f) => ({ ...f, profileId: programs[0].profileId }));
    }
  }, [programs, formData.profileId]);

  useEffect(() => {
    generateHolderJwk().then(setHolderJwk).catch((e) => setError(`Key generation failed: ${e.message}`));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!holderJwk) {
      setError("Holder key is still being generated.");
      return;
    }
    mutate(
      {
        resource: "mappings",
        values: { ...formData, sourceSystem: "refine-admin-ui", holderPublicJwk: holderJwk },
      },
      {
        onSuccess: (data) => setResult(data.data),
        onError: (err: any) => setError(err?.message ?? "Mapping failed."),
      }
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Provisioning Simulator</h1>
      <p className="text-slate-400 mb-8">Manually provision a customer relationship mapping via the Smithy API.</p>

      <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-xl shadow-lg flex flex-col gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Program</label>
          {programs.length === 0 ? (
            <div className="text-sm text-amber-400/90 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              No programs registered yet — use “Onboard Organization” first.
            </div>
          ) : (
            <select
              className="w-full glass-input p-3 rounded-lg"
              value={formData.profileId}
              onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
              required
            >
              {programs.map((p: any) => (
                <option key={p.profileId} value={p.profileId} className="bg-slate-900">
                  {p.principalLegalName ? `${p.principalLegalName} — ${p.profileId}` : p.profileId}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Customer ID Namespace</label>
          <input
            className="w-full glass-input p-3 rounded-lg"
            value={formData.customerIdNamespace}
            onChange={(e) => setFormData({ ...formData, customerIdNamespace: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Synthetic Customer ID</label>
          <input
            className="w-full glass-input p-3 rounded-lg"
            value={formData.customerId}
            onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
            required
          />
          <p className="text-xs text-slate-500 mt-1">Never leaves the bridge: the Smithy maps it to an opaque identifier.</p>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Consumer Pairwise WebID</label>
          <input
            className="w-full glass-input p-3 rounded-lg"
            value={formData.pairwiseWebId}
            onChange={(e) => setFormData({ ...formData, pairwiseWebId: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Holder Public Key (EC P-256)</label>
          <div className="bg-black/30 p-3 rounded-lg font-mono text-xs break-all border border-white/10 text-slate-300">
            {holderJwk ? JSON.stringify(holderJwk) : "Generating…"}
          </div>
          <button
            type="button"
            onClick={() => generateHolderJwk().then(setHolderJwk)}
            className="text-xs text-[#d4af37] hover:underline mt-1"
          >
            Regenerate key
          </button>
          <p className="text-xs text-slate-500 mt-1">
            Ephemeral, generated in this browser. The credential is bound to this key.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading || programs.length === 0 || !holderJwk}
          className="action-btn mt-2 self-start"
        >
          {isLoading ? "Provisioning..." : "Provision Mapping"}
        </button>
      </form>

      {error && (
        <div className="mt-6 glass-panel p-6 rounded-xl border border-red-500/30">
          <h3 className="text-lg font-bold text-red-400 mb-2">Provisioning rejected</h3>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono">{error}</pre>
        </div>
      )}

      {result?.credential?.jws && (
        <div className="mt-8 glass-panel p-6 rounded-xl">
          <h3 className="text-xl font-bold text-[#d4af37] mb-4">Connection Output</h3>
          {result.credential.connectionId && (
            <>
              <p className="text-sm font-semibold text-slate-300">Connection ID:</p>
              <div className="bg-black/30 p-3 rounded-lg font-mono text-xs break-all mb-4 border border-white/10">
                {result.credential.connectionId}
              </div>
            </>
          )}
          <p className="text-sm font-semibold text-slate-300">Connection credential (JWS):</p>
          <div className="bg-black/30 p-4 rounded-lg font-mono text-sm break-all max-h-40 overflow-y-auto mb-4 border border-white/10">
            {result.credential.jws}
          </div>
          {result.credential.holderThumbprint && (
            <p className="text-xs text-slate-500">Holder thumbprint: {result.credential.holderThumbprint}</p>
          )}
        </div>
      )}
    </div>
  );
};
