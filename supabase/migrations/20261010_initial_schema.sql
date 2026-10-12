-- ============================================================================
-- SIVARSTOCK - ESQUEMA RELACIONAL COMPLETO PARA POSTGRESQL & SUPABASE
-- Sistema de Control de Inventario Físico y Digital (Guatemala - Quetzales GTQ)
-- Preparado para conexión nativa con Google Looker Studio (Data Studio)
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ÁREAS Y DEPARTAMENTOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  cost_center VARCHAR(50),
  manager_name VARCHAR(150),
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. UBICACIONES FÍSICAS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. USUARIOS Y PERMISOS RBAC
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username VARCHAR(80) UNIQUE NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL CHECK(role IN ('ADMIN', 'SUBADMIN', 'AREA_MANAGER', 'VIEWER')),
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  initials VARCHAR(10) NOT NULL,
  can_view_financials SMALLINT DEFAULT 1,
  can_export SMALLINT DEFAULT 1,
  can_manage_users SMALLINT DEFAULT 0,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. CATEGORÍAS DE BIENES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  tracking_type VARCHAR(20) NOT NULL CHECK(tracking_type IN ('INDIVIDUAL', 'QUANTITY', 'BATCH')),
  description TEXT,
  icon VARCHAR(50) DEFAULT 'Package',
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. PRODUCTOS / ARTÍCULOS BASE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  brand VARCHAR(100),
  model VARCHAR(100),
  unit_of_measure VARCHAR(30) DEFAULT 'unidad',
  is_consumable SMALLINT DEFAULT 0,
  min_stock NUMERIC(12,2) DEFAULT 5.0,
  target_stock NUMERIC(12,2) DEFAULT 20.0,
  current_stock NUMERIC(12,2) DEFAULT 0.0,
  default_supplier VARCHAR(150),
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. ACTIVOS INDIVIDUALES CON IDENTIFICADOR PERMANENTE (SIV-{DEPT}-{SEQ:6})
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  permanent_code VARCHAR(40) UNIQUE NOT NULL,
  serial_number VARCHAR(120),
  brand VARCHAR(100),
  model VARCHAR(100),
  current_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  current_location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  current_assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  operational_status VARCHAR(30) NOT NULL DEFAULT 'DISPONIBLE' CHECK(operational_status IN ('DISPONIBLE', 'ASIGNADO', 'RESERVADO', 'EN_REVISION', 'DADO_DE_BAJA', 'PERDIDO')),
  physical_condition VARCHAR(30) NOT NULL DEFAULT 'BUENO' CHECK(physical_condition IN ('NUEVO', 'BUENO', 'USADO', 'DANADO', 'AVERIADO', 'EN_REPARACION', 'NO_EVALUADO')),
  purchase_date DATE,
  reception_date DATE,
  supplier VARCHAR(150),
  purchase_price NUMERIC(14,2),
  replacement_value NUMERIC(14,2),
  residual_value NUMERIC(14,2),
  currency VARCHAR(10) DEFAULT 'GTQ',
  warranty_expiration DATE,
  invoice_number VARCHAR(80),
  purchase_order VARCHAR(80),
  notes TEXT,
  photo_url TEXT,
  registered_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. EXISTENCIAS DE MATERIALES CONSUMIBLES Y LOTES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consumable_stocks (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 0.0 CHECK(quantity >= 0),
  batch_number VARCHAR(80),
  unit_cost NUMERIC(14,2) DEFAULT 0.0,
  expiration_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_consumable_stock UNIQUE(product_id, department_id, batch_number)
);

-- ----------------------------------------------------------------------------
-- 8. ASIGNACIONES A USUARIOS Y CÓDIGOS DE ENTREGA (AM-2026-PROD-001)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  assignment_code VARCHAR(60) UNIQUE NOT NULL,
  item_id TEXT REFERENCES inventory_items(id) ON DELETE RESTRICT,
  product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,2) DEFAULT 1.0,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  origin_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  target_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  charged_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_return_date DATE,
  returned_at TIMESTAMPTZ,
  return_condition VARCHAR(30) CHECK(return_condition IN ('NUEVO', 'BUENO', 'USADO', 'DANADO', 'AVERIADO', 'EN_REPARACION', 'NO_EVALUADO') OR return_condition IS NULL),
  return_notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVA' CHECK(status IN ('ACTIVA', 'DEVUELTO', 'PERDIDO', 'TRANSFERIDO')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. MOVIMIENTOS DE INVENTARIO (KARDEX AUDITABLE)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  movement_type VARCHAR(40) NOT NULL CHECK(movement_type IN ('RECEPCION', 'COMPRA', 'ENTRADA', 'ASIGNACION', 'TRANSFERENCIA', 'CONSUMO', 'DEVOLUCION', 'AJUSTE_AUTORIZADO', 'REPARACION', 'BAJA', 'PERDIDA')),
  item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 1.0,
  unit_cost NUMERIC(14,2),
  total_cost NUMERIC(14,2),
  from_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  to_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  from_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  reference_code VARCHAR(80),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 10. AVERÍAS Y MANTENIMIENTO
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_records (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  reported_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reported_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  fault_description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'MODERADA' CHECK(severity IN ('LEVE', 'MODERADA', 'CRITICA')),
  technician_supplier VARCHAR(150),
  repair_cost NUMERIC(14,2) DEFAULT 0.0,
  charged_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'REPORTADA' CHECK(status IN ('REPORTADA', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'REPARADO', 'IRREPARABLE_BAJA')),
  resolved_date TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 11. LICENCIAS Y SERVICIOS DIGITALES (SAAS, DOMINIOS, NUBE)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS digital_services (
  id TEXT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(40) NOT NULL CHECK(category IN ('OFIMATICA', 'DISENO', 'NUBE', 'DOMINIO_HOSTING', 'SEGURIDAD', 'SAAS', 'HERRAMIENTAS')),
  provider VARCHAR(150) NOT NULL,
  responsible_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  charged_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  plan_type VARCHAR(80),
  license_type VARCHAR(40) DEFAULT 'USUARIOS',
  seats_contracted INTEGER DEFAULT 1,
  seats_used INTEGER DEFAULT 1,
  cost_period VARCHAR(20) NOT NULL CHECK(cost_period IN ('MENSUAL', 'ANUAL', 'UNICO', 'GRATUITO')),
  amount NUMERIC(14,2),
  monthly_equivalent_cost NUMERIC(14,2) DEFAULT 0.0,
  currency VARCHAR(10) DEFAULT 'GTQ',
  start_date DATE,
  expiration_date DATE,
  renewal_date DATE,
  auto_renew VARCHAR(15) DEFAULT 'SI' CHECK(auto_renew IN ('SI', 'NO', 'DESCONOCIDO')),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVA' CHECK(status IN ('ACTIVA', 'GRATUITA', 'VENCIDA', 'CANCELADA', 'PENDIENTE')),
  payment_method_ref VARCHAR(100),
  invoice_number VARCHAR(80),
  assigned_users_text TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 12. REGISTROS DE COSTOS MULTIDIMENSIONALES (LAS 5 DIMENSIONES DE ÁREA)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cost_records (
  id TEXT PRIMARY KEY,
  item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  digital_service_id TEXT REFERENCES digital_services(id) ON DELETE SET NULL,
  cost_nature VARCHAR(40) NOT NULL CHECK(cost_nature IN ('ADQUISICION', 'ADICIONAL_FLETE_INSTALACION', 'REPOSICION_ESTIMADA', 'MANTENIMIENTO', 'LICENCIA_SUSCRIPCION', 'OPERATIVO')),
  concept VARCHAR(200) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  tax_amount NUMERIC(14,2) DEFAULT 0.0,
  discount_amount NUMERIC(14,2) DEFAULT 0.0,
  total_amount NUMERIC(14,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'GTQ',
  exchange_rate NUMERIC(10,4) DEFAULT 1.0,
  expense_date DATE NOT NULL,
  requesting_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  originating_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  recording_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  budget_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  charged_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  supplier VARCHAR(150),
  invoice_number VARCHAR(80),
  purchase_order VARCHAR(80),
  cost_center VARCHAR(50),
  status VARCHAR(20) DEFAULT 'CONFIRMADO',
  notes TEXT,
  recorded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 13. CAMPOS PERSONALIZADOS DINÁMICOS DE COSTOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_cost_fields (
  id TEXT PRIMARY KEY,
  field_key VARCHAR(80) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  field_type VARCHAR(20) NOT NULL CHECK(field_type IN ('TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'PERCENTAGE', 'SELECT', 'BOOLEAN')),
  is_required SMALLINT DEFAULT 0,
  options_json JSONB DEFAULT '[]'::jsonb,
  applicable_modules_json JSONB DEFAULT '["INVENTARIO","COSTOS"]'::jsonb,
  applicable_categories_json JSONB DEFAULT '[]'::jsonb,
  visible_in_forms SMALLINT DEFAULT 1,
  visible_in_queries SMALLINT DEFAULT 1,
  visible_in_exports SMALLINT DEFAULT 1,
  visible_in_reports SMALLINT DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 14. VALORES DE CAMPOS PERSONALIZADOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_field_values (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL REFERENCES custom_cost_fields(id) ON DELETE CASCADE,
  entity_type VARCHAR(30) NOT NULL CHECK(entity_type IN ('ITEM', 'PRODUCT', 'SERVICE', 'COST_RECORD')),
  entity_id TEXT NOT NULL,
  field_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_custom_val UNIQUE(field_id, entity_type, entity_id)
);

-- ----------------------------------------------------------------------------
-- 15. CONFIGURACIONES GUARDADAS DE REPORTES PERSONALIZADOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_reports (
  id TEXT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  module VARCHAR(30) NOT NULL CHECK(module IN ('INVENTARIO', 'MOVIMIENTOS', 'COSTOS', 'ASIGNACIONES', 'SERVICIOS', 'MANTENIMIENTO')),
  columns_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  filters_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  group_by VARCHAR(80),
  sort_by VARCHAR(80),
  sort_direction VARCHAR(10) DEFAULT 'DESC',
  visualization_type VARCHAR(30) DEFAULT 'TABLE',
  date_range_preset VARCHAR(40) DEFAULT 'ALL',
  allowed_roles_json JSONB DEFAULT '["ADMIN","SUBADMIN","AREA_MANAGER","VIEWER"]'::jsonb,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 16. AUDITORÍA INMUTABLE DEL SISTEMA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(80) NOT NULL,
  user_role VARCHAR(30) NOT NULL,
  action VARCHAR(80) NOT NULL,
  module VARCHAR(50) NOT NULL,
  entity_id TEXT,
  entity_name VARCHAR(100),
  before_state_json JSONB,
  after_state_json JSONB,
  reason TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 17. CONFIGURACIONES GENERALES DEL SISTEMA (GUATEMALA / QUETZALES)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(80) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- ÍNDICES DE RENDIMIENTO
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_items_permanent_code ON inventory_items(permanent_code);
CREATE INDEX IF NOT EXISTS idx_items_dept ON inventory_items(current_department_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON inventory_items(operational_status);
CREATE INDEX IF NOT EXISTS idx_assignments_code ON assignments(assignment_code);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_movements_prod ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_costs_charged_dept ON cost_records(charged_department_id);
CREATE INDEX IF NOT EXISTS idx_costs_origin_dept ON cost_records(originating_department_id);
CREATE INDEX IF NOT EXISTS idx_costs_date ON cost_records(expense_date);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);

-- ============================================================================
-- VISTAS ANALÍTICAS OPTIMIZADAS PARA GOOGLE LOOKER STUDIO (DATA STUDIO)
-- Permiten conexión directa mediante el conector nativo PostgreSQL de Looker Studio
-- ============================================================================

-- 1. VISTA: INVENTARIO DE ACTIVOS FÍSICOS
CREATE OR REPLACE VIEW vw_gds_inventory_assets AS
SELECT 
  i.id AS asset_id,
  i.permanent_code,
  i.serial_number,
  p.name AS product_name,
  p.code AS product_sku,
  c.name AS category_name,
  COALESCE(i.brand, p.brand) AS brand,
  COALESCE(i.model, p.model) AS model,
  d.name AS current_department,
  d.cost_center AS department_cost_center,
  l.name AS location_name,
  u.full_name AS assigned_user_name,
  u.email AS assigned_user_email,
  i.operational_status,
  i.physical_condition,
  i.purchase_date,
  i.reception_date,
  i.warranty_expiration,
  i.supplier,
  COALESCE(i.purchase_price, 0) AS purchase_price_gtq,
  COALESCE(i.replacement_value, 0) AS replacement_value_gtq,
  i.currency,
  i.invoice_number,
  i.created_at AS registered_at
FROM inventory_items i
JOIN products p ON i.product_id = p.id
JOIN categories c ON p.category_id = c.id
LEFT JOIN departments d ON i.current_department_id = d.id
LEFT JOIN locations l ON i.current_location_id = l.id
LEFT JOIN users u ON i.current_assigned_user_id = u.id;

-- 2. VISTA: ANALÍTICA MULTIDIMENSIONAL DE COSTOS Y GASTOS (5 DIMENSIONES DE ÁREA)
CREATE OR REPLACE VIEW vw_gds_cost_analytics AS
SELECT 
  cr.id AS cost_id,
  cr.expense_date,
  EXTRACT(YEAR FROM cr.expense_date) AS expense_year,
  EXTRACT(MONTH FROM cr.expense_date) AS expense_month,
  TO_CHAR(cr.expense_date, 'YYYY-MM') AS expense_year_month,
  cr.concept,
  cr.cost_nature,
  cr.amount AS subtotal_gtq,
  cr.tax_amount AS tax_gtq,
  cr.discount_amount AS discount_gtq,
  cr.total_amount AS total_gtq,
  cr.currency,
  -- Dimensión 1: Área Solicitante
  req_d.name AS requesting_department,
  -- Dimensión 2: Área Originadora del Gasto
  orig_d.name AS originating_department,
  -- Dimensión 3: Área que Registró
  rec_d.name AS recording_department,
  -- Dimensión 4: Área del Presupuesto
  bud_d.name AS budget_department,
  -- Dimensión 5: Área Imputada (Asume el Costo)
  chg_d.name AS charged_department,
  chg_d.cost_center AS charged_cost_center,
  cr.supplier,
  cr.invoice_number,
  cr.purchase_order,
  cr.status,
  i.permanent_code AS related_asset_code,
  p.name AS related_product_name,
  ds.name AS related_digital_service
FROM cost_records cr
LEFT JOIN departments req_d ON cr.requesting_department_id = req_d.id
LEFT JOIN departments orig_d ON cr.originating_department_id = orig_d.id
LEFT JOIN departments rec_d ON cr.recording_department_id = rec_d.id
LEFT JOIN departments bud_d ON cr.budget_department_id = bud_d.id
LEFT JOIN departments chg_d ON cr.charged_department_id = chg_d.id
LEFT JOIN inventory_items i ON cr.item_id = i.id
LEFT JOIN products p ON cr.product_id = p.id
LEFT JOIN digital_services ds ON cr.digital_service_id = ds.id;

-- 3. VISTA: STOCK Y VALORACIÓN DE CONSUMIBLES
CREATE OR REPLACE VIEW vw_gds_consumables_stock AS
SELECT 
  cs.id AS stock_id,
  p.code AS product_code,
  p.name AS product_name,
  c.name AS category_name,
  d.name AS department_name,
  l.name AS location_name,
  cs.quantity AS current_stock,
  p.min_stock,
  p.target_stock,
  p.unit_of_measure,
  cs.unit_cost AS unit_cost_gtq,
  (cs.quantity * cs.unit_cost) AS total_valuation_gtq,
  cs.batch_number,
  cs.expiration_date,
  CASE 
    WHEN cs.quantity <= p.min_stock THEN 'STOCK CRITICO (BAJO MINIMO)'
    WHEN cs.quantity <= p.target_stock THEN 'STOCK EN REORDEN'
    ELSE 'STOCK NORMAL'
  END AS stock_alert_status
FROM consumable_stocks cs
JOIN products p ON cs.product_id = p.id
JOIN categories c ON p.category_id = c.id
JOIN departments d ON cs.department_id = d.id
LEFT JOIN locations l ON cs.location_id = l.id;

-- 4. VISTA: HISTORIAL DE ASIGNACIONES Y ENTREGAS (CÓDIGOS REGLAMENTARIOS)
CREATE OR REPLACE VIEW vw_gds_assignments_history AS
SELECT 
  a.id AS assignment_id,
  a.assignment_code,
  i.permanent_code AS asset_permanent_code,
  p.name AS product_name,
  u.full_name AS assigned_user_name,
  u.initials AS user_initials,
  u_dept.name AS user_department,
  a_by.full_name AS assigned_by_name,
  a.assigned_at,
  a.expected_return_date,
  a.returned_at,
  a.return_condition,
  a.status AS assignment_status,
  a.notes
FROM assignments a
LEFT JOIN inventory_items i ON a.item_id = i.id
LEFT JOIN products p ON COALESCE(a.product_id, i.product_id) = p.id
JOIN users u ON a.user_id = u.id
LEFT JOIN departments u_dept ON u.department_id = u_dept.id
JOIN users a_by ON a.assigned_by_user_id = a_by.id;

-- 5. VISTA: LICENCIAS Y SERVICIOS DIGITALES (ALERTAS DE RENOVACIÓN)
CREATE OR REPLACE VIEW vw_gds_digital_services AS
SELECT 
  ds.id AS service_id,
  ds.name AS service_name,
  ds.category,
  ds.provider,
  resp_d.name AS responsible_department,
  chg_d.name AS charged_department,
  ds.plan_type,
  ds.seats_contracted,
  ds.seats_used,
  (ds.seats_contracted - ds.seats_used) AS available_seats,
  ds.cost_period,
  COALESCE(ds.amount, 0) AS amount_gtq,
  COALESCE(ds.monthly_equivalent_cost, 0) AS monthly_equivalent_gtq,
  (COALESCE(ds.monthly_equivalent_cost, 0) * 12) AS annual_projected_cost_gtq,
  ds.currency,
  ds.start_date,
  ds.expiration_date,
  ds.renewal_date,
  ds.auto_renew,
  ds.status,
  CASE 
    WHEN ds.renewal_date IS NOT NULL THEN (ds.renewal_date - CURRENT_DATE)
    WHEN ds.expiration_date IS NOT NULL THEN (ds.expiration_date - CURRENT_DATE)
    ELSE NULL 
  END AS days_remaining,
  CASE 
    WHEN ds.status = 'VENCIDA' OR (ds.renewal_date < CURRENT_DATE) THEN 'VENCIDO'
    WHEN (ds.renewal_date - CURRENT_DATE) <= 7 THEN 'ALERTA ROJA (<=7 DIAS)'
    WHEN (ds.renewal_date - CURRENT_DATE) <= 15 THEN 'ALERTA AMARILLA (<=15 DIAS)'
    WHEN (ds.renewal_date - CURRENT_DATE) <= 30 THEN 'ALERTA PREVENTIVA (<=30 DIAS)'
    ELSE 'AL DIA'
  END AS renewal_status_alert
FROM digital_services ds
LEFT JOIN departments resp_d ON ds.responsible_department_id = resp_d.id
LEFT JOIN departments chg_d ON ds.charged_department_id = chg_d.id;

-- 6. VISTA: TRANSACCIONES KARDEX AUDITABLES
CREATE OR REPLACE VIEW vw_gds_kardex_movements AS
SELECT 
  m.id AS movement_id,
  m.created_at AS movement_timestamp,
  TO_CHAR(m.created_at, 'YYYY-MM-DD') AS movement_date,
  m.movement_type,
  p.name AS product_name,
  p.code AS product_sku,
  i.permanent_code AS asset_code,
  m.quantity,
  COALESCE(m.unit_cost, 0) AS unit_cost_gtq,
  COALESCE(m.total_cost, 0) AS total_cost_gtq,
  from_d.name AS source_department,
  to_d.name AS target_department,
  from_u.full_name AS source_user,
  to_u.full_name AS target_user,
  m.reason,
  m.reference_code,
  op_u.full_name AS performed_by_user
FROM inventory_movements m
LEFT JOIN products p ON m.product_id = p.id
LEFT JOIN inventory_items i ON m.item_id = i.id
LEFT JOIN departments from_d ON m.from_department_id = from_d.id
LEFT JOIN departments to_d ON m.to_department_id = to_d.id
LEFT JOIN users from_u ON m.from_user_id = from_u.id
LEFT JOIN users to_u ON m.to_user_id = to_u.id
LEFT JOIN users op_u ON m.user_id = op_u.id;

-- ============================================================================
-- POLÍTICAS DE ROW LEVEL SECURITY (RLS) PARA SUPABASE
-- ============================================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumable_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_cost_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública/autenticada para catálogos
CREATE POLICY "Lectura para usuarios autorizados" ON departments FOR SELECT USING (true);
CREATE POLICY "Lectura para usuarios autorizados" ON locations FOR SELECT USING (true);
CREATE POLICY "Lectura para usuarios autorizados" ON categories FOR SELECT USING (true);
CREATE POLICY "Lectura para usuarios autorizados" ON products FOR SELECT USING (true);
CREATE POLICY "Lectura para usuarios autorizados" ON inventory_items FOR SELECT USING (true);
CREATE POLICY "Lectura para usuarios autorizados" ON consumable_stocks FOR SELECT USING (true);
CREATE POLICY "Lectura para usuarios autorizados" ON assignments FOR SELECT USING (true);
CREATE POLICY "Lectura para usuarios autorizados" ON digital_services FOR SELECT USING (true);
CREATE POLICY "Lectura para usuarios autorizados" ON cost_records FOR SELECT USING (true);
CREATE POLICY "Lectura para usuarios autorizados" ON custom_cost_fields FOR SELECT USING (true);
CREATE POLICY "Lectura para usuarios autorizados" ON custom_field_values FOR SELECT USING (true);
CREATE POLICY "Lectura para usuarios autorizados" ON custom_reports FOR SELECT USING (true);
CREATE POLICY "Lectura para usuarios autorizados" ON system_settings FOR SELECT USING (true);
