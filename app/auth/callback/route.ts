import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/reset-password'

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url))
    }

    // Build redirect response with session cookies
    const response = NextResponse.redirect(new URL(next, request.url))
    
    if (data.session) {
      response.cookies.set('sb-access-token', data.session.access_token, {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        maxAge: data.session.expires_in,
      })
      response.cookies.set('sb-refresh-token', data.session.refresh_token, {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      })
    }
    
    return response
  }

  return NextResponse.redirect(new URL('/login', request.url))
}
