import { NextRequest, NextResponse } from 'next/server';
import {
  applyAdminSessionCookies,
  clearAdminSessionCookies,
  isAuthorizedAdminEmail,
} from '@/lib/admin-auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

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

  if (error || !data.session || !data.user || !isAuthorizedAdminEmail(data.user.email)) {
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
