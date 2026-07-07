export async function GET() {
  return Response.json({
    nvidiaKeySet: !!process.env.NVIDIA_API_KEY_MINIMAX,
    nodeEnv: process.env.NODE_ENV,
  })
}
