import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import util from 'util'

const execPromise = util.promisify(exec)
const WORKSPACE_ROOT = process.cwd()

export async function GET() {
  try {
    const { stdout } = await execPromise('git status --porcelain=v1', { cwd: WORKSPACE_ROOT, timeout: 5000 })
    const lines = stdout.trim().split('\n').filter(Boolean)

    const statusMap: Record<string, string> = {}
    for (const line of lines) {
      const indexStatus = line[0]
      const workStatus = line[1]
      const filePath = line.slice(3)

      if (indexStatus === '?' && workStatus === '?') {
        statusMap[filePath] = 'untracked'
      } else if (indexStatus === '!' && workStatus === '!') {
        statusMap[filePath] = 'ignored'
      } else if (indexStatus === ' ' && workStatus === ' ') {
        statusMap[filePath] = 'clean'
      } else {
        statusMap[filePath] = 'modified'
      }
    }

    let branch = 'main'
    try {
      const { stdout: branchOut } = await execPromise('git rev-parse --abbrev-ref HEAD', { cwd: WORKSPACE_ROOT, timeout: 3000 })
      branch = branchOut.trim()
    } catch {}

    return NextResponse.json({ statuses: statusMap, branch })
  } catch {
    return NextResponse.json({ statuses: {}, branch: 'main' })
  }
}
