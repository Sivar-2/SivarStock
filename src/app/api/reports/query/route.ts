import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'SUMMARY'; // 'SUMMARY' | 'FEED'
    const format = searchParams.get('format') || 'json';

    const [
      bodegaCount,
      rentedProducts,
      mobilesTotal,
      mobilesPersonalNoPlan,
      mobilesWaitingClaro,
      servicesTotal,
      servicesRenewals,
      costsSummary,
      movementsCount,
      pendingActas,
    ] = await Promise.all([
      queryOne<any>(`
        SELECT COUNT(*) as count, COALESCE(SUM(i.purchase_price), 0) as total_value
        FROM inventory_items i
        LEFT JOIN departments d ON i.current_department_id = d.id
        WHERE d.is_bodega = 1 OR i.current_employee_id IS NULL
      `),
      query<any>(`
        SELECT p.id, p.code, p.name, p.rental_cost, p.rental_period, p.rental_provider, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_rented = 1 AND p.is_active = 1
      `),
      queryOne<any>(`SELECT COUNT(*) as count, COALESCE(SUM(monthly_cost), 0) as monthly_total FROM mobile_devices`),
      query<any>(`
        SELECT m.*, e.full_name as employee_name, d.name as department_name
        FROM mobile_devices m
        LEFT JOIN employees e ON m.employee_id = e.id
        LEFT JOIN departments d ON COALESCE(m.department_id, e.department_id) = d.id
        WHERE m.assignment_mode = 'PERSONAL_SIN_PLAN'
      `),
      query<any>(`
        SELECT m.*, e.full_name as employee_name, d.name as department_name,
          CAST((julianday('now') - julianday(COALESCE(m.incident_date, m.updated_at))) AS INTEGER) as waiting_days
        FROM mobile_devices m
        LEFT JOIN employees e ON m.employee_id = e.id
        LEFT JOIN departments d ON COALESCE(m.department_id, e.department_id) = d.id
        WHERE m.incident_type IN ('ROBO_ASALTO', 'PERDIDA_REPOSICION') OR m.status IN ('ROBO_ASALTO', 'PERDIDA_REPOSICION')
      `),
      queryOne<any>(`
        SELECT COUNT(*) as count,
          SUM(CASE WHEN no_expiration = 1 THEN 1 ELSE 0 END) as no_expiration_count,
          COALESCE(SUM(monthly_equivalent_cost), 0) as monthly_cost
        FROM digital_services
      `),
      query<any>(`
        SELECT s.*, COALESCE(lc.name, s.category_legacy, 'Licencia / Contrato') as category,
          e.full_name as employee_name
        FROM digital_services s
        LEFT JOIN license_categories lc ON s.category_id = lc.id
        LEFT JOIN employees e ON s.employee_id = e.id
        ORDER BY COALESCE(s.last_renewal_date, s.created_at) DESC
        LIMIT 25
      `),
      queryOne<any>(`
        SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total_amount
        FROM cost_records
      `),
      queryOne<any>(`SELECT COUNT(*) as count FROM inventory_movements`),
      queryOne<any>(`SELECT COUNT(*) as count FROM actas WHERE status = 'PENDIENTE'`),
    ]);

    const payload = {
      generatedAt: new Date().toISOString(),
      kpis: {
        bodegaItems: Number(bodegaCount?.count || 0),
        bodegaValue: Number(bodegaCount?.total_value || 0),
        rentedProductsCount: rentedProducts.length,
        rentedMonthlyTotal: rentedProducts.reduce((acc, r) => acc + Number(r.rental_cost || 0), 0),
        mobilesCount: Number(mobilesTotal?.count || 0),
        mobilesMonthlyTotal: Number(mobilesTotal?.monthly_total || 0),
        personalNoPlanCount: mobilesPersonalNoPlan.length,
        waitingClaroCount: mobilesWaitingClaro.length,
        servicesCount: Number(servicesTotal?.count || 0),
        servicesNoExpirationCount: Number(servicesTotal?.no_expiration_count || 0),
        servicesMonthlyCost: Number(servicesTotal?.monthly_cost || 0),
        totalCostsAmount: Number(costsSummary?.total_amount || 0),
        totalCostsRecords: Number(costsSummary?.count || 0),
        totalMovements: Number(movementsCount?.count || 0),
        pendingActasCount: Number(pendingActas?.count || 0),
      },
      personalSinPlan: mobilesPersonalNoPlan,
      esperandoReposicionClaro: mobilesWaitingClaro,
      alquileresActivos: rentedProducts,
      licenciasYRenovaciones: servicesRenewals,
    };

    if (mode === 'FEED' && format === 'csv') {
      const headers = ['Metrica', 'Valor'];
      const rows = Object.entries(payload.kpis).map(([k, v]) => `${k},${v}`);
      const csv = [headers.join(','), ...rows].join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="sivarstock_saas_metrics.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, ...payload });
  } catch (error: any) {
    console.error('Error en GET /api/reports/query:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener métricas ejecutivas.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Debe iniciar sesión para ejecutar reportes.' }, { status: 401 });
    }
    const body = await req.json();
    const {
      module, // 'INVENTARIO', 'MOVIMIENTOS', 'COSTOS', 'ASIGNACIONES', 'SERVICIOS', 'MANTENIMIENTO', 'CELULARES', 'BODEGA', 'ALQUILERES'
      filters = {},
      groupBy,
      sortBy,
      sortDir = 'ASC',
      startDate,
      endDate,
    } = body;

    let baseSql = '';
    const params: any[] = [];

    if (module === 'INVENTARIO') {
      baseSql = `
        SELECT 
          i.id,
          i.permanent_code,
          p.code as product_code,
          p.name as product_name,
          c.name as category_name,
          i.brand,
          i.model,
          i.serial_number,
          i.mac_address,
          i.imei,
          i.ip_address,
          i.hostname,
          d.name as department_name,
          d.code as department_code,
          COALESCE(e.full_name, u.full_name) as assigned_user_name,
          i.operational_status,
          i.physical_condition,
          i.purchase_price,
          i.replacement_value,
          i.supplier,
          i.purchase_date,
          i.warranty_expiration,
          i.invoice_number,
          p.is_consumable,
          p.unit_of_measure
        FROM inventory_items i
        JOIN products p ON i.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN departments d ON i.current_department_id = d.id
        LEFT JOIN employees e ON i.current_employee_id = e.id
        LEFT JOIN users u ON i.current_assigned_user_id = u.id
        WHERE 1=1
      `;

      if (filters.departmentId) {
        baseSql += ` AND i.current_department_id = ?`;
        params.push(filters.departmentId);
      }
      if (filters.status) {
        baseSql += ` AND i.operational_status = ?`;
        params.push(filters.status);
      }
      if (filters.employeeId) {
        baseSql += ` AND i.current_employee_id = ?`;
        params.push(filters.employeeId);
      }
    } else if (module === 'BODEGA') {
      baseSql = `
        SELECT 
          i.id,
          i.permanent_code,
          p.code as product_code,
          p.name as product_name,
          c.name as category_name,
          i.brand,
          i.model,
          i.serial_number,
          i.mac_address,
          i.imei,
          COALESCE(d.name, 'Bodega Central') as department_name,
          i.operational_status,
          i.purchase_price,
          i.supplier,
          i.purchase_date
        FROM inventory_items i
        JOIN products p ON i.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN departments d ON i.current_department_id = d.id
        WHERE (d.is_bodega = 1 OR i.current_employee_id IS NULL)
      `;
    } else if (module === 'ALQUILERES') {
      baseSql = `
        SELECT
          p.id,
          p.code as product_code,
          p.name as product_name,
          c.name as category_name,
          p.brand,
          p.model,
          p.rental_cost,
          p.rental_period,
          COALESCE(p.rental_provider, p.default_supplier) as supplier,
          p.supplier_phone,
          p.supplier_contract,
          p.unit_of_measure
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_rented = 1 AND p.is_active = 1
      `;
    } else if (module === 'CELULARES') {
      baseSql = `
        SELECT 
          m.id,
          m.device_code,
          m.brand,
          m.model,
          m.serial_number,
          m.mac_address,
          m.phone_number,
          m.imei,
          m.sim_iccid,
          m.carrier,
          COALESCE(m.assignment_mode, 'EQUIPO_Y_LINEA') as assignment_mode,
          m.plan_name,
          m.monthly_cost,
          m.contract_number,
          m.contract_end_date,
          m.status,
          m.incident_type,
          m.incident_date,
          CASE 
            WHEN m.incident_date IS NOT NULL AND m.incident_date != '' 
            THEN CAST((julianday('now') - julianday(m.incident_date)) AS INTEGER)
            ELSE 0
          END as waiting_days,
          m.delivery_date as delivered_date,
          m.notes_history as notes,
          e.full_name as employee_name,
          d.name as department_name
        FROM mobile_devices m
        LEFT JOIN employees e ON m.employee_id = e.id
        LEFT JOIN departments d ON COALESCE(m.department_id, e.department_id) = d.id
        WHERE 1=1
      `;
      if (filters.departmentId) {
        baseSql += ` AND (m.department_id = ? OR e.department_id = ?)`;
        params.push(filters.departmentId, filters.departmentId);
      }
      if (filters.assignmentMode) {
        baseSql += ` AND m.assignment_mode = ?`;
        params.push(filters.assignmentMode);
      }
      if (filters.waitingClaroOnly) {
        baseSql += ` AND (m.incident_type IN ('ROBO_ASALTO', 'PERDIDA_REPOSICION') OR m.status IN ('ROBO_ASALTO', 'PERDIDA_REPOSICION'))`;
      }
    } else if (module === 'MANTENIMIENTO') {
      baseSql = `
        SELECT 
          mr.id,
          mr.reported_date,
          mr.fault_description,
          mr.severity,
          mr.status,
          mr.repair_source,
          mr.observation_start_date,
          mr.observation_end_date,
          mr.solution_type,
          mr.resolution_notes as solution_notes,
          mr.repair_cost as cost,
          mr.resolved_date as repair_date,
          i.permanent_code,
          p.name as product_name,
          d.name as department_name,
          rep_i.permanent_code as replacement_code
        FROM maintenance_records mr
        JOIN inventory_items i ON mr.item_id = i.id
        JOIN products p ON i.product_id = p.id
        LEFT JOIN departments d ON i.current_department_id = d.id
        LEFT JOIN inventory_items rep_i ON mr.replacement_item_id = rep_i.id
        WHERE 1=1
      `;
      if (startDate) {
        baseSql += ` AND mr.reported_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        baseSql += ` AND mr.reported_date <= ?`;
        params.push(endDate);
      }
    } else if (module === 'COSTOS') {
      baseSql = `
        SELECT 
          c.id,
          c.expense_date,
          c.concept,
          c.cost_nature,
          c.amount,
          c.tax_amount,
          c.total_amount,
          c.currency,
          c.supplier,
          c.invoice_number,
          c.purchase_order,
          d_chg.name as charged_dept_name,
          i.permanent_code,
          p.name as product_name
        FROM cost_records c
        LEFT JOIN departments d_chg ON c.charged_department_id = d_chg.id
        LEFT JOIN inventory_items i ON c.item_id = i.id
        LEFT JOIN products p ON c.product_id = p.id
        WHERE 1=1
      `;
      if (filters.chargedDeptId || filters.departmentId) {
        baseSql += ` AND c.charged_department_id = ?`;
        params.push(filters.chargedDeptId || filters.departmentId);
      }
      if (startDate) {
        baseSql += ` AND c.expense_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        baseSql += ` AND c.expense_date <= ?`;
        params.push(endDate);
      }
    } else if (module === 'MOVIMIENTOS') {
      baseSql = `
        SELECT 
          m.id,
          m.created_at,
          m.movement_type,
          m.quantity,
          m.unit_cost,
          m.total_cost,
          m.reason,
          m.reference_code,
          COALESCE(e.full_name, m.recipient_name, 'Bodega / General') as recipient_name,
          a.acta_number,
          COALESCE(a.status, 'SIN_ACTA') as acta_status,
          p.code as product_code,
          p.name as product_name,
          d_from.name as from_dept_name,
          d_to.name as to_dept_name,
          u.full_name as executed_by_name
        FROM inventory_movements m
        LEFT JOIN products p ON m.product_id = p.id
        LEFT JOIN departments d_from ON m.from_department_id = d_from.id
        LEFT JOIN departments d_to ON m.to_department_id = d_to.id
        LEFT JOIN employees e ON m.to_employee_id = e.id
        LEFT JOIN actas a ON m.acta_id = a.id
        LEFT JOIN users u ON m.user_id = u.id
        WHERE 1=1
      `;
      if (startDate) {
        baseSql += ` AND m.created_at >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        baseSql += ` AND m.created_at <= ?`;
        params.push(endDate);
      }
    } else if (module === 'SERVICIOS') {
      baseSql = `
        SELECT 
          s.id,
          s.name,
          COALESCE(lc.name, s.category_legacy, 'Servicio / Contrato') as category,
          s.provider,
          s.contract_number,
          s.contract_type,
          s.cost_period,
          s.amount,
          s.currency,
          s.monthly_equivalent_cost,
          CASE WHEN s.no_expiration = 1 THEN 'SIN RENOVACIÓN / PERPETUA' ELSE COALESCE(s.expiration_date, 'N/A') END as expiration_date,
          s.last_renewal_date,
          COALESCE(s.renewal_count, 0) as renewal_count,
          e.full_name as employee_name,
          s.seats_used,
          s.status,
          d.name as department_name
        FROM digital_services s
        LEFT JOIN license_categories lc ON s.category_id = lc.id
        LEFT JOIN employees e ON s.employee_id = e.id
        LEFT JOIN departments d ON s.responsible_department_id = d.id
        WHERE 1=1
      `;
    } else if (module === 'ASIGNACIONES') {
      baseSql = `
        SELECT 
          a.id,
          a.assignment_code,
          a.assigned_at,
          a.status,
          a.employee_id,
          i.permanent_code,
          p.name as product_name,
          COALESCE(e.full_name, u.full_name) as user_name,
          d.name as target_dept_name
        FROM assignments a
        LEFT JOIN products p ON a.product_id = p.id
        LEFT JOIN employees e ON a.employee_id = e.id
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN inventory_items i ON a.item_id = i.id
        LEFT JOIN departments d ON a.target_department_id = d.id
        WHERE 1=1
      `;
    } else {
      return NextResponse.json({ error: 'Módulo de reporte no reconocido.' }, { status: 400 });
    }

    const ALLOWED_SORT_COLUMNS = new Set([
      'id', 'permanent_code', 'product_code', 'product_name', 'category_name',
      'brand', 'model', 'serial_number', 'mac_address', 'imei', 'department_name', 'department_code',
      'assigned_user_name', 'operational_status', 'physical_condition',
      'purchase_price', 'replacement_value', 'supplier', 'purchase_date',
      'warranty_expiration', 'invoice_number', 'created_at', 'device_code',
      'phone_number', 'status', 'delivery_date', 'reported_date',
      'severity', 'cost', 'repair_date', 'expense_date', 'concept', 'amount',
      'total_amount', 'movement_type', 'quantity', 'unit_cost', 'total_cost',
      'assigned_at', 'contract_end_date', 'expiration_date'
    ]);

    const safeDir = String(sortDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    if (sortBy && ALLOWED_SORT_COLUMNS.has(String(sortBy).toLowerCase())) {
      baseSql += ` ORDER BY ${String(sortBy).toLowerCase()} ${safeDir}`;
    } else {
      baseSql += ` ORDER BY 1 ${safeDir}`;
    }

    const rawRows = await query(baseSql, params);

    const rows = rawRows.map((r: any) => {
      if (!user.canViewFinancials) {
        const sanitized = { ...r };
        delete sanitized.purchase_price;
        delete sanitized.replacement_value;
        delete sanitized.cost;
        delete sanitized.amount;
        delete sanitized.total_amount;
        delete sanitized.unit_cost;
        delete sanitized.total_cost;
        delete sanitized.monthly_cost;
        return sanitized;
      }
      return r;
    });

    const groupedSummary: Record<string, { count: number; totalAmount?: number }> = {};
    if (groupBy && rows.length > 0) {
      rows.forEach((r: any) => {
        const key = r[groupBy] || 'Sin especificar';
        if (!groupedSummary[key]) {
          groupedSummary[key] = { count: 0, totalAmount: 0 };
        }
        groupedSummary[key].count += 1;
        if (user.canViewFinancials) {
          if (r.total_amount) {
            groupedSummary[key].totalAmount = (groupedSummary[key].totalAmount || 0) + Number(r.total_amount);
          } else if (r.purchase_price) {
            groupedSummary[key].totalAmount = (groupedSummary[key].totalAmount || 0) + Number(r.purchase_price);
          } else if (r.amount) {
            groupedSummary[key].totalAmount = (groupedSummary[key].totalAmount || 0) + Number(r.amount);
          } else if (r.rental_cost) {
            groupedSummary[key].totalAmount = (groupedSummary[key].totalAmount || 0) + Number(r.rental_cost);
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      count: rows.length,
      data: rows,
      groupedSummary: groupBy ? groupedSummary : null,
    });
  } catch (error: any) {
    console.error('Error al ejecutar reporte:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar consulta de reporte.' }, { status: 500 });
  }
}
