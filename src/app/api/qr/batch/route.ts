import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('department_id');
    const employeeId = searchParams.get('employee_id');
    const deviceType = searchParams.get('device_type'); // LAPTOP, IMPRESORA, DESKTOP, etc.

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (departmentId) {
      whereClause += ' AND i.current_department_id = ?';
      params.push(departmentId);
    }
    if (employeeId) {
      whereClause += ' AND i.assigned_employee_id = ?';
      params.push(employeeId);
    }
    if (deviceType) {
      whereClause += ' AND p.category = ?';
      params.push(deviceType);
    }

    const items = await query<any>(`
      SELECT 
        i.id,
        i.permanent_code,
        i.serial_number,
        i.created_at,
        p.name as product_name,
        p.category,
        p.model,
        d.name as department_name,
        d.code as department_code,
        e.full_name as employee_name,
        e.employee_code
      FROM inventory_items i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN departments d ON i.current_department_id = d.id
      LEFT JOIN employees e ON i.assigned_employee_id = e.id
      ${whereClause}
      ORDER BY i.permanent_code ASC
      LIMIT 100
    `, params);

    // Generar códigos QR para cada artículo
    const itemsWithQr = await Promise.all(
      items.map(async (item) => {
        const payload = `${process.env.APP_URL || 'http://localhost:3000'}/inventario?search=${encodeURIComponent(item.permanent_code)}`;
        const qrDataUrl = await QRCode.toDataURL(payload, {
          width: 180,
          margin: 1,
          color: { dark: '#1e293b', light: '#ffffff' },
        });
        return {
          ...item,
          qrDataUrl,
        };
      })
    );

    return NextResponse.json({ success: true, count: itemsWithQr.length, items: itemsWithQr });
  } catch (error: any) {
    console.error('Error generating batch QR:', error);
    return NextResponse.json({ error: 'Error al generar lote de códigos QR.' }, { status: 500 });
  }
}
