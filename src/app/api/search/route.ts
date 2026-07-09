import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

function getWorkspacePath() {
  return process.cwd()
}

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.txt',
  '.yml', '.yaml', '.svg', '.less', '.scss', '.py', '.rs', '.go', '.java',
  '.c', '.cpp', '.h', '.hpp', '.sh', '.sql', '.xml', '.toml', '.env',
  '.gitignore', '.dockerignore', '.prettierrc', '.eslintrc'
])

const EXCLUDED_DIRS = ['node_modules', '.git', '.next', 'dist', 'out', '.vercel', '.kilo', 'coverage', '.cache']

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
        const name = path.basename(res)
        if (TEXT_EXTENSIONS.has(ext)) return [res]
        if (!ext && TEXT_EXTENSIONS.has(name)) return [res]
        return []
      }
    })
  )
  return files.flat()
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildSearchRegex(query: string, caseSensitive: boolean, wholeWord: boolean, useRegex: boolean): RegExp {
  let pattern = useRegex ? query : escapeRegExp(query)
  if (wholeWord) pattern = `\\b${pattern}\\b`
  const flags = caseSensitive ? 'g' : 'gi'
  return new RegExp(pattern, flags)
}

export async function POST(request: Request) {
  try {
    const workspacePath = getWorkspacePath()
    const { action, query, replaceWith, caseSensitive, wholeWord, useRegex, fileFilters } = await request.json()

    if (!query) {
      return NextResponse.json({ results: [] })
    }

    const regex = buildSearchRegex(query, !!caseSensitive, !!wholeWord, !!useRegex)
    const files = await getFiles(workspacePath)

    const filteredFiles = files.filter(filePath => {
      const relativePath = path.relative(workspacePath, filePath)
      if (fileFilters?.exclude) {
        const excludePatterns = fileFilters.exclude.split(',').map((s: string) => s.trim().toLowerCase())
        if (excludePatterns.some((p: string) => relativePath.toLowerCase().includes(p))) return false
      }
      if (fileFilters?.include) {
        const includePatterns = fileFilters.include.split(',').map((s: string) => s.trim().toLowerCase())
        if (!includePatterns.some((p: string) => relativePath.toLowerCase().includes(p))) return false
      }
      return true
    })

    if (action === 'search') {
      const results: any[] = []

      for (const filePath of filteredFiles) {
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const lines = content.split('\n')
          const relativePath = path.relative(workspacePath, filePath)
          const fileMatches: any[] = []

          lines.forEach((lineText, lineIdx) => {
            regex.lastIndex = 0
            const lineMatches: { index: number; length: number }[] = []
            let match

            while ((match = regex.exec(lineText)) !== null) {
              lineMatches.push({ index: match.index, length: match[0].length })
              if (regex.lastIndex === 0) break
            }

            if (lineMatches.length > 0) {
              fileMatches.push({ line: lineIdx + 1, text: lineText, matches: lineMatches })
            }
          })

          if (fileMatches.length > 0) {
            results.push({ path: relativePath, fullPath: filePath, matches: fileMatches })
          }
        } catch {}
      }

      return NextResponse.json({ results })
    }

    if (action === 'replace') {
      let filesModified = 0
      let occurrencesReplaced = 0

      for (const filePath of filteredFiles) {
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          regex.lastIndex = 0

          if (regex.test(content)) {
            regex.lastIndex = 0
            const matches = content.match(regex)
            const occurrences = matches ? matches.length : 0
            regex.lastIndex = 0
            const updatedContent = content.replace(regex, replaceWith || '')
            await fs.writeFile(filePath, updatedContent, 'utf-8')
            filesModified++
            occurrencesReplaced += occurrences
          }
        } catch {}
      }

      return NextResponse.json({ success: true, filesModified, occurrencesReplaced })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Search API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
