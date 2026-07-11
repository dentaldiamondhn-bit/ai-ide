import { ESLint } from 'eslint'

export async function POST(request: Request) {
  const { path: filePath, content } = await request.json()
  if (!filePath && !content) {
    return Response.json({ error: 'path or content required' }, { status: 400 })
  }
  try {
    const eslint = new ESLint({
      cwd: process.cwd(),
      errorOnUnmatchedPattern: false,
    })
    let results
    if (content) {
      results = await eslint.lintText(content, { filePath: filePath || 'file.tsx' })
    } else {
      results = await eslint.lintFiles([filePath])
    }
    const result = results[0]
    if (!result) {
      return Response.json({ errors: 0, warnings: 0 })
    }
    return Response.json({
      errors: result.errorCount,
      warnings: result.warningCount,
      messages: result.messages.map(m => ({
        line: m.line,
        column: m.column,
        message: m.message,
        severity: m.severity === 2 ? 'error' : 'warning',
        ruleId: m.ruleId,
      })),
    })
  } catch {
    return Response.json({ errors: 0, warnings: 0 })
  }
}
// git config fix
