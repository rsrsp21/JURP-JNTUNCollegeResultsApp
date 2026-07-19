import { NextResponse } from 'next/server';
import { getStudentResults } from '@/lib/results-data';

export const dynamic = 'force-dynamic';

const resultCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
};

export async function GET(_request, context) {
  const { studentId } = await context.params;
  const result = await getStudentResults(studentId);
  if (!result.cgpaData && !Object.keys(result.semesterData || {}).length) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }
  return NextResponse.json(result, { headers: resultCacheHeaders });
}
