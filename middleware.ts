import { NextRequest, NextResponse } from 'next/server'

const GATE_COOKIE = 'ap_gate'
const GATE_VALUE  = 'ok'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow the gate page and its API action through
  if (pathname.startsWith('/gate') || pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/logo') || pathname.startsWith('/chains') || pathname.startsWith('/api/gate')) {
    return NextResponse.next()
  }

  const cookie = req.cookies.get(GATE_COOKIE)
  if (cookie?.value === GATE_VALUE) return NextResponse.next()

  const gateUrl = req.nextUrl.clone()
  gateUrl.pathname = '/gate'
  return NextResponse.redirect(gateUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
