import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { waseetMetadataRepository } from '@/modules/waseet/metadata-repository';

export const maxDuration = 60;


export async function GET(req: NextRequest) {
  try {
    if (!getSessionUser(req)) return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });
    const params = new URL(req.url).searchParams;
    const cityId = Number(params.get('cityId')) || undefined;
    await waseetMetadataRepository.ensureAvailable();

    if (cityId) {
      return NextResponse.json({ regions: await waseetMetadataRepository.listRegions(cityId) });
    }
    return NextResponse.json(await waseetMetadataRepository.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر تحميل قوائم الوسيط.' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'تحديث بيانات الوسيط يتطلب صلاحيات المدير.' }, { status: 403 });
    }
    return NextResponse.json({ success: true, ...(await waseetMetadataRepository.refreshAll()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'فشل تحديث بيانات الوسيط.' },
      { status: 500 },
    );
  }
}
