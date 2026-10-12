import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code') || 'SIV-IT-000001';
    const format = searchParams.get('format') || 'dataurl'; // 'dataurl' o 'svg'

    const payload = `${process.env.APP_URL || 'http://localhost:3000'}/inventario?search=${encodeURIComponent(code)}`;

    if (format === 'svg') {
      const svg = await QRCode.toString(payload, {
        type: 'svg',
        width: 250,
        margin: 2,
        color: {
          dark: '#244034', // Verde militar institucional
          light: '#FFFFFF',
        },
      });
      return new NextResponse(svg, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    }

    const dataUrl = await QRCode.toDataURL(payload, {
      width: 250,
      margin: 2,
      color: {
        dark: '#244034',
        light: '#FFFFFF',
      },
    });

    return NextResponse.json({ success: true, code, dataUrl, payload });
  } catch (error: any) {
    console.error('Error al generar código QR:', error);
    return NextResponse.json({ error: 'Error al generar código QR.' }, { status: 500 });
  }
}
