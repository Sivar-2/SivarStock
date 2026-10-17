import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acceso denegado: El módulo de Movimientos es exclusivo del rol ADMIN.' },
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
        m.id, m.movement_type, m.quantity, m.unit_cost, m.total_cost,
        m.reason, m.reference_code, m.created_at,
        p.name as product_name, p.code as product_code, p.unit_of_measure,
        fd.name as from_dept_name, td.name as to_dept_name,
        fe.full_name as from_employee_name, te.full_name as to_employee_name,
        u.username as executed_by_username, u.full_name as executed_by_name
      FROM inventory_movements m
      LEFT JOIN products p ON m.product_id = p.id
      LEFT JOIN departments fd ON m.from_department_id = fd.id
      LEFT JOIN departments td ON m.to_department_id = td.id
      LEFT JOIN employees fe ON m.from_employee_id = fe.id
      LEFT JOIN employees te ON m.to_employee_id = te.id
      LEFT JOIN users u ON m.user_id = u.id
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

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acceso denegado: El registro de Movimientos es exclusivo del rol ADMIN.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      productId,
      movementType, // 'ENTRADA', 'COMPRA', 'RECEPCION', 'CONSUMO', 'AJUSTE_AUTORIZADO', 'TRANSFERENCIA'
      quantity,
      unitCost,
      fromDepartmentId,
      toDepartmentId,
      fromEmployeeId,
      toEmployeeId,
      reason,
      referenceCode,
      date,
    } = body;

    // Validación Poka-Yoke estricta
    if (!productId || !movementType || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Producto, tipo de movimiento y cantidad positiva son requeridos.' },
        { status: 400 }
      );
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: 'El motivo o justificación del movimiento es obligatorio por control de auditoría.' },
        { status: 400 }
      );
    }

    const prod = await queryOne<any>(`SELECT * FROM products WHERE id = ?`, [productId]);
    if (!prod) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const qty = Number(quantity);
    const cost = unitCost !== undefined ? Number(unitCost) : prod.unit_price;
    const totalCost = cost * qty;
    const effectiveDate = date ? `${date} 12:00:00` : new Date().toISOString().replace('T', ' ').slice(0, 19);

    // Actualizar stock de acuerdo al tipo de movimiento
    let newStock = prod.current_stock;
    const isAdding = ['ENTRADA', 'COMPRA', 'RECEPCION', 'DEVOLUCION'].includes(movementType);
    const isDeducting = ['CONSUMO', 'BAJA', 'ASIGNACION', 'PERDIDA'].includes(movementType);

    if (isAdding) {
      newStock += qty;
    } else if (isDeducting) {
      if (prod.current_stock < qty) {
        return NextResponse.json(
          { error: `Stock insuficiente. Stock actual: ${prod.current_stock}, cantidad a retirar: ${qty}` },
          { status: 400 }
        );
      }
      newStock -= qty;
    }

    await run(`UPDATE products SET current_stock = ? WHERE id = ?`, [newStock, productId]);

    // Insertar movimiento
    const movId = `mov-${Date.now()}`;
    await run(
      `INSERT INTO inventory_movements (
        id, movement_type, product_id, quantity, unit_cost, total_cost,
        from_department_id, to_department_id, from_employee_id, to_employee_id,
        reason, reference_code, user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movId,
        movementType,
        productId,
        qty,
        cost,
        totalCost,
        fromDepartmentId || null,
        toDepartmentId || (isAdding ? 'dept-bod' : null),
        fromEmployeeId || null,
        toEmployeeId || null,
        reason.trim(),
        referenceCode ? referenceCode.trim() : null,
        user.id, // Quién realizó el movimiento
        effectiveDate,
      ]
    );

    // Si fue compra o entrada con costo, registrar en historial de precios de compra
    if (isAdding && cost > 0) {
      await run(
        `INSERT INTO product_price_history (
          id, product_id, purchase_date, unit_price, box_price, currency, invoice_number, notes
        ) VALUES (?, ?, ?, ?, 0, 'GTQ', ?, ?)`,
        [
          `ph-${Date.now()}`,
          productId,
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
      entityName: `${prod.name} (${qty} ${prod.unit_of_measure}s)`,
      reason: `Operación registrada por ${user.fullName}: ${reason.trim()}. Nuevo stock: ${newStock}`,
    });

    return NextResponse.json({
      success: true,
      movementId: movId,
      newStock,
      executedBy: user.fullName,
    });
  } catch (error: any) {
    console.error('Error al registrar movimiento:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar movimiento.' }, { status: 500 });
  }
}
