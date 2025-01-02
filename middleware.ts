import { NextRequest, NextResponse } from 'next/server';

declare module 'next/server' {
  interface NextRequest {
    geo?: {
      city?: string;
      country?: string;
      region?: string;
    };
  }
}

const meetingsApiPath = /^\/api\/meetings\/[^\/]+$/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (meetingsApiPath.test(pathname) && (req.method === 'PATCH' || req.method === 'DELETE')) {
    const geo = req.geo ?? {}; 
    const ip = req.headers.get('x-forwarded-for') || 'Unknown IP';

    const match = pathname.match(/^\/api\/meetings\/([^\/]+)$/);
    const meetingId = match ? match[1] : 'Unknown Meeting ID';

    const action = req.method === 'PATCH' ? 'Edit' : 'Vote for Deletion';

    console.log(`Action: ${action}`);
    console.log(`Meeting ID: ${meetingId}`);
    console.log(`IP Address: ${ip}`);
    console.log(`Location: ${geo.city ?? 'Unknown City'}, ${geo.country ?? 'Unknown Country'}`);
    console.log('-------------------------------------------');
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/meetings/:id'],
};
