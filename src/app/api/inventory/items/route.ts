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
        i.is_rented,
        i.rental_cost,
        i.rental_provider,
        i.qr_printed,
        i.qr_printed_at,
        i.label_orientation,
        i.current_employee_id,
        i.current_department_id,
        i.created_at,
        p.id as product_id,
        p.name as product_name,
        p.code as product_code,
        p.unit_of_measure,
        p.current_stock as product_stock,
        p.is_rented as product_is_rented,
        p.rental_cost as product_rental_cost,
        p.rental_provider as product_rental_provider,
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
      if (status === 'BODEGA_Y_MANTENIMIENTO') {
        sql += ` AND i.operational_status IN ('DISPONIBLE', 'EN_REVISION', 'AVERIADO', 'DEVOLUCION_PENDIENTE')`;
      } else if (status === 'EN_MANTENIMIENTO_GROUP') {
        sql += ` AND i.operational_status IN ('EN_REVISION', 'AVERIADO')`;
      } else {
        sql += ` AND i.operational_status = ?`;
        params.push(status);
      }
    }

    if (condition) {
      sql += ` AND i.physical_condition = ?`;
      params.push(condition);
    }

    if (categoryId) {
      sql += ` AND c.id = ?`;
      params.push(categoryId);
    }

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
      return NextResponse.json({ error: 'No autorizado para operar en Bodega.' }, { status: 403 });
    }

    const body = await req.json();

    // Acción rápida: Traslado de Bodega / Departamento
    if (body.action === 'TRANSFER') {
      const { itemId, toDepartmentId, notes } = body;
      if (!itemId || !toDepartmentId) {
        return NextResponse.json({ error: 'Seleccione el producto y el departamento destino.' }, { status: 400 });
      }
      const item = await queryOne<any>(`SELECT * FROM inventory_items WHERE id = ?`, [itemId]);
      if (!item) return NextResponse.json({ error: 'Activo no encontrado en Bodega.' }, { status: 404 });

      const destDept = await queryOne<any>(`SELECT * FROM departments WHERE id = ?`, [toDepartmentId]);
      await transaction(async () => {
        await run(
          `UPDATE inventory_items SET current_department_id = ?, updated_at = datetime('now') WHERE id = ?`,
          [toDepartmentId, itemId]
        );
        await run(
          `INSERT INTO inventory_movements (
            id, movement_type, item_id, product_id, quantity,
            from_department_id, to_department_id, reason, reference_code, user_id
          ) VALUES (?, 'TRANSFERENCIA', ?, ?, 1, ?, ?, ?, ?, ?)`,
          [
            `mov-${Date.now()}`,
            itemId,
            item.product_id,
            item.current_department_id || 'dept-bod',
            toDepartmentId,
            notes || `Traslado desde Bodega hacia ${destDept?.name || toDepartmentId}`,
            item.permanent_code,
            user.id,
          ]
        );
      });

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'TRASLADO_BODEGA',
        module: 'INVENTARIO',
        entityId: itemId,
        entityName: item.permanent_code,
        reason: `Traslado a ${destDept?.name || toDepartmentId}. ${notes || ''}`,
      });

      return NextResponse.json({
        success: true,
        message: `Producto ${item.permanent_code} trasladado a ${destDept?.name || 'nueva ubicación'}.`,
      });
    }

    // Acción rápida: Enviar a Mantenimiento desde Bodega
    if (body.action === 'SEND_TO_MAINTENANCE') {
      const { itemId, faultDescription, severity = 'MODERADA', repairProviderType = 'INTERNO_IT', technicianSupplier = 'Soporte IT Interno' } = body;
      if (!itemId || !faultDescription) {
        return NextResponse.json({ error: 'Debe indicar el motivo o falla para enviar a mantenimiento.' }, { status: 400 });
      }
      const item = await queryOne<any>(`SELECT * FROM inventory_items WHERE id = ?`, [itemId]);
      if (!item) return NextResponse.json({ error: 'Activo no encontrado.' }, { status: 404 });

      const maintId = `mnt-${Date.now()}`;
      await transaction(async () => {
        await run(
          `UPDATE inventory_items SET operational_status = 'EN_REVISION', physical_condition = 'EN_REPARACION', is_broken = 1, broken_notes = ?, updated_at = datetime('now') WHERE id = ?`,
          [faultDescription, itemId]
        );
        if (item.operational_status === 'DISPONIBLE') {
          await run(`UPDATE products SET current_stock = MAX(0, COALESCE(current_stock, 1) - 1) WHERE id = ?`, [item.product_id]);
        }
        await run(
          `INSERT INTO maintenance_records (
            id, item_id, reported_date, reported_by_user_id, fault_description,
            severity, technician_supplier, repair_provider_type, status, updates_log_json
          ) VALUES (?, ?, date('now'), ?, ?, ?, ?, ?, 'EN_REPARACION', ?)`,
          [
            maintId,
            itemId,
            user.id,
            faultDescription,
            severity,
            technicianSupplier,
            repairProviderType,
            JSON.stringify([
              {
                date: new Date().toISOString(),
                author: user.fullName || user.username,
                note: `Ingresado a mantenimiento (${repairProviderType === 'TERCERO_EXTERNO' ? 'Proveedor Externo: ' + technicianSupplier : 'Taller Interno IT'}): ${faultDescription}`,
              },
            ]),
          ]
        );
        await run(
          `INSERT INTO inventory_movements (
            id, movement_type, item_id, product_id, quantity, from_department_id, reason, reference_code, user_id
          ) VALUES (?, 'REPARACION', ?, ?, 1, ?, ?, ?, ?)`,
          [
            `mov-${Date.now()}`,
            itemId,
            item.product_id,
            item.current_department_id || 'dept-bod',
            `Enviado a Mantenimiento (${technicianSupplier}): ${faultDescription}`,
            item.permanent_code,
            user.id,
          ]
        );
      });

      return NextResponse.json({
        success: true,
        message: `Activo ${item.permanent_code} enviado a Mantenimiento y registrado en Averías.`,
      });
    }

    // Acción rápida: Marcar Etiqueta QR como Impresa
    if (body.action === 'MARK_QR_PRINTED') {
      const { itemIds = [], orientation = 'HORIZONTAL' } = body;
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return NextResponse.json({ error: 'Seleccione al menos un activo para marcar como impreso.' }, { status: 400 });
      }
      const nowStr = new Date().toISOString();
      await transaction(async () => {
        for (const id of itemIds) {
          await run(
            `UPDATE inventory_items SET qr_printed = 1, qr_printed_at = ?, label_orientation = ? WHERE id = ?`,
            [nowStr, orientation, id]
          );
        }
      });
      return NextResponse.json({
        success: true,
        message: `${itemIds.length} etiqueta(s) marcada(s) como impresas.`,
      });
    }

    // Registro de Nuevo Producto / Activo en Bodega
    const {
      productId,
      newProductName,
      newCategoryId,
      unitOfMeasure = 'unidad',
      departmentId = 'dept-bod',
      employeeId,
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
      operationalStatus = 'DISPONIBLE',
      purchaseDate = new Date().toISOString().split('T')[0],
      receptionDate = new Date().toISOString().split('T')[0],
      supplier,
      supplierPhone,
      contractNumber,
      purchasePrice,
      replacementValue,
      residualValue,
      currency = 'GTQ',
      warrantyExpiration,
      invoiceNumber,
      purchaseOrder,
      notes,
      chargedDepartmentId,
      isRented = false,
      rentalCost = 0,
      rentalProvider = '',
      quantity = 1,
    } = body;

    let resolvedProductId = productId;

    // Si el usuario escribió un nuevo producto directamente desde Bodega, crearlo automáticamente
    if (!resolvedProductId && newProductName && newProductName.trim()) {
      const catId = newCategoryId || 'cat-comp';
      const cat = await queryOne<any>(`SELECT code FROM categories WHERE id = ?`, [catId]);
      const prefix = cat?.code || 'BOD';
      const countRow = await queryOne<any>(`SELECT COUNT(*) as total FROM products WHERE category_id = ?`, [catId]);
      const nextSeq = ((countRow ? Number(countRow.total) : 0) + 1).toString().padStart(3, '0');
      const generatedProdCode = `${prefix}-${nextSeq}-${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
      resolvedProductId = `prod-${Date.now()}`;

      await run(
        `INSERT INTO products (
          id, category_id, code, name, description, brand, model,
          unit_of_measure, current_stock, min_stock, target_stock,
          unit_price, default_supplier, is_consumable,
          is_rented, rental_cost, rental_provider, supplier_phone, contract_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 2, 10, ?, ?, 0, ?, ?, ?, ?, ?)`,
        [
          resolvedProductId,
          catId,
          generatedProdCode,
          newProductName.trim(),
          specifications || notes || null,
          brand?.trim() || null,
          model?.trim() || null,
          unitOfMeasure || 'unidad',
          purchasePrice ? parseFloat(purchasePrice) : 0,
          supplier?.trim() || null,
          isRented ? 1 : 0,
          rentalCost ? parseFloat(String(rentalCost)) : 0,
          rentalProvider?.trim() || null,
          supplierPhone?.trim() || null,
          contractNumber?.trim() || null,
        ]
      );
    }

    if (!resolvedProductId) {
      return NextResponse.json(
        { error: 'Seleccione un producto del catálogo o escriba el nombre del nuevo producto.' },
        { status: 400 }
      );
    }

    const prod = await queryOne<any>(`SELECT * FROM products WHERE id = ?`, [resolvedProductId]);
    if (!prod) {
      return NextResponse.json({ error: 'Producto de catálogo no encontrado.' }, { status: 404 });
    }

    let emp: any = null;
    if (employeeId) {
      emp = await queryOne<any>(`SELECT * FROM employees WHERE id = ?`, [employeeId]);
    }

    const effectiveDeptId = departmentId || emp?.department_id || 'dept-bod';
    const effectiveStatus = employeeId ? 'ASIGNADO' : (operationalStatus || 'DISPONIBLE');
    const dept = await queryOne<{ code: string }>(`SELECT code FROM departments WHERE id = ?`, [effectiveDeptId]);
    const qtyToCreate = Math.max(1, Math.min(50, Number(quantity) || 1));

    const createdCodes: string[] = [];
    let firstItemId = '';
    let generatedAssignmentCode: string | null = null;

    await transaction(async () => {
      for (let idx = 0; idx < qtyToCreate; idx++) {
        const permanentCode = await generatePermanentCode(dept?.code || 'BOD');
        const itemId = `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
        if (idx === 0) firstItemId = itemId;
        createdCodes.push(permanentCode);

        const itemSerial = qtyToCreate === 1
          ? (serialNumber?.trim() || null)
          : (serialNumber?.trim() ? `${serialNumber.trim()}-${idx + 1}` : null);

        await run(
          `INSERT INTO inventory_items (
            id, product_id, permanent_code, serial_number, mac_address, imei, ip_address, hostname, specifications,
            brand, model, current_department_id, current_employee_id, current_location_id,
            operational_status, physical_condition, purchase_date, reception_date, supplier,
            purchase_price, replacement_value, residual_value, currency, warranty_expiration,
            invoice_number, purchase_order, notes, is_rented, rental_cost, rental_provider, registered_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            resolvedProductId,
            permanentCode,
            itemSerial,
            idx === 0 ? (macAddress?.trim() || null) : null,
            idx === 0 ? (imei?.trim() || null) : null,
            idx === 0 ? (ipAddress?.trim() || null) : null,
            idx === 0 ? (hostname?.trim() || null) : null,
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
            isRented ? 1 : (prod.is_rented || 0),
            rentalCost ? parseFloat(String(rentalCost)) : (prod.rental_cost || 0),
            rentalProvider?.trim() || prod.rental_provider || null,
            user.id,
          ]
        );

        if (effectiveStatus === 'DISPONIBLE') {
          await run(`UPDATE products SET current_stock = COALESCE(current_stock, 0) + 1 WHERE id = ?`, [resolvedProductId]);
        }

        // Si ingresa directamente en mantenimiento (EN_REVISION o AVERIADO), crear ficha en Averías y Mantenimiento
        if (effectiveStatus === 'EN_REVISION' || effectiveStatus === 'AVERIADO') {
          await run(
            `INSERT INTO maintenance_records (
              id, item_id, reported_date, reported_by_user_id, fault_description,
              severity, technician_supplier, repair_provider_type, status, updates_log_json
            ) VALUES (?, ?, date('now'), ?, ?, 'MODERADA', ?, 'INTERNO_IT', 'EN_REPARACION', ?)`,
            [
              `mnt-${Date.now()}-${idx}`,
              itemId,
              user.id,
              notes?.trim() || 'Producto registrado en Bodega en estado de Mantenimiento',
              supplier?.trim() || 'Taller IT',
              JSON.stringify([
                {
                  date: new Date().toISOString(),
                  author: user.fullName || user.username,
                  note: notes?.trim() || 'Ingreso directo a mantenimiento desde Bodega',
                },
              ]),
            ]
          );
        }

        const movId = `mov-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`;
        await run(
          `INSERT INTO inventory_movements (
            id, movement_type, item_id, product_id, quantity, unit_cost, total_cost,
            to_department_id, to_employee_id, recipient_name, reason, reference_code, user_id
          ) VALUES (?, 'RECEPCION', ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            movId,
            itemId,
            resolvedProductId,
            purchasePrice ? parseFloat(purchasePrice) : (prod.unit_price || null),
            purchasePrice ? parseFloat(purchasePrice) : (prod.unit_price || null),
            effectiveDeptId,
            employeeId || null,
            emp?.full_name || 'Bodega Central',
            emp
              ? `Ingreso en Bodega (${permanentCode}) y asignación directa a ${emp.full_name}`
              : `Ingreso de producto a Bodega (${permanentCode})`,
            invoiceNumber || permanentCode,
            user.id,
          ]
        );

        if (emp) {
          generatedAssignmentCode = await generateAssignmentCode(emp.initials || 'EMP', prod.code || 'ACT', new Date().getFullYear());
          const asgId = `asg-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`;
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
              resolvedProductId,
              emp.id,
              user.id,
              effectiveDeptId,
              chargedDepartmentId || effectiveDeptId,
              notes?.trim() || `Asignación desde Bodega (${permanentCode}) a ${emp.full_name}`,
            ]
          );
        }
      }

      const unitPriceVal = purchasePrice ? parseFloat(purchasePrice) : 0;
      const finalPrice = unitPriceVal * qtyToCreate;
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
            costId,
            firstItemId,
            resolvedProductId,
            `Ingreso a Bodega (${qtyToCreate}x ${prod.name}) [${createdCodes.join(', ')}]`,
            finalPrice,
            finalPrice,
            currency,
            purchaseDate,
            effectiveDeptId,
            effectiveDeptId,
            user.departmentId || effectiveDeptId,
            chargedDepartmentId || effectiveDeptId,
            chargedDepartmentId || effectiveDeptId,
            supplier || null,
            invoiceNumber || null,
            purchaseOrder || null,
            user.id,
          ]
        );
      }
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'CREAR_ACTIVO_BODEGA',
      module: 'INVENTARIO',
      entityId: firstItemId,
      entityName: createdCodes.join(', '),
      afterState: { createdCodes, productId: resolvedProductId, departmentId: effectiveDeptId, employeeId, serialNumber, macAddress, imei, purchasePrice },
      reason: `Registro en Bodega de ${qtyToCreate} unidad(es): ${createdCodes.join(', ')}`,
    });

    return NextResponse.json({
      success: true,
      message: qtyToCreate > 1
        ? `Se registraron ${qtyToCreate} unidades en Bodega (${createdCodes[0]} ... ${createdCodes[createdCodes.length - 1]}).`
        : emp
          ? `Producto ${createdCodes[0]} registrado y asignado a ${emp.full_name} (${generatedAssignmentCode}).`
          : `Producto ${createdCodes[0]} registrado en Bodega exitosamente.`,
      item: { id: firstItemId, permanentCode: createdCodes[0], assignmentCode: generatedAssignmentCode },
    });
  } catch (error: any) {
    console.error('Error al registrar activo en Bodega:', error);
    return NextResponse.json({ error: error.message || 'Error al registrar activo en Bodega.' }, { status: 500 });
  }
}
