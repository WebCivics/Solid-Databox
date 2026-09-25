import { useList } from "@refinedev/core";

export const ProgramsList = () => {
  const { result, query } = useList({ resource: "programs" });
  const { isLoading, isError } = query;

  if (isLoading) return <div>Loading programs...</div>;
  if (isError) return <div className="text-red-500">Error fetching programs. Ensure CSS backend is running on port 3000.</div>;

  const programs = result?.data || [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-bold">Registered Programs</h1>
      </div>
      <p className="text-slate-400 mb-8">Manage organizations currently provisioned through the Databox Smithy.</p>

      {programs.length === 0 ? (
        <div className="text-slate-400 text-center p-8 glass-panel rounded-xl">
          No programs registered. Use the "Onboard Organization" tab to provision one.
        </div>
      ) : (
        <div className="glass-panel rounded-xl overflow-hidden shadow-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[#d4af37]">
                <th className="p-4 font-semibold border-b border-white/5">Organization</th>
                <th className="p-4 font-semibold border-b border-white/5">Program URI</th>
                <th className="p-4 font-semibold border-b border-white/5">Databox Route</th>
                <th className="p-4 font-semibold border-b border-white/5">Status</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p: any) => {
                const pName = p.principalLegalName || p.profile?.program?.principal?.legalName || p.profileId;
                return (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 border-b border-white/5">
                      <strong className="block">{pName}</strong>
                      {pName !== p.profileId && <span className="text-xs text-slate-400">{p.profileId}</span>}
                      {p.principalJurisdiction && (
                        <span className="text-xs text-slate-500 ml-2">{p.principalJurisdiction}</span>
                      )}
                    </td>
                    <td className="p-4 border-b border-white/5">
                      <a href={p.programUri} target="_blank" rel="noreferrer" className="text-[#d4af37] hover:underline">
                        {p.programUri}
                      </a>
                    </td>
                    <td className="p-4 border-b border-white/5 font-mono text-sm">{p.databoxBaseUrl}</td>
                    <td className="p-4 border-b border-white/5">
                      <span className="bg-[#d4af37]/15 text-[#d4af37] px-3 py-1 rounded-full text-xs font-bold">
                        Active
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
