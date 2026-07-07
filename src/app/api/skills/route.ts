import fs from 'fs/promises'
import type { Dirent } from 'fs'
import path from 'path'

const SKILLS_DIR = path.join(process.cwd(), '.agents', 'skills')

interface SkillMeta {
  name: string
  description: string
}

function parseYamlFrontmatter(content: string): Record<string, string> {
  const meta: Record<string, string> = {}
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return meta
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const key = line.slice(0, idx).trim()
      let val = line.slice(idx + 1).trim()
      val = val.replace(/^["']|["']$/g, '')
      meta[key] = val
    }
  }
  return meta
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const skillName = searchParams.get('skill')

  try {
    if (skillName) {
      const skillPath = path.join(SKILLS_DIR, skillName)
      const skillFile = path.join(skillPath, 'SKILL.md')
      try {
        const content = await fs.readFile(skillFile, 'utf-8')
        return Response.json({ name: skillName, content })
      } catch {
        return Response.json({ error: `Skill "${skillName}" not found` }, { status: 404 })
      }
    }

    let dirs: Dirent[] = []
    try {
      const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true })
      dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'))
    } catch {} // skills dir may not exist

    const skills: SkillMeta[] = []
    for (const dir of dirs) {
      try {
        const skillFile = path.join(SKILLS_DIR, dir.name, 'SKILL.md')
        const content = await fs.readFile(skillFile, 'utf-8')
        const meta = parseYamlFrontmatter(content)
        skills.push({
          name: meta.name || dir.name,
          description: meta.description || ''
        })
      } catch {
        skills.push({ name: dir.name, description: '' })
      }
    }

    const models = [
      { id: "minimaxai/minimax-m3", name: "MiniMax M3", provider: "NVIDIA" },
      { id: "z-ai/glm-5.2", name: "GLM 5.2", provider: "NVIDIA" },
      { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 3 Ultra 550B", provider: "NVIDIA" },
      { id: "moonshotai/kimi-k2.6", name: "Kimi K2.6", provider: "NVIDIA" },
      { id: "mistralai/mistral-medium-3.5-128b", name: "Mistral Medium 3.5 128B", provider: "NVIDIA" },
      { id: "stepfun-ai/step-3.7-flash", name: "Step 3.7 Flash", provider: "NVIDIA" },
      { id: "deepseek-ai/deepseek-v4-flash", name: "DeepSeek V4 Flash", provider: "NVIDIA" },
      { id: "deepseek-ai/deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "NVIDIA" },
      { id: "mistralai/mixtral-8x7b-instruct-v0.1", name: "Mixtral 8x7B", provider: "NVIDIA" },
      { id: "meta/llama-3.2-1b-instruct", name: "Llama 3.2 1B", provider: "NVIDIA" },
      { id: "meta/llama-3.1-70b-instruct", name: "Llama 3.1 70B", provider: "NVIDIA" },
      { id: "qwen/qwen3.5-122b-a10b", name: "Qwen 3.5 122B (A10B)", provider: "NVIDIA" },
    ]

    return Response.json({ skills, models })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
