import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('department_id');
    const employeeId = searchParams.get('employee_id');
    const categoryId = searchParams.get('category_id');
    const unassignedOnly = searchParams.get('unassigned') === 'true';
    const printStatus = searchParams.get('print_status'); // 'PRINTED' | 'UNPRINTED' | ''

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (departmentId) {
      whereClause += ' AND i.current_department_id = ?';
      params.push(departmentId);
    }
    if (employeeId) {
      whereClause += ' AND i.current_employee_id = ?';
      params.push(employeeId);
    }
    if (categoryId) {
      whereClause += ' AND p.category_id = ?';
      params.push(categoryId);
    }
    if (unassignedOnly) {
      whereClause += ' AND (i.current_employee_id IS NULL OR d.is_bodega = 1)';
    }
    if (printStatus === 'PRINTED') {
      whereClause += ' AND COALESCE(i.qr_printed, 0) = 1';
    } else if (printStatus === 'UNPRINTED') {
      whereClause += ' AND COALESCE(i.qr_printed, 0) = 0';
    }

    const items = await query<any>(
      `
      SELECT 
        i.id,
        i.permanent_code,
        COALESCE(i.brand, p.brand, '') as brand,
        COALESCE(i.model, p.model, p.name) as model,
        i.serial_number,
        i.created_at,
        COALESCE(i.qr_printed, 0) as qr_printed,
        i.qr_printed_at,
        COALESCE(i.label_orientation, 'HORIZONTAL') as label_orientation,
        p.name as product_name,
        c.name as category_name,
        d.name as department_name,
        d.code as department_code,
        e.full_name as employee_name,
        e.employee_code,
        (
          SELECT a.assigned_at 
          FROM assignments a 
          WHERE a.item_id = i.id AND a.status = 'ACTIVA' 
          ORDER BY a.assigned_at DESC 
          LIMIT 1
        ) as delivery_date
      FROM inventory_items i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN departments d ON i.current_department_id = d.id
      LEFT JOIN employees e ON i.current_employee_id = e.id
      ${whereClause}
      ORDER BY COALESCE(i.qr_printed, 0) ASC, i.permanent_code ASC
      LIMIT 300
    `,
      params
    );

    const itemsWithQr = await Promise.all(
      items.map(async (item) => {
        const qrDataUrl = await QRCode.toDataURL(item.permanent_code, {
          width: 200,
          margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        return {
          ...item,
          qrDataUrl,
        };
      })
    );

    return NextResponse.json({
      success: true,
      count: itemsWithQr.length,
      printedCount: itemsWithQr.filter((i) => Number(i.qr_printed) === 1).length,
      unprintedCount: itemsWithQr.filter((i) => Number(i.qr_printed) === 0).length,
      items: itemsWithQr,
    });
  } catch (error: any) {
    console.error('Error generating batch QR:', error);
    return NextResponse.json({ error: 'Error al generar lote de códigos QR.' }, { status: 500 });
  }
}
