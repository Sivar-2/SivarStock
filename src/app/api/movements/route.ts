import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { getCurrentUser, canAccessModule } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { DEFAULT_ISSUER_NAME, DEFAULT_ISSUER_ROLE, DEFAULT_LEGAL_NOTICE } from '@/app/api/actas/route';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!canAccessModule(user, 'MOVIMIENTOS', 'view')) {
      return NextResponse.json(
        { error: 'Acceso denegado al módulo de Entradas y Movimientos.' },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const movementType = url.searchParams.get('movementType');
    const productId = url.searchParams.get('productId');
    const fromDate = url.searchParams.get('fromDate');
    const toDate = url.searchParams.get('toDate');

    let sql = `
      SELECT 
        m.id, m.movement_type, m.product_id, m.quantity, m.unit_cost, m.total_cost,
        m.reason, m.reference_code, m.created_at,
        m.from_department_id, m.to_department_id,
        m.from_employee_id, m.to_employee_id,
        m.recipient_name, m.requires_acta, m.acta_id, m.acta_code,
        COALESCE(da.status, m.acta_status) as acta_status,
        da.public_token as acta_token,
        p.name as product_name, p.code as product_code, p.unit_of_measure, p.brand as product_brand, p.model as product_model,
        fd.name as from_dept_name, td.name as to_dept_name,
        fe.full_name as from_employee_name,
        COALESCE(te.full_name, m.recipient_name) as to_employee_name,
        te.email as to_employee_email, te.phone as to_employee_phone, te.dpi as to_employee_dpi,
        u.username as executed_by_username, u.full_name as executed_by_name
      FROM inventory_movements m
      LEFT JOIN products p ON m.product_id = p.id
      LEFT JOIN departments fd ON m.from_department_id = fd.id
      LEFT JOIN departments td ON m.to_department_id = td.id
      LEFT JOIN employees fe ON m.from_employee_id = fe.id
      LEFT JOIN employees te ON m.to_employee_id = te.id
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN delivery_actas da ON m.acta_id = da.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (movementType) {
      sql += ` AND m.movement_type = ?`;
      params.push(movementType);
    }
    if (productId) {
      sql += ` AND m.product_id = ?`;
      params.push(productId);
    }
    if (fromDate) {
      sql += ` AND m.created_at >= ?`;
      params.push(`${fromDate} 00:00:00`);
    }
    if (toDate) {
      sql += ` AND m.created_at <= ?`;
      params.push(`${toDate} 23:59:59`);
    }

    sql += ` ORDER BY m.created_at DESC`;

    const movements = await query(sql, params);
    return NextResponse.json({ movements });
  } catch (error: any) {
    console.error('Error al listar movimientos:', error);
    return NextResponse.json({ error: 'Error al consultar movimientos.' }, { status: 500 });
  }
}

async function createLinkedActa(params: {
  employeeId?: string | null;
  recipientName: string;
  productName: string;
  productCode: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  quantity: number;
  condition?: string;
  notes?: string;
}) {
  const emp = params.employeeId
    ? await queryOne<any>(
        `SELECT e.*, d.name as department_name, s.full_name as supervisor_name
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         LEFT JOIN employees s ON e.supervisor_id = s.id
         WHERE e.id = ?`,
        [params.employeeId]
      )
    : null;

  const settingsRows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM system_settings WHERE key IN ('acta_issuer_name', 'acta_issuer_role', 'acta_issuer_signature')`
  );
  const map: Record<string, string> = {};
  for (const r of settingsRows) map[r.key] = r.value;

  const issuerName = map['acta_issuer_name'] || DEFAULT_ISSUER_NAME;
  const issuerRole =
    !map['acta_issuer_role'] || map['acta_issuer_role'] === 'Jefe de IT / Administración de Inventario'
      ? DEFAULT_ISSUER_ROLE
      : map['acta_issuer_role'];
  const issuerSignature = map['acta_issuer_signature'] || null;

  const year = new Date().getFullYear();
  const countRow = await queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM delivery_actas`);
  const nextNum = ((countRow?.cnt || 0) + 1).toString().padStart(4, '0');
  const actaCode = `ACTA-${year}-${nextNum}`;
  const actaId = `acta-${Date.now()}`;
  const publicToken = `tok-${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
  const nowIso = new Date().toISOString();

  const items = [
    {
      code: params.productCode,
      name: params.productName,
      brand: params.brand || '',
      model: params.model || '',
      serialNumber: params.serialNumber || 'S/N',
      quantity: params.quantity || 1,
      condition: params.condition || 'Nuevo',
    },
  ];

  await run(
    `INSERT INTO delivery_actas (
      id, acta_code, acta_type, employee_id, employee_code, employee_name,
      employee_dpi, employee_email, employee_phone, department_name, supervisor_name,
      delivered_by_name, delivered_by_role, delivered_by_signature,
      items_json, delivery_date, status, public_token, legal_notice, notes
    ) VALUES (?, ?, 'ENTREGA_INICIAL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE_FIRMA', ?, ?, ?)`,
    [
      actaId,
      actaCode,
      emp?.id || null,
      emp?.employee_code || null,
      emp?.full_name || params.recipientName || 'Colaborador',
      emp?.dpi || null,
      emp?.email || null,
      emp?.phone || null,
      emp?.department_name || null,
      emp?.supervisor_name || null,
      issuerName,
      issuerRole,
      issuerSignature,
      JSON.stringify(items),
      nowIso,
      publicToken,
      DEFAULT_LEGAL_NOTICE,
      params.notes || null,
    ]
  );

  return { actaId, actaCode, publicToken };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!canAccessModule(user, 'MOVIMIENTOS', 'create')) {
      return NextResponse.json(
        { error: 'Acceso denegado para registrar movimientos.' },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Acción rápida: Generar Acta Digital para un movimiento existente que no tenía acta
    if (body.action === 'GENERATE_ACTA_FOR_MOVEMENT') {
      const { movementId, employeeId, recipientName } = body;
      const mov = await queryOne<any>(
        `SELECT m.*, p.name as product_name, p.code as product_code, p.brand, p.model,
                te.full_name as emp_name
         FROM inventory_movements m
         LEFT JOIN products p ON m.product_id = p.id
         LEFT JOIN employees te ON m.to_employee_id = te.id
         WHERE m.id = ?`,
        [movementId]
      );
      if (!mov) {
        return NextResponse.json({ error: 'Movimiento no encontrado.' }, { status: 404 });
      }

      const targetEmpId = employeeId || mov.to_employee_id || null;
      const targetName = recipientName || mov.emp_name || mov.recipient_name || 'Colaborador Asignado';

      const { actaId, actaCode, publicToken } = await createLinkedActa({
        employeeId: targetEmpId,
        recipientName: targetName,
        productName: mov.product_name || 'Equipo / Suministro',
        productCode: mov.product_code || 'PROD',
        brand: mov.brand || '',
        model: mov.model || '',
        quantity: Number(mov.quantity) || 1,
        condition: 'Entregado en Movimiento',
        notes: mov.reason,
      });

      await run(
        `UPDATE inventory_movements
         SET requires_acta = 1, acta_id = ?, acta_code = ?, acta_status = 'PENDIENTE_FIRMA',
             to_employee_id = COALESCE(?, to_employee_id),
             recipient_name = COALESCE(?, recipient_name)
         WHERE id = ?`,
        [actaId, actaCode, targetEmpId, targetName, movementId]
      );

      return NextResponse.json({
        success: true,
        actaId,
        actaCode,
        publicToken,
        message: `Acta Digital ${actaCode} generada y vinculada al movimiento.`,
      });
    }

    const {
      createNewProduct = false,
      newProductName,
      newProductCategoryId,
      newCategoryName,
      newProductBrand,
      newProductModel,
      newProductUnit = 'unidad',
      newProductSerial,
      newProductMac,
      newProductImei,
      isRented = false,
      rentalCost = 0,
      rentalProvider = '',
      supplierName = '',
      supplierPhone = '',
      contractNumber = '',
      destinationType = 'BODEGA', // 'BODEGA' | 'EMPLEADO' | 'SOLO_CATEGORIA'
      productId: existingProductId,
      movementType = 'ENTRADA',
      quantity = 1,
      unitCost,
      fromDepartmentId,
      toDepartmentId,
      fromEmployeeId,
      toEmployeeId,
      recipientName,
      requiresActa = false,
      condition = 'Nuevo',
      reason,
      referenceCode,
      date,
    } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: 'El motivo o justificación del movimiento es obligatorio.' },
        { status: 400 }
      );
    }

    const qty = Math.max(1, Number(quantity) || 1);
    let finalProductId = existingProductId;
    let prod: any = null;

    // Si el usuario eligió agregar un NUEVO PRODUCTO desde Entradas y Movimientos
    if (createNewProduct) {
      if (!newProductName || !String(newProductName).trim()) {
        return NextResponse.json(
          { error: 'Debe indicar el nombre del nuevo producto a ingresar.' },
          { status: 400 }
        );
      }

      let catId = newProductCategoryId;
      if (catId === '__NEW__' && newCategoryName && String(newCategoryName).trim()) {
        catId = `cat-${Date.now()}`;
        const catCode =
          String(newCategoryName)
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 4) +
          '-' +
          Math.floor(100 + Math.random() * 900);
        await run(`INSERT INTO categories (id, code, name, description) VALUES (?, ?, ?, ?)`, [
          catId,
          catCode,
          String(newCategoryName).trim(),
          'Categoría creada desde Entradas y Movimientos',
        ]);
      }

      finalProductId = `prod-${Date.now()}`;
      const prodCode = `PRD-${Math.floor(1000 + Math.random() * 9000)}`;
      const initialPrice = Number(unitCost) || 0;

      await run(
        `INSERT INTO products (
          id, code, name, category_id, brand, model, unit_of_measure,
          unit_price, current_stock, min_stock, is_rented, rental_cost,
          rental_provider, supplier_name, supplier_phone, contract_number,
          assigned_department_id, assigned_employee_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          finalProductId,
          prodCode,
          String(newProductName).trim(),
          catId || 'cat-2',
          newProductBrand || '',
          newProductModel || '',
          newProductUnit || 'unidad',
          initialPrice,
          0, // Se sumará en el paso de movimiento o creación de unidades en bodega
          isRented ? 1 : 0,
          Number(rentalCost) || 0,
          rentalProvider || null,
          supplierName || null,
          supplierPhone || null,
          contractNumber || null,
          toDepartmentId || 'dept-bod',
          toEmployeeId || null,
        ]
      );

      // Si también ingresa a Bodega o se asigna a Empleado, crear los activos en inventory_items
      if (destinationType === 'BODEGA' || destinationType === 'EMPLEADO' || movementType === 'ASIGNACION') {
        const assignEmpId = toEmployeeId || null;
        const itemStatus = assignEmpId ? 'ASIGNADO' : 'DISPONIBLE';
        const itemsToCreate = Math.min(qty, 50);

        for (let i = 0; i < itemsToCreate; i++) {
          const itemId = `item-${Date.now()}-${i}`;
          const assetCode = `SIV-BOD-${Math.floor(1000 + Math.random() * 9000)}${i > 0 ? `-${i + 1}` : ''}`;
          await run(
            `INSERT INTO inventory_items (
              id, product_id, permanent_code, serial_number, mac_address, imei,
              brand, model, current_department_id, current_employee_id, current_location_id,
              operational_status, physical_condition, purchase_date, purchase_price,
              supplier, is_rented, rental_cost, rental_provider, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'loc-bod-1', ?, 'NUEVO', date('now'), ?, ?, ?, ?, ?, ?)`,
            [
              itemId,
              finalProductId,
              assetCode,
              i === 0 && newProductSerial ? newProductSerial : null,
              i === 0 && newProductMac ? newProductMac : null,
              i === 0 && newProductImei ? newProductImei : null,
              newProductBrand || '',
              newProductModel || '',
              toDepartmentId || 'dept-bod',
              assignEmpId,
              itemStatus,
              initialPrice,
              supplierName || null,
              isRented ? 1 : 0,
              Number(rentalCost) || 0,
              rentalProvider || null,
              reason.trim(),
            ]
          );
        }
      }

      prod = await queryOne<any>(`SELECT * FROM products WHERE id = ?`, [finalProductId]);
    } else {
      if (!finalProductId) {
        return NextResponse.json({ error: 'Debe seleccionar un producto.' }, { status: 400 });
      }
      prod = await queryOne<any>(`SELECT * FROM products WHERE id = ?`, [finalProductId]);
      if (!prod) {
        return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });
      }
    }

    const cost = unitCost !== undefined && unitCost !== '' ? Number(unitCost) : Number(prod.unit_price) || 0;
    const totalCost = cost * qty;
    const effectiveDate = date ? `${date} 12:00:00` : new Date().toISOString().replace('T', ' ').slice(0, 19);

    let newStock = Number(prod.current_stock) || 0;
    const isAdding = ['ENTRADA', 'COMPRA', 'RECEPCION', 'DEVOLUCION'].includes(movementType);
    const isDeducting = ['CONSUMO', 'BAJA', 'ASIGNACION', 'PERDIDA'].includes(movementType);

    if (isAdding) {
      newStock += qty;
    } else if (isDeducting && !createNewProduct) {
      if (newStock < qty) {
        return NextResponse.json(
          { error: `Stock insuficiente. Stock actual: ${newStock}, cantidad a retirar: ${qty}` },
          { status: 400 }
        );
      }
      newStock -= qty;
    } else if (createNewProduct && isDeducting) {
      newStock = qty;
    }

    await run(`UPDATE products SET current_stock = ?, unit_price = COALESCE(?, unit_price) WHERE id = ?`, [
      newStock,
      cost > 0 ? cost : prod.unit_price,
      finalProductId,
    ]);

    // Resolver nombre del receptor si se seleccionó empleado
    let resolvedRecipient = recipientName ? String(recipientName).trim() : null;
    if (toEmployeeId && !resolvedRecipient) {
      const empRow = await queryOne<{ full_name: string }>(`SELECT full_name FROM employees WHERE id = ?`, [
        toEmployeeId,
      ]);
      if (empRow) resolvedRecipient = empRow.full_name;
    }

    // Si requiere Acta de Entrega Digital, generarla automáticamente
    let actaId: string | null = null;
    let actaCode: string | null = null;
    let actaStatus = requiresActa ? 'PENDIENTE_FIRMA' : 'NO_REQUERIDA';

    if (requiresActa) {
      const createdActa = await createLinkedActa({
        employeeId: toEmployeeId || null,
        recipientName: resolvedRecipient || 'Colaborador Asignado',
        productName: prod.name,
        productCode: prod.code,
        brand: prod.brand,
        model: prod.model,
        serialNumber: newProductSerial || 'S/N',
        quantity: qty,
        condition: condition || 'Nuevo',
        notes: reason.trim(),
      });
      actaId = createdActa.actaId;
      actaCode = createdActa.actaCode;
      actaStatus = 'PENDIENTE_FIRMA';
    }

    const movId = `mov-${Date.now()}`;
    await run(
      `INSERT INTO inventory_movements (
        id, movement_type, product_id, quantity, unit_cost, total_cost,
        from_department_id, to_department_id, from_employee_id, to_employee_id,
        recipient_name, requires_acta, acta_id, acta_code, acta_status,
        reason, reference_code, user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movId,
        movementType,
        finalProductId,
        qty,
        cost,
        totalCost,
        fromDepartmentId || null,
        toDepartmentId || (isAdding ? 'dept-bod' : null),
        fromEmployeeId || null,
        toEmployeeId || null,
        resolvedRecipient,
        requiresActa ? 1 : 0,
        actaId,
        actaCode,
        actaStatus,
        reason.trim(),
        referenceCode ? referenceCode.trim() : actaCode,
        user.id,
        effectiveDate,
      ]
    );

    if (isAdding && cost > 0) {
      await run(
        `INSERT INTO product_price_history (
          id, product_id, purchase_date, unit_price, box_price, currency, invoice_number, notes
        ) VALUES (?, ?, ?, ?, 0, 'GTQ', ?, ?)`,
        [
          `ph-${Date.now()}`,
          finalProductId,
          date || new Date().toISOString().split('T')[0],
          cost,
          referenceCode || null,
          reason.trim(),
        ]
      );
    }

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: `MOVIMIENTO_${movementType}`,
      module: 'MOVIMIENTOS',
      entityId: movId,
      entityName: `${prod.name} (${qty} ${prod.unit_of_measure})`,
      reason: `Operación registrada por ${user.fullName}: ${reason.trim()}${resolvedRecipient ? ` | Entregado a: ${resolvedRecipient}` : ''}${actaCode ? ` | Acta: ${actaCode}` : ''}`,
    });

    return NextResponse.json({
      success: true,
      movementId: movId,
      productId: finalProductId,
      newStock,
      actaId,
      actaCode,
      executedBy: user.fullName,
    });
  } catch (error: any) {
    console.error('Error al registrar movimiento:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar movimiento.' }, { status: 500 });
  }
}
