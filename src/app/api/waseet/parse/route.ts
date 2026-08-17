import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { waseetMetadataRepository } from '@/modules/waseet/metadata-repository';
import { parseStudentMessage } from '@/modules/waseet/parser';

export async function POST(req: NextRequest) {
  try {
    if (!getSessionUser(req)) return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });
    const body = await req.json() as { text?: string };
    const metadata = await waseetMetadataRepository.ensureAvailable();
    return NextResponse.json(parseStudentMessage(body.text || '', metadata.cities, metadata.regions));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر تحليل رسالة الطالب.' },
      { status: 400 },
    );
  }
}
