import React from "react";
import { lineTotal, money } from "./operations";

export const StatusBadge = ({ tone = "slate", children }: { tone?: string; children: React.ReactNode }) => {
  const tones: Record<string, string> = {
    green: "bg-green-500/15 text-green-300 border-green-500/40",
    amber: "bg-amber-500/15 text-amber-200 border-amber-500/40",
    sky: "bg-sky-500/15 text-sky-200 border-sky-500/40",
    violet: "bg-violet-500/15 text-violet-200 border-violet-500/40",
    slate: "bg-slate-500/15 text-slate-300 border-slate-500/40",
    red: "bg-red-500/15 text-red-200 border-red-500/40",
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold border ${tones[tone] ?? tones.slate}`}>
      {children}
    </span>
  );
};

export const CapabilityStrip = ({ snapshot }: { snapshot: any }) => {
  const portable = snapshot.capabilityMode === "portable-core" || snapshot.controlPlaneAvailable === false;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-3 mb-5">
      <div className={`rounded-lg border px-4 py-3 text-sm ${portable ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-sky-500/25 bg-sky-500/10 text-sky-100"}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">{portable ? "Standard-Solid portable mode" : "CSS-enhanced IPMS mode"}</span>
          <StatusBadge tone={portable ? "amber" : "sky"}>{snapshot.capabilityMode}</StatusBadge>
        </div>
        <p className="mt-2 text-xs opacity-85">{snapshot.degradationReason}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {(snapshot.solidSurfaces ?? []).slice(0, 3).map((surface: string) => (
            <StatusBadge key={surface} tone="green">{surface}</StatusBadge>
          ))}
          <StatusBadge tone={snapshot.nativeEdgeAvailable ? "green" : "amber"}>
            Native edge {snapshot.nativeEdgeAvailable ? "attached" : "unavailable"}
          </StatusBadge>
        </div>
      </div>
    </div>
  );
};

export const OrderLinesTable = ({ lines }: { lines: any[] }) => (
  <table className="w-full text-left text-sm">
    <thead className="bg-white/5 border-b border-white/10 text-slate-300">
      <tr>
        <th className="p-3 font-semibold">Item</th>
        <th className="p-3 font-semibold">Station</th>
        <th className="p-3 font-semibold text-right">Qty</th>
        <th className="p-3 font-semibold text-right">Total</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-white/5">
      {lines.map((line: any) => (
        <tr key={`${line.itemId}:${line.name}`} className="hover:bg-white/5">
          <td className="p-3 text-white">{line.name}</td>
          <td className="p-3"><StatusBadge tone={line.station === "kitchen" ? "violet" : "sky"}>{line.station}</StatusBadge></td>
          <td className="p-3 text-right font-mono text-slate-300">{line.quantity}</td>
          <td className="p-3 text-right font-mono text-slate-200">{money(lineTotal(line))}</td>
        </tr>
      ))}
    </tbody>
  </table>
);
