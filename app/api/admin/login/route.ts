import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_EMAIL,
  applyAdminSessionCookies,
  clearAdminSessionCookies,
  isAuthorizedAdminEmail,
} from '@/lib/admin-auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password || !isAuthorizedAdminEmail(email)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Supabase auth is not configured' }, { status: 500 });
  }

  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session || !data.user || data.user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  applyAdminSessionCookies(response, data.session);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearAdminSessionCookies(response);
  return response;
}
