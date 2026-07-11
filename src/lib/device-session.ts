'use client'

export interface DeviceInfo {
  id: string
  name: string
}

const STORAGE_KEY = 'ai-ide-device-session'

function getPlatformNickname(): string {
  if (typeof window === 'undefined') return 'Remote Server'

  const userAgent = window.navigator.userAgent.toLowerCase()
  let platform = 'Development Sandbox'

  if (userAgent.includes('windows')) {
    platform = 'Windows Dev PC'
  } else if (userAgent.includes('macintosh')) {
    platform = 'macOS Developer'
  } else if (userAgent.includes('linux')) {
    platform = userAgent.includes('chrome') ? 'Crostini Chromebook' : 'Linux Workstation'
  }

  const uniqueSuffix = Math.floor(1000 + Math.random() * 9000)
  return `${platform} (${uniqueSuffix})`
}

export function getOrCreateDeviceSession(): DeviceInfo {
  if (typeof window === 'undefined') {
    return { id: 'default', name: 'Server Instance' }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.id && parsed.name) {
        return parsed
      }
    }
  } catch (e) {
    console.error('Failed to parse active device session, generating fresh profile.', e)
  }

  const newId = `dev_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`
  const newSession: DeviceInfo = {
    id: newId,
    name: getPlatformNickname()
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession))
  } catch (e) {
    console.error('Failed to store device session in local storage', e)
  }

  return newSession
}

export function updateDeviceNickname(newName: string): DeviceInfo {
  const current = getOrCreateDeviceSession()
  const updated = { ...current, name: newName.trim() || current.name }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (e) {
    console.error('Failed to update local device label', e)
  }

  return updated
}
