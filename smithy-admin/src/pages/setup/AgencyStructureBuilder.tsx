import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// --- Custom Nodes ---

const OrganizationNode = ({ data }: any) => {
  return (
    <div className="bg-indigo-900/80 border-2 border-indigo-500 p-4 rounded-xl shadow-xl shadow-indigo-500/20 text-center w-48">
      <div className="text-xs text-indigo-300 font-bold mb-1">foaf:Organization</div>
      <div className="text-white font-semibold">{data.name || "New Organization"}</div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-400" />
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-400" />
    </div>
  );
};

const PersonNode = ({ data, id }: any) => {
  return (
    <div className="bg-emerald-900/80 border-2 border-emerald-500 p-3 rounded-xl shadow-xl shadow-emerald-500/20 text-center w-48">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-emerald-400" />
      <div className="text-xs text-emerald-300 font-bold mb-1">foaf:Person</div>
      <input 
        className="w-full bg-black/50 border border-emerald-500/50 rounded px-2 py-1 text-xs text-white mb-2" 
        placeholder="WebID URI..." 
        value={data.webId || ""}
        onChange={(e) => data.onChange(id, 'webId', e.target.value)}
      />
      <input 
        className="w-full bg-black/50 border border-emerald-500/50 rounded px-2 py-1 text-xs text-white" 
        placeholder="Role (e.g. Legal Owner)" 
        value={data.role || ""}
        onChange={(e) => data.onChange(id, 'role', e.target.value)}
      />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-400" />
    </div>
  );
};

const SoftwareNode = ({ data, id }: any) => {
  return (
    <div className="bg-amber-900/80 border-2 border-amber-500 p-3 rounded-xl shadow-xl shadow-amber-500/20 text-center w-48">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-400" />
      <div className="text-xs text-amber-300 font-bold mb-1">schema:SoftwareApplication</div>
      <input 
        className="w-full bg-black/50 border border-amber-500/50 rounded px-2 py-1 text-xs text-white" 
        placeholder="Software Name" 
        value={data.name || ""}
        onChange={(e) => data.onChange(id, 'name', e.target.value)}
      />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-amber-400" />
    </div>
  );
};

const nodeTypes = {
  organization: OrganizationNode,
  person: PersonNode,
  software: SoftwareNode,
};

// --- Sidebar Component ---

const Sidebar = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 bg-slate-900/80 border-r border-white/10 p-4 flex flex-col gap-4">
      <h3 className="text-white font-bold text-lg mb-2">Entities</h3>
      <div className="text-sm text-slate-400 mb-4">Drag entities onto the canvas to map relationships.</div>
      
      <div 
        className="bg-emerald-900/50 border border-emerald-500/50 p-3 rounded cursor-grab hover:bg-emerald-900 transition-colors"
        onDragStart={(event) => onDragStart(event, 'person')}
        draggable
      >
        <div className="text-emerald-300 font-bold text-sm">foaf:Person</div>
        <div className="text-xs text-slate-300">Human operator or steward</div>
      </div>
      
      <div 
        className="bg-amber-900/50 border border-amber-500/50 p-3 rounded cursor-grab hover:bg-amber-900 transition-colors"
        onDragStart={(event) => onDragStart(event, 'software')}
        draggable
      >
        <div className="text-amber-300 font-bold text-sm">schema:SoftwareApplication</div>
        <div className="text-xs text-slate-300">Automated system or IPMS</div>
      </div>
    </div>
  );
};

// --- Main Builder Component ---

interface AgencyStructureBuilderProps {
  orgName: string;
  onChange: (nodes: Node[], edges: Edge[]) => void;
}

const initialNodes: Node[] = [
  {
    id: 'org',
    type: 'organization',
    position: { x: 250, y: 50 },
    data: { name: 'Organization' },
  },
];

const initialEdges: Edge[] = [];

let id = 0;
const getId = () => `node_${id++}`;

export const AgencyStructureBuilder: React.FC<AgencyStructureBuilderProps> = ({ orgName, onChange }) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Update org name if it changes from parent
  useEffect(() => {
    setNodes((nds) => 
      nds.map((node) => {
        if (node.id === 'org') {
          node.data = { ...node.data, name: orgName };
        }
        return node;
      })
    );
  }, [orgName, setNodes]);

  // Notify parent of changes
  useEffect(() => {
    onChange(nodes, edges);
  }, [nodes, edges, onChange]);

  const updateNodeData = useCallback((nodeId: string, key: string, value: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          node.data = { ...node.data, [key]: value };
        }
        return node;
      })
    );
  }, [setNodes]);

  const onConnect = useCallback((params: Connection) => {
    // Basic interaction: ask user for edge label? Let's just default to schema:member or let them edit later.
    // For now we'll default to schema:member or schema:creator based on source.
    let label = 'schema:member';
    if (params.target === 'org' && params.source.startsWith('software')) label = 'as:actor';
    if (params.source === 'org' && params.target.startsWith('software')) label = 'schema:creator';

    setEdges((eds) => addEdge({ 
      ...params, 
      animated: true, 
      label, 
      style: { stroke: '#fff' }, 
      labelStyle: { fill: '#fff', fontWeight: 700 }, 
      labelBgStyle: { fill: '#333' } 
    }, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${type}_${getId()}`,
        type,
        position,
        data: { onChange: updateNodeData },
      };

      if (type === 'person') {
        newNode.data.webId = '';
        newNode.data.role = 'Technical Steward';
      }
      if (type === 'software') {
        newNode.data.name = 'Solid IPMS';
      }

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, updateNodeData]
  );

  return (
    <div className="flex h-[500px] w-full rounded-xl overflow-hidden border border-white/10 glass-panel">
      <ReactFlowProvider>
        <Sidebar />
        <div className="flex-1 h-full" ref={reactFlowWrapper}>
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
            fitView
            className="bg-black/50"
          >
            <Background color="#333" gap={16} />
            <Controls className="bg-slate-800 border-white/10 fill-white" />
            <MiniMap className="bg-slate-900 border-white/10" nodeColor="#6366f1" />
          </ReactFlow>
        </div>
      </ReactFlowProvider>
    </div>
  );
};
