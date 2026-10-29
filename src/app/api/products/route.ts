import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run, transaction } from '@/lib/db';
import { getCurrentUser, canAccessModule } from '@/lib/auth';
import { generatePermanentCode, generateAssignmentCode } from '@/lib/codes';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get('id');

    if (productId) {
      const product = await queryOne<any>(
        `SELECT p.*, c.name as category_name, c.tracking_type
         FROM products p
         JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`,
        [productId]
      );

      if (!product) {
        return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
      }

      // Proveedores asociados
      const suppliers = await query<any>(
        `SELECT * FROM product_suppliers WHERE product_id = ? ORDER BY is_preferred DESC, supplier_name ASC`,
        [productId]
      );

      // Historial de precios de compra
      const priceHistory = await query<any>(
        `SELECT * FROM product_price_history WHERE product_id = ? ORDER BY purchase_date DESC`,
        [productId]
      );

      return NextResponse.json({
        product,
        suppliers,
        priceHistory,
      });
    }

    // Listar todos los productos incluyendo el desglose vivo: Bodega + Asignados a Empleados = Inventario Total
    const products = await query<any>(`
      SELECT p.*, c.name as category_name, c.tracking_type,
        (SELECT COUNT(*) FROM product_suppliers ps WHERE ps.product_id = p.id) as suppliers_count,
        (SELECT COUNT(*) FROM inventory_items ii WHERE ii.product_id = p.id AND ii.operational_status != 'DADO_DE_BAJA') as individual_total_count,
        (SELECT COUNT(*) FROM inventory_items ii WHERE ii.product_id = p.id AND ii.operational_status = 'DISPONIBLE') as individual_bodega_count,
        (SELECT COUNT(*) FROM inventory_items ii WHERE ii.product_id = p.id AND ii.operational_status = 'ASIGNADO') as individual_assigned_count,
        (SELECT COUNT(*) FROM inventory_items ii WHERE ii.product_id = p.id AND ii.operational_status IN ('EN_REVISION', 'AVERIADO')) as individual_revision_count,
        (SELECT COALESCE(SUM(a.quantity), 0) FROM assignments a WHERE a.product_id = p.id AND a.item_id IS NULL AND a.status = 'ACTIVA') as bulk_assigned_count
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
      ORDER BY p.name ASC
    `);

    // Unificar métricas de stock para que Bodega + Empleados = Total sea siempre exacto
    const enrichedProducts = products.map((p: any) => {
      const indTotal = Number(p.individual_total_count || 0);
      const indBodega = Number(p.individual_bodega_count || 0);
      const indAssigned = Number(p.individual_assigned_count || 0);
      const indRevision = Number(p.individual_revision_count || 0);
      const bulkAssigned = Number(p.bulk_assigned_count || 0);

      // Stock en Bodega: si tiene activos individuales registrados en DISPONIBLE y current_stock es menor, sincronizar visualmente
      const warehouseStock = p.tracking_type === 'INDIVIDUAL' && indTotal > 0
        ? Math.max(Number(p.current_stock || 0), indBodega)
        : Number(p.current_stock || 0);

      const assignedToEmployees = indAssigned + bulkAssigned;
      const totalCompanyInventory = warehouseStock + assignedToEmployees + indRevision;

      return {
        ...p,
        warehouse_stock: warehouseStock,
        assigned_to_employees: assignedToEmployees,
        in_revision_count: indRevision,
        total_company_inventory: totalCompanyInventory,
      };
    });

    return NextResponse.json({ products: enrichedProducts });
  } catch (error: any) {
    console.error('Error al consultar productos:', error);
    return NextResponse.json({ error: 'Error al consultar productos.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!canAccessModule(user, 'PRODUCTOS', 'WRITE')) {
      return NextResponse.json(
        { error: 'Acceso denegado: No tiene permisos de creación o modificación en Productos.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      action, // 'CREATE', 'ASSIGN_TO_EMPLOYEE', 'DEDUCT_STOCK', 'ADD_SUPPLIER', 'ADD_PRICE_HISTORY'
      categoryId,
      code,
      name,
      description,
      brand,
      model,
      imageUrl,
      unitOfMeasure,
      currentStock,
      minStock,
      targetStock,
      unitPrice,
      boxPrice,
      unitsPerBox,
      defaultSupplier,
      // Asignación directa
      productId,
      employeeId,
      quantity,
      reason,
      serialNumber,
      macAddress,
      imei,
      // Proveedor / Precio
      supplierName,
      contactInfo,
      purchaseDate,
      invoiceNumber,
    } = body;

    // 1. Asignar producto de Bodega a empleado y vincular tanto en inventario individual como stock total
    if (action === 'ASSIGN_TO_EMPLOYEE') {
      if (!productId || !employeeId || !quantity || quantity <= 0) {
        return NextResponse.json(
          { error: 'Debe seleccionar producto, empleado y una cantidad válida mayor a cero.' },
          { status: 400 }
        );
      }

      const prod = await queryOne<any>(`
        SELECT p.*, c.tracking_type
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
      `, [productId]);
      if (!prod) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

      const emp = await queryOne<any>(`SELECT * FROM employees WHERE id = ?`, [employeeId]);
      if (!emp) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });

      const dept = await queryOne<any>(`SELECT code FROM departments WHERE id = ?`, [emp.department_id || 'dept-bod']);
      const qtyNum = Number(quantity);

      // Verificar si hay un activo individual DISPONIBLE en Bodega de este producto
      const availableItems = await query<any>(
        `SELECT * FROM inventory_items WHERE product_id = ? AND operational_status = 'DISPONIBLE' ORDER BY created_at ASC LIMIT ?`,
        [productId, qtyNum]
      );

      if (prod.current_stock < qtyNum && availableItems.length < qtyNum) {
        return NextResponse.json(
          { error: `Stock insuficiente en Bodega. Stock actual: ${prod.current_stock}, solicitado: ${qtyNum}` },
          { status: 400 }
        );
      }

      const newStock = Math.max(0, Number(prod.current_stock || 0) - qtyNum);
      const asgCode = await generateAssignmentCode(emp.initials || 'ASG', prod.code || 'PRD', new Date().getFullYear());
      const asgId = `asg-${Date.now()}`;

      await transaction(async () => {
        // Si es categoría INDIVIDUAL o hay unidades individuales disponibles, vincular o crear el inventory_item para que aparezca en el expediente del empleado
        let linkedItemId: string | null = null;
        if (availableItems.length > 0) {
          const itemToAssign = availableItems[0];
          linkedItemId = itemToAssign.id;
          await run(
            `UPDATE inventory_items
             SET operational_status = 'ASIGNADO',
                 current_employee_id = ?,
                 current_department_id = ?,
                 serial_number = COALESCE(?, serial_number),
                 mac_address = COALESCE(?, mac_address),
                 imei = COALESCE(?, imei),
                 updated_at = datetime('now')
             WHERE id = ?`,
            [
              employeeId,
              emp.department_id || 'dept-bod',
              serialNumber?.trim() || null,
              macAddress?.trim() || null,
              imei?.trim() || null,
              linkedItemId,
            ]
          );
        } else if (prod.tracking_type === 'INDIVIDUAL' || qtyNum === 1) {
          // Crear el activo individual automáticamente para que el empleado lo tenga trazado con su código SIV-XX-XXXXXX
          const permCode = await generatePermanentCode(dept?.code || 'BOD');
          linkedItemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          await run(
            `INSERT INTO inventory_items (
              id, product_id, permanent_code, serial_number, mac_address, imei,
              brand, model, current_department_id, current_employee_id,
              operational_status, physical_condition, purchase_date, supplier,
              purchase_price, replacement_value, currency, notes, registered_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ASIGNADO', 'BUENO', date('now'), ?, ?, ?, 'GTQ', ?, ?)`,
            [
              linkedItemId,
              productId,
              permCode,
              serialNumber?.trim() || null,
              macAddress?.trim() || null,
              imei?.trim() || null,
              prod.brand || null,
              prod.model || null,
              emp.department_id || 'dept-bod',
              employeeId,
              prod.default_supplier || null,
              prod.unit_price || 0,
              prod.unit_price || 0,
              reason || `Asignado desde catálogo de productos a ${emp.full_name}`,
              user.id,
            ]
          );
        }

        // Insertar asignación
        await run(
          `INSERT INTO assignments (
            id, assignment_code, item_id, product_id, employee_id, quantity,
            assigned_by_user_id, origin_department_id, target_department_id,
            charged_department_id, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'dept-bod', ?, ?, 'ACTIVA', ?)`,
          [
            asgId,
            asgCode,
            linkedItemId,
            productId,
            employeeId,
            qtyNum,
            user.id,
            emp.department_id,
            emp.department_id,
            reason || 'Asignación directa desde catálogo de productos',
          ]
        );

        // Restar del stock disponible en Bodega
        await run(`UPDATE products SET current_stock = ? WHERE id = ?`, [newStock, productId]);

        // Registrar movimiento en Kardex
        await run(
          `INSERT INTO inventory_movements (
            id, movement_type, item_id, product_id, quantity, unit_cost, total_cost,
            from_department_id, to_department_id, to_employee_id,
            reason, reference_code, user_id
          ) VALUES (?, 'ASIGNACION', ?, ?, ?, ?, ?, 'dept-bod', ?, ?, ?, ?, ?)`,
          [
            `mov-${Date.now()}`,
            linkedItemId,
            productId,
            qtyNum,
            prod.unit_price,
            (prod.unit_price || 0) * qtyNum,
            emp.department_id,
            employeeId,
            reason || `Asignación de ${qtyNum} unidad(es) a ${emp.full_name}`,
            asgCode,
            user.id,
          ]
        );
      });

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'ASIGNACION_DIRECTA_PRODUCTO',
        module: 'PRODUCTOS',
        entityId: productId,
        entityName: prod.name,
        reason: `Asignación de ${qtyNum} unidad(es) al empleado ${emp.full_name}. Stock en Bodega restante: ${newStock}`,
      });

      return NextResponse.json({
        success: true,
        message: `Asignación exitosa a ${emp.full_name} (${asgCode}). Stock en Bodega actualizado a ${newStock} unidades.`,
        newStock,
        assignmentCode: asgCode,
      });
    }

    // 2. Restar stock directamente (Consumo o Ajuste autorizado)
    if (action === 'DEDUCT_STOCK') {
      if (!productId || !quantity || quantity <= 0) {
        return NextResponse.json({ error: 'Cantidad inválida para descontar.' }, { status: 400 });
      }
      if (!reason || !reason.trim()) {
        return NextResponse.json({ error: 'El motivo del descuento es obligatorio (Poka-Yoke).' }, { status: 400 });
      }

      const prod = await queryOne<any>(`SELECT * FROM products WHERE id = ?`, [productId]);
      if (!prod) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

      if (prod.current_stock < quantity) {
        return NextResponse.json(
          { error: `Stock insuficiente. Stock actual: ${prod.current_stock}, solicitado descontar: ${quantity}` },
          { status: 400 }
        );
      }

      const newStock = prod.current_stock - quantity;
      await run(`UPDATE products SET current_stock = ? WHERE id = ?`, [newStock, productId]);

      // Registrar movimiento
      await run(
        `INSERT INTO inventory_movements (
          id, movement_type, product_id, quantity, unit_cost, total_cost,
          from_department_id, reason, user_id
        ) VALUES (?, 'CONSUMO', ?, ?, ?, ?, 'dept-bod', ?, ?)`,
        [
          `mov-${Date.now()}`,
          productId,
          quantity,
          prod.unit_price,
          prod.unit_price * quantity,
          reason.trim(),
          user.id,
        ]
      );

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'DESCONTAR_STOCK',
        module: 'PRODUCTOS',
        entityId: productId,
        entityName: prod.name,
        reason: `Descuento de ${quantity} unidad(es). Motivo: ${reason.trim()}`,
      });

      return NextResponse.json({ success: true, newStock });
    }

    // 3. Agregar Proveedor a un producto
    if (action === 'ADD_SUPPLIER') {
      if (!productId || !supplierName) {
        return NextResponse.json({ error: 'Producto y Nombre de Proveedor requeridos.' }, { status: 400 });
      }
      const supId = `ps-${Date.now()}`;
      await run(
        `INSERT INTO product_suppliers (id, product_id, supplier_name, contact_info) VALUES (?, ?, ?, ?)`,
        [supId, productId, supplierName.trim(), contactInfo ? contactInfo.trim() : null]
      );
      return NextResponse.json({ success: true, supplierId: supId });
    }

    // 4. Agregar Historial de Precio de Compra
    if (action === 'ADD_PRICE_HISTORY') {
      if (!productId || !purchaseDate || !unitPrice) {
        return NextResponse.json({ error: 'Producto, fecha y precio unitario son requeridos.' }, { status: 400 });
      }
      const phId = `ph-${Date.now()}`;
      await run(
        `INSERT INTO product_price_history (
          id, product_id, purchase_date, unit_price, box_price, currency, supplier_name, invoice_number, notes
        ) VALUES (?, ?, ?, ?, ?, 'GTQ', ?, ?, ?)`,
        [
          phId,
          productId,
          purchaseDate,
          Number(unitPrice),
          boxPrice ? Number(boxPrice) : 0,
          supplierName || null,
          invoiceNumber || null,
          reason || null,
        ]
      );
      return NextResponse.json({ success: true, priceHistoryId: phId });
    }

    // 5. Crear Producto Normal
    if (!categoryId || !name) {
      return NextResponse.json({ error: 'Categoría y Nombre son obligatorios.' }, { status: 400 });
    }

    // Generar código si no se envía
    let generatedCode = code;
    if (!generatedCode) {
      const cat = await queryOne<any>(`SELECT code FROM categories WHERE id = ?`, [categoryId]);
      const prefix = cat ? cat.code : 'PRD';
      const count = await queryOne<any>(`SELECT COUNT(*) as total FROM products WHERE category_id = ?`, [categoryId]);
      const nextSeq = ((count ? count.total : 0) + 1).toString().padStart(3, '0');
      generatedCode = `${prefix}-${nextSeq}`;
    }

    const newProdId = `prod-${Date.now()}`;
    await run(
      `INSERT INTO products (
        id, category_id, code, name, description, brand, model, image_url,
        unit_of_measure, current_stock, min_stock, target_stock,
        unit_price, box_price, units_per_box, default_supplier, is_consumable
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newProdId,
        categoryId,
        generatedCode.trim(),
        name.trim(),
        description || null,
        brand || null,
        model || null,
        imageUrl || null,
        unitOfMeasure || 'unidad',
        Number(currentStock) || 0,
        Number(minStock) || 5,
        Number(targetStock) || 20,
        Number(unitPrice) || 0,
        Number(boxPrice) || 0,
        Number(unitsPerBox) || 1,
        defaultSupplier || null,
        Number(currentStock) > 0 ? 1 : 0,
      ]
    );

    // Si se especificó proveedor, registrarlo en la tabla relacional
    if (defaultSupplier) {
      await run(
        `INSERT INTO product_suppliers (id, product_id, supplier_name, is_preferred) VALUES (?, ?, ?, 1)`,
        [`ps-${Date.now()}`, newProdId, defaultSupplier.trim()]
      );
    }

    // Si se especificó precio de compra inicial, registrar en historial
    if (unitPrice && Number(unitPrice) > 0) {
      await run(
        `INSERT INTO product_price_history (
          id, product_id, purchase_date, unit_price, box_price, currency, supplier_name, notes
        ) VALUES (?, ?, ?, ?, ?, 'GTQ', ?, 'Precio inicial de alta en sistema')`,
        [
          `ph-${Date.now()}`,
          newProdId,
          new Date().toISOString().split('T')[0],
          Number(unitPrice),
          Number(boxPrice) || 0,
          defaultSupplier || 'Proveedor Inicial',
        ]
      );
    }

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'CREAR_PRODUCTO',
      module: 'PRODUCTOS',
      entityId: newProdId,
      entityName: `${generatedCode} - ${name}`,
      reason: 'Creación de nuevo producto en catálogo con stock y precios',
    });

    return NextResponse.json({ success: true, id: newProdId, code: generatedCode });
  } catch (error: any) {
    console.error('Error al guardar producto:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (!canAccessModule(user, 'PRODUCTOS', 'WRITE')) {
      return NextResponse.json(
        { error: 'Acceso denegado: No tiene permisos para modificar productos.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      id,
      name,
      brand,
      model,
      categoryId,
      description,
      imageUrl,
      unitOfMeasure,
      unitPrice,
      boxPrice,
      unitsPerBox,
      minStock,
      targetStock,
      currentStock,
      defaultSupplier,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'El ID del producto es obligatorio para modificarlo.' }, { status: 400 });
    }

    const existing = await queryOne<any>(`SELECT * FROM products WHERE id = ?`, [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    await run(
      `UPDATE products SET
        name = COALESCE(?, name),
        brand = COALESCE(?, brand),
        model = COALESCE(?, model),
        category_id = COALESCE(?, category_id),
        description = COALESCE(?, description),
        image_url = COALESCE(?, image_url),
        unit_of_measure = COALESCE(?, unit_of_measure),
        unit_price = COALESCE(?, unit_price),
        box_price = COALESCE(?, box_price),
        units_per_box = COALESCE(?, units_per_box),
        min_stock = COALESCE(?, min_stock),
        target_stock = COALESCE(?, target_stock),
        current_stock = COALESCE(?, current_stock),
        default_supplier = COALESCE(?, default_supplier)
      WHERE id = ?`,
      [
        name !== undefined ? name.trim() : null,
        brand !== undefined ? brand.trim() : null,
        model !== undefined ? model.trim() : null,
        categoryId || null,
        description !== undefined ? description : null,
        imageUrl !== undefined ? imageUrl : null,
        unitOfMeasure || null,
        unitPrice !== undefined ? Number(unitPrice) : null,
        boxPrice !== undefined ? Number(boxPrice) : null,
        unitsPerBox !== undefined ? Number(unitsPerBox) : null,
        minStock !== undefined ? Number(minStock) : null,
        targetStock !== undefined ? Number(targetStock) : null,
        currentStock !== undefined ? Number(currentStock) : null,
        defaultSupplier !== undefined ? defaultSupplier : null,
        id,
      ]
    );

    // Si cambió el precio, registrar en historial de precios
    if (unitPrice !== undefined && Number(unitPrice) !== Number(existing.unit_price)) {
      await run(
        `INSERT INTO product_price_history (
          id, product_id, purchase_date, unit_price, box_price, currency, supplier_name, notes
        ) VALUES (?, ?, ?, ?, ?, 'GTQ', ?, 'Modificación manual de precio de catálogo')`,
        [
          `ph-${Date.now()}`,
          id,
          new Date().toISOString().split('T')[0],
          Number(unitPrice),
          boxPrice !== undefined ? Number(boxPrice) : Number(existing.box_price || 0),
          defaultSupplier || existing.default_supplier || 'Proveedor Catálogo',
        ]
      );
    }

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'MODIFICAR_PRODUCTO',
      module: 'PRODUCTOS',
      entityId: id,
      entityName: `${existing.code} - ${name || existing.name}`,
      reason: `Modificación de parámetros del producto. Precio: Q${unitPrice || existing.unit_price}, Stock: ${currentStock ?? existing.current_stock}`,
    });

    return NextResponse.json({ success: true, message: 'Producto modificado exitosamente.' });
  } catch (error: any) {
    console.error('Error al modificar producto:', error);
    return NextResponse.json({ error: error.message || 'Error al modificar producto.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessModule(user, 'PRODUCTOS', 'DELETE')) {
      return NextResponse.json(
        { error: 'Acceso denegado: Se requiere rol ADMIN o SUBADMIN con permisos de edición para eliminar productos.' },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const reason = url.searchParams.get('reason') || 'Eliminación autorizada por administración';

    if (!id) return NextResponse.json({ error: 'ID de producto requerido' }, { status: 400 });

    const prod = await queryOne<any>(`SELECT * FROM products WHERE id = ?`, [id]);
    if (!prod) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

    await transaction(async () => {
      // 1. Eliminar asignaciones vinculadas a este producto o a sus activos individuales
      await run(
        `DELETE FROM assignments 
         WHERE product_id = ? OR item_id IN (SELECT id FROM inventory_items WHERE product_id = ?)`,
        [id, id]
      );

      // 2. Eliminar stock de consumibles
      await run(`DELETE FROM consumable_stocks WHERE product_id = ?`, [id]);

      // 3. Eliminar registros de mantenimiento de sus activos
      await run(
        `DELETE FROM maintenance_records 
         WHERE item_id IN (SELECT id FROM inventory_items WHERE product_id = ?)`,
        [id]
      );

      // 4. Eliminar registros de costos de este producto o sus activos
      await run(
        `DELETE FROM cost_records 
         WHERE product_id = ? OR item_id IN (SELECT id FROM inventory_items WHERE product_id = ?)`,
        [id, id]
      );

      // 5. Eliminar movimientos kardex vinculados
      await run(
        `DELETE FROM inventory_movements 
         WHERE product_id = ? OR item_id IN (SELECT id FROM inventory_items WHERE product_id = ?)`,
        [id, id]
      );

      // 6. Eliminar activos físicos individuales de este producto
      await run(`DELETE FROM inventory_items WHERE product_id = ?`, [id]);

      // 7. Eliminar historial de precios y proveedores asociados
      await run(`DELETE FROM product_price_history WHERE product_id = ?`, [id]);
      await run(`DELETE FROM product_suppliers WHERE product_id = ?`, [id]);

      // 8. Eliminar el producto
      await run(`DELETE FROM products WHERE id = ?`, [id]);
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'ELIMINAR_PRODUCTO',
      module: 'PRODUCTOS',
      entityId: id,
      entityName: `${prod.code} - ${prod.name}`,
      reason: `Producto eliminado en cascada por ${user.fullName}. Motivo: ${reason}`,
    });

    return NextResponse.json({
      success: true,
      message: `Producto ${prod.name} y sus registros dependientes eliminados correctamente.`,
    });
  } catch (error: any) {
    console.error('Error al eliminar producto:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar producto.' }, { status: 500 });
  }
}
