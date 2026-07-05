import { NextResponse } from 'next/server';
import { listNotifications } from '@/lib/results-data';

export const dynamic = 'force-dynamic';

const notificationCacheHeaders = {
  'Cache-Control': 'public, max-age=120, s-maxage=600, stale-while-revalidate=86400'
};

export async function GET() {
  try {
    return NextResponse.json(await listNotifications(), { headers: notificationCacheHeaders });
  } catch (error) {
    console.error('notifications API failed:', error);
    return NextResponse.json([], { headers: notificationCacheHeaders });
  }
}
