import { NextRequest, NextResponse } from 'next/server';
import { generateCsv, generateExcelBuffer, generatePdfDoc } from '@/lib/export';
import { getCurrentUser, isAdminOrSuperAdmin } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (user && !user.canExport && !isAdminOrSuperAdmin(user)) {
      return NextResponse.json({ error: 'No cuenta con permisos para exportar información.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      format = 'csv', // 'csv', 'excel', 'pdf'
      title = 'Reporte SivarStock',
      subtitle = '',
      columns = [],
      data = [],
    } = body;

    if (!Array.isArray(columns) || !Array.isArray(data) || columns.length === 0) {
      return NextResponse.json({ error: 'Datos o columnas insuficientes para exportar.' }, { status: 400 });
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const cleanFileName = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 30);

    if (format === 'csv') {
      const csvContent = generateCsv(columns, data);
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${cleanFileName}_${timestamp}.csv"`,
        },
      });
    }

    if (format === 'excel') {
      const buffer = generateExcelBuffer(title, columns, data);
      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${cleanFileName}_${timestamp}.xlsx"`,
        },
      });
    }

    if (format === 'pdf') {
      const doc = generatePdfDoc(title, subtitle, columns, data);
      const pdfBytes = doc.output('arraybuffer');
      return new NextResponse(pdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${cleanFileName}_${timestamp}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: 'Formato de exportación no soportado.' }, { status: 400 });
  } catch (error: any) {
    console.error('Error al exportar reporte:', error);
    return NextResponse.json({ error: 'Error al generar archivo de exportación.' }, { status: 500 });
  }
}
