import Groq from 'groq-sdk'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const body = await request.json().catch(() => ({}))
  const messages = body.messages || [{ role: 'user', content: 'say hi' }]
  const model = body.model || 'llama-3.3-70b-versatile'
  const useStream = body.stream !== false

  const results: any[] = []

  try {
    results.push({ step: 'env_check', hasKey: !!process.env.GROQ_API_KEY, keyLen: process.env.GROQ_API_KEY?.length, keyPrefix: process.env.GROQ_API_KEY?.slice(0, 10) })
  } catch (e: any) {
    results.push({ step: 'env_error', error: e.message })
  }

  try {
    const req: any = { model, messages, temperature: 0.3 }
    const result = await groq.chat.completions.create(req)
    results.push({ step: 'non_streaming', status: 'ok', content: result.choices?.[0]?.message?.content?.slice(0, 100) })
  } catch (e: any) {
    results.push({ step: 'non_streaming', status: 'error', message: e.message, statusCode: e.status, errorData: e.error })
  }

  try {
    const stream = await groq.chat.completions.create({
      model,
      messages,
      tools: [{ type: 'function', function: { name: 'read_file', description: 'Read files', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } }],
      temperature: 0.3,
      stream: true,
    })
    let content = ''
    for await (const chunk of stream) {
      if (chunk.choices?.[0]?.delta?.content) content += chunk.choices[0].delta.content
    }
    results.push({ step: 'streaming_with_tools', status: 'ok', content: content.slice(0, 100) })
  } catch (e: any) {
    results.push({ step: 'streaming_with_tools', status: 'error', message: e.message, statusCode: e.status, errorData: e.error })
  }

  return Response.json(results)
}
