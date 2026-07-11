'use client'

export interface LocalFileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: LocalFileNode[]
  handle: FileSystemHandle
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function verifyPermission(
  fileHandle: FileSystemHandle,
  readWrite: boolean = true
): Promise<boolean> {
  const options = {
    mode: readWrite ? 'readwrite' as const : 'read' as const,
  }
  try {
    const handle = fileHandle as any
    if ((await handle.queryPermission(options)) === 'granted') return true
    if ((await handle.requestPermission(options)) === 'granted') return true
    return false
  } catch {
    return false
  }
}

const EXCLUDED_NAMES = new Set(['node_modules', '.git', '.next', 'dist', 'out', '.vscode', '.idea'])

export async function mapLocalDirectory(
  dirHandle: FileSystemDirectoryHandle,
  currentPath: string = ''
): Promise<LocalFileNode[]> {
  const nodes: LocalFileNode[] = []
  try {
    const h = dirHandle as any
    for await (const entry of h.values()) {
      if (EXCLUDED_NAMES.has(entry.name)) continue
      const nodePath = currentPath ? `${currentPath}/${entry.name}` : entry.name
      const isDirectory = entry.kind === 'directory'
      const node: LocalFileNode = {
        name: entry.name,
        path: nodePath,
        isDirectory,
        handle: entry,
      }
      if (isDirectory) {
        node.children = await mapLocalDirectory(entry as FileSystemDirectoryHandle, nodePath)
      }
      nodes.push(node)
    }
  } catch (error) {
    console.error(`Error mapping local directory at ${currentPath}:`, error)
  }
  return nodes.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
}

export async function readLocalFile(fileHandle: FileSystemFileHandle): Promise<string> {
  const file = await fileHandle.getFile()
  return await file.text()
}

export async function writeLocalFile(fileHandle: FileSystemFileHandle, content: string): Promise<boolean> {
  try {
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
    return true
  } catch (error) {
    console.error(`Failed to write local file ${fileHandle.name}:`, error)
    return false
  }
}

export async function createLocalResource(
  parentDirHandle: FileSystemDirectoryHandle,
  name: string,
  type: 'file' | 'directory'
): Promise<FileSystemHandle> {
  if (type === 'file') {
    return await parentDirHandle.getFileHandle(name, { create: true })
  } else {
    return await parentDirHandle.getDirectoryHandle(name, { create: true })
  }
}

export async function deleteLocalResource(
  parentDirHandle: FileSystemDirectoryHandle,
  name: string
): Promise<boolean> {
  try {
    await parentDirHandle.removeEntry(name, { recursive: true })
    return true
  } catch (error) {
    console.error(`Failed to delete ${name}:`, error)
    return false
  }
}

/**
 * Find the directory handle that contains a given file path.
 * Walks the tree to locate the deepest matching directory.
 */
export function findDirHandle(
  rootHandle: FileSystemDirectoryHandle,
  filePath: string,
  tree: LocalFileNode[]
): FileSystemDirectoryHandle | null {
  const parts = filePath.split('/')
  // Remove the file name, we want the parent directory
  const dirParts = parts.slice(0, -1)

  let current: LocalFileNode[] = tree
  let lastDirHandle: FileSystemDirectoryHandle | null = rootHandle

  for (const part of dirParts) {
    const found = current.find(n => n.name === part && n.isDirectory)
    if (found && found.children) {
      lastDirHandle = found.handle as FileSystemDirectoryHandle
      current = found.children
    } else {
      return lastDirHandle
    }
  }
  return lastDirHandle
}

/**
 * Find a file handle in the tree by path.
 */
export function findFileHandle(
  tree: LocalFileNode[],
  filePath: string
): FileSystemFileHandle | null {
  const parts = filePath.split('/')
  let current: LocalFileNode[] = tree

  for (let i = 0; i < parts.length; i++) {
    const found = current.find(n => n.name === parts[i])
    if (!found) return null
    if (i === parts.length - 1 && !found.isDirectory) {
      return found.handle as FileSystemFileHandle
    }
    if (found.children) {
      current = found.children
    }
  }
  return null
}

/**
 * Find a directory handle in the tree by path.
 */
export function findDirHandleByPath(
  tree: LocalFileNode[],
  dirPath: string
): FileSystemDirectoryHandle | null {
  const parts = dirPath.split('/')
  let current: LocalFileNode[] = tree

  for (let i = 0; i < parts.length; i++) {
    const found = current.find(n => n.name === parts[i] && n.isDirectory)
    if (!found) return null
    if (i === parts.length - 1) {
      return found.handle as FileSystemDirectoryHandle
    }
    if (found.children) {
      current = found.children
    }
  }
  return null
}

// ── IndexedDB persistence for directory handle ───────────────────

const DB_NAME = 'ia-ide-fs'
const DB_STORE = 'handles'
const DIR_KEY = 'root-dir-handle'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function persistDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put(handle, DIR_KEY)
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
    db.close()
  } catch {}
}

export async function restoreDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(DB_STORE, 'readonly')
    const req = tx.objectStore(DB_STORE).get(DIR_KEY)
    const handle = await new Promise<any>((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
    db.close()
    if (!handle) return null
    const granted = await verifyPermission(handle, true)
    if (!granted) return null
    return handle
  } catch {
    return null
  }
}
