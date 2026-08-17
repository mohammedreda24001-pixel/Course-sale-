import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { waseetClient } from '@/modules/waseet/client';
import { waseetMetadataRepository } from '@/modules/waseet/metadata-repository';

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
    const [auth, metadata] = await Promise.all([
      waseetClient.healthCheck(),
      waseetMetadataRepository.getAll(),
    ]);
    return NextResponse.json({
      ok: true,
      auth,
      metadata: {
        cities: metadata.cities.length,
        regions: metadata.regions.length,
        packageSizes: metadata.packageSizes.length,
        statuses: metadata.statuses.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'فشل فحص اتصال الوسيط.' },
      { status: 500 },
    );
  }
}
