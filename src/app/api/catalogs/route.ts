import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db';
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

    // Proveedores únicos históricos
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
      suppliers: suppliers.map(s => s.supplier),
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
    const { type, data } = body; // type: 'department', 'location', 'category', 'product'

    if (!type || !data) {
      return NextResponse.json({ error: 'Tipo y datos son requeridos.' }, { status: 400 });
    }

    if (type === 'department') {
      const id = `dept-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      await run(`
        INSERT INTO departments (id, code, name, cost_center, manager_name)
        VALUES (?, ?, ?, ?, ?)
      `, [id, data.code.toUpperCase().trim(), data.name.trim(), data.costCenter?.trim() || null, data.managerName?.trim() || null]);

      await logAudit({
        userId: user.id, username: user.username, userRole: user.role,
        action: 'CREAR_DEPARTAMENTO', module: 'CATALOGOS', entityId: id, entityName: data.name
      });
      return NextResponse.json({ success: true, message: 'Área/Departamento creada con éxito.', id });
    }

    if (type === 'category') {
      const id = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      await run(`
        INSERT INTO categories (id, code, name, tracking_type, description, icon)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, data.code.toUpperCase().trim(), data.name.trim(), data.trackingType || 'INDIVIDUAL', data.description || null, data.icon || 'Package']);

      await logAudit({
        userId: user.id, username: user.username, userRole: user.role,
        action: 'CREAR_CATEGORIA', module: 'CATALOGOS', entityId: id, entityName: data.name
      });
      return NextResponse.json({ success: true, message: 'Categoría creada con éxito.', id });
    }

    if (type === 'product') {
      const id = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      await run(`
        INSERT INTO products (
          id, category_id, code, name, description, brand, model,
          unit_of_measure, is_consumable, min_stock, target_stock, default_supplier
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, data.categoryId, data.code.toUpperCase().trim(), data.name.trim(),
        data.description || null, data.brand || null, data.model || null,
        data.unitOfMeasure || 'unidad', data.isConsumable ? 1 : 0,
        parseFloat(data.minStock) || 5, parseFloat(data.targetStock) || 20, data.defaultSupplier || null
      ]);

      await logAudit({
        userId: user.id, username: user.username, userRole: user.role,
        action: 'CREAR_PRODUCTO', module: 'CATALOGOS', entityId: id, entityName: data.name
      });
      return NextResponse.json({ success: true, message: 'Producto registrado con éxito.', id });
    }

    return NextResponse.json({ error: 'Tipo de catálogo no soportado.' }, { status: 400 });
  } catch (error: any) {
    console.error('Error al registrar catálogo:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar catálogo.' }, { status: 500 });
  }
}
