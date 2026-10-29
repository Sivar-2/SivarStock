import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run, transaction } from '@/lib/db';
import { getCurrentUser, canAccessModule } from '@/lib/auth';
import { generatePermanentCode, generateAssignmentCode } from '@/lib/codes';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const departmentId = searchParams.get('departmentId');
    const employeeId = searchParams.get('employeeId');
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
        i.mac_address,
        i.imei,
        i.ip_address,
        i.hostname,
        i.specifications,
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
        i.current_employee_id,
        i.current_department_id,
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
        i.mac_address LIKE ? OR
        i.imei LIKE ? OR
        i.ip_address LIKE ? OR
        i.hostname LIKE ? OR
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
      params.push(
        term, term, term, term, term, term,
        term, term, term, term, term, term,
        term, term, term, term, term, term
      );
    }

    if (departmentId) {
      sql += ` AND i.current_department_id = ?`;
      params.push(departmentId);
    }

    if (employeeId) {
      sql += ` AND i.current_employee_id = ?`;
      params.push(employeeId);
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
    if (!user || !canAccessModule(user, 'INVENTARIO', 'WRITE')) {
      return NextResponse.json({ error: 'No autorizado para registrar activos.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      productId,
      departmentId,
      employeeId, // Si se registra directamente al expediente de un empleado
      locationId,
      serialNumber,
      macAddress,
      imei,
      ipAddress,
      hostname,
      specifications,
      brand,
      model,
      physicalCondition = 'NUEVO',
      operationalStatus,
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

    if (!productId || (!departmentId && !employeeId)) {
      return NextResponse.json(
        { error: 'Debe especificar el producto y el departamento o empleado asignado.' },
        { status: 400 }
      );
    }

    const prod = await queryOne<any>(`SELECT * FROM products WHERE id = ?`, [productId]);
    if (!prod) {
      return NextResponse.json({ error: 'Producto de catálogo no encontrado.' }, { status: 404 });
    }

    let emp: any = null;
    if (employeeId) {
      emp = await queryOne<any>(`SELECT * FROM employees WHERE id = ?`, [employeeId]);
    }

    const effectiveDeptId = departmentId || emp?.department_id || 'dept-bod';
    const effectiveStatus = employeeId ? 'ASIGNADO' : (operationalStatus || 'DISPONIBLE');

    // Obtener código de departamento para generar el identificador permanente
    const dept = await queryOne<{ code: string }>(`SELECT code FROM departments WHERE id = ?`, [effectiveDeptId]);
    const permanentCode = await generatePermanentCode(dept?.code || 'GEN');
    const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    let generatedAssignmentCode: string | null = null;
    if (emp) {
      generatedAssignmentCode = await generateAssignmentCode(emp.initials || 'EMP', prod.code || 'ACT', new Date().getFullYear());
    }

    // Transacción atómica
    await transaction(async () => {
      // 1. Insertar el activo individual con serie, MAC, IMEI, IP, Hostname y estado
      await run(
        `INSERT INTO inventory_items (
          id, product_id, permanent_code, serial_number, mac_address, imei, ip_address, hostname, specifications,
          brand, model, current_department_id, current_employee_id, current_location_id,
          operational_status, physical_condition, purchase_date, reception_date, supplier,
          purchase_price, replacement_value, residual_value, currency, warranty_expiration,
          invoice_number, purchase_order, notes, registered_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          productId,
          permanentCode,
          serialNumber?.trim() || null,
          macAddress?.trim() || null,
          imei?.trim() || null,
          ipAddress?.trim() || null,
          hostname?.trim() || null,
          specifications?.trim() || null,
          brand?.trim() || prod.brand || null,
          model?.trim() || prod.model || null,
          effectiveDeptId,
          employeeId || null,
          locationId || null,
          effectiveStatus,
          physicalCondition,
          purchaseDate,
          receptionDate,
          supplier?.trim() || prod.default_supplier || null,
          purchasePrice ? parseFloat(purchasePrice) : (prod.unit_price || null),
          replacementValue ? parseFloat(replacementValue) : (purchasePrice ? parseFloat(purchasePrice) : (prod.unit_price || null)),
          residualValue ? parseFloat(residualValue) : 0,
          currency,
          warrantyExpiration || null,
          invoiceNumber?.trim() || null,
          purchaseOrder?.trim() || null,
          notes?.trim() || null,
          user.id
        ]
      );

      // 2. Si el activo ingresa DISPONIBLE en Bodega, incrementar el stock disponible del producto en catálogo
      if (effectiveStatus === 'DISPONIBLE') {
        await run(`UPDATE products SET current_stock = COALESCE(current_stock, 0) + 1 WHERE id = ?`, [productId]);
      }

      // 3. Registrar movimiento de entrada en kardex
      const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      await run(
        `INSERT INTO inventory_movements (
          id, movement_type, item_id, product_id, quantity, unit_cost, total_cost,
          to_department_id, to_employee_id, reason, reference_code, user_id
        ) VALUES (?, 'RECEPCION', ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
        [
          movId, itemId, productId,
          purchasePrice ? parseFloat(purchasePrice) : (prod.unit_price || null),
          purchasePrice ? parseFloat(purchasePrice) : (prod.unit_price || null),
          effectiveDeptId,
          employeeId || null,
          emp
            ? `Alta de activo nuevo (${permanentCode}) e incorporación directa al empleado ${emp.full_name}`
            : 'Alta de activo nuevo con identificador permanente en inventario total',
          invoiceNumber || permanentCode, user.id
        ]
      );

      // 4. Si se asignó directamente a un empleado al momento de registrarlo, crear su Acta de Asignación formal
      if (emp && generatedAssignmentCode) {
        const asgId = `asg-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        await run(
          `INSERT INTO assignments (
            id, assignment_code, item_id, product_id, employee_id, quantity,
            assigned_by_user_id, origin_department_id, target_department_id, charged_department_id,
            assigned_at, status, notes
          ) VALUES (?, ?, ?, ?, ?, 1, ?, 'dept-bod', ?, ?, datetime('now'), 'ACTIVA', ?)`,
          [
            asgId,
            generatedAssignmentCode,
            itemId,
            productId,
            emp.id,
            user.id,
            effectiveDeptId,
            chargedDepartmentId || effectiveDeptId,
            notes?.trim() || `Asignación directa de activo ${permanentCode} al empleado ${emp.full_name}`
          ]
        );
      }

      // 5. Si se registró costo de compra conocido, crear registro económico
      const finalPrice = purchasePrice ? parseFloat(purchasePrice) : 0;
      if (finalPrice > 0) {
        const costId = `cst-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        await run(
          `INSERT INTO cost_records (
            id, item_id, product_id, cost_nature, concept, amount, total_amount, currency,
            expense_date, requesting_department_id, originating_department_id, recording_department_id,
            budget_department_id, charged_department_id, supplier, invoice_number, purchase_order,
            recorded_by_user_id
          ) VALUES (?, ?, ?, 'ADQUISICION', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            costId, itemId, productId,
            `Adquisición activo ${permanentCode} (${prod.name})`,
            finalPrice, finalPrice, currency,
            purchaseDate, effectiveDeptId, effectiveDeptId, user.departmentId || effectiveDeptId,
            chargedDepartmentId || effectiveDeptId, chargedDepartmentId || effectiveDeptId,
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
      afterState: { permanentCode, productId, departmentId: effectiveDeptId, employeeId, serialNumber, macAddress, imei, purchasePrice },
      reason: emp
        ? `Registro de activo ${permanentCode} asignado a ${emp.full_name} e integrado al inventario total`
        : 'Registro formal de nuevo activo individual',
    });

    return NextResponse.json({
      success: true,
      message: emp
        ? `Activo ${permanentCode} registrado en el inventario total y asignado a ${emp.full_name} (${generatedAssignmentCode}).`
        : `Activo ${permanentCode} registrado con éxito.`,
      item: { id: itemId, permanentCode, assignmentCode: generatedAssignmentCode }
    });
  } catch (error: any) {
    console.error('Error al registrar activo:', error);
    return NextResponse.json({ error: error.message || 'Error al registrar activo.' }, { status: 500 });
  }
}
