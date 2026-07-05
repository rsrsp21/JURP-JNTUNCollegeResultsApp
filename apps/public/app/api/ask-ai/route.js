import { NextResponse } from 'next/server';
import { buildStudentContext, callGemini, getGeminiModel } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const question = String(payload.question || '').trim();
  const studentId = String(payload.studentId || '').trim().toUpperCase();

  if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 });
  if (!studentId) return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });

  const context = await buildStudentContext(studentId, question);
  if (!context) return NextResponse.json({ error: 'No result data found for this roll number' }, { status: 404 });

  const result = await callGemini(question, context, [], 2000);
  if (result.error) {
    console.error('Gemini service error:', result.error);
    return NextResponse.json({ error: 'Results AI is currently offline or undergoing maintenance. Please try again in a few moments.' }, { status: 503 });
  }
  return NextResponse.json({ answer: result.answer, model: result.model || getGeminiModel() });
}
