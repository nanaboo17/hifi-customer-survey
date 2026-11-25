import { NextRequest, NextResponse } from 'next/server'
import { staff } from '@/lib/upload-security'
export const runtime = 'nodejs'
export async function GET(req: NextRequest) {
 try { return NextResponse.json({authenticated:staff(req)},{headers:{'Cache-Control':'no-store'}}) }
 catch { return NextResponse.json({authenticated:false},{headers:{'Cache-Control':'no-store'}}) }
}
