import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

export const OperatorNode = ({ data, isConnectable }: NodeProps) => {
  return (
    <div className="glass-panel border-2 border-cyan-500/50 rounded p-3 shadow-[0_0_15px_rgba(6,182,212,0.2)] min-w-[140px] flex items-center gap-3 bg-gradient-to-r from-[#1e293b]/80 to-[#0f172a]/90 backdrop-blur-md transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]">
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-cyan-400 border-2 border-[#020617]"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="t"
        isConnectable={isConnectable}
        className="w-3 h-3 bg-cyan-400 border-2 border-[#020617]"
      />
      
      <div className="w-8 h-8 rounded bg-cyan-500/20 flex-shrink-0 flex items-center justify-center border border-cyan-500/50">
        <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      
      <div className="flex flex-col overflow-hidden">
        <div className="font-bold text-cyan-400 tracking-wider text-xs uppercase truncate">{data.label as string}</div>
        <div className="text-[10px] text-slate-400">Operator</div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="a"
        isConnectable={isConnectable}
        className="w-3 h-3 bg-cyan-400 border-2 border-[#020617]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="b"
        isConnectable={isConnectable}
        className="w-3 h-3 bg-cyan-400 border-2 border-[#020617]"
      />
    </div>
  );
};
