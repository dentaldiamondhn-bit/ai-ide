import { NextResponse } from 'next/server'
import os from 'os'
import path from 'path'

export async function GET() {
  try {
    const platform = os.platform()
    const homedir = os.homedir()
    const username = os.userInfo().username

    let defaultWorkspaceRoot = homedir

    if (platform === 'win32') {
      defaultWorkspaceRoot = path.join(homedir, 'Documents')
    } else if (platform === 'darwin') {
      defaultWorkspaceRoot = path.join(homedir, 'Developer')
    }

    return NextResponse.json({
      success: true,
      platform,
      osLabel: platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux',
      username,
      homedir,
      defaultWorkspaceRoot: defaultWorkspaceRoot.replace(/\\/g, '/'),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message, defaultWorkspaceRoot: '/home' },
      { status: 500 }
    )
  }
}
