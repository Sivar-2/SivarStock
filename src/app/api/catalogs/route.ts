import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { getCurrentUser, checkPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET() {
  try {
    const departments = await query<any>(`SELECT * FROM departments WHERE is_active = 1 ORDER BY name ASC`);
    const locations = await query<any>(`SELECT * FROM locations WHERE is_active = 1 ORDER BY name ASC`);
    const categories = await query<any>(`SELECT * FROM categories WHERE is_active = 1 ORDER BY name ASC`);
    const products = await query<any>(`
      SELECT p.*, c.name as category_name, c.tracking_type 
      FROM products p 
      JOIN categories c ON p.category_id = c.id 
      WHERE p.is_active = 1 
      ORDER BY p.name ASC
    `);
    const users = await query<any>(`
      SELECT u.id, u.username, u.full_name, u.email, u.role, u.initials, u.department_id, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.is_active = 1
      ORDER BY u.full_name ASC
    `);

    const suppliers = await query<any>(`
      SELECT DISTINCT supplier FROM (
        SELECT supplier FROM inventory_items WHERE supplier IS NOT NULL AND supplier != ''
        UNION
        SELECT default_supplier as supplier FROM products WHERE default_supplier IS NOT NULL AND default_supplier != ''
        UNION
        SELECT provider as supplier FROM digital_services WHERE provider IS NOT NULL AND provider != ''
      ) ORDER BY supplier ASC
    `);

    return NextResponse.json({
      success: true,
      departments,
      locations,
      categories,
      products,
      users,
      suppliers: suppliers.map((s) => s.supplier),
    });
  } catch (error: any) {
    console.error('Error al obtener catálogos:', error);
    return NextResponse.json({ error: 'Error al consultar catálogos.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !checkPermission(user, 'SUBADMIN')) {
      return NextResponse.json({ error: 'No autorizado para crear elementos de catálogo.' }, { status: 403 });
    }

    const body = await req.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ error: 'Tipo y datos son requeridos.' }, { status: 400 });
    }

    if (type === 'department') {
      const id = `dept-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      const rawCode = (data.code || data.name?.substring(0, 4) || 'AREA').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const existingCode = await queryOne(`SELECT id FROM departments WHERE code = ?`, [rawCode]);
      const finalCode = existingCode ? `${rawCode}-${Math.floor(10 + Math.random() * 89)}` : rawCode;

      await run(
        `INSERT INTO departments (id, code, name, cost_center, manager_name) VALUES (?, ?, ?, ?, ?)`,
        [id, finalCode, data.name.trim(), data.costCenter?.trim() || null, data.managerName?.trim() || null]
      );

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'CREAR_DEPARTAMENTO',
        module: 'CATALOGOS',
        entityId: id,
        entityName: data.name,
      });
      return NextResponse.json({ success: true, message: 'Área/Departamento creada con éxito.', id, code: finalCode });
    }

    if (type === 'category') {
      if (!data.name || !data.name.trim()) {
        return NextResponse.json({ error: 'El nombre de la carpeta/categoría es obligatorio.' }, { status: 400 });
      }
      const id = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      const baseCode = (data.code || data.name.substring(0, 4)).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'CAT';
      const existingCat = await queryOne(`SELECT id FROM categories WHERE code = ?`, [baseCode]);
      const finalCode = existingCat ? `${baseCode}${Math.floor(10 + Math.random() * 89)}` : baseCode;

      await run(
        `INSERT INTO categories (id, code, name, tracking_type, description, icon, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          finalCode,
          data.name.trim(),
          data.trackingType || 'INDIVIDUAL',
          data.description?.trim() || null,
          data.icon || 'Package',
        ]
      );

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'CREAR_CATEGORIA',
        module: 'CATALOGOS',
        entityId: id,
        entityName: data.name,
      });
      return NextResponse.json({ success: true, message: `Carpeta de categoría "${data.name.trim()}" creada con éxito.`, id, code: finalCode });
    }

    if (type === 'product') {
      const id = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      await run(
        `INSERT INTO products (
          id, category_id, code, name, description, brand, model,
          unit_of_measure, is_consumable, min_stock, target_stock, default_supplier
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.categoryId,
          (data.code || `PRD-${Date.now().toString().slice(-4)}`).toUpperCase().trim(),
          data.name.trim(),
          data.description || null,
          data.brand || null,
          data.model || null,
          data.unitOfMeasure || 'unidad',
          data.isConsumable ? 1 : 0,
          parseFloat(data.minStock) || 5,
          parseFloat(data.targetStock) || 20,
          data.defaultSupplier || null,
        ]
      );

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'CREAR_PRODUCTO',
        module: 'CATALOGOS',
        entityId: id,
        entityName: data.name,
      });
      return NextResponse.json({ success: true, message: 'Producto registrado con éxito.', id });
    }

    return NextResponse.json({ error: 'Tipo de catálogo no soportado.' }, { status: 400 });
  } catch (error: any) {
    console.error('Error al registrar catálogo:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar catálogo.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !checkPermission(user, 'SUBADMIN')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json({ error: 'Tipo e ID requeridos.' }, { status: 400 });
    }

    if (type === 'category') {
      const hasProds = await queryOne<any>(`SELECT COUNT(*) as cnt FROM products WHERE category_id = ? AND is_active = 1`, [id]);
      if (hasProds && Number(hasProds.cnt) > 0) {
        return NextResponse.json(
          { error: `Esta carpeta contiene ${hasProds.cnt} producto(s). Mueva o elimine primero los productos antes de borrar la carpeta.` },
          { status: 400 }
        );
      }
      await run(`DELETE FROM categories WHERE id = ?`, [id]);
      return NextResponse.json({ success: true, message: 'Carpeta de categoría eliminada.' });
    }

    return NextResponse.json({ error: 'Operación no soportada.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al eliminar.' }, { status: 500 });
  }
}
