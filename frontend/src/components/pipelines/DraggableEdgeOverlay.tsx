"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

export type NodeRef = {
  key: string;
  ref: React.RefObject<HTMLDivElement>;
};

export type SimpleEdge = { from: string; to: string };

interface Props {
  nodes: { key: string; label?: string }[];
  edges: SimpleEdge[];
  onAddEdge: (from: string, to: string) => void;
  height?: number;
}

// Lightweight HTML/SVG overlay that lets you drag from a node handle to another node to create edges.
export default function DraggableEdgeOverlay({ nodes, edges, onAddEdge, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const nodeRefs = useMemo<NodeRef[]>(
    () => nodes.map((n) => ({ key: n.key, ref: React.createRef<HTMLDivElement>() })),
    [nodes]
  );

  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [dropHint, setDropHint] = useState<{ x: number; y: number; msg: string } | null>(null);

  // Calculate center of a node relative to the container
  const getNodeCenter = (k: string) => {
    const cont = containerRef.current;
    const nodeRef = nodeRefs.find((r) => r.key === k)?.ref.current;
    if (!cont || !nodeRef) return null;
    const cRect = cont.getBoundingClientRect();
    const nRect = nodeRef.getBoundingClientRect();
    return {
      x: nRect.left - cRect.left + nRect.width / 2,
      y: nRect.top - cRect.top + nRect.height / 2,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragFrom) return;
      const cont = containerRef.current;
      if (!cont) return;
      const cRect = cont.getBoundingClientRect();
      setCursor({ x: e.clientX - cRect.left, y: e.clientY - cRect.top });
    };
    const onUp = (e: MouseEvent) => {
      if (!dragFrom) return;
      const targetKey = getNodeUnderPointer(e.clientX, e.clientY);
      if (targetKey && targetKey !== dragFrom) {
        onAddEdge(dragFrom, targetKey);
      } else {
        // brief hint to help users understand drop requirement
        const cont = containerRef.current;
        if (cont) {
          const cRect = cont.getBoundingClientRect();
          setDropHint({ x: e.clientX - cRect.left, y: e.clientY - cRect.top, msg: "Drop on a node to connect" });
          setTimeout(() => setDropHint(null), 1200);
        }
      }
      setDragFrom(null);
      setCursor(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragFrom, onAddEdge, nodeRefs]);

  const getNodeUnderPointer = (clientX: number, clientY: number): string | null => {
    // First pass: strict bounds hit-test
    for (const { key, ref } of nodeRefs) {
      const el = ref.current;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return key;
      }
    }
    // Second pass: tolerant center-radius hit-test
    let nearest: { key: string; d: number } | null = null;
    for (const { key, ref } of nodeRefs) {
      const el = ref.current;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (nearest == null || d < nearest.d) nearest = { key, d };
    }
    // 40px radius tolerance
    if (nearest && nearest.d <= 40) return nearest.key;
    return null;
  };

  const line = useMemo(() => {
    if (!dragFrom || !cursor) return null;
    const p1 = getNodeCenter(dragFrom);
    if (!p1) return null;
    return { x1: p1.x, y1: p1.y, x2: cursor.x, y2: cursor.y };
  }, [dragFrom, cursor]);

  return (
    <div ref={containerRef} className="relative border rounded bg-white" style={{ height }}>
      {/* Nodes as simple pills */}
      <div className="flex flex-wrap gap-3 p-3 select-none">
        {nodes.map((n) => {
          const ref = nodeRefs.find((r) => r.key === n.key)!.ref;
          return (
            <div
              key={n.key}
              ref={ref}
              className="inline-flex items-center gap-2 px-3 py-2 rounded border bg-gray-50 hover:bg-gray-100 relative"
            >
              <span className="text-sm font-mono">{n.label || n.key}</span>
              {/* drag handle */}
              <span
                title="Drag to connect"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragFrom(n.key);
                }}
                className="w-4 h-4 rounded-full bg-blue-500 hover:bg-blue-600 cursor-crosshair ring-2 ring-blue-200"
              />
              {/* larger invisible hit area to ease grabbing */}
              <span
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragFrom(n.key);
                }}
                className="absolute right-1 top-1 w-6 h-6 -mr-1 -mt-1 cursor-crosshair"
                style={{ background: 'transparent' }}
              />
            </div>
          );
        })}
      </div>

      {/* SVG edges */}
      <svg ref={svgRef} className="absolute inset-0 pointer-events-none">
        {/* Existing edges */}
        {edges.map((e, i) => {
          const a = getNodeCenter(e.from);
          const b = getNodeCenter(e.to);
          if (!a || !b) return null;
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#64748b" strokeWidth={2} />
              {/* Arrow head */}
              <polygon
                points={`${b.x},${b.y} ${b.x - 6},${b.y - 3} ${b.x - 6},${b.y + 3}`}
                fill="#64748b"
              />
            </g>
          );
        })}
        {/* Dragging preview */}
        {line && (
          <g>
            <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#3b82f6" strokeWidth={2} />
            <circle cx={line.x2} cy={line.y2} r={3} fill="#3b82f6" />
          </g>
        )}
      </svg>

      {/* Dragging chip */}
      {dragFrom && (
        <div className="absolute left-3 top-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded shadow">
          Dragging from: <span className="font-mono">{dragFrom}</span>
        </div>
      )}

      {/* Drop hint near cursor on failure */}
      {dropHint && (
        <div
          className="absolute text-[11px] bg-red-600 text-white px-2 py-0.5 rounded shadow"
          style={{ left: Math.max(4, Math.min(dropHint.x + 8, (containerRef.current?.clientWidth || 0) - 120)), top: Math.max(4, dropHint.y + 8) }}
        >
          {dropHint.msg}
        </div>
      )}
    </div>
  );
}
