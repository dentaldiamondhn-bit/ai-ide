export async function GET() {
  return Response.json({
    groqKeySet: !!process.env.GROQ_API_KEY,
    groqKeyLen: process.env.GROQ_API_KEY?.length || 0,
    groqKeyPrefix: (process.env.GROQ_API_KEY || '').slice(0, 10),
    clerkPublishableSet: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    nodeEnv: process.env.NODE_ENV,
  })
}
