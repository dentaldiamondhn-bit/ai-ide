import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import util from 'util'
import path from 'path'

const execPromise = util.promisify(exec)

function getWorkspacePath() {
  return process.cwd()
}

export async function GET(request: Request) {
  const workspacePath = getWorkspacePath()
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    if (action === 'branch') {
      const { stdout } = await execPromise('git branch --show-current', { cwd: workspacePath, timeout: 5000 })
      return NextResponse.json({ branch: stdout.trim() || 'detached' })
    }

    if (action === 'status') {
      const [statusRes, branchRes] = await Promise.all([
        execPromise('git status --porcelain', { cwd: workspacePath, timeout: 5000 }),
        execPromise('git branch --show-current', { cwd: workspacePath, timeout: 5000 })
      ])

      const lines = statusRes.stdout.split('\n').filter(Boolean)
      const changes = lines.map(line => {
        const statusX = line[0]
        const statusY = line[1]
        const filePath = line.slice(3).trim()

        let isStaged = false
        let isUnstaged = false
        let type: 'modified' | 'untracked' | 'deleted' | 'added' = 'modified'

        if (statusX !== ' ' && statusX !== '?') isStaged = true
        if (statusY !== ' ') isUnstaged = true

        if (statusX === '?' && statusY === '?') {
          type = 'untracked'
        } else if (statusX === 'A' || statusY === 'A') {
          type = 'added'
        } else if (statusX === 'D' || statusY === 'D') {
          type = 'deleted'
        }

        return { path: filePath, isStaged, isUnstaged, type }
      })

      return NextResponse.json({
        branch: branchRes.stdout.trim() || 'main',
        changes
      })
    }

    return NextResponse.json({ error: 'Invalid GET action' }, { status: 400 })
  } catch (error: any) {
    console.error('Git API GET Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const workspacePath = getWorkspacePath()

  try {
    const { action, payload } = await request.json()

    if (action === 'stage') {
      const fileTarget = payload.path === '.' ? '.' : `"${payload.path}"`
      await execPromise(`git add ${fileTarget}`, { cwd: workspacePath, timeout: 5000 })
      return NextResponse.json({ success: true })
    }

    if (action === 'unstage') {
      const fileTarget = payload.path === '.' ? 'HEAD' : `HEAD "${payload.path}"`
      await execPromise(`git reset ${fileTarget}`, { cwd: workspacePath, timeout: 5000 })
      return NextResponse.json({ success: true })
    }

    if (action === 'discard') {
      await execPromise(`git restore "${payload.path}"`, { cwd: workspacePath, timeout: 5000 })
      return NextResponse.json({ success: true })
    }

    if (action === 'commit') {
      if (!payload.message?.trim()) {
        return NextResponse.json({ error: 'Commit message is required' }, { status: 400 })
      }
      const cleanMsg = payload.message.replace(/"/g, '\\"')
      const { stdout } = await execPromise(`git commit -m "${cleanMsg}"`, { cwd: workspacePath, timeout: 10000 })
      return NextResponse.json({ success: true, log: stdout })
    }

    if (action === 'push') {
      const { stdout } = await execPromise('git push', { cwd: workspacePath, timeout: 30000 })
      return NextResponse.json({ success: true, log: stdout })
    }

    return NextResponse.json({ error: 'Invalid POST action' }, { status: 400 })
  } catch (error: any) {
    console.error('Git API POST Error:', error)
    return NextResponse.json({ error: error.stderr || error.message }, { status: 500 })
  }
}
