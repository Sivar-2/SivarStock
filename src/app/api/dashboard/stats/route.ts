import { NextResponse, NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'mensual'; // semanal | mensual | trimestral | historico

    // Construir filtro de fecha para movimientos y costos según período
    let dateFilter = "created_at >= datetime('now', '-30 days')";
    let daysCount = 30;
    if (period === 'semanal') {
      dateFilter = "created_at >= datetime('now', '-7 days')";
      daysCount = 7;
    } else if (period === 'trimestral') {
      dateFilter = "created_at >= datetime('now', '-90 days')";
      daysCount = 90;
    } else if (period === 'historico') {
      dateFilter = "1=1";
      daysCount = 9999;
    }

    // 1. Resumen de Activos Individuales y Valor de Adquisición
    const itemsSummary = await queryOne<any>(`
      SELECT 
        COUNT(*) as total_items,
        SUM(CASE WHEN operational_status = 'DISPONIBLE' THEN 1 ELSE 0 END) as available_items,
        SUM(CASE WHEN operational_status = 'ASIGNADO' THEN 1 ELSE 0 END) as assigned_items,
        SUM(CASE WHEN operational_status = 'EN_REVISION' THEN 1 ELSE 0 END) as in_revision_items,
        SUM(CASE WHEN operational_status = 'DADO_DE_BAJA' THEN 1 ELSE 0 END) as decommissioned_items,
        SUM(CASE WHEN operational_status = 'PERDIDO' THEN 1 ELSE 0 END) as lost_items,
        SUM(CASE WHEN physical_condition IN ('DANADO', 'AVERIADO', 'EN_REPARACION') THEN 1 ELSE 0 END) as damaged_items,
        COALESCE(SUM(CASE WHEN purchase_price IS NOT NULL AND purchase_price > 0 THEN purchase_price ELSE 0 END), 0) as total_acquisition_cost_gtq,
        COALESCE(SUM(CASE WHEN replacement_value IS NOT NULL AND replacement_value > 0 THEN replacement_value ELSE 0 END), 0) as total_replacement_value_gtq,
        SUM(CASE WHEN purchase_price IS NOT NULL AND purchase_price > 0 THEN 1 ELSE 0 END) as known_cost_count,
        SUM(CASE WHEN purchase_price IS NULL OR purchase_price = 0 THEN 1 ELSE 0 END) as unknown_cost_count
      FROM inventory_items
    `);

    // 2. Alertas de Stock Mínimo en Consumibles / Suministros
    const lowStockList = await query<any>(`
      SELECT 
        p.id as product_id,
        p.code,
        p.name,
        p.unit_of_measure,
        p.min_stock,
        p.target_stock,
        p.default_supplier,
        COALESCE(SUM(cs.quantity), 0) as current_quantity,
        d.name as department_name
      FROM products p
      LEFT JOIN consumable_stocks cs ON p.id = cs.product_id
      LEFT JOIN departments d ON cs.department_id = d.id
      WHERE p.is_consumable = 1
      GROUP BY p.id, cs.department_id
      HAVING current_quantity <= p.min_stock
      ORDER BY (p.min_stock - current_quantity) DESC
    `);

    // 3. Resumen de Servicios Digitales y Licencias (Desglose GTQ y USD)
    const digitalSummary = await queryOne<any>(`
      SELECT 
        COUNT(*) as total_services,
        SUM(CASE WHEN status = 'ACTIVA' THEN 1 ELSE 0 END) as active_services,
        SUM(CASE WHEN status = 'GRATUITA' THEN 1 ELSE 0 END) as free_services,
        SUM(CASE WHEN status = 'VENCIDA' THEN 1 ELSE 0 END) as expired_services,
        SUM(CASE WHEN status = 'PAGO_UNICO' THEN 1 ELSE 0 END) as single_pay_services,
        COALESCE(SUM(CASE WHEN status = 'ACTIVA' AND (currency = 'GTQ' OR currency IS NULL) THEN monthly_equivalent_cost ELSE 0 END), 0) as monthly_gtq_spend,
        COALESCE(SUM(CASE WHEN status = 'ACTIVA' AND currency = 'USD' THEN monthly_equivalent_cost ELSE 0 END), 0) as monthly_usd_spend,
        COALESCE(SUM(CASE WHEN status = 'ACTIVA' AND (currency = 'GTQ' OR currency IS NULL) THEN monthly_equivalent_cost * 12 ELSE 0 END), 0) as annual_gtq_spend,
        COALESCE(SUM(CASE WHEN status = 'ACTIVA' AND currency = 'USD' THEN monthly_equivalent_cost * 12 ELSE 0 END), 0) as annual_usd_spend
      FROM digital_services
    `);

    // 4. Servicios con Próximo Vencimiento (Menor a 35 días)
    const expiringServices = await query<any>(`
      SELECT id, name, provider, expiration_date, amount, currency, cost_period, auto_renew, status,
             CAST((julianday(expiration_date) - julianday('now')) AS INTEGER) as days_remaining
      FROM digital_services
      WHERE expiration_date IS NOT NULL 
        AND status IN ('ACTIVA', 'PENDIENTE')
        AND julianday(expiration_date) >= julianday('now')
        AND (julianday(expiration_date) - julianday('now')) <= 35
      ORDER BY expiration_date ASC
    `);

    // 5. Total de Movimientos y Cambios en el Período
    const movementsStats = await queryOne<any>(`
      SELECT 
        COUNT(*) as total_movements_period,
        SUM(CASE WHEN movement_type = 'ENTRADA' THEN 1 ELSE 0 END) as entradas_count,
        SUM(CASE WHEN movement_type = 'SALIDA' THEN 1 ELSE 0 END) as salidas_count,
        SUM(CASE WHEN movement_type IN ('ASIGNACION', 'REASIGNACION') THEN 1 ELSE 0 END) as asignaciones_count,
        SUM(CASE WHEN movement_type = 'BAJA' THEN 1 ELSE 0 END) as bajas_count,
        COALESCE(SUM(quantity), 0) as total_units_moved
      FROM inventory_movements
      WHERE ${dateFilter}
    `);

    const totalHistoricalMovements = await queryOne<any>(`
      SELECT COUNT(*) as total_count FROM inventory_movements
    `);

    // 6. Movimientos por Departamento (Flujo económico)
    const movementsByDept = await query<any>(`
      SELECT 
        COALESCE(d.name, 'Sin Depto') as dept_name,
        d.code as dept_code,
        COUNT(m.id) as movement_count,
        COALESCE(SUM(m.quantity), 0) as total_quantity
      FROM inventory_movements m
      LEFT JOIN departments d ON m.to_department_id = d.id
      WHERE ${dateFilter}
      GROUP BY d.id
      ORDER BY movement_count DESC
      LIMIT 6
    `);

    // 7. Reporte de Bodega Central (Cuarto de Servidores, is_bodega = 1)
    const bodegaStats = await queryOne<any>(`
      SELECT 
        (SELECT COUNT(*) FROM inventory_items i 
         JOIN departments d ON i.current_department_id = d.id 
         WHERE d.is_bodega = 1 AND i.operational_status = 'DISPONIBLE') as bodega_available_items,
        (SELECT COALESCE(SUM(i.purchase_price), 0) FROM inventory_items i 
         JOIN departments d ON i.current_department_id = d.id 
         WHERE d.is_bodega = 1) as bodega_items_value,
        (SELECT COALESCE(SUM(cs.quantity), 0) FROM consumable_stocks cs 
         JOIN departments d ON cs.department_id = d.id 
         WHERE d.is_bodega = 1) as bodega_consumables_units
    `);

    // 8. Distribución de Costos por Área Imputada en Quetzales
    const costsByDept = await query<any>(`
      SELECT 
        d.code as dept_code,
        d.name as dept_name,
        ROUND(COALESCE(SUM(c.total_amount), 0), 2) as total_charged,
        COUNT(c.id) as transaction_count
      FROM departments d
      LEFT JOIN cost_records c ON d.id = c.charged_department_id
      GROUP BY d.id
      ORDER BY total_charged DESC
    `);

    // 9. Últimos Movimientos de Kardex
    const recentMovements = await query<any>(`
      SELECT 
        m.id,
        m.movement_type,
        m.quantity,
        m.reason,
        m.created_at,
        p.name as product_name,
        p.code as product_code,
        COALESCE(u.full_name, 'Sistema') as user_name,
        d_from.name as from_dept_name,
        d_to.name as to_dept_name
      FROM inventory_movements m
      JOIN products p ON m.product_id = p.id
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN departments d_from ON m.from_department_id = d_from.id
      LEFT JOIN departments d_to ON m.to_department_id = d_to.id
      ORDER BY m.created_at DESC
      LIMIT 10
    `);

    // 10. Equipos en Mantenimiento / Avería
    const maintenanceAlerts = await query<any>(`
      SELECT 
        m.id,
        m.reported_date,
        m.fault_description,
        m.severity,
        m.status,
        i.permanent_code,
        p.name as product_name,
        d.name as department_name
      FROM maintenance_records m
      JOIN inventory_items i ON m.item_id = i.id
      JOIN products p ON i.product_id = p.id
      LEFT JOIN departments d ON i.current_department_id = d.id
      WHERE m.status IN ('REPORTADA', 'EN_DIAGNOSTICO', 'EN_REPARACION')
      ORDER BY m.reported_date DESC
    `);

    // 11. Resumen de Averías y Reparaciones
    const maintenanceSummary = await queryOne<any>(`
      SELECT 
        COUNT(*) as total_records,
        SUM(CASE WHEN status IN ('REPORTADA', 'EN_DIAGNOSTICO', 'EN_REPARACION') THEN 1 ELSE 0 END) as active_repairs,
        SUM(CASE WHEN status = 'REPARADO' THEN 1 ELSE 0 END) as solved_repairs,
        SUM(CASE WHEN status = 'DADO_DE_BAJA' THEN 1 ELSE 0 END) as decommissioned_repairs,
        COALESCE(SUM(cost), 0) as total_maintenance_cost
      FROM maintenance_records
    `);

    return NextResponse.json({
      success: true,
      period,
      daysCount,
      userRole: user?.role || 'VIEWER',
      canViewFinancials: user?.canViewFinancials ?? true,
      stats: {
        items: itemsSummary,
        digital: digitalSummary,
        movements: movementsStats,
        totalHistoricalMovements: totalHistoricalMovements?.total_count || 0,
        bodega: bodegaStats,
        maintenance: maintenanceSummary,
        lowStockAlertsCount: lowStockList.length,
        maintenanceActiveCount: maintenanceAlerts.length,
      },
      lowStockList,
      expiringServices,
      costsByDept,
      movementsByDept,
      recentMovements,
      maintenanceAlerts,
    });
  } catch (error: any) {
    console.error('Error al obtener estadísticas del dashboard:', error);
    return NextResponse.json(
      { error: 'Error al procesar métricas del dashboard.' },
      { status: 500 }
    );
  }
}
