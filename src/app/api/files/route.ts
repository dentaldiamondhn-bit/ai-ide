import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const PROJECT_ROOT = process.cwd()

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

async function buildFileTree(dirPath: string): Promise<FileNode[]> {
  const result: FileNode[] = []
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      if (['node_modules', '.git', '.next', 'dist', 'out', '.idea', '.vscode'].includes(entry.name)) {
        continue
      }
      
      const fullPath = path.join(dirPath, entry.name)
      
      if (entry.isDirectory()) {
        result.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          children: await buildFileTree(fullPath)
        })
      } else {
        result.push({
          name: entry.name,
          path: fullPath,
          isDirectory: false
        })
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error)
  }
  
  return result.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const targetPath = searchParams.get('root') || searchParams.get('path')

  if (action === 'read' && targetPath) {
    try {
      await fs.access(targetPath, fs.constants.R_OK)
      const content = await fs.readFile(targetPath, 'utf-8')
      return NextResponse.json({ content })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error reading file:', targetPath, error)
      return NextResponse.json({ error: message, path: targetPath }, { status: 500 })
    }
  }

  const defaultPath = targetPath || PROJECT_ROOT

  try {
    const parentPath = path.dirname(defaultPath)
    const fileTree = await buildFileTree(defaultPath)
    return NextResponse.json({ rootPath: defaultPath, parentPath: parentPath !== defaultPath ? parentPath : null, tree: fileTree })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}