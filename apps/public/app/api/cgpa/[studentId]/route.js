import { NextResponse } from 'next/server';
import { getStudentCgpa } from '@/lib/results-data';

export const dynamic = 'force-dynamic';

const resultCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
};

export async function GET(_request, context) {
  const { studentId } = await context.params;
  const record = await getStudentCgpa(studentId);
  if (!record) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  return NextResponse.json(record, { headers: resultCacheHeaders });
}
