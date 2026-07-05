import { NextResponse } from 'next/server';
import { listNotifications } from '@/lib/results-data';

export const dynamic = 'force-dynamic';

const notificationCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam === 'all' ? 0 : (Number(limitParam) || 3);
    
    return NextResponse.json(await listNotifications(limit), { headers: notificationCacheHeaders });
  } catch (error) {
    console.error('notifications API failed:', error);
    return NextResponse.json([], { headers: notificationCacheHeaders });
  }
}
