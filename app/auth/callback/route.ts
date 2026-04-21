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

  // Implicit flow: session is in URL fragment (#access_token=...).
  // Server-side redirects lose the fragment, so we use a client-side
  // redirect that preserves it. The Supabase client will then detect
  // the session from the fragment (detectSessionInUrl: true).
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>מעבר...</title>
  <script>
    // Preserve the URL fragment when redirecting
    var nextUrl = ${JSON.stringify(next)};
    var fragment = window.location.hash;
    window.location.replace(nextUrl + fragment);
  </script>
</head>
<body>
  <noscript>
    <p>נדרש JavaScript. <a href="${next}">לחץ/י כאן להמשך</a></p>
  </noscript>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
