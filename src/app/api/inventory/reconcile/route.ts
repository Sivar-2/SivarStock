import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run, transaction } from '@/lib/db';
import { getCurrentUser, canAccessModule } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inventory/reconcile
 * Retorna la matriz de Recuento y Conciliación de Inventario Total:
 * Total Empresa = En Bodega + Asignados a Empleados + En Revisión/Avería
 * Además del historial de recuentos físicos realizados.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const productsMatrix = await query<any>(`
      SELECT 
        p.id as product_id,
        p.code as product_code,
        p.name as product_name,
        p.brand,
        p.model,
        p.unit_of_measure,
        p.unit_price,
        p.current_stock as catalog_bodega_stock,
        p.min_stock,
        c.name as category_name,
        c.tracking_type,
        (SELECT COUNT(*) FROM inventory_items ii WHERE ii.product_id = p.id AND ii.operational_status = 'DISPONIBLE') as items_in_bodega,
        (SELECT COUNT(*) FROM inventory_items ii WHERE ii.product_id = p.id AND ii.operational_status = 'ASIGNADO') as items_assigned_employees,
        (SELECT COUNT(*) FROM inventory_items ii WHERE ii.product_id = p.id AND ii.operational_status IN ('EN_REVISION', 'AVERIADO', 'DEVOLUCION_PENDIENTE')) as items_in_revision,
        (SELECT COALESCE(SUM(a.quantity), 0) FROM assignments a WHERE a.product_id = p.id AND a.item_id IS NULL AND a.status = 'ACTIVA') as bulk_assigned_employees
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
      ORDER BY c.name ASC, p.name ASC
    `);

    const formattedMatrix = productsMatrix.map((row: any) => {
      const itemsBodega = Number(row.items_in_bodega || 0);
      const catalogBodega = Number(row.catalog_bodega_stock || 0);
      const expectedBodega = row.tracking_type === 'INDIVIDUAL' && (itemsBodega > 0 || Number(row.items_assigned_employees) > 0)
        ? Math.max(itemsBodega, catalogBodega)
        : catalogBodega;
      const assignedEmployees = Number(row.items_assigned_employees || 0) + Number(row.bulk_assigned_employees || 0);
      const inRevision = Number(row.items_in_revision || 0);
      const expectedTotal = expectedBodega + assignedEmployees + inRevision;

      return {
        ...row,
        expected_bodega: expectedBodega,
        assigned_employees: assignedEmployees,
        in_revision: inRevision,
        expected_total: expectedTotal,
        total_valuation_gtq: expectedTotal * Number(row.unit_price || 0),
      };
    });

    // Resumen por empleado (cuántos equipos y celulares tiene cada empleado activo)
    const employeeHoldings = await query<any>(`
      SELECT 
        e.id, e.employee_code, e.full_name, e.status,
        d.name as department_name,
        (SELECT COUNT(*) FROM inventory_items ii WHERE ii.current_employee_id = e.id AND ii.operational_status != 'DADO_DE_BAJA') as assets_count,
        (SELECT COUNT(*) FROM mobile_devices md WHERE md.employee_id = e.id AND md.status != 'DADO_DE_BAJA') as mobiles_count,
        (SELECT COALESCE(SUM(a.quantity), 0) FROM assignments a WHERE a.employee_id = e.id AND a.item_id IS NULL AND a.status = 'ACTIVA') as consumables_assigned_count,
        (SELECT COALESCE(SUM(ii.purchase_price), 0) FROM inventory_items ii WHERE ii.current_employee_id = e.id AND ii.operational_status != 'DADO_DE_BAJA') as total_assets_value_gtq
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.status = 'ACTIVO'
      ORDER BY assets_count DESC, e.full_name ASC
    `);

    // Historial de recuentos físicos guardados
    const history = await query<any>(`
      SELECT ic.*, d.name as department_name
      FROM inventory_counts ic
      LEFT JOIN departments d ON ic.department_id = d.id
      ORDER BY ic.created_at DESC
      LIMIT 25
    `);

    return NextResponse.json({
      success: true,
      matrix: formattedMatrix,
      employeeHoldings,
      history: history.map((h: any) => ({
        ...h,
        details: (() => {
          try { return JSON.parse(h.details_json || '[]'); } catch { return []; }
        })(),
      })),
    });
  } catch (error: any) {
    console.error('Error en GET /api/inventory/reconcile:', error);
    return NextResponse.json({ error: 'Error al obtener matriz de recuento de inventario.' }, { status: 500 });
  }
}

/**
 * POST /api/inventory/reconcile
 * Registra un Recuento Físico de Inventario, concilia diferencias en Bodega si se solicita
 * y genera los movimientos AJUSTE_AUTORIZADO en el Kardex.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessModule(user, 'INVENTARIO', 'WRITE')) {
      return NextResponse.json({ error: 'No autorizado para ejecutar recuentos y ajustes de inventario.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      departmentId,
      applyAdjustments = true,
      notes,
      items = [], // [{ productId, expectedBodega, countedBodega, assignedEmployees, itemNotes }]
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Debe enviar al menos un producto contado en el recuento.' }, { status: 400 });
    }

    const countCode = `REC-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const countId = `cnt-${Date.now()}`;

    let totalExpected = 0;
    let totalCounted = 0;
    let totalBodega = 0;
    let totalAssigned = 0;
    let discrepanciesCount = 0;
    const detailsReport: any[] = [];

    await transaction(async () => {
      for (const entry of items) {
        const prod = await queryOne<any>(`SELECT * FROM products WHERE id = ?`, [entry.productId]);
        if (!prod) continue;

        const expBodega = Number(entry.expectedBodega ?? prod.current_stock ?? 0);
        const cntBodega = Number(entry.countedBodega ?? expBodega);
        const asgEmp = Number(entry.assignedEmployees ?? 0);
        const diff = cntBodega - expBodega;

        totalExpected += expBodega + asgEmp;
        totalCounted += cntBodega + asgEmp;
        totalBodega += cntBodega;
        totalAssigned += asgEmp;

        if (diff !== 0) {
          discrepanciesCount++;

          if (applyAdjustments) {
            await run(`UPDATE products SET current_stock = ? WHERE id = ?`, [cntBodega, prod.id]);

            const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            await run(
              `INSERT INTO inventory_movements (
                id, movement_type, product_id, quantity, unit_cost, total_cost,
                to_department_id, reason, reference_code, user_id
              ) VALUES (?, 'AJUSTE_AUTORIZADO', ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                movId,
                prod.id,
                Math.abs(diff),
                prod.unit_price || 0,
                Math.abs(diff) * (prod.unit_price || 0),
                departmentId || 'dept-bod',
                `Ajuste por Recuento Físico (${countCode}): Bodega esperado ${expBodega} -> contado ${cntBodega} (${diff > 0 ? '+' : ''}${diff}). Asignados a empleados: ${asgEmp}. ${entry.itemNotes || notes || ''}`.trim(),
                countCode,
                user.id,
              ]
            );
          }
        }

        detailsReport.push({
          productId: prod.id,
          productCode: prod.code,
          productName: prod.name,
          expectedBodega: expBodega,
          countedBodega: cntBodega,
          assignedEmployees: asgEmp,
          totalInventory: cntBodega + asgEmp,
          difference: diff,
          itemNotes: entry.itemNotes || '',
        });
      }

      await run(
        `INSERT INTO inventory_counts (
          id, count_code, department_id, executed_by_user_id, executed_by_name,
          total_expected, total_counted, total_bodega, total_assigned_employees,
          discrepancies_count, details_json, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETADO')`,
        [
          countId,
          countCode,
          departmentId || 'dept-bod',
          user.id,
          user.fullName,
          totalExpected,
          totalCounted,
          totalBodega,
          totalAssigned,
          discrepanciesCount,
          JSON.stringify(detailsReport),
          notes || 'Recuento físico y conciliación de inventario total',
        ]
      );
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'RECUENTO_FISICO_INVENTARIO',
      module: 'INVENTARIO',
      entityId: countId,
      entityName: countCode,
      afterState: { countCode, totalExpected, totalCounted, totalBodega, totalAssigned, discrepanciesCount, applyAdjustments },
      reason: `Recuento físico de inventario (${countCode}) completado con ${discrepanciesCount} diferencia(s).`,
    });

    return NextResponse.json({
      success: true,
      countCode,
      discrepanciesCount,
      totalBodega,
      totalAssigned,
      totalCounted,
      message: `Recuento ${countCode} registrado con éxito. Inventario Total conciliado: ${totalCounted} unidades (${totalBodega} en Bodega + ${totalAssigned} en poder de Empleados).`,
    });
  } catch (error: any) {
    console.error('Error en POST /api/inventory/reconcile:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar el recuento de inventario.' }, { status: 500 });
  }
}
