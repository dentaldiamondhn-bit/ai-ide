import { promises as fs } from 'fs'
import { join } from 'path'

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || '/home/dentaldiamondhn/ai-ide/workspace'

export async function ensureWorkspaceDir() {
  try {
    await fs.mkdir(WORKSPACE_DIR, { recursive: true })
  } catch (error) {
    console.error('Failed to create workspace dir:', error)
  }
}

export async function getWorkspacePath(relativePath?: string): Promise<string> {
  await ensureWorkspaceDir()
  return relativePath ? join(WORKSPACE_DIR, relativePath) : WORKSPACE_DIR
}

export interface FileInfo {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileInfo[]
}

export async function listDirectory(path: string): Promise<FileInfo[]> {
  const fullPath = await getWorkspacePath(path)
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    const files: FileInfo[] = []
    for (const entry of entries) {
      files.push({
        name: entry.name,
        path: path ? join(path, entry.name) : entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        children: entry.isDirectory() ? [] : undefined
      })
    }
    return files
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

export async function readFile(path: string): Promise<string> {
  const fullPath = await getWorkspacePath(path)
  return fs.readFile(fullPath, 'utf-8')
}

export async function writeFile(path: string, content: string): Promise<void> {
  const fullPath = await getWorkspacePath(path)
  const dir = join(fullPath, '..')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(fullPath, content, 'utf-8')
}

export async function createDirectory(path: string): Promise<void> {
  const fullPath = await getWorkspacePath(path)
  await fs.mkdir(fullPath, { recursive: true })
}

export async function deletePath(path: string): Promise<void> {
  const fullPath = await getWorkspacePath(path)
  const stat = await fs.stat(fullPath)
  if (stat.isDirectory()) {
    await fs.rm(fullPath, { recursive: true, force: true })
  } else {
    await fs.unlink(fullPath)
  }
}

export async function movePath(source: string, destination: string): Promise<void> {
  const sourcePath = await getWorkspacePath(source)
  const destPath = await getWorkspacePath(destination)
  const destDir = join(destPath, '..')
  await fs.mkdir(destDir, { recursive: true })
  await fs.rename(sourcePath, destPath)
}