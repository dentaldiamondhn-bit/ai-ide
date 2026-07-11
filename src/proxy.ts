import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isLogin = pathname.startsWith('/login')
  const isApi = pathname.startsWith('/api')
  const isStatic = pathname.startsWith('/_next') || pathname.includes('.')

  if (isApi || isStatic || isLogin) {
    return NextResponse.next()
  }

  // Check for any Supabase auth cookie (sb-<ref>-auth-token)
  const hasSession = request.cookies.getAll().some(c => c.name.endsWith('-auth-token'))

  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
