import { NextResponse } from 'next/server';
import {
  buildGeneralContext,
  buildDirectComparisonAnswer,
  buildMultiStudentContext,
  buildStudentContext,
  callGemini,
  extractAllRollNumbers,
  getGeminiModel,
  isComparisonMessage,
  isRelevantAcademicMessage,
  needsStudentResultContext
} from '@/lib/ai';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const message = String(payload.message || '').trim();
  const activeStudentId = String(payload.activeStudentId || '').trim().toUpperCase();
  const history = Array.isArray(payload.history) ? payload.history : [];

  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

  if (!isRelevantAcademicMessage(message)) {
    return NextResponse.json({
      answer: 'I can only help with JNTUK UCEN results, CGPA, SGPA, credits, backlogs, subjects, toppers, downloads, and portal navigation. Please ask a result-related question.'
    });
  }

  const rollNumbers = extractAllRollNumbers(message);
  if (rollNumbers.length < 2 && activeStudentId && !rollNumbers.includes(activeStudentId)) {
    rollNumbers.unshift(activeStudentId);
  }

  if (rollNumbers.length >= 2) {
    const context = await buildMultiStudentContext(rollNumbers, message);
    if (isComparisonMessage(message)) {
      const answer = buildDirectComparisonAnswer(context);
      if (answer) return NextResponse.json({ answer });
    }
    return aiResponse(message, context, history);
  }

  if (rollNumbers.length === 1) {
    const studentId = rollNumbers[0];
    const context = await buildStudentContext(studentId, message);
    if (!context) {
      return NextResponse.json({ answer: `I could not find result data for roll number ${studentId}. Please check the roll number and try again.` });
    }
    return aiResponse(message, context, history, studentId);
  }

  if (!needsStudentResultContext(message)) {
    return aiResponse(message, await buildGeneralContext(message), history);
  }

  return NextResponse.json({
    answer: 'I can answer that after I know the student roll number. Use the Ask by roll number or Compare students quick action, or type the roll number directly in your question.'
  });
}

async function aiResponse(message, context, history, studentId = '') {
  const result = await callGemini(message, context, history, 2000);
  if (result.error) {
    console.error('Gemini service error:', result.error);
    return NextResponse.json({ error: 'Results AI is currently offline or undergoing maintenance. Please try again in a few moments.' }, { status: 503 });
  }
  return NextResponse.json({
    answer: result.answer,
    studentId: studentId || undefined,
    model: result.model || getGeminiModel()
  });
}
