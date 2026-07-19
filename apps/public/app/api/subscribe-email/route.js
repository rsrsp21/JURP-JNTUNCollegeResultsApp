import { NextResponse } from 'next/server';
import { setStudentEmail } from '@/lib/results-data';

export const dynamic = 'force-dynamic';

const ROLL_PATTERN = /^[0-9]{2}[0-9A-Z]{3}A[0-9A-Z]{4}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const studentId = String(body.studentId || '').trim().toUpperCase();
  const email = String(body.email || '').trim().toLowerCase();

  if (!ROLL_PATTERN.test(studentId)) {
    return NextResponse.json({ error: 'Enter a valid roll number first.' }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 120) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const result = await setStudentEmail(studentId, email);
  if (!result) {
    return NextResponse.json({ error: 'No student record found for this roll number.' }, { status: 404 });
  }

  return NextResponse.json(result);
}
