import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run, transaction } from '@/lib/db';
import { getCurrentUser, canAccessModule } from '@/lib/auth';
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

    // Listar todos los productos
    const products = await query<any>(`
      SELECT p.*, c.name as category_name, c.tracking_type,
        (SELECT COUNT(*) FROM product_suppliers ps WHERE ps.product_id = p.id) as suppliers_count
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
      ORDER BY p.name ASC
    `);

    return NextResponse.json({ products });
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
      // Proveedor / Precio
      supplierName,
      contactInfo,
      purchaseDate,
      invoiceNumber,
    } = body;

    // 1. Asignar producto de Bodega a empleado y restar automáticamente de stock
    if (action === 'ASSIGN_TO_EMPLOYEE') {
      if (!productId || !employeeId || !quantity || quantity <= 0) {
        return NextResponse.json(
          { error: 'Debe seleccionar producto, empleado y una cantidad válida mayor a cero.' },
          { status: 400 }
        );
      }

      const prod = await queryOne<any>(`SELECT * FROM products WHERE id = ?`, [productId]);
      if (!prod) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

      if (prod.current_stock < quantity) {
        return NextResponse.json(
          { error: `Stock insuficiente en Bodega. Stock actual: ${prod.current_stock}, solicitado: ${quantity}` },
          { status: 400 }
        );
      }

      const emp = await queryOne<any>(`SELECT * FROM employees WHERE id = ?`, [employeeId]);
      if (!emp) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });

      // Generar código de asignación
      const asgSeq = Date.now().toString().slice(-4);
      const asgCode = `${emp.initials || 'ASG'}-${new Date().getFullYear()}-${prod.code.slice(0, 4)}-${asgSeq}`;
      const asgId = `asg-${Date.now()}`;

      // Insertar asignación
      await run(
        `INSERT INTO assignments (
          id, assignment_code, product_id, employee_id, quantity,
          assigned_by_user_id, origin_department_id, target_department_id,
          charged_department_id, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVA', ?)`,
        [
          asgId,
          asgCode,
          productId,
          employeeId,
          quantity,
          user.id,
          'dept-bod', // Bodega
          emp.department_id,
          emp.department_id,
          reason || 'Asignación directa desde catálogo de productos',
        ]
      );

      // Restar del inventario
      const newStock = prod.current_stock - quantity;
      await run(`UPDATE products SET current_stock = ? WHERE id = ?`, [newStock, productId]);

      // Registrar movimiento en Kardex
      await run(
        `INSERT INTO inventory_movements (
          id, movement_type, product_id, quantity, unit_cost, total_cost,
          from_department_id, to_department_id, to_employee_id,
          reason, reference_code, user_id
        ) VALUES (?, 'ASIGNACION', ?, ?, ?, ?, 'dept-bod', ?, ?, ?, ?, ?)`,
        [
          `mov-${Date.now()}`,
          productId,
          quantity,
          prod.unit_price,
          prod.unit_price * quantity,
          emp.department_id,
          employeeId,
          reason || `Asignación de ${quantity} unidad(es) a ${emp.full_name}`,
          asgCode,
          user.id,
        ]
      );

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'ASIGNACION_DIRECTA_PRODUCTO',
        module: 'PRODUCTOS',
        entityId: productId,
        entityName: prod.name,
        reason: `Asignación de ${quantity} unidad(es) al empleado ${emp.full_name}. Stock restante: ${newStock}`,
      });

      return NextResponse.json({
        success: true,
        message: `Asignación exitosa. Stock actualizado a ${newStock} unidades.`,
        newStock,
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
