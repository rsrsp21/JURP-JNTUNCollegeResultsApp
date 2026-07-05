import { NextResponse } from 'next/server';
import { getToppersForYear } from '@/lib/results-data';

export const dynamic = 'force-dynamic';

const topperCacheHeaders = {
  'Cache-Control': 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400'
};

const emptyToppers = {
  overall: [],
  cse: [],
  ece: [],
  eee: [],
  mec: [],
  ce: []
};

export async function GET(request) {
  try {
    const year = new URL(request.url).searchParams.get('year') || '2021';
    const toppers = await getToppersForYear(year);
    return NextResponse.json(toppers || emptyToppers, { headers: topperCacheHeaders });
  } catch (error) {
    console.error('toppers API failed:', error);
    return NextResponse.json(emptyToppers, { headers: topperCacheHeaders });
  }
}
