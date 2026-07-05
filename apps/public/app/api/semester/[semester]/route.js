import { NextResponse } from 'next/server';
import { batchYearFromStudentId, getBatchSemesterCsv } from '@/lib/results-data';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  const { semester } = await context.params;
  const studentId = new URL(request.url).searchParams.get('student_id') || '';
  const batchYear = batchYearFromStudentId(studentId);
  if (!batchYear) return new NextResponse('Invalid student ID pattern', { status: 400 });

  const csv = await getBatchSemesterCsv(batchYear, semester);
  if (!csv) return new NextResponse('Semester data not found', { status: 404 });
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8'
    }
  });
}
