import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

function getWorkspacePath() {
  return process.cwd()
}

interface WikiPage {
  title: string
  category: string
  summary: string
  content: string
  fileName: string
}

function inferCategory(content: string, fileName: string): string {
  const lower = (content + fileName).toLowerCase()
  if (lower.includes('architecture') || lower.includes('structure') || lower.includes('layout')) return 'architecture'
  if (lower.includes('api') || lower.includes('endpoint') || lower.includes('route')) return 'api'
  return 'guides'
}

export async function GET() {
  try {
    const workspacePath = getWorkspacePath()
    const wikiDir = path.join(workspacePath, '.wiki')

    let entries: string[] = []
    try {
      entries = await fs.readdir(wikiDir)
    } catch {
      // Create .wiki directory with a starter page
      await fs.mkdir(wikiDir, { recursive: true })
      const starter = `# Welcome to CodeWiki\n\nThis is your project documentation hub.\n\n## Getting Started\n\nCreate markdown files in the \`.wiki/\` folder to add documentation pages.\n\n## Features\n\n- Category-based organization\n- Live markdown preview\n- Local file-based storage\n`
      await fs.writeFile(path.join(wikiDir, 'welcome.md'), starter, 'utf-8')
      entries = ['welcome.md']
    }

    const mdFiles = entries.filter(f => f.endsWith('.md'))
    const pages: WikiPage[] = []

    for (const fileName of mdFiles) {
      try {
        const content = await fs.readFile(path.join(wikiDir, fileName), 'utf-8')
        const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('#'))
        const title = content.match(/^#\s+(.+)/m)?.[1] || fileName.replace('.md', '')

        pages.push({
          title,
          category: inferCategory(content, fileName),
          summary: firstLine?.slice(0, 120) || '',
          content,
          fileName
        })
      } catch {}
    }

    return NextResponse.json({ pages })
  } catch (error: any) {
    return NextResponse.json({ pages: [] })
  }
}

export async function POST(request: Request) {
  try {
    const workspacePath = getWorkspacePath()
    const wikiDir = path.join(workspacePath, '.wiki')
    await fs.mkdir(wikiDir, { recursive: true })

    const { fileName, content } = await request.json()
    if (!fileName || !content) {
      return NextResponse.json({ error: 'fileName and content required' }, { status: 400 })
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    await fs.writeFile(path.join(wikiDir, safeName), content, 'utf-8')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const workspacePath = getWorkspacePath()
    const { fileName } = await request.json()
    const safeName = fileName.replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    await fs.unlink(path.join(workspacePath, '.wiki', safeName))
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
