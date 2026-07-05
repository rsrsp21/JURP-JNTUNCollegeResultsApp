import { NextResponse } from 'next/server';
import { getBatchData } from '@/lib/results-data';

export const dynamic = 'force-dynamic';

export async function GET(_request, context) {
  const { batchYear } = await context.params;
  if (!/^\d{4}$/.test(batchYear)) {
    return NextResponse.json({ error: 'Invalid batch year format. Please use YYYY.' }, { status: 400 });
  }
  const data = await getBatchData(batchYear);
  if (!data.length) return NextResponse.json({ error: `No student data found for the batch year ${batchYear}.` }, { status: 404 });
  return NextResponse.json(data);
}
