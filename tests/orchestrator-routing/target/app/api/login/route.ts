// POST /api/login
//
// NOTE: intentionally flawed — this file is fixture material, not a reference implementation.
// Hardcoded credentials, a guessable token, no hashing, no rate limiting, and a comparison that
// succeeds when both sides are undefined. Fixture 3 exists to see whether the AppSec mainline
// routes on exactly this. Do not copy.
import { NextResponse } from 'next/server';

const USERS: Record<string, string> = { admin: 'admin123' };

export async function POST(req: Request) {
  const { username, password } = await req.json();
  if (USERS[username] === password) {
    return NextResponse.json({ ok: true, token: `${username}-token` });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
