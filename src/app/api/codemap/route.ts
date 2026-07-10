import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

function getWorkspacePath() {
  return process.cwd()
}

const EXCLUDED_DIRS = ['node_modules', '.git', '.next', 'dist', 'out', '.vercel', 'coverage', '.cache']
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.json', '.md', '.yaml', '.yml'])

interface CodeNode {
  id: string
  name: string
  relativePath: string
  type: 'component' | 'page' | 'style' | 'config' | 'util' | 'hook' | 'api'
  size: string
  imports: string[]
  status: 'modified' | 'clean' | 'untracked'
}

async function getFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const res = path.resolve(dir, entry.name)
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.includes(entry.name)) return []
        return getFiles(res)
      } else {
        const ext = path.extname(res).toLowerCase()
        return TEXT_EXTENSIONS.has(ext) ? [res] : []
      }
    })
  )
  return files.flat()
}

function getGitStatuses(workspacePath: string): Promise<Record<string, string>> {
  return fs.readFile(path.join(workspacePath, '.git', 'index'), 'binary')
    .then(() => import('child_process').then(({ execSync }) => {
      try {
        const out = execSync('git status --porcelain', { cwd: workspacePath, timeout: 5000, encoding: 'utf-8' })
        const map: Record<string, string> = {}
        for (const line of out.split('\n').filter(Boolean)) {
          const fp = line.slice(3).trim()
          if (line[0] === '?' && line[1] === '?') map[fp] = 'untracked'
          else map[fp] = 'modified'
        }
        return map
      } catch { return {} }
    }))
    .catch(() => ({}))
}

function inferType(filePath: string): CodeNode['type'] {
  const name = path.basename(filePath).toLowerCase()
  if (name.includes('hook') || name.startsWith('use')) return 'hook'
  if (filePath.includes('/api/') || filePath.includes('\\api\\')) return 'api'
  if (filePath.includes('/components/') || name.endsWith('.tsx')) return 'component'
  if (filePath.includes('/app/') && (name === 'page.tsx' || name === 'layout.tsx')) return 'page'
  if (name.endsWith('.css') || name.endsWith('.scss')) return 'style'
  if (name.endsWith('.json') || name.endsWith('.yaml') || name.endsWith('.yml')) return 'config'
  if (filePath.includes('/lib/') || filePath.includes('/utils/') || filePath.includes('/hooks/')) return 'util'
  return 'component'
}

export async function GET() {
  try {
    const workspacePath = getWorkspacePath()
    const files = await getFiles(workspacePath)
    const gitStatuses = await getGitStatuses(workspacePath)

    const fileMap = new Map<string, string>()
    const allFiles = files.map(f => {
      const rel = path.relative(workspacePath, f)
      fileMap.set(rel, f)
      return rel
    })

    const nodes: CodeNode[] = allFiles.map((rel, idx) => {
      const absPath = fileMap.get(rel)!
      const stat = { size: 0 }
      try { require('fs').statSync(absPath).size } catch {}

      let sizeStr = '0 B'
      try {
        const s = require('fs').statSync(absPath).size
        if (s > 1024) sizeStr = `${(s / 1024).toFixed(1)} KB`
        else sizeStr = `${s} B`
      } catch {}

      return {
        id: String(idx),
        name: path.basename(rel),
        relativePath: rel,
        type: inferType(rel),
        size: sizeStr,
        imports: [],
        status: gitStatuses[rel] === 'untracked' ? 'untracked' : gitStatuses[rel] === 'modified' ? 'modified' : 'clean'
      }
    })

    // Resolve import paths for each file
    for (const node of nodes) {
      try {
        const content = await fs.readFile(fileMap.get(node.relativePath)!, 'utf-8')
        const importMatches = content.matchAll(/(?:import|from|require)\s*[\s\S]*?['"](\.[^'"]+)['"]/g)
        for (const match of importMatches) {
          const importPath = match[1]
          const resolved = path.resolve(path.dirname(fileMap.get(node.relativePath)!), importPath)
          const candidates = [resolved, resolved + '.ts', resolved + '.tsx', resolved + '.js', resolved + '.jsx', path.join(resolved, 'index.tsx'), path.join(resolved, 'index.ts')]
          for (const candidate of candidates) {
            const relCandidate = path.relative(workspacePath, candidate)
            const target = nodes.find(n => n.relativePath === relCandidate)
            if (target && !node.imports.includes(target.id)) {
              node.imports.push(target.id)
              break
            }
          }
        }
      } catch {}
    }

    // Only include nodes that have imports or are imported (keep the graph manageable)
    const relevantIds = new Set<string>()
    for (const node of nodes) {
      if (node.imports.length > 0) relevantIds.add(node.id)
      for (const imp of node.imports) relevantIds.add(imp)
    }

    // Layout nodes in a simple grid
    const relevant = nodes.filter(n => relevantIds.has(n.id))
    const cols = Math.ceil(Math.sqrt(relevant.length))
    relevant.forEach((node, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      node.imports = node.imports.filter(id => relevantIds.has(id))
    })

    return NextResponse.json({ nodes: relevant.length > 0 ? relevant : nodes.slice(0, 20) })
  } catch (error: any) {
    console.error('Codemap API error:', error)
    return NextResponse.json({ nodes: [] })
  }
}
