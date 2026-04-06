"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useJobs, useUpdateJob } from "@/hooks/use-jobs";
import { useKanbanStore } from "@/stores/kanban-store";
import { useToast } from "@/components/ui/toast";
import { X, GripVertical, ExternalLink, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { Job, JobStatus } from "@/types/database";

/* ── Sankey Node Definitions ─────────────────────────────────────────────── */

interface SankeyNode {
  id: JobStatus;
  label: string;
  color: string;
  textColor: string;
  x: number;  // column position (0-based)
  order: number; // vertical order within the column
}

// Define the flow structure: source → target relationships
interface FlowLink {
  source: JobStatus;
  target: JobStatus;
}

const SANKEY_NODES: SankeyNode[] = [
  { id: "in_progress",  label: "In Progress",  color: "#3b82f6", textColor: "#1e3a5f", x: 0, order: 0 },
  { id: "applied",      label: "Applied",      color: "#6366f1", textColor: "#312e81", x: 1, order: 0 },
  { id: "interviewing", label: "Interviewing", color: "#8b5cf6", textColor: "#4c1d95", x: 2, order: 0 },
  { id: "offer",        label: "Offer",        color: "#22c55e", textColor: "#14532d", x: 3, order: 0 },
  { id: "rejected",     label: "Rejected",     color: "#ef4444", textColor: "#7f1d1d", x: 3, order: 1 },
];

const FLOW_LINKS: FlowLink[] = [
  { source: "in_progress",  target: "applied" },
  { source: "applied",      target: "interviewing" },
  { source: "applied",      target: "rejected" },
  { source: "interviewing", target: "offer" },
  { source: "interviewing", target: "rejected" },
];

/* ── Layout Constants ────────────────────────────────────────────────────── */

const SVG_PADDING_X = 60; // padding on left/right so labels don't clip
const SVG_WIDTH = 960;
const SVG_HEIGHT = 360;
const NODE_WIDTH = 32;
const NODE_MIN_HEIGHT = 44;
const NODE_PADDING = 30;
const DRAW_WIDTH = SVG_WIDTH - SVG_PADDING_X * 2; // drawable area
const COLUMN_GAP = DRAW_WIDTH / 3; // 4 columns (0-3)

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function getNodeX(col: number): number {
  return SVG_PADDING_X + col * COLUMN_GAP;
}

// Curved path between two points for the flow links
function sankeyPath(
  x0: number, y0: number, h0: number,
  x1: number, y1: number, h1: number
): string {
  const midX = (x0 + x1) / 2;
  return [
    `M ${x0},${y0}`,
    `C ${midX},${y0} ${midX},${y1} ${x1},${y1}`,
    `L ${x1},${y1 + h1}`,
    `C ${midX},${y1 + h1} ${midX},${y0 + h0} ${x0},${y0 + h0}`,
    `Z`,
  ].join(" ");
}

/* ── Component ────────────────────────────────────────────────────────────── */

export function SankeyDiagram() {
  const { data: jobs = [], isLoading } = useJobs();
  const updateJob = useUpdateJob();
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    fetch("/api/stripe/status")
      .then((r) => r.json())
      .then((d) => setIsPremium(d.isPremium ?? false))
      .catch(() => {});
  }, []);
  const { toast } = useToast();
  const [selectedNode, setSelectedNode] = useState<JobStatus | null>(null);
  const [hoveredNode, setHoveredNode] = useState<JobStatus | null>(null);
  const [dragOverNode, setDragOverNode] = useState<JobStatus | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Count jobs per status
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const node of SANKEY_NODES) map[node.id] = 0;
    for (const job of jobs) {
      if (map[job.status] !== undefined) map[job.status]++;
    }
    return map;
  }, [jobs]);

  const totalJobs = jobs.length;

  // Calculate node heights proportional to count
  const nodeLayouts = useMemo(() => {
    const maxCount = Math.max(...Object.values(counts), 1);
    const maxNodeHeight = SVG_HEIGHT - 100;

    // Group nodes by column
    const columns: Record<number, SankeyNode[]> = {};
    for (const n of SANKEY_NODES) {
      if (!columns[n.x]) columns[n.x] = [];
      columns[n.x].push(n);
    }

    const layouts: Record<string, { x: number; y: number; width: number; height: number }> = {};

    for (const [colStr, nodes] of Object.entries(columns)) {
      const col = Number(colStr);
      const x = getNodeX(col);

      if (nodes.length === 1) {
        const n = nodes[0];
        const h = Math.max(NODE_MIN_HEIGHT, (counts[n.id] / Math.max(maxCount, 1)) * maxNodeHeight);
        layouts[n.id] = { x, y: (SVG_HEIGHT - h) / 2, width: NODE_WIDTH, height: h };
      } else {
        // Multiple nodes in the same column (e.g., offer + rejected)
        const totalCount = nodes.reduce((s, n) => s + counts[n.id], 0);
        const availableHeight = SVG_HEIGHT - NODE_PADDING * (nodes.length - 1);
        let currentY = 20;

        for (const n of nodes) {
          const h = totalCount > 0
            ? Math.max(NODE_MIN_HEIGHT, (counts[n.id] / totalCount) * availableHeight)
            : NODE_MIN_HEIGHT;
          layouts[n.id] = { x, y: currentY, width: NODE_WIDTH, height: h };
          currentY += h + NODE_PADDING;
        }
      }
    }

    return layouts;
  }, [counts]);

  // Calculate flow link geometries
  const linkPaths = useMemo(() => {
    return FLOW_LINKS.map((link) => {
      const src = nodeLayouts[link.source];
      const tgt = nodeLayouts[link.target];
      if (!src || !tgt) return null;

      const srcCount = counts[link.source] || 0;
      const tgtCount = counts[link.target] || 0;
      const flowCount = Math.min(srcCount, tgtCount);

      // Calculate the thickness of the flow proportionally — bolder links
      const maxCount = Math.max(...Object.values(counts), 1);
      const thickness = Math.max(24, (flowCount / maxCount) * 120);

      // Source exits from right side center, target enters from left side center
      const x0 = src.x + src.width;
      const y0 = src.y + src.height / 2 - thickness / 2;
      const x1 = tgt.x;
      const y1 = tgt.y + tgt.height / 2 - thickness / 2;

      const srcNode = SANKEY_NODES.find((n) => n.id === link.source)!;
      const tgtNode = SANKEY_NODES.find((n) => n.id === link.target)!;

      return {
        ...link,
        path: sankeyPath(x0, y0, thickness, x1, y1, thickness),
        flowCount,
        color: tgtNode.color,
        srcLabel: srcNode.label,
        tgtLabel: tgtNode.label,
      };
    }).filter(Boolean);
  }, [nodeLayouts, counts]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent, nodeId: JobStatus) => {
    e.preventDefault();
    setDragOverNode(nodeId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverNode(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetStatus: JobStatus) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("text/plain");
    if (jobId) {
      updateJob.mutate(
        { id: jobId, status: targetStatus },
        {
          onSuccess: () => {
            toast({ title: `Job moved to ${SANKEY_NODES.find((n) => n.id === targetStatus)?.label}` });
          },
        }
      );
    }
    setDragOverNode(null);
  }, [updateJob, toast]);

  // Handle drag start from the job list panel
  const handleJobDragStart = useCallback((e: React.DragEvent, jobId: string) => {
    e.dataTransfer.setData("text/plain", jobId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  // Jobs filtered by selected node
  const selectedJobs = useMemo(() => {
    if (!selectedNode) return [];
    return jobs.filter((j) => j.status === selectedNode);
  }, [jobs, selectedNode]);

  if (isLoading || totalJobs === 0) return null;

  return (
    <div className="mt-6 rounded-2xl bg-white shadow-sm overflow-hidden relative border border-border/50">
      {!isPremium && (
        <div className="block lg:hidden absolute inset-0 z-20 bg-white/40 backdrop-blur-[6px] flex flex-col items-center justify-center p-6 text-center border-t border-white/50">
          <div className="h-12 w-12 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-4 shadow-sm border border-accent/20">
            <Lock className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-lg text-primary mb-2">Visualize on Mobile</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-[280px]">
            Upgrade to Premium to drag-and-drop your applications in the visual pipeline flow right from your phone.
          </p>
          <Link href="/dashboard/profile" className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-accent text-white font-medium text-sm transition-colors hover:bg-accent/90 shadow-sm">
            <Sparkles className="h-4 w-4 mr-2" /> Upgrade to Premium
          </Link>
        </div>
      )}

      <div className={cn("p-6", !isPremium && "max-lg:opacity-30 max-lg:pointer-events-none")}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-primary">Application Flow</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click a stage to view jobs · Drag jobs between stages to update status
            </p>
          </div>
          <div className="text-xs font-semibold text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
            {totalJobs} total job{totalJobs !== 1 ? "s" : ""}
          </div>
        </div>

        {/* ── SVG Sankey ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full max-w-[900px] mx-auto"
          style={{ minWidth: 600 }}
        >
          {/* Flow links */}
          {linkPaths.map((link, i) => link && (
            <g key={i}>
              <path
                d={link.path}
                fill={link.color}
                opacity={
                  hoveredNode
                    ? (hoveredNode === link.source || hoveredNode === link.target ? 0.35 : 0.08)
                    : 0.18
                }
                className="transition-opacity duration-200"
              />
            </g>
          ))}

          {/* Nodes */}
          {SANKEY_NODES.map((node) => {
            const layout = nodeLayouts[node.id];
            if (!layout) return null;
            const count = counts[node.id];
            const isHovered = hoveredNode === node.id;
            const isDragTarget = dragOverNode === node.id;
            const isSelected = selectedNode === node.id;

            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, node.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e as unknown as React.DragEvent, node.id)}
              >
                {/* Node bar */}
                <rect
                  x={layout.x}
                  y={layout.y}
                  width={layout.width}
                  height={layout.height}
                  rx={6}
                  fill={node.color}
                  opacity={isHovered || isDragTarget || isSelected ? 1 : 0.85}
                  stroke={isDragTarget ? "#b8941f" : isSelected ? node.color : "transparent"}
                  strokeWidth={isDragTarget || isSelected ? 3 : 0}
                  className="transition-all duration-200"
                />
                {/* Glow effect on drag target */}
                {isDragTarget && (
                  <rect
                    x={layout.x - 4}
                    y={layout.y - 4}
                    width={layout.width + 8}
                    height={layout.height + 8}
                    rx={9}
                    fill="none"
                    stroke="#b8941f"
                    strokeWidth={2}
                    opacity={0.5}
                    className="animate-pulse"
                  />
                )}
                {/* Label */}
                <text
                  x={layout.x + layout.width / 2}
                  y={layout.y - 10}
                  textAnchor="middle"
                  className="text-[11px] font-semibold fill-foreground"
                  style={{ userSelect: "none" }}
                >
                  {node.label}
                </text>
                {/* Count */}
                <text
                  x={layout.x + layout.width / 2}
                  y={layout.y + layout.height / 2 + 5}
                  textAnchor="middle"
                  className="text-[13px] font-bold"
                  fill="white"
                  style={{ userSelect: "none" }}
                >
                  {count}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Detail Panel (visible when a node is clicked) ──────────────────── */}
      {selectedNode && (
        <div className="mt-4 border-t border-border/40 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-primary flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: SANKEY_NODES.find((n) => n.id === selectedNode)?.color }}
              />
              {SANKEY_NODES.find((n) => n.id === selectedNode)?.label}
              <span className="text-muted-foreground font-normal">
                ({selectedJobs.length} job{selectedJobs.length !== 1 ? "s" : ""})
              </span>
            </h4>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {selectedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              No jobs in this stage yet.
            </p>
          ) : (
            <div className="grid gap-2 max-h-[250px] overflow-y-auto pr-1">
              {selectedJobs.map((job) => (
                <SankeyJobItem
                  key={job.id}
                  job={job}
                  onDragStart={handleJobDragStart}
                />
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

/* ── Job Item (inside the detail panel) ──────────────────────────────────── */

function SankeyJobItem({
  job,
  onDragStart,
}: {
  job: Job;
  onDragStart: (e: React.DragEvent, jobId: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, job.id)}
      className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/50 hover:border-accent/30 transition-all group cursor-grab active:cursor-grabbing"
    >
      <div className="text-muted-foreground/40 group-hover:text-accent/60 transition-colors">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{job.title}</p>
        <p className="text-xs text-muted-foreground truncate">{job.company}{job.location ? ` · ${job.location}` : ""}</p>
      </div>
      <Link
        href={`/dashboard/jobs/${job.id}`}
        className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-md hover:bg-white"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
