import React, { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  Panel,
} from '@xyflow/react';
import type { Connection, Edge, Node, ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { AgencyNode } from './nodes/AgencyNode';
import { StewardNode } from './nodes/StewardNode';
import { OperatorNode } from './nodes/OperatorNode';
import { RelationEdge } from './edges/RelationEdge';

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const nodeTypes = {
  agency: AgencyNode,
  steward: StewardNode,
  operator: OperatorNode,
};

const edgeTypes = {
  relation: RelationEdge,
};

let id = 0;
const getId = () => `dndnode_${id++}`;

const Sidebar = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 glass-panel border-r border-white/10 p-4 flex flex-col gap-4">
      <h3 className="text-xl font-bold text-[#d4af37] mb-4">Structure Elements</h3>
      <p className="text-sm text-slate-400 mb-2">Drag elements onto the canvas to build your agency structure.</p>
      
      <div 
        className="glass-panel p-3 border border-[#d4af37]/30 rounded cursor-grab hover:bg-white/5 transition-all text-center"
        onDragStart={(event) => onDragStart(event, 'agency')}
        draggable
      >
        <span className="font-medium text-[#d4af37]">Agency / Organization</span>
      </div>
      
      <div 
        className="glass-panel p-3 border border-purple-500/30 rounded cursor-grab hover:bg-white/5 transition-all text-center"
        onDragStart={(event) => onDragStart(event, 'steward')}
        draggable
      >
        <span className="font-medium text-purple-400">Steward</span>
      </div>

      <div 
        className="glass-panel p-3 border border-cyan-500/30 rounded cursor-grab hover:bg-white/5 transition-all text-center"
        onDragStart={(event) => onDragStart(event, 'operator')}
        draggable
      >
        <span className="font-medium text-cyan-400">Operator</span>
      </div>
    </div>
  );
};

const Flow = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, type: 'relation' }, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowInstance || !reactFlowWrapper.current) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node` },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  return (
    <div className="flex h-[calc(100vh-6rem)] w-full rounded-xl overflow-hidden border border-white/10 shadow-2xl">
      <Sidebar />
      <div className="flex-1 h-full relative bg-[#020617]" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          className="bg-[#020617]"
        >
          <Controls className="bg-white/5 border border-white/10 fill-white" />
          <MiniMap className="bg-slate-900 border border-white/10" maskColor="rgba(2, 6, 23, 0.7)" />
          <Background color="#334155" gap={24} size={2} />
          
          <Panel position="top-right" className="glass-panel p-4 m-4 border border-white/10 rounded-lg shadow-xl w-64 hidden">
             <h3 className="text-lg font-bold text-white mb-2">Properties</h3>
             <p className="text-sm text-slate-400">Select a node to edit.</p>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
};

export const AgencyStructurePage = () => {
  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-[#d4af37] mb-2">Agency Structure</h1>
          <p className="text-slate-400">Define Stewards, Operators, and organisational relationships.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium transition-all shadow-md cursor-pointer">
            Export RDF
          </button>
          <button className="px-4 py-2 bg-gradient-to-r from-[#d4af37] to-[#b38b22] text-black border border-[#d4af37] rounded-lg font-medium shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-all cursor-pointer hover:shadow-[0_0_25px_rgba(212,175,55,0.5)]">
            Save Structure
          </button>
        </div>
      </div>
      
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </div>
  );
};
