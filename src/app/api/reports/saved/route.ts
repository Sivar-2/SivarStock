import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db';
import { getCurrentUser, checkPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET() {
  try {
    const reports = await query<any>(`
      SELECT r.*, u.full_name as author_name
      FROM custom_reports r
      LEFT JOIN users u ON r.created_by_user_id = u.id
      ORDER BY r.created_at DESC
    `);

    const formatted = reports.map(r => ({
      ...r,
      columns: JSON.parse(r.columns_json || '[]'),
      filters: JSON.parse(r.filters_json || '[]'),
      allowedRoles: JSON.parse(r.allowed_roles_json || '[]'),
    }));

    return NextResponse.json({ success: true, reports: formatted });
  } catch (error: any) {
    console.error('Error al consultar reportes guardados:', error);
    return NextResponse.json({ error: 'Error al consultar reportes.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !checkPermission(user, 'AREA_MANAGER')) {
      return NextResponse.json({ error: 'No autorizado para guardar configuraciones de reporte.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      description,
      module,
      columns = [],
      filters = [],
      groupBy,
      sortBy,
      sortDirection = 'ASC',
      visualizationType = 'TABLE',
      dateRangePreset = 'ALL',
      allowedRoles = ['ADMIN', 'SUBADMIN', 'AREA_MANAGER', 'VIEWER'],
    } = body;

    if (!name || !module) {
      return NextResponse.json({ error: 'Nombre y módulo son obligatorios.' }, { status: 400 });
    }

    const id = `rep-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

    await run(`
      INSERT INTO custom_reports (
        id, name, description, module, columns_json, filters_json,
        group_by, sort_by, sort_direction, visualization_type, date_range_preset,
        allowed_roles_json, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, name.trim(), description?.trim() || null, module,
      JSON.stringify(columns), JSON.stringify(filters),
      groupBy || null, sortBy || null, sortDirection,
      visualizationType, dateRangePreset, JSON.stringify(allowedRoles), user.id
    ]);

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'GUARDAR_CONFIGURACION_REPORTE',
      module: 'REPORTES',
      entityId: id,
      entityName: name,
      reason: `Guardado de reporte personalizado '${name}'`,
    });

    return NextResponse.json({ success: true, message: 'Configuración de reporte guardada.', id });
  } catch (error: any) {
    console.error('Error al guardar reporte:', error);
    return NextResponse.json({ error: 'Error al guardar reporte.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !checkPermission(user, 'ADMIN')) {
      return NextResponse.json({ error: 'Solo administradores pueden eliminar reportes guardados.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });
    }

    await run(`DELETE FROM custom_reports WHERE id = ?`, [id]);
    return NextResponse.json({ success: true, message: 'Reporte eliminado.' });
  } catch (error: any) {
    console.error('Error al eliminar reporte:', error);
    return NextResponse.json({ error: 'Error al eliminar reporte.' }, { status: 500 });
  }
}
