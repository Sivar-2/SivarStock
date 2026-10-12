import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run, transaction } from '@/lib/db';
import { getCurrentUser, checkPermission } from '@/lib/auth';
import { generatePermanentCode } from '@/lib/codes';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');
    const condition = searchParams.get('condition');
    const categoryId = searchParams.get('categoryId');
    const sortBy = searchParams.get('sortBy') || 'permanent_code';
    const sortDir = searchParams.get('sortDir') === 'DESC' ? 'DESC' : 'ASC';

    let sql = `
      SELECT 
        i.id,
        i.permanent_code,
        i.serial_number,
        i.brand,
        i.model,
        i.operational_status,
        i.physical_condition,
        i.purchase_date,
        i.supplier,
        i.purchase_price,
        i.replacement_value,
        i.residual_value,
        i.currency,
        i.warranty_expiration,
        i.invoice_number,
        i.notes,
        i.created_at,
        p.id as product_id,
        p.name as product_name,
        p.code as product_code,
        c.id as category_id,
        c.name as category_name,
        d.id as department_id,
        d.code as department_code,
        d.name as department_name,
        loc.name as location_name,
        COALESCE(e.id, u.id) as assigned_user_id,
        COALESCE(e.full_name, u.full_name) as assigned_user_name,
        COALESCE(e.email, u.email) as assigned_user_email,
        e.phone as assigned_user_phone,
        e.employee_code as assigned_employee_code
      FROM inventory_items i
      JOIN products p ON i.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN departments d ON i.current_department_id = d.id
      LEFT JOIN locations loc ON i.current_location_id = loc.id
      LEFT JOIN users u ON i.current_assigned_user_id = u.id
      LEFT JOIN employees e ON (i.current_employee_id = e.id OR (i.current_employee_id IS NULL AND u.employee_id = e.id))
      WHERE 1=1
    `;

    const params: any[] = [];

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      sql += ` AND (
        i.permanent_code LIKE ? OR 
        i.serial_number LIKE ? OR 
        p.code LIKE ? OR
        p.name LIKE ? OR 
        i.brand LIKE ? OR 
        i.model LIKE ? OR
        e.full_name LIKE ? OR
        u.full_name LIKE ? OR
        e.employee_code LIKE ? OR
        e.phone LIKE ? OR
        i.purchase_date LIKE ? OR
        i.created_at LIKE ? OR
        i.invoice_number LIKE ? OR
        i.supplier LIKE ?
      )`;
      params.push(term, term, term, term, term, term, term, term, term, term, term, term, term, term);
    }

    if (departmentId) {
      sql += ` AND i.current_department_id = ?`;
      params.push(departmentId);
    }

    if (status) {
      sql += ` AND i.operational_status = ?`;
      params.push(status);
    }

    if (condition) {
      sql += ` AND i.physical_condition = ?`;
      params.push(condition);
    }

    if (categoryId) {
      sql += ` AND c.id = ?`;
      params.push(categoryId);
    }

    // Ordenamiento seguro
    const allowedSortCols = ['permanent_code', 'product_name', 'department_name', 'operational_status', 'physical_condition', 'purchase_price', 'created_at'];
    const safeCol = allowedSortCols.includes(sortBy) ? sortBy : 'permanent_code';
    sql += ` ORDER BY ${safeCol === 'product_name' ? 'p.name' : safeCol === 'department_name' ? 'd.name' : 'i.' + safeCol} ${sortDir}`;

    const items = await query(sql, params);
    return NextResponse.json({ success: true, count: items.length, items });
  } catch (error: any) {
    console.error('Error al consultar inventario:', error);
    return NextResponse.json({ error: 'Error al consultar inventario.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !checkPermission(user, 'AREA_MANAGER')) {
      return NextResponse.json({ error: 'No autorizado para registrar activos.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      productId,
      departmentId,
      locationId,
      serialNumber,
      brand,
      model,
      physicalCondition = 'NUEVO',
      operationalStatus = 'DISPONIBLE',
      purchaseDate = new Date().toISOString().split('T')[0],
      receptionDate = new Date().toISOString().split('T')[0],
      supplier,
      purchasePrice,
      replacementValue,
      residualValue,
      currency = 'GTQ',
      warrantyExpiration,
      invoiceNumber,
      purchaseOrder,
      notes,
      chargedDepartmentId, // Para registro de costo
    } = body;

    if (!productId || !departmentId) {
      return NextResponse.json(
        { error: 'Debe especificar el producto y el departamento asignado.' },
        { status: 400 }
      );
    }

    // Obtener código de departamento para generar el identificador permanente
    const dept = await queryOne<{ code: string }>(`SELECT code FROM departments WHERE id = ?`, [departmentId]);
    const permanentCode = await generatePermanentCode(dept?.code || 'GEN');
    const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Transacción atómica
    await transaction(async () => {
      // 1. Insertar el activo individual
      await run(
        `INSERT INTO inventory_items (
          id, product_id, permanent_code, serial_number, brand, model,
          current_department_id, current_location_id, operational_status, physical_condition,
          purchase_date, reception_date, supplier, purchase_price, replacement_value, residual_value,
          currency, warranty_expiration, invoice_number, purchase_order, notes, registered_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId, productId, permanentCode, serialNumber?.trim() || null, brand?.trim() || null, model?.trim() || null,
          departmentId, locationId || null, operationalStatus, physicalCondition,
          purchaseDate, receptionDate, supplier?.trim() || null,
          purchasePrice ? parseFloat(purchasePrice) : null,
          replacementValue ? parseFloat(replacementValue) : null,
          residualValue ? parseFloat(residualValue) : 0,
          currency, warrantyExpiration || null, invoiceNumber?.trim() || null, purchaseOrder?.trim() || null,
          notes?.trim() || null, user.id
        ]
      );

      // 2. Registrar movimiento de entrada en kardex
      const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      await run(
        `INSERT INTO inventory_movements (
          id, movement_type, item_id, product_id, quantity, unit_cost, total_cost,
          to_department_id, reason, reference_code, user_id
        ) VALUES (?, 'RECEPCION', ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
        [
          movId, itemId, productId,
          purchasePrice ? parseFloat(purchasePrice) : null,
          purchasePrice ? parseFloat(purchasePrice) : null,
          departmentId, 'Alta de activo nuevo con identificador permanente',
          invoiceNumber || permanentCode, user.id
        ]
      );

      // 3. Si se registró costo de compra conocido, crear registro económico
      if (purchasePrice && parseFloat(purchasePrice) > 0) {
        const costId = `cst-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        const priceNum = parseFloat(purchasePrice);
        await run(
          `INSERT INTO cost_records (
            id, item_id, product_id, cost_nature, concept, amount, total_amount, currency,
            expense_date, requesting_department_id, originating_department_id, recording_department_id,
            budget_department_id, charged_department_id, supplier, invoice_number, purchase_order,
            recorded_by_user_id
          ) VALUES (?, ?, ?, 'ADQUISICION', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            costId, itemId, productId,
            `Adquisición activo ${permanentCode}`,
            priceNum, priceNum, currency,
            purchaseDate, departmentId, departmentId, user.departmentId || departmentId,
            chargedDepartmentId || departmentId, chargedDepartmentId || departmentId,
            supplier || null, invoiceNumber || null, purchaseOrder || null, user.id
          ]
        );
      }
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'CREAR_ACTIVO',
      module: 'INVENTARIO',
      entityId: itemId,
      entityName: permanentCode,
      afterState: { permanentCode, productId, departmentId, purchasePrice },
      reason: 'Registro formal de nuevo activo individual',
    });

    return NextResponse.json({
      success: true,
      message: `Activo ${permanentCode} registrado con éxito.`,
      item: { id: itemId, permanentCode }
    });
  } catch (error: any) {
    console.error('Error al registrar activo:', error);
    return NextResponse.json({ error: error.message || 'Error al registrar activo.' }, { status: 500 });
  }
}
