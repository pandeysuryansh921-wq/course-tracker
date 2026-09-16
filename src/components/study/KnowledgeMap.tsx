import React, { useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Edge,
  Node,
  MarkerType,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { DagNode } from '@/lib/dag';
import { TopicStatus } from '@/types/curriculum';

// Custom Node Component to show nice styling
const TopicNode = ({ data }: { data: { label: string, status: TopicStatus, isUnlocked: boolean } }) => {
  let bgColor = 'bg-slate-100 dark:bg-slate-800';
  let borderColor = 'border-slate-300 dark:border-slate-600';
  let textColor = 'text-slate-500';

  if (data.status === 'completed') {
    bgColor = 'bg-green-100 dark:bg-green-900/30';
    borderColor = 'border-green-400 dark:border-green-600';
    textColor = 'text-green-700 dark:text-green-300';
  } else if (data.status === 'needs-review') {
    bgColor = 'bg-orange-100 dark:bg-orange-900/30';
    borderColor = 'border-orange-400 dark:border-orange-600';
    textColor = 'text-orange-700 dark:text-orange-300';
  } else if (data.isUnlocked) {
    bgColor = 'bg-white dark:bg-slate-700';
    borderColor = 'border-violet-400 dark:border-violet-500';
    textColor = 'text-slate-800 dark:text-slate-200';
  }

  return (
    <div className={`px-4 py-2 shadow-md rounded-md border-2 ${bgColor} ${borderColor}`}>
      <Handle type="target" position={Position.Top} className="w-16 !bg-slate-400 opacity-0" />
      <div className={`font-bold text-sm ${textColor} max-w-[150px] text-center`}>
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-16 !bg-slate-400 opacity-0" />
    </div>
  );
};

const nodeTypes = {
  topicNode: TopicNode,
};

interface KnowledgeMapProps {
  dagNodes: DagNode[];
}

const layoutNodes = (dagNodes: DagNode[]): Node[] => {
  const nodes: Node[] = [];
  
  // Group by depth (distance from root)
  const depths = new Map<string, number>();
  
  const getDepth = (id: string, visited: Set<string>): number => {
    if (depths.has(id)) return depths.get(id)!;
    if (visited.has(id)) return 0; // cycle
    
    const node = dagNodes.find(n => n.topic.id === id);
    if (!node || node.prerequisites.length === 0) {
      depths.set(id, 0);
      return 0;
    }
    
    visited.add(id);
    let maxDepth = 0;
    for (const p of node.prerequisites) {
      maxDepth = Math.max(maxDepth, getDepth(p, new Set(visited)));
    }
    const myDepth = maxDepth + 1;
    depths.set(id, myDepth);
    return myDepth;
  };

  dagNodes.forEach(n => getDepth(n.topic.id, new Set()));

  // Count how many nodes at each depth to calculate X offsets
  const depthCounts = new Map<number, number>();
  const currentDepthCounts = new Map<number, number>();

  dagNodes.forEach(n => {
    const d = depths.get(n.topic.id) || 0;
    depthCounts.set(d, (depthCounts.get(d) || 0) + 1);
    currentDepthCounts.set(d, 0);
  });

  dagNodes.forEach(n => {
    const d = depths.get(n.topic.id) || 0;
    const countAtDepth = depthCounts.get(d) || 1;
    const currentIndex = currentDepthCounts.get(d) || 0;
    currentDepthCounts.set(d, currentIndex + 1);

    const xOffset = (currentIndex - (countAtDepth - 1) / 2) * 250;
    
    nodes.push({
      id: n.topic.id,
      type: 'topicNode',
      position: { x: xOffset, y: d * 150 },
      data: { 
        label: n.topic.name, 
        status: n.topic.status,
        isUnlocked: n.isUnlocked
      }
    });
  });

  return nodes;
};

const buildEdges = (dagNodes: DagNode[]): Edge[] => {
  const edges: Edge[] = [];
  dagNodes.forEach(n => {
    n.prerequisites.forEach(pId => {
      edges.push({
        id: `e-${pId}-${n.topic.id}`,
        source: pId,
        target: n.topic.id,
        type: 'smoothstep',
        animated: n.isUnlocked && n.status !== 'completed',
        style: { stroke: '#94a3b8', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#94a3b8',
        },
      });
    });
  });
  return edges;
};

export default function KnowledgeMap({ dagNodes }: KnowledgeMapProps) {
  const initialNodes = useMemo(() => layoutNodes(dagNodes), [dagNodes]);
  const initialEdges = useMemo(() => buildEdges(dagNodes), [dagNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(layoutNodes(dagNodes));
    setEdges(buildEdges(dagNodes));
  }, [dagNodes, setNodes, setEdges]);

  return (
    <div className="w-full h-[600px] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900/50 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Controls />
        <MiniMap zoomable pannable className="dark:bg-slate-800" />
        <Background color="#cbd5e1" gap={16} />
      </ReactFlow>
    </div>
  );
}