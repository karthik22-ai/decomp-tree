import { useMemo } from 'react';
import * as dagre from 'dagre';
import type { Edge } from 'reactflow';
import type { KPIData } from '../types';

interface UseKPILayoutProps {
  kpis: Record<string, KPIData>;
}

export const useKPILayout = ({ kpis }: UseKPILayoutProps) => {
  // Generate a structural fingerprint to prevent layout recalculation on value changes
  const layoutFingerprint = useMemo(() => {
    if (!kpis) return '';
    try {
      return Object.values(kpis).map((k: KPIData) => 
        k ? `${k.id}-${k.parentId}-${k.children?.length}-${k.isExpanded}-${k.label}` : ''
      ).join('|');
    } catch (e) {
      return '';
    }
  }, [kpis]);

  // Compute layout positions only when structure changes
  const layoutPositions = useMemo(() => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    
    const nodeWidth = 280;
    const nodeHeight = 300;
    const baseNodesep = 60; // Slightly more vertical space for clarity
    
    // 1. First, quickly traverse the tree to find its structural stats (breadth and depth)
    const roots = Object.values(kpis || {}).filter((k: KPIData) => k && (!k.parentId || !kpis[k.parentId]));
    const rankCounts: Record<number, number> = {};
    let maxDepth = 0;
    
    const calculateStats = (id: string, depth: number) => {
      maxDepth = Math.max(maxDepth, depth);
      rankCounts[depth] = (rankCounts[depth] || 0) + 1;
      const kpi = kpis[id];
      if (kpi && kpi.isExpanded && kpi.children) {
        kpi.children.forEach(childId => calculateStats(childId, depth + 1));
      }
    };
    roots.forEach(r => calculateStats(r.id, 1));
    
    const breadth = Math.max(...Object.values(rankCounts), 1);
    const depth = maxDepth || 1;
    
    // 2. Dynamically calculate ranksep and nodesep to balance Width vs Height
    // In 'LR' mode: 
    // width ≈ depth * (nodeWidth + ranksep)
    // height ≈ breadth * (nodeHeight + nodesep)
    
    // Default values
    let calculatedRankSep = 200;
    let calculatedNodeSep = 60;

    if (depth > 0 && breadth > 0) {
      // We want: depth * (nodeWidth + ranksep) = breadth * (nodeHeight + nodesep)
      // Let's solve for ranksep given a base nodesep
      const targetHeight = breadth * (nodeHeight + 20); // 20 is min nodesep
      calculatedRankSep = (targetHeight / depth) - nodeWidth;
      
      // If the breadth is very high, we also compress nodesep
      if (breadth > 5) {
        calculatedNodeSep = Math.max(10, 80 - (breadth * 2));
      }
    }
    
    // Clamp values to sensible ranges to prevent infinite explosion or overlapping
    // Increase max ranksep to 3000 to allow broad horizontal growth
    const finalRankSep = Math.max(120, Math.min(3000, calculatedRankSep));
    const finalNodeSep = Math.max(10, Math.min(100, calculatedNodeSep));

    dagreGraph.setGraph({ 
      rankdir: 'LR', 
      nodesep: finalNodeSep, 
      ranksep: finalRankSep,
      marginx: 100,
      marginy: 100
    });

    const visited = new Set<string>();
    const edges: Edge[] = [];
    const nodesInLayout: string[] = [];

    const traverse = (kpi: KPIData) => {
      if (!kpi || !kpi.id || visited.has(kpi.id)) return;
      visited.add(kpi.id);
      nodesInLayout.push(kpi.id);
      dagreGraph.setNode(kpi.id, { width: nodeWidth, height: nodeHeight });

      if (kpi.isExpanded && kpi.children) {
        kpi.children.forEach((childId: string) => {
          if (!childId) return;
          const child = kpis?.[childId];
          if (child) {
            edges.push({
              id: `e-${kpi.id}-${childId}`,
              source: kpi.id,
              target: childId,
              type: 'default',
              animated: false,
              style: { strokeWidth: 2, stroke: kpi.color || '#cbd5e1' }
            });
            dagreGraph.setEdge(kpi.id, childId);
            traverse(child);
          }
        });
      }
    };

    roots.forEach(r => traverse(r));
    dagre.layout(dagreGraph);

    const positions: Record<string, { x: number, y: number }> = {};
    nodesInLayout.forEach(id => {
      const pos = dagreGraph.node(id);
      if (pos) {
        positions[id] = {
          x: pos.x - nodeWidth / 2,
          y: pos.y - nodeHeight / 2
        };
      }
    });

    return { positions, edges };
  }, [layoutFingerprint, kpis]);

  return layoutPositions;
};
