'use client'

import React, { useState, useEffect } from 'react'
import { Network, ZoomIn, ZoomOut, RefreshCw, FileCode, Layers, Activity } from 'lucide-react'

interface CodeNode {
  id: string
  name: string
  relativePath: string
  type: 'component' | 'page' | 'style' | 'config' | 'util' | 'hook' | 'api'
  size: string
  imports: string[]
  status: 'modified' | 'clean' | 'untracked'
  x?: number
  y?: number
}

const TYPE_COLORS: Record<string, string> = {
  component: '#38bdf8',
  page: '#a78bfa',
  style: '#34d399',
  config: '#fbbf24',
  util: '#f472b6',
  hook: '#fb923c',
  api: '#f87171'
}

function layoutNodes(nodes: CodeNode[]): CodeNode[] {
  const positioned = [...nodes]
  const cols = Math.ceil(Math.sqrt(positioned.length * 1.5))
  const spacingX = 140
  const spacingY = 90
  const offsetX = 60
  const offsetY = 40

  // Simple force-directed-ish: nodes with more imports go to top
  const sorted = [...positioned].sort((a, b) => b.imports.length - a.imports.length)
  sorted.forEach((node, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    node.x = offsetX + col * spacingX
    node.y = offsetY + row * spacingY
  })

  return positioned
}

export default function CodemapsPanel({ onSelectFile }: { onSelectFile?: (path: string) => void }) {
  const [zoom, setZoom] = useState(1)
  const [selectedNode, setSelectedNode] = useState<CodeNode | null>(null)
  const [nodes, setNodes] = useState<CodeNode[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadMap = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/codemap')
      const data = await res.json()
      setNodes(layoutNodes(data.nodes || []))
    } catch {
      setNodes([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadMap() }, [])

  const svgWidth = Math.max(400, ...nodes.map(n => (n.x || 0) + 160))
  const svgHeight = Math.max(300, ...nodes.map(n => (n.y || 0) + 80))

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-300 font-sans select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/60 bg-zinc-900/40">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Layers size={13} className="text-sky-400" /> Codemaps
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.4, z - 0.2))} className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80" title="Zoom Out">
            <ZoomOut size={12} />
          </button>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.2))} className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80" title="Zoom In">
            <ZoomIn size={12} />
          </button>
          <button onClick={loadMap} disabled={isLoading} className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80">
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* SVG Graph */}
      <div className="flex-1 relative overflow-hidden bg-zinc-950/20 border-b border-zinc-800/40 flex items-center justify-center min-h-[220px]">
        {isLoading ? (
          <div className="text-xs text-zinc-500 flex flex-col items-center gap-2">
            <RefreshCw size={16} className="animate-spin text-sky-500" />
            <span>Parsing dependency matrix...</span>
          </div>
        ) : nodes.length === 0 ? (
          <div className="text-xs text-zinc-600 italic">No dependency data found</div>
        ) : (
          <svg
            width="100%"
            height="100%"
            className="absolute inset-0 cursor-grab"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s ease-out' }}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#3f3f46" />
              </marker>
            </defs>

            {/* Edges */}
            {nodes.map(node =>
              node.imports.map(targetId => {
                const target = nodes.find(n => n.id === targetId)
                if (!target || !target.x || !node.x) return null
                return (
                  <g key={`${node.id}-${targetId}`}>
                    <line
                      x1={node.x} y1={node.y}
                      x2={target.x} y2={target.y}
                      stroke="#3f3f46"
                      strokeWidth="1.5"
                      markerEnd="url(#arrow)"
                    />
                    {node.status === 'modified' && (
                      <circle r="2.5" fill="#f59e0b">
                        <animateMotion
                          path={`M ${node.x} ${node.y} L ${target.x} ${target.y}`}
                          dur="3s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                )
              })
            )}

            {/* Nodes */}
            {nodes.map(node => {
              if (!node.x || !node.y) return null
              const color = TYPE_COLORS[node.type] || '#71717a'
              const isSelected = selectedNode?.id === node.id
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => setSelectedNode(node)}
                  className="cursor-pointer group"
                >
                  <circle
                    r={isSelected ? 9 : 7}
                    fill={isSelected ? color : node.status === 'modified' ? '#f59e0b' : node.status === 'untracked' ? '#34d399' : color}
                    stroke={isSelected ? '#fff' : 'transparent'}
                    strokeWidth={isSelected ? 2 : 0}
                    className="transition-all duration-150"
                    opacity={isSelected ? 1 : 0.85}
                  />
                  <text
                    y="20"
                    textAnchor="middle"
                    className={`text-[8px] font-mono select-none pointer-events-none ${isSelected ? 'fill-zinc-100 font-bold' : 'fill-zinc-500 group-hover:fill-zinc-300'}`}
                  >
                    {node.name.length > 18 ? node.name.slice(0, 16) + '..' : node.name}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>

      {/* Node Details */}
      <div className="p-3 bg-zinc-900/10 space-y-3 flex-shrink-0 min-h-[140px]">
        {selectedNode ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Selected Node</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                selectedNode.status === 'modified' ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                  : selectedNode.status === 'untracked' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-zinc-500 bg-zinc-800'
              }`}>
                {selectedNode.status}
              </span>
            </div>

            <div className="p-2.5 bg-black/40 border border-zinc-800/40 rounded space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                <FileCode size={13} style={{ color: TYPE_COLORS[selectedNode.type] }} />
                <span className="truncate font-mono text-[11px]">{selectedNode.relativePath}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-500">
                <div>Size: <span className="text-zinc-300 font-mono">{selectedNode.size}</span></div>
                <div>Type: <span className="text-zinc-300 font-mono capitalize">{selectedNode.type}</span></div>
                <div>Deps: <span className="text-zinc-300 font-mono">{selectedNode.imports.length}</span></div>
              </div>
            </div>

            {selectedNode.imports.length > 0 && (
              <div className="space-y-1">
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">Imports ({selectedNode.imports.length})</span>
                <div className="space-y-0.5 max-h-16 overflow-y-auto pr-1">
                  {selectedNode.imports.map(impId => {
                    const imp = nodes.find(n => n.id === impId)
                    return imp ? (
                      <div key={impId} className="text-[10px] font-mono text-zinc-400 bg-zinc-900/40 px-2 py-0.5 rounded border border-zinc-800/40 truncate">
                        {imp.relativePath}
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            )}

            <button
              onClick={() => onSelectFile?.(selectedNode.relativePath)}
              className="w-full py-1.5 bg-sky-600/10 border border-sky-500/30 hover:bg-sky-600/20 rounded text-sky-400 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
            >
              <Activity size={12} /> Open File
            </button>
          </div>
        ) : (
          <div className="text-xs text-zinc-600 italic text-center py-4">
            Click a node to inspect file relations
          </div>
        )}
      </div>
    </div>
  )
}
