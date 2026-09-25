import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

export const StewardNode = ({ data, isConnectable }: NodeProps) => {
  return (
    <div className="glass-panel border-2 border-purple-500/50 rounded-full p-4 shadow-[0_0_15px_rgba(168,85,247,0.2)] w-[120px] h-[120px] flex flex-col items-center justify-center text-center bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/90 backdrop-blur-md transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-purple-400 border-2 border-[#020617]"
      />
      
      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/50 mb-2">
        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
      
      <div className="font-bold text-purple-400 tracking-wider text-xs uppercase break-words w-full">{data.label as string}</div>
      <div className="text-[10px] text-slate-400 mt-1">Steward</div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="a"
        isConnectable={isConnectable}
        className="w-3 h-3 bg-purple-400 border-2 border-[#020617]"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="b"
        isConnectable={isConnectable}
        className="w-3 h-3 bg-purple-400 border-2 border-[#020617]"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="c"
        isConnectable={isConnectable}
        className="w-3 h-3 bg-purple-400 border-2 border-[#020617]"
      />
    </div>
  );
};
