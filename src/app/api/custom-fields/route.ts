import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db';
import { getCurrentUser, checkPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const module = searchParams.get('module');

    const fields = await query<any>(`
      SELECT * FROM custom_cost_fields 
      WHERE is_active = 1 
      ORDER BY display_order ASC, name ASC
    `);

    // Parsear arrays JSON
    const parsed = fields.map(f => ({
      ...f,
      options: JSON.parse(f.options_json || '[]'),
      applicableModules: JSON.parse(f.applicable_modules_json || '[]'),
      applicableCategories: JSON.parse(f.applicable_categories_json || '[]'),
      isRequired: Boolean(f.is_required),
      visibleInForms: Boolean(f.visible_in_forms),
      visibleInQueries: Boolean(f.visible_in_queries),
      visibleInExports: Boolean(f.visible_in_exports),
      visibleInReports: Boolean(f.visible_in_reports),
    }));

    const filtered = module 
      ? parsed.filter(f => f.applicableModules.includes(module))
      : parsed;

    return NextResponse.json({ success: true, count: filtered.length, fields: filtered });
  } catch (error: any) {
    console.error('Error al consultar campos personalizados:', error);
    return NextResponse.json({ error: 'Error al consultar campos.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !checkPermission(user, 'ADMIN')) {
      return NextResponse.json({ error: 'Solo administradores pueden crear campos personalizados.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      description,
      fieldType, // 'TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'PERCENTAGE', 'SELECT', 'BOOLEAN'
      isRequired = false,
      options = [],
      applicableModules = ['COSTOS', 'INVENTARIO'],
      applicableCategories = [],
      visibleInForms = true,
      visibleInQueries = true,
      visibleInExports = true,
      visibleInReports = true,
      displayOrder = 0,
    } = body;

    if (!name || !fieldType) {
      return NextResponse.json({ error: 'Nombre y tipo de campo son obligatorios.' }, { status: 400 });
    }

    // Generar clave slug única
    const fieldKey = name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);

    const id = `fld-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

    await run(`
      INSERT INTO custom_cost_fields (
        id, field_key, name, description, field_type, is_required,
        options_json, applicable_modules_json, applicable_categories_json,
        visible_in_forms, visible_in_queries, visible_in_exports, visible_in_reports,
        display_order, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      id, fieldKey, name.trim(), description?.trim() || null, fieldType,
      isRequired ? 1 : 0, JSON.stringify(options || []),
      JSON.stringify(applicableModules || ['COSTOS']),
      JSON.stringify(applicableCategories || []),
      visibleInForms ? 1 : 0, visibleInQueries ? 1 : 0,
      visibleInExports ? 1 : 0, visibleInReports ? 1 : 0,
      parseInt(displayOrder, 10) || 0
    ]);

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'CREAR_CAMPO_PERSONALIZADO',
      module: 'CONFIGURACION',
      entityId: id,
      entityName: name,
      afterState: { fieldKey, fieldType, applicableModules },
      reason: 'Creación de campo de costo dinámico',
    });

    return NextResponse.json({ success: true, message: 'Campo personalizado creado con éxito.', id });
  } catch (error: any) {
    console.error('Error al crear campo personalizado:', error);
    return NextResponse.json({ error: error.message || 'Error al crear campo personalizado.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !checkPermission(user, 'ADMIN')) {
      return NextResponse.json({ error: 'Solo administradores pueden desactivar campos.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de campo requerido.' }, { status: 400 });
    }

    // Desactivar sin borrar valores históricos
    await run(`UPDATE custom_cost_fields SET is_active = 0 WHERE id = ?`, [id]);

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'DESACTIVAR_CAMPO_PERSONALIZADO',
      module: 'CONFIGURACION',
      entityId: id,
      reason: 'Desactivación lógica de campo personalizado para preservar trazabilidad histórica',
    });

    return NextResponse.json({ success: true, message: 'Campo personalizado desactivado correctamente.' });
  } catch (error: any) {
    console.error('Error al desactivar campo:', error);
    return NextResponse.json({ error: 'Error al procesar desactivación.' }, { status: 500 });
  }
}
