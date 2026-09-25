import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

export const AgencyNode = ({ data, isConnectable }: NodeProps) => {
  return (
    <div className="glass-panel border-2 border-[#d4af37]/50 rounded-lg p-4 shadow-[0_0_15px_rgba(212,175,55,0.2)] min-w-[150px] text-center bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/90 backdrop-blur-md transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-[#d4af37] border-2 border-[#020617]"
      />
      <div className="flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-[#d4af37]/20 flex items-center justify-center border border-[#d4af37]/50">
          <svg className="w-5 h-5 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div className="font-bold text-[#d4af37] tracking-wider text-sm uppercase">{data.label as string}</div>
        <div className="text-xs text-slate-400">Organization</div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="a"
        isConnectable={isConnectable}
        className="w-3 h-3 bg-[#d4af37] border-2 border-[#020617]"
      />
    </div>
  );
};
