import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run, transaction } from '@/lib/db';
import { getCurrentUser, checkPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const departmentId = searchParams.get('departmentId');

    let sql = `
      SELECT 
        p.id as product_id,
        p.code,
        p.name,
        p.description,
        p.brand,
        p.unit_of_measure,
        p.min_stock,
        p.target_stock,
        p.default_supplier,
        c.name as category_name,
        COALESCE(SUM(cs.quantity), 0) as total_quantity,
        d.id as department_id,
        d.name as department_name,
        CASE 
          WHEN COALESCE(SUM(cs.quantity), 0) <= 0 THEN 'AGOTADO'
          WHEN COALESCE(SUM(cs.quantity), 0) <= p.min_stock THEN 'CRITICO'
          ELSE 'NORMAL'
        END as stock_status
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN consumable_stocks cs ON p.id = cs.product_id
      LEFT JOIN departments d ON cs.department_id = d.id
      WHERE p.is_consumable = 1
    `;

    const params: any[] = [];
    if (search.trim()) {
      sql += ` AND (p.name LIKE ? OR p.code LIKE ? OR p.brand LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (departmentId) {
      sql += ` AND cs.department_id = ?`;
      params.push(departmentId);
    }

    sql += ` GROUP BY p.id, cs.department_id ORDER BY stock_status DESC, p.name ASC`;

    const items = await query(sql, params);

    // Obtener desglose de lotes
    const batches = await query<any>(`
      SELECT cs.*, p.name as product_name, p.code as product_code, d.name as department_name
      FROM consumable_stocks cs
      JOIN products p ON cs.product_id = p.id
      JOIN departments d ON cs.department_id = d.id
      ORDER BY cs.quantity DESC
    `);

    return NextResponse.json({ success: true, items, batches });
  } catch (error: any) {
    console.error('Error al consultar consumibles:', error);
    return NextResponse.json({ error: 'Error al consultar consumibles.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !checkPermission(user, 'AREA_MANAGER')) {
      return NextResponse.json({ error: 'No autorizado para modificar existencias de consumibles.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      productId,
      departmentId,
      operationType, // 'CONSUMO', 'ENTRADA', 'AJUSTE'
      quantity,
      batchNumber,
      reason,
      unitCost,
      chargedDepartmentId,
    } = body;

    const qty = parseFloat(quantity);
    if (!productId || !departmentId || !operationType || isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: 'Parámetros de operación inválidos.' }, { status: 400 });
    }

    const product = await queryOne<any>(`SELECT * FROM products WHERE id = ?`, [productId]);
    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });
    }

    const batch = batchNumber?.trim() || 'LOTE-GENERAL';

    await transaction(async () => {
      const currentStockRow = await queryOne<any>(`
        SELECT * FROM consumable_stocks 
        WHERE product_id = ? AND department_id = ? AND batch_number = ?
      `, [productId, departmentId, batch]);

      const currentQty = currentStockRow ? parseFloat(currentStockRow.quantity) : 0;

      if (operationType === 'CONSUMO') {
        if (currentQty < qty) {
          throw new Error(`Existencia insuficiente (${currentQty} ${product.unit_of_measure}) para consumir ${qty}.`);
        }

        const newQty = currentQty - qty;
        await run(`
          UPDATE consumable_stocks
          SET quantity = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [newQty, currentStockRow.id]);

        // Kardex consumo
        const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        await run(`
          INSERT INTO inventory_movements (
            id, movement_type, product_id, quantity, unit_cost, total_cost,
            from_department_id, to_department_id, reason, reference_code, user_id
          ) VALUES (?, 'CONSUMO', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          movId, productId, qty, unitCost ? parseFloat(unitCost) : currentStockRow?.unit_cost || 0,
          (unitCost ? parseFloat(unitCost) : currentStockRow?.unit_cost || 0) * qty,
          departmentId, chargedDepartmentId || departmentId,
          reason || 'Consumo operativo autorizado', batch, user.id
        ]);
      } else if (operationType === 'ENTRADA') {
        if (currentStockRow) {
          const newQty = currentQty + qty;
          await run(`
            UPDATE consumable_stocks
            SET quantity = ?, 
                unit_cost = COALESCE(?, unit_cost),
                updated_at = datetime('now')
            WHERE id = ?
          `, [newQty, unitCost ? parseFloat(unitCost) : null, currentStockRow.id]);
        } else {
          const stockId = `stk-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
          await run(`
            INSERT INTO consumable_stocks (
              id, product_id, department_id, quantity, batch_number, unit_cost
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [stockId, productId, departmentId, qty, batch, unitCost ? parseFloat(unitCost) : 0]);
        }

        // Kardex entrada
        const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        await run(`
          INSERT INTO inventory_movements (
            id, movement_type, product_id, quantity, unit_cost, total_cost,
            to_department_id, reason, reference_code, user_id
          ) VALUES (?, 'ENTRADA', ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          movId, productId, qty, unitCost ? parseFloat(unitCost) : 0,
          (unitCost ? parseFloat(unitCost) : 0) * qty,
          departmentId, reason || 'Ingreso de suministro', batch, user.id
        ]);
      } else if (operationType === 'AJUSTE') {
        // Ajuste inventario
        const diff = qty - currentQty;
        if (currentStockRow) {
          await run(`
            UPDATE consumable_stocks
            SET quantity = ?, updated_at = datetime('now')
            WHERE id = ?
          `, [qty, currentStockRow.id]);
        } else {
          const stockId = `stk-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
          await run(`
            INSERT INTO consumable_stocks (
              id, product_id, department_id, quantity, batch_number, unit_cost
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [stockId, productId, departmentId, qty, batch, unitCost ? parseFloat(unitCost) : 0]);
        }

        const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        await run(`
          INSERT INTO inventory_movements (
            id, movement_type, product_id, quantity,
            to_department_id, reason, reference_code, user_id
          ) VALUES (?, 'AJUSTE_AUTORIZADO', ?, ?, ?, ?, ?, ?)
        `, [
          movId, productId, Math.abs(diff), departmentId,
          `Ajuste de inventario físico: de ${currentQty} a ${qty}. Motivo: ${reason || 'Conteo físico'}`,
          batch, user.id
        ]);
      }
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: `CONSUMIBLE_${operationType}`,
      module: 'INVENTARIO',
      entityId: productId,
      entityName: product.name,
      reason: `${operationType} de ${qty} ${product.unit_of_measure}. ${reason || ''}`,
    });

    return NextResponse.json({
      success: true,
      message: `Operación ${operationType} completada con éxito.`,
    });
  } catch (error: any) {
    console.error('Error en operación de consumible:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar existencias.' }, { status: 400 });
  }
}
