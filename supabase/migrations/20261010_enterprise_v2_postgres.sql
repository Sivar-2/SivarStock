-- ============================================================================
-- SIVARSTOCK ENTERPRISE GT - ESQUEMA RELACIONAL COMPLETO PARA POSTGRESQL & SUPABASE
-- Versión: 2.5.0 Producción
-- Moneda Oficial: Quetzales (GTQ - Q) con soporte de costos y valoración
-- Preparado para conexión nativa con Google Looker Studio (Data Studio)
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ÁREAS Y DEPARTAMENTOS DE LA EMPRESA (11 Departamentos Operativos)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  cost_center VARCHAR(50),
  manager_name VARCHAR(150),
  is_bodega SMALLINT DEFAULT 0, -- 1 para "Cuarto de Servidores (Bodega)"
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. EMPLEADOS / PERSONAL DE LA EMPRESA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  employee_code VARCHAR(30) UNIQUE NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  initials VARCHAR(10) NOT NULL,
  email VARCHAR(180),
  phone VARCHAR(50),
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  immediate_supervisor_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  company_name VARCHAR(150) DEFAULT 'Persiluz / SivarStock',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK(status IN ('ACTIVO', 'INACTIVO', 'RETIRADO')),
  exit_date DATE,
  exit_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. USUARIOS Y PERMISOS DEL SISTEMA (RBAC Granular)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username VARCHAR(80) UNIQUE NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'VIEWER' CHECK(role IN ('ADMIN', 'SUBADMIN', 'AREA_MANAGER', 'VIEWER')),
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  initials VARCHAR(10) NOT NULL,
  allowed_tabs_json TEXT DEFAULT '["DASHBOARD","INVENTARIO","CELULARES","PRODUCTOS","MOVIMIENTOS","ASIGNACIONES","MANTENIMIENTO","SERVICIOS","COSTOS","REPORTES","DEPARTAMENTOS","CONFIGURACION"]',
  only_own_department SMALLINT DEFAULT 0,
  can_view_financials SMALLINT DEFAULT 1,
  can_export SMALLINT DEFAULT 1,
  can_manage_users SMALLINT DEFAULT 0,
  can_edit SMALLINT DEFAULT 1,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. CATEGORÍAS DE PRODUCTOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  tracking_type VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL' CHECK(tracking_type IN ('INDIVIDUAL', 'QUANTITY', 'BATCH')),
  description TEXT,
  icon VARCHAR(50) DEFAULT 'Package',
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. CATÁLOGO DE PRODUCTOS / ARTÍCULOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  brand VARCHAR(100),
  model VARCHAR(100),
  image_url TEXT,
  unit_of_measure VARCHAR(30) DEFAULT 'unidad',
  current_stock NUMERIC DEFAULT 0 CHECK (current_stock >= 0),
  min_stock NUMERIC DEFAULT 5,
  target_stock NUMERIC DEFAULT 20,
  unit_price NUMERIC DEFAULT 0 CHECK (unit_price >= 0),
  box_price NUMERIC DEFAULT 0,
  units_per_box NUMERIC DEFAULT 1,
  default_supplier VARCHAR(150),
  is_consumable SMALLINT DEFAULT 0,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proveedores habituales por producto
CREATE TABLE IF NOT EXISTS product_suppliers (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_name VARCHAR(150) NOT NULL,
  contact_info TEXT,
  is_preferred SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de precios de compra
CREATE TABLE IF NOT EXISTS product_price_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL,
  unit_price NUMERIC NOT NULL,
  box_price NUMERIC DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'GTQ',
  supplier_name VARCHAR(150),
  invoice_number VARCHAR(80),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. ACTIVOS FÍSICOS INDIVIDUALES CON IDENTIFICADOR PERMANENTE (SIV-{DEPT}-{SEQ:6})
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  permanent_code VARCHAR(50) UNIQUE NOT NULL,
  serial_number VARCHAR(100),
  brand VARCHAR(100),
  model VARCHAR(100),
  current_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  current_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  current_assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  operational_status VARCHAR(30) NOT NULL DEFAULT 'DISPONIBLE' CHECK(operational_status IN ('DISPONIBLE', 'ASIGNADO', 'RESERVADO', 'DEVOLUCION_PENDIENTE', 'EN_REVISION', 'AVERIADO', 'DADO_DE_BAJA', 'PERDIDO')),
  physical_condition VARCHAR(30) NOT NULL DEFAULT 'BUENO' CHECK(physical_condition IN ('NUEVO', 'BUENO', 'USADO', 'DANADO', 'AVERIADO', 'EN_REPARACION', 'NO_EVALUADO')),
  purchase_date DATE,
  reception_date DATE,
  supplier VARCHAR(150),
  purchase_price NUMERIC,
  replacement_value NUMERIC,
  residual_value NUMERIC,
  currency VARCHAR(10) DEFAULT 'GTQ' CHECK(currency IN ('GTQ', 'USD')),
  warranty_expiration DATE,
  invoice_number VARCHAR(100),
  purchase_order VARCHAR(100),
  warranty_document_url TEXT,
  invoice_document_url TEXT,
  notes TEXT,
  photo_url TEXT,
  is_broken SMALLINT DEFAULT 0,
  broken_notes TEXT,
  replacement_item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  registered_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. PESTAÑA DEDICADA DE CELULARES (LÍNEAS Y DISPOSITIVOS MÓVILES)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mobile_devices (
  id TEXT PRIMARY KEY,
  device_code VARCHAR(50) UNIQUE NOT NULL,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  phone_number VARCHAR(50) NOT NULL,
  imei VARCHAR(50) UNIQUE NOT NULL,
  delivery_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ASIGNADO' CHECK(status IN ('ASIGNADO', 'DISPONIBLE', 'DEVOLUCION_PENDIENTE', 'EN_REPARACION', 'DADO_DE_BAJA')),
  notes_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. INVENTARIO POR VOLUMEN / CONSUMIBLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consumable_stocks (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK(quantity >= 0),
  batch_number VARCHAR(100) DEFAULT 'LOTE-GENERAL',
  unit_cost NUMERIC DEFAULT 0,
  expiration_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. ASIGNACIONES A EMPLEADOS CON CÓDIGOS DE ENTREGA (AM-2026-LAPD-001)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  assignment_code VARCHAR(80) UNIQUE NOT NULL,
  item_id TEXT REFERENCES inventory_items(id) ON DELETE RESTRICT,
  product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
  employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  quantity NUMERIC DEFAULT 1,
  assigned_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  origin_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  target_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  charged_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_return_date DATE,
  returned_at TIMESTAMPTZ,
  return_condition VARCHAR(30) CHECK(return_condition IN ('NUEVO', 'BUENO', 'USADO', 'DANADO', 'AVERIADO', 'EN_REPARACION', 'NO_EVALUADO') OR return_condition IS NULL),
  return_notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVA' CHECK(status IN ('ACTIVA', 'DEVUELTO', 'DEVOLUCION_PENDIENTE', 'PERDIDO', 'TRANSFERIDO')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 10. ENTRADAS, SALIDAS Y MOVIMIENTOS (KARDEX AUDITABLE)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  movement_type VARCHAR(30) NOT NULL CHECK(movement_type IN ('RECEPCION', 'COMPRA', 'ENTRADA', 'ASIGNACION', 'TRANSFERENCIA', 'CONSUMO', 'DEVOLUCION', 'AJUSTE_AUTORIZADO', 'REPARACION', 'BAJA', 'PERDIDA')),
  item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_cost NUMERIC,
  total_cost NUMERIC,
  from_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  to_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  to_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  from_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  reference_code VARCHAR(100),
  attachment_url TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 11. MANTENIMIENTOS Y REPARACIONES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_records (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  maintenance_type VARCHAR(30) DEFAULT 'CORRECTIVO' CHECK(maintenance_type IN ('PREVENTIVO', 'CORRECTIVO', 'REVISION')),
  fault_description TEXT NOT NULL,
  solution_description TEXT,
  cost NUMERIC DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'GTQ',
  charged_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  reported_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  technician_name VARCHAR(150),
  external_provider VARCHAR(150),
  status VARCHAR(30) NOT NULL DEFAULT 'REPORTADA' CHECK(status IN ('REPORTADA', 'EN_PROCESO', 'COMPLETADA', 'IRREPARABLE', 'CANCELADA')),
  severity VARCHAR(20) DEFAULT 'MODERADA' CHECK(severity IN ('BAJA', 'MODERADA', 'ALTA', 'CRITICA')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 12. SERVICIOS DIGITALES Y LICENCIAS DE SOFTWARE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS digital_services (
  id TEXT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  provider VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK(category IN ('SOFTWARE_LICENSE', 'CLOUD_SERVICE', 'EMAIL_SERVICE', 'ERP_ACCOUNT', 'DEVELOPMENT_TOOL', 'SECURITY_TOOL', 'COMMUNICATION', 'OTHER')),
  license_type VARCHAR(50) DEFAULT 'SUBSCRIPTION',
  seats_purchased INTEGER DEFAULT 1,
  seats_assigned INTEGER DEFAULT 0,
  monthly_cost NUMERIC DEFAULT 0,
  annual_cost NUMERIC DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  billing_cycle VARCHAR(30) DEFAULT 'MONTHLY',
  payment_method VARCHAR(50),
  renewal_date DATE,
  expiration_date DATE,
  account_email VARCHAR(180),
  charged_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  responsible_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PENDING_RENEWAL', 'EXPIRED', 'CANCELLED')),
  auto_renew SMALLINT DEFAULT 1,
  contract_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 13. REGISTROS DE COSTOS Y FACTURACIÓN
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cost_records (
  id TEXT PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  concept VARCHAR(200) NOT NULL,
  amount NUMERIC NOT NULL,
  currency VARCHAR(10) DEFAULT 'GTQ',
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  invoice_number VARCHAR(100),
  supplier VARCHAR(150),
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 14. BITÁCORA DE AUDITORÍA INMUTABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username VARCHAR(80) NOT NULL,
  user_role VARCHAR(30) NOT NULL,
  action VARCHAR(80) NOT NULL,
  module VARCHAR(50) NOT NULL,
  entity_id TEXT,
  entity_name VARCHAR(200),
  previous_state JSONB,
  new_state JSONB,
  reason TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices estratégicos para alto rendimiento
CREATE INDEX IF NOT EXISTS idx_items_dept ON inventory_items(current_department_id);
CREATE INDEX IF NOT EXISTS idx_items_emp ON inventory_items(current_employee_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON inventory_items(operational_status);
CREATE INDEX IF NOT EXISTS idx_assignments_emp ON assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_movements_prod ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ----------------------------------------------------------------------------
-- INMUTABILIDAD CRIPTOGRÁFICA Y DE BASE DE DATOS PARA AUDITORÍA
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de auditoría de SivarStock son estrictamente inmutables: se deniega UPDATE y DELETE';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- ----------------------------------------------------------------------------
-- VISTAS ANALÍTICAS PARA GOOGLE LOOKER STUDIO (DATA STUDIO)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_looker_inventory_valuation AS
SELECT 
  p.id as product_id,
  p.code as product_code,
  p.name as product_name,
  c.name as category_name,
  p.unit_price as unit_price_gtq,
  p.current_stock as warehouse_stock,
  (p.unit_price * p.current_stock) as total_valuation_gtq,
  p.min_stock,
  CASE WHEN p.current_stock <= p.min_stock THEN 'STOCK_BAJO' ELSE 'NORMAL' END as stock_health
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.is_active = 1;

CREATE OR REPLACE VIEW v_looker_movements_kardex AS
SELECT 
  m.id as movement_id,
  m.created_at,
  m.movement_type,
  p.code as product_code,
  p.name as product_name,
  m.quantity,
  m.unit_cost,
  m.total_cost,
  df.name as origin_department,
  dt.name as target_department,
  e.full_name as recipient_employee,
  u.full_name as executed_by,
  m.reason
FROM inventory_movements m
LEFT JOIN products p ON m.product_id = p.id
LEFT JOIN departments df ON m.from_department_id = df.id
LEFT JOIN departments dt ON m.to_department_id = dt.id
LEFT JOIN employees e ON m.to_employee_id = e.id
LEFT JOIN users u ON m.user_id = u.id;

-- ----------------------------------------------------------------------------
-- DATOS INICIALES SEMILLA (SEED DATA)
-- ----------------------------------------------------------------------------
-- Departamentos empresariales con Cuarto de Servidores (Bodega)
INSERT INTO departments (id, code, name, cost_center, manager_name, is_bodega) VALUES
('dept-bod', 'BOD', 'Cuarto de Servidores (Bodega)', 'CC-001', 'Alexander Admin', 1),
('dept-it', 'IT', 'Tecnología e Informática', 'CC-002', 'Alexander Admin', 0),
('dept-prod', 'PROD', 'Producción y Fabricación', 'CC-003', 'Carlos Gómez', 0),
('dept-mant', 'MANT', 'Mantenimiento de Planta', 'CC-004', 'Eduardo Ramos', 0),
('dept-vent', 'VENT', 'Ventas y Comercial', 'CC-005', 'Mariana Torres', 0),
('dept-fin', 'FIN', 'Finanzas y Contabilidad', 'CC-006', 'Lucía Méndez', 0),
('dept-rrhh', 'RRHH', 'Recursos Humanos', 'CC-007', 'Sofía Castillo', 0),
('dept-log', 'LOG', 'Logística y Despacho', 'CC-008', 'Javier Peña', 0),
('dept-cal', 'CAL', 'Control de Calidad', 'CC-009', 'Andrea Morales', 0),
('dept-adm', 'ADM', 'Administración General', 'CC-010', 'Roberto Flores', 0),
('dept-ger', 'GER', 'Gerencia General', 'CC-011', 'Dirección Ejecutiva', 0)
ON CONFLICT (id) DO NOTHING;

-- Usuario Administrador principal
INSERT INTO users (
  id, username, full_name, email, password_hash, role,
  department_id, initials, can_view_financials, can_export, can_manage_users, can_edit, is_active
) VALUES (
  'usr-admin', 'alexander7tm', 'Alexander Admin', 'alexander7tm@gmail.com',
  '$2a$10$wT8Kz5hX/gH1kP0xWz6K3.j5zO5e3a3q9f3u1e7r5w1e7r5w1e7r5', 'ADMIN',
  'dept-bod', 'AA', 1, 1, 1, 1, 1
) ON CONFLICT (email) DO NOTHING;
