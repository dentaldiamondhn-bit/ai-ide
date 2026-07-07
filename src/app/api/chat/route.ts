import fs from 'fs/promises'
import { exec, spawn } from 'child_process'
import util from 'util'
import path from 'path'
import axios from 'axios'
import DiffMatchPatch from 'diff-match-patch'
import jscodeshift from 'jscodeshift'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

const execPromise = util.promisify(exec)
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'

const MAX_AGENT_STEPS = 100
const MAX_CONVERSATION_TOKENS = 120000
const WORKSPACE_ROOT = process.cwd()

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

function pruneConversation(messages: any[], maxTokens: number): any[] {
  let totalTokens = messages.reduce((sum, m) => sum + estimateTokens(JSON.stringify(m)), 0)
  if (totalTokens <= maxTokens) return messages

  const systemMsg = messages[0]
  const otherMsgs = messages.slice(1)
  
  let pruned = otherMsgs
  while (pruned.length > 2) {
    const tokens = estimateTokens(JSON.stringify([systemMsg, ...pruned]))
    if (tokens <= maxTokens) break
    pruned = pruned.slice(1)
  }
  
  return [systemMsg, ...pruned]
}
const SKILLS_DIR = path.join(process.cwd(), '.agents', 'skills')

function parseYamlFrontmatter(content: string): Record<string, any> {
  const meta: Record<string, any> = {}
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return meta
  let currentKey = ''
  for (const line of match[1].split('\n')) {
    const listMatch = line.match(/^\s+-\s+(.+)/)
    if (listMatch) {
      if (currentKey) {
        if (!meta[currentKey]) meta[currentKey] = []
        meta[currentKey].push(listMatch[1].replace(/^["']|["']$/g, ''))
      }
      continue
    }
    const idx = line.indexOf(':')
    if (idx > 0) {
      currentKey = line.slice(0, idx).trim()
      let val = line.slice(idx + 1).trim()
      val = val.replace(/^["']|["']$/g, '')
      meta[currentKey] = val
    }
  }
  return meta
}

async function syncSkillToSupabase(filePath: string, userId?: string | null): Promise<void> {
  try {
    const relative = path.relative(SKILLS_DIR, filePath)
    const parts = relative.split(path.sep)
    if (parts.length < 2 || parts[1] !== 'SKILL.md') return
    const slug = parts[0]
    const content = await fs.readFile(filePath, 'utf-8')
    const meta = parseYamlFrontmatter(content)
    const prompt = content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim()
    const name = meta.name || slug
    const { data: existing } = await supabaseAdmin.from('skills').select('id').eq('name', name).maybeSingle()
    if (existing) {
      await supabaseAdmin.from('skills').update({
        description: meta.description || '',
        prompt,
        category: meta.category || '',
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabaseAdmin.from('skills').insert({
        name,
        description: meta.description || '',
        prompt,
        category: meta.category || '',
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        is_public: true,
        created_by: userId || '00000000-0000-0000-0000-000000000000',
        version: 1,
      })
    }
  } catch {}
}

async function deleteSkillFromSupabase(skillDir: string): Promise<void> {
  try {
    const slug = path.basename(skillDir)
    const { data: existing } = await supabaseAdmin.from('skills').select('id, name').eq('name', slug).maybeSingle()
    if (existing) {
      await supabaseAdmin.from('skills').delete().eq('id', existing.id)
    } else {
      const skillFile = path.join(skillDir, 'SKILL.md')
      const content = await fs.readFile(skillFile, 'utf-8')
      const meta = parseYamlFrontmatter(content)
      const name = meta.name || slug
      await supabaseAdmin.from('skills').delete().eq('name', name)
    }
  } catch {}
}
const SYSTEM_PROMPT = `You are an autonomous AI coding agent in a web IDE. Your job is to fulfill the user's exact request by taking real actions with tool calls.

AVAILABLE TOOLS:
- read_file(path) — read a file's content
- write_file(path, content) — create or overwrite a file
- edit_file(path, oldString, newString) — make a targeted edit by finding and replacing text
- apply_patch(path, patch) — apply a diff-match-patch formatted patch for conflict-free merging
- modify_react_component_ast(path, action, payload) — surgically insert React hooks, state, or imports via AST parsing
- run_command(command, workdir?) — execute a shell command
- list_files(path?) — list directory contents (defaults to project root)

RULES:
1. Only do what the user explicitly asks. Do not explore, fix, or modify files unless the user requests it.
2. If the user asks to list files, just list them — do not read every file or make changes.
3. If the user asks a question, answer it directly. Do not make unnecessary tool calls.
4. When you DO need to act, always prefer tool calls over describing what could be done.
5. Read a file before editing it.
6. Never use placeholders or TODO comments — write complete, working code.
7. After modifying files, verify with a build/lint/test command if available.
8. Never run create-* scaffolding tools; create files directly with write_file.
9. Prefer npx over global npm installs.
10. Keep responses concise — the step output shows what you did.
11. If a tool fails, diagnose the error and retry with a different approach.
12. Before each tool call, explain your reasoning step by step in text. Your analysis and thought process should be visible before you take any action.
13. For file edits, prefer using edit_file (targeted search-and-replace) over write_file. Never use sed, awk, perl, or python to edit files — always use the edit_file or write_file tools instead.
14. Use create_skill to persist reusable instructions, patterns, or workflows to the skills database. Use delete_skill to remove them. These tools dual-write to both the local filesystem and Supabase for persistence across sessions.`

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read the full contents of a file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to workspace root (e.g. 'src/app/page.tsx')" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description: "Create a new file or overwrite an existing file with new content.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to workspace root" },
          content: { type: "string", description: "The complete file content to write" }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "run_command",
      description: "Execute a shell command. Defaults to project root; use workdir to run in a subdirectory.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The shell command to execute" },
          workdir: { type: "string", description: "Working directory (absolute or relative to project root). Defaults to project root." }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "edit_file",
      description: "Edit a file by finding a unique string and replacing it. Use this for targeted edits instead of writing the whole file. Always read the file first to find exact text to match.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to workspace root" },
          oldString: { type: "string", description: "The exact text to find (must be unique in the file)" },
          newString: { type: "string", description: "The replacement text" }
        },
        required: ["path", "oldString", "newString"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "list_files",
      description: "List files and directories at a given path.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path relative to workspace root" }
        },
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "apply_patch",
      description: "Apply a structured diff patch to a file using Google's diff-match-patch. The patch text must be in diff-match-patch's patch format (use patch_toText output). Always read the file first before generating the patch.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to workspace root" },
          patch: { type: "string", description: "The patch text in diff-match-patch format" }
        },
        required: ["path", "patch"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "modify_react_component_ast",
      description: "Surgically insert React hooks, state variables, or imports into a component using AST parsing. Supports ADD_IMPORT, ADD_STATE, and ADD_USE_EFFECT actions. Prevents syntax breakage.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the .tsx/.ts/.jsx/.js file" },
          action: { type: "string", enum: ["ADD_IMPORT", "ADD_STATE", "ADD_USE_EFFECT"], description: "AST operation to perform" },
          payload: { type: "object", description: "Details for the operation. For ADD_IMPORT: {source, specifier?, defaultSpecifier?}. For ADD_STATE: {name, defaultValue?}. For ADD_USE_EFFECT: {deps?: string[]}." }
        },
        required: ["path", "action", "payload"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "create_skill",
      description: "Create or update a persistent skill in both the local filesystem and Supabase database. The skill will be available on app reload. Use this to save reusable instructions, patterns, or workflows the agent should remember.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Human-readable skill name (e.g. 'React Testing Patterns')" },
          description: { type: "string", description: "Brief one-line description" },
          prompt: { type: "string", description: "Full skill instructions / system prompt content" },
          category: { type: "string", description: "Optional category (e.g. 'react', 'testing', 'workflow')" },
          tags: { type: "array", items: { type: "string" }, description: "Optional tags array" }
        },
        required: ["name", "description", "prompt"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "delete_skill",
      description: "Delete a persistent skill from both the local filesystem and Supabase database.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the skill to delete" }
        },
        required: ["name"]
      }
    }
  }
]

interface AnimationData {
  path: string
  insertions: number
  deletions: number
}

interface ToolOutput {
  output: string
  filesModified: string[]
  commandsRun: string[]
  insertions: number
  deletions: number
  animationData?: AnimationData[]
}

async function executeTool(name: string, args: Record<string, unknown>, workspaceRoot?: string, onOutput?: (text: string) => void, clerkUserId?: string | null): Promise<ToolOutput> {
  const result: ToolOutput = { output: "", filesModified: [], commandsRun: [], insertions: 0, deletions: 0 }
  const root = workspaceRoot || WORKSPACE_ROOT
  const resolvePath = (p: string) => path.isAbsolute(p) ? p : path.join(root, p)

  if (name === "read_file") {
    try {
      const filePath = resolvePath(args.path as string)
      const content = await fs.readFile(filePath, "utf-8")
      result.output = content
    } catch (err: any) {
      result.output = `ERROR: Could not read file "${args.path}": ${err.message}`
    }
  } else if (name === "write_file") {
    const filePath = resolvePath(args.path as string)
    const content = args.content as string
    const newLines = content.split("\n")
    try {
      const existing = await fs.readFile(filePath, "utf-8")
      const oldLines = existing.split("\n")
      result.insertions = Math.max(0, newLines.length - oldLines.length)
      result.deletions = Math.max(0, oldLines.length - newLines.length)
      if (result.insertions === 0 && result.deletions === 0 && existing !== content) {
        result.insertions = 1; result.deletions = 1
      }
    } catch {
      result.insertions = newLines.length
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, "utf-8")
    result.output = `Wrote ${newLines.length} lines to ${args.path}`
    result.filesModified.push(args.path as string)
    result.animationData = [{ path: args.path as string, insertions: result.insertions, deletions: result.deletions }]
    syncSkillToSupabase(filePath, clerkUserId)
  } else if (name === "run_command") {
    let cmd = args.command as string
    let workdir = args.workdir ? (path.isAbsolute(args.workdir as string) ? args.workdir as string : path.join(root, args.workdir as string)) : root
    const scaffolding = ["create-next-app", "create-react-app", "create-vite", "create-nx", "create-t3-app", "create-remix", "create-vue", "create-svelte"]
    if (scaffolding.some(s => cmd.includes(s))) {
      result.output = "BLOCKED: Scaffolding tools (create-*) are disabled."
      return result
    }
    if (cmd.includes("npm install") && !cmd.includes("--legacy-peer-deps")) cmd = `${cmd} --legacy-peer-deps`
    const dangerous = ["rm -rf /", "rm -rf /*", ":(){", "mkfs", "dd if=", "shutdown", "reboot", "halt", "poweroff", "sed -i", "sed -i."]
    if (dangerous.some(p => cmd.toLowerCase().includes(p))) {
      result.output = "BLOCKED: This command violates safety protocols."
    } else if (onOutput) {
      result.output = await new Promise<string>((resolve) => {
        const child = spawn(cmd, [], { cwd: workdir, shell: true, env: { ...process.env, TERM: 'xterm-256color' }, stdio: ['pipe', 'pipe', 'pipe'] })
        let fullOutput = ''
        const onData = (data: Buffer) => {
          const text = data.toString()
          fullOutput += text
          onOutput(text)
        }
        child.stdout.on('data', onData)
        child.stderr.on('data', onData)
        child.on('close', (code) => {
          result.commandsRun.push(cmd)
          resolve(fullOutput || `(exit code ${code})`)
        })
        child.on('error', (err) => {
          result.commandsRun.push(cmd)
          resolve(`COMMAND FAILED: ${err.message}`)
        })
      })
    } else {
      try {
        const { stdout, stderr } = await execPromise(cmd, { cwd: workdir, maxBuffer: 10 * 1024 * 1024, timeout: 120000 })
        result.output = stdout || stderr || "(no output)"
        if (stderr) result.output += `\n\nSTDERR:\n${stderr}`
        result.commandsRun.push(cmd)
      } catch (err: any) {
        result.output = `COMMAND FAILED:\n${err.stderr || err.message}`
        result.commandsRun.push(cmd)
      }
    }
  } else if (name === "edit_file") {
    const filePath = resolvePath(args.path as string)
    const oldString = args.oldString as string
    const newString = args.newString as string
    try {
      const content = await fs.readFile(filePath, "utf-8")
      const idx = content.indexOf(oldString)
      if (idx === -1) {
        result.output = `ERROR: Could not find the specified text to replace in "${args.path}". The text must match exactly.`
      } else if (content.indexOf(oldString, idx + 1) !== -1) {
        result.output = `ERROR: Found multiple matches for the specified text in "${args.path}". Provide more surrounding context to make the match unique.`
      } else {
        const newContent = content.replace(oldString, newString)
        await fs.writeFile(filePath, newContent, "utf-8")
        const oldLines = content.split("\n").length
        const newLines = newContent.split("\n").length
        result.insertions = Math.max(0, newLines - oldLines)
        result.deletions = Math.max(0, oldLines - newLines)
        result.output = `Applied edit to ${args.path}`
        result.filesModified.push(args.path as string)
        result.animationData = [{ path: args.path as string, insertions: result.insertions, deletions: result.deletions }]
      }
    } catch (err: any) {
      result.output = `ERROR: Could not edit file "${args.path}": ${err.message}`
    }
  } else if (name === "apply_patch") {
    const filePath = resolvePath(args.path as string)
    const patchText = args.patch as string
    try {
      const dmp = new DiffMatchPatch()
      const currentContent = await fs.readFile(filePath, "utf-8")
      const patches = dmp.patch_fromText(patchText)
      const [updatedContent, results] = dmp.patch_apply(patches, currentContent)
      if (results.every(r => r === true)) {
        await fs.writeFile(filePath, updatedContent, "utf-8")
        const oldLines = currentContent.split("\n").length
        const newLines = updatedContent.split("\n").length
        result.insertions = Math.max(0, newLines - oldLines)
        result.deletions = Math.max(0, oldLines - newLines)
        result.output = `Patch cleanly merged to ${args.path} (${result.insertions} ins, ${result.deletions} del)`
        result.filesModified.push(args.path as string)
        result.animationData = [{ path: args.path as string, insertions: result.insertions, deletions: result.deletions }]
      } else {
        const failCount = results.filter(r => !r).length
        result.output = `ERROR: Patch merge failed for "${args.path}": ${failCount} conflict(s) detected. Generate a full rewrite instead.`
      }
    } catch (err: any) {
      result.output = `ERROR: Could not apply patch to "${args.path}": ${err.message}`
    }
  } else if (name === "modify_react_component_ast") {
    const filePath = resolvePath(args.path as string)
    const action = args.action as string
    const payload = args.payload as Record<string, any>
    try {
      const content = await fs.readFile(filePath, "utf-8")
      const ext = path.extname(filePath).toLowerCase()
      const parser = ext === ".tsx" || ext === ".jsx" ? "tsx" : ext === ".ts" ? "ts" : "babylon"
      const j = jscodeshift.withParser(parser)
      const root = j(content)

      if (action === "ADD_IMPORT") {
        const src = payload.source as string
        if (!src) throw new Error("payload.source is required for ADD_IMPORT")
        const specifiers: any[] = []
        if (payload.defaultSpecifier) specifiers.push(j.importDefaultSpecifier(j.identifier(payload.defaultSpecifier)))
        if (payload.specifier) specifiers.push(j.importSpecifier(j.identifier(payload.specifier)))
        const newImport = j.importDeclaration(specifiers, j.literal(src))
        const existingImports = root.find(j.ImportDeclaration)
        if (existingImports.length > 0) {
          existingImports.at(-1).insertAfter(newImport)
        } else {
          root.get().node.program.body.unshift(newImport)
        }
      } else if (action === "ADD_STATE") {
        const stateName = payload.name as string
        if (!stateName) throw new Error("payload.name is required for ADD_STATE")
        const setterName = `set${stateName.charAt(0).toUpperCase()}${stateName.slice(1)}`
        const defaultValue = payload.defaultValue
        const stateDecl = j.variableDeclaration("const", [
          j.variableDeclarator(
            j.arrayPattern([j.identifier(stateName), j.identifier(setterName)]),
            j.callExpression(j.identifier("useState"), [defaultValue !== undefined ? j.literal(defaultValue) : j.identifier("undefined")])
          )
        ])
        const firstFn = root.find(j.FunctionDeclaration).filter(p => !!p.value.id).paths()[0]
        if (firstFn?.value?.body) {
          const body = firstFn.value.body.body
          const returnIdx = body.findIndex((s: any) => s.type === "ReturnStatement")
          if (returnIdx >= 0) body.splice(returnIdx, 0, stateDecl)
          else body.unshift(stateDecl)
        }
      } else if (action === "ADD_USE_EFFECT") {
        const deps = payload.deps as string[] | undefined
        const useEffectCall = j.expressionStatement(
          j.callExpression(j.identifier("useEffect"), [
            j.arrowFunctionExpression([], j.blockStatement([]), false),
            deps ? j.arrayExpression(deps.map((d: string) => j.identifier(d))) : j.arrayExpression([])
          ])
        )
        const firstFn = root.find(j.FunctionDeclaration).filter(p => !!p.value.id).paths()[0]
        if (firstFn?.value?.body) {
          firstFn.value.body.body.push(useEffectCall)
        }
      } else {
        throw new Error(`Unknown action: ${action}. Supported: ADD_IMPORT, ADD_STATE, ADD_USE_EFFECT`)
      }

      const modified = root.toSource()
      await fs.writeFile(filePath, modified, "utf-8")
      const oldLines = content.split("\n").length
      const newLines = modified.split("\n").length
      result.insertions = Math.max(0, newLines - oldLines)
      result.deletions = Math.max(0, oldLines - newLines)
      result.output = `AST Edit: Applied ${action} to ${args.path} (${result.insertions} ins, ${result.deletions} del)`
      result.filesModified.push(args.path as string)
      result.animationData = [{ path: args.path as string, insertions: result.insertions, deletions: result.deletions }]
    } catch (err: any) {
      result.output = `ERROR: Could not apply AST edit to "${args.path}": ${err.message}`
    }
  } else if (name === "list_files") {
    try {
      const dirPath = args.path ? resolvePath(args.path as string) : root
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const items = entries.filter(e => !["node_modules", ".git", ".next"].includes(e.name)).map(e => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`)
      result.output = items.length > 0 ? items.join("\n") : "(empty directory)"
    } catch (err: any) {
      result.output = `ERROR: Could not list "${args.path || '/'}": ${err.message}`
    }
  } else if (name === "create_skill") {
    const name = args.name as string
    const description = args.description as string
    const prompt = args.prompt as string
    const category = (args.category as string) || ''
    const tags = (args.tags as string[]) || []
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skill'
      const skillDir = path.join(SKILLS_DIR, slug)
      await fs.mkdir(skillDir, { recursive: true })
      const frontmatter = [
        '---',
        `name: "${name}"`,
        `description: "${description}"`,
        `category: "${category}"`,
        'tags:',
        ...tags.map(t => `  - "${t}"`),
        '---',
        ''
      ].join('\n')
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), frontmatter + prompt, 'utf-8')
      await syncSkillToSupabase(path.join(skillDir, 'SKILL.md'), clerkUserId)
      result.output = `Skill "${name}" created and persisted to database.`
      result.filesModified.push(`.agents/skills/${slug}/SKILL.md`)
    } catch (err: any) {
      result.output = `ERROR: Could not create skill "${name}": ${err.message}`
    }
  } else if (name === "delete_skill") {
    const name = args.name as string
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skill'
      const skillDir = path.join(SKILLS_DIR, slug)
      await fs.rm(skillDir, { recursive: true, force: true })
      await deleteSkillFromSupabase(skillDir)
      result.output = `Skill "${name}" deleted from filesystem and database.`
    } catch (err: any) {
      result.output = `ERROR: Could not delete skill "${name}": ${err.message}`
    }
  }
  return result
}

const NVIDIA_MODEL_CONFIG: Record<string, { envKey: string; supportsTools: boolean; payload?: Record<string, any> }> = {
  'minimaxai/minimax-m3': {
    envKey: 'NVIDIA_API_KEY_MINIMAX',
    supportsTools: true,
    payload: { max_tokens: 8192, temperature: 1.0, top_p: 0.95 },
  },
  'z-ai/glm-5.2': {
    envKey: 'NVIDIA_API_KEY_GLM',
    supportsTools: true,
    payload: { max_tokens: 16384, temperature: 1, top_p: 1, seed: 42 },
  },
  'nvidia/nemotron-3-ultra-550b-a55b': {
    envKey: 'NVIDIA_API_KEY_NEMOTRON',
    supportsTools: true,
    payload: { max_tokens: 16384, temperature: 1, top_p: 0.95, reasoning_budget: 16384, chat_template_kwargs: { enable_thinking: true } },
  },
  'moonshotai/kimi-k2.6': {
    envKey: 'NVIDIA_API_KEY_KIMI',
    supportsTools: true,
    payload: { max_tokens: 16384, temperature: 1.0, top_p: 1.0 },
  },
  'mistralai/mistral-medium-3.5-128b': {
    envKey: 'NVIDIA_API_KEY_MISTRAL_MEDIUM',
    supportsTools: true,
    payload: { max_tokens: 16384, temperature: 0.70, top_p: 1.0, reasoning_effort: 'high' },
  },
  'stepfun-ai/step-3.7-flash': {
    envKey: 'NVIDIA_API_KEY_STEP',
    supportsTools: true,
    payload: { max_tokens: 16384, temperature: 1.0, top_p: 0.95 },
  },
  'deepseek-ai/deepseek-v4-flash': {
    envKey: 'NVIDIA_API_KEY_DEEPSEEK_FLASH',
    supportsTools: true,
    payload: { max_tokens: 16384, temperature: 1, top_p: 0.95, chat_template_kwargs: { thinking: true, reasoning_effort: 'high' } },
  },
  'deepseek-ai/deepseek-v4-pro': {
    envKey: 'NVIDIA_API_KEY_DEEPSEEK_PRO',
    supportsTools: true,
    payload: { max_tokens: 16384, temperature: 1, top_p: 0.95, chat_template_kwargs: { thinking: false } },
  },
  'mistralai/mixtral-8x7b-instruct-v0.1': {
    envKey: 'NVIDIA_API_KEY_MIXTRAL',
    supportsTools: false,
    payload: { max_tokens: 1024, temperature: 0.5, top_p: 1 },
  },
  'meta/llama-3.2-1b-instruct': {
    envKey: 'NVIDIA_API_KEY_LLAMA32_1B',
    supportsTools: false,
    payload: { max_tokens: 1024, temperature: 0.2, top_p: 0.7 },
  },
  'meta/llama-3.1-70b-instruct': {
    envKey: 'NVIDIA_API_KEY_LLAMA31_70B',
    supportsTools: true,
    payload: { max_tokens: 1024, temperature: 0.2, top_p: 0.7 },
  },
  'qwen/qwen3.5-122b-a10b': {
    envKey: 'NVIDIA_API_KEY_QWEN35',
    supportsTools: true,
    payload: { max_tokens: 16384, temperature: 0.60, top_p: 0.95 },
  },
}

async function callNVIDIA(messages: any[], forceTools?: boolean, skillInject?: string, modelId?: string) {
  const mid = modelId || 'minimaxai/minimax-m3'
  const cfg = NVIDIA_MODEL_CONFIG[mid] || NVIDIA_MODEL_CONFIG['minimaxai/minimax-m3']
  const apiKey = process.env[cfg.envKey]
  if (!apiKey) throw new Error(`No API key for model ${mid} (expected env ${cfg.envKey})`)

  const sysContent = skillInject ? SYSTEM_PROMPT + skillInject : SYSTEM_PROMPT
  const payload: any = {
    model: mid,
    messages: [{ role: 'system', content: sysContent }, ...messages],
    stream: false,
    ...cfg.payload,
  }
  if (cfg.supportsTools) {
    payload.tools = TOOLS
    if (forceTools) payload.tool_choice = 'required'
  } else {
    payload.messages[0].content += "\n\nNOTE: You cannot use tool calls. Respond in plain text."
  }
  try {
    const res = await axios.post(NVIDIA_API_URL, payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      }
    })
    return res.data
  } catch (err: any) {
    const msg = err?.response?.data?.error?.message || err?.message || ''
    const status = err?.response?.status
    if (status === 400 && (msg.includes('tool_use_failed') || msg.includes('not support') || msg.includes('tool_calls') || msg.includes('tool choice'))) {
      delete payload.tools; delete payload.tool_choice
      payload.messages[0].content += "\n\nNOTE: Do NOT use tool calls. Respond in plain text only."
      const res = await axios.post(NVIDIA_API_URL, payload, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        }
      })
      return res.data
    }
    throw err
  }
}

async function callLLM(messages: any[], skillInject?: string, modelId?: string) {
  return callNVIDIA(messages, false, skillInject, modelId)
}

async function streamNVIDIA(messages: any[], skillInject: string | undefined, modelId: string | undefined, onToken: (text: string) => void): Promise<{ content: string; toolCalls: any[] }> {
  const mid = modelId || 'minimaxai/minimax-m3'
  const cfg = NVIDIA_MODEL_CONFIG[mid] || NVIDIA_MODEL_CONFIG['minimaxai/minimax-m3']
  const apiKey = process.env[cfg.envKey]
  if (!apiKey) throw new Error(`No API key for model ${mid}`)

  const sysContent = skillInject ? SYSTEM_PROMPT + skillInject : SYSTEM_PROMPT
  const payload: any = { model: mid, messages: [{ role: 'system', content: sysContent }, ...messages], stream: true, ...cfg.payload }
  if (cfg.supportsTools) { payload.tools = TOOLS } else { payload.messages[0].content += "\n\nNOTE: You cannot use tool calls. Respond in plain text." }

  const res = await fetch(NVIDIA_API_URL, {
    method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`NVIDIA streaming error: ${res.status}`)

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let toolCalls: Record<number, any> = {}

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const t = line.trim()
      if (!t || !t.startsWith('data: ')) continue
      const data = t.slice(6)
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const choice = parsed.choices?.[0]
        if (!choice) continue
        const delta = choice.delta || {}
        if (delta.content) { content += delta.content; onToken(delta.content) }
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            if (!toolCalls[idx]) toolCalls[idx] = { id: tc.id || `call_${idx}`, type: 'function' as const, function: { name: '', arguments: '' } }
            if (tc.id) toolCalls[idx].id = tc.id
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments
          }
        }
      } catch {}
    }
  }
  return { content, toolCalls: Object.values(toolCalls) }
}

async function streamLLM(messages: any[], skillInject: string | undefined, modelId: string | undefined, onToken: (text: string) => void): Promise<{ content: string; toolCalls: any[] }> {
  try {
    return await streamNVIDIA(messages, skillInject, modelId, onToken)
  } catch (err) {
    console.error('Streaming failed, falling back to non-streaming:', err)
    try {
      const response = await callLLM(messages, skillInject, modelId)
      const msg = response.choices[0].message
      return { content: msg.content || '', toolCalls: msg.tool_calls || [] }
    } catch (fallbackErr: any) {
      console.error('Non-streaming fallback also failed:', fallbackErr)
      throw fallbackErr
    }
  }
}

async function runAgent(messages: any[], send: (d: any) => void, stepId: string, model?: string, skillInject?: string, workspaceRoot?: string, isContinuation?: boolean, clerkUserId?: string | null) {
  const conversation = [...messages]
  const allFiles: string[] = []
  const allCommands: string[] = []

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    send({ type: "status", content: step === 0 ? "Analyzing your request..." : "Thinking...", stepId })

    const prunedConversation = pruneConversation(conversation, MAX_CONVERSATION_TOKENS)
    const stepStart = Date.now()

    const reasoningPrompt = isContinuation
      ? "You were interrupted mid-task. Continue from where you left off. Do not re-read files or re-run commands you already did. Resume the task using your existing knowledge. Before taking any action, first explain your reasoning step by step in detail. Then make the tool calls needed."
      : "Before taking any action, first explain your reasoning step by step in detail. Then make the tool calls needed."

    const result = await streamLLM(
      [
        ...prunedConversation,
        { role: "user", content: reasoningPrompt }
      ],
      skillInject,
      model,
      (text) => send({ type: "reasoning", content: text, stepId })
    )

    if (result.toolCalls.length === 0) {
      send({ type: "done", content: result.content || "Done.", filesModified: allFiles, commandsRun: allCommands, steps: step + 1, stepId })
      return
    }

    for (const call of result.toolCalls) {
      let parsedArgs: Record<string, unknown>
      try { parsedArgs = JSON.parse(call.function.arguments) } catch {
        conversation.push({ role: "assistant" as const, content: result.content || "" })
        conversation.push({ role: "user" as const, content: `ERROR: Invalid JSON in tool call '${call.function.name}': "${call.function.arguments}". Fix and retry.` })
        continue
      }

      const reasoning = result.content?.trim() || ''
      const reasoningDuration = Date.now() - stepStart
      send({ type: "tool_call", name: call.function.name, args: parsedArgs, reasoning, reasoningDuration, stepId })
      const sendOutput = call.function.name === 'run_command' ? (text: string) => send({ type: "tool_output", content: text, stepId }) : undefined
      const toolResult = await executeTool(call.function.name, parsedArgs, workspaceRoot, sendOutput, clerkUserId)
      allFiles.push(...toolResult.filesModified)
      allCommands.push(...toolResult.commandsRun)
      send({ type: "tool_result", name: call.function.name, args: parsedArgs, output: toolResult.output, filesModified: toolResult.filesModified, commandsRun: toolResult.commandsRun, insertions: toolResult.insertions, deletions: toolResult.deletions, animationData: toolResult.animationData, stepId })

      conversation.push({ role: "assistant" as const, tool_calls: [{ id: call.id, type: "function" as const, function: { name: call.function.name, arguments: call.function.arguments } }] })
      conversation.push({ role: "tool" as const, tool_call_id: call.id, name: call.function.name, content: toolResult.output })
    }
  }

  send({ type: "done", content: `Reached max steps (${MAX_AGENT_STEPS}).`, filesModified: allFiles, commandsRun: allCommands, interrupted: true, stepId })
}

async function loadSkillContent(skillName: string): Promise<string> {
  const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md')
  try { return await fs.readFile(skillPath, 'utf-8') } catch { return '' }
}

export async function POST(request: Request) {
  const { userId } = await auth()
  const { messages, skill, model, fileTreePath, activeFilePath } = await request.json()
  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "Invalid messages" }) + "\n", {
      status: 400, headers: { "Content-Type": "application/x-ndjson" }
    })
  }

  const encoder = new TextEncoder()
  const stepId = `step_${Date.now()}`
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"))
      }

      request.signal.addEventListener("abort", () => { try { controller.close() } catch {} }, { once: true })
      if (request.signal.aborted) { send({ type: "done", content: "Stopped.", stepId }); controller.close(); return }

      send({ type: "status", content: "Analyzing your request...", stepId })

      try {
        const skillContent = skill ? await loadSkillContent(skill) : ''
        let skillInject = skillContent ? `\n\nACTIVE SKILL: ${skill}\n\nFollow these instructions:\n\`\`\`\n${skillContent}\n\`\`\`\n\nExecute steps proactively.` : ''
        const dirHint = fileTreePath
          ? `\n\nThe user is currently viewing the directory: "${fileTreePath}". When asked about the current workspace, list files from this directory.`
          : ''
        const activeHint = activeFilePath
          ? ` The user currently has "${activeFilePath}" open in their editor.`
          : ''
        skillInject = (skillInject + dirHint + activeHint).trim()
        const workspaceRoot = fileTreePath ? (path.isAbsolute(fileTreePath) ? fileTreePath : path.join(WORKSPACE_ROOT, fileTreePath)) : undefined

        const isContinuation = messages.length > 0 &&
          messages[messages.length - 1]?.role === 'user' &&
          typeof messages[messages.length - 1].content === 'string' &&
          messages[messages.length - 1].content.includes('Continue from where you left off')

        await runAgent(messages, send, stepId, model, skillInject, workspaceRoot, isContinuation, userId)
      } catch (err: any) {
        const detail = err?.error?.message || err?.error || (err?.response?.data ? JSON.stringify(err.response.data) : '')
        send({ type: "error", content: detail ? `${err.message}: ${detail}` : (err.message || "Internal error"), stepId })
      }

      controller.close()
    }
  })

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } })
}
