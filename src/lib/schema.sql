-- ============================================================================
-- SIVARSTOCK - ESQUEMA RELACIONAL EMPRESARIAL COMPLETO
-- Base de Datos Unificada con Soporte SQLite / PostgreSQL (Supabase)
-- Moneda Oficial: Quetzales (GTQ - Q) con soporte secundario en Dólares (USD)
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  cost_center TEXT,
  manager_name TEXT,
  is_bodega INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  employee_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  initials TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  immediate_supervisor_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  company_name TEXT DEFAULT 'Persiluz / SivarStock',
  status TEXT NOT NULL DEFAULT 'ACTIVO' CHECK(status IN ('ACTIVO', 'INACTIVO', 'RETIRADO')),
  exit_date TEXT,
  exit_reason TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'VIEWER' CHECK(role IN ('ADMIN', 'SUBADMIN', 'AREA_MANAGER', 'VIEWER')),
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  initials TEXT NOT NULL,
  allowed_tabs_json TEXT DEFAULT '["DASHBOARD","INVENTARIO","CELULARES","PRODUCTOS","MOVIMIENTOS","ASIGNACIONES","MANTENIMIENTO","SERVICIOS","COSTOS","REPORTES","DEPARTAMENTOS","CONFIGURACION"]',
  only_own_department INTEGER DEFAULT 0,
  can_view_financials INTEGER DEFAULT 1,
  can_export INTEGER DEFAULT 1,
  can_manage_users INTEGER DEFAULT 0,
  can_edit INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tracking_type TEXT NOT NULL DEFAULT 'INDIVIDUAL' CHECK(tracking_type IN ('INDIVIDUAL', 'QUANTITY', 'BATCH')),
  description TEXT,
  icon TEXT DEFAULT 'Package',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  model TEXT,
  image_url TEXT,
  unit_of_measure TEXT DEFAULT 'unidad',
  current_stock REAL DEFAULT 0,
  min_stock REAL DEFAULT 5,
  target_stock REAL DEFAULT 20,
  unit_price REAL DEFAULT 0,
  box_price REAL DEFAULT 0,
  units_per_box REAL DEFAULT 1,
  default_supplier TEXT,
  is_consumable INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_suppliers (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  contact_info TEXT,
  is_preferred INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_price_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  purchase_date TEXT NOT NULL,
  unit_price REAL NOT NULL,
  box_price REAL DEFAULT 0,
  currency TEXT DEFAULT 'GTQ',
  supplier_name TEXT,
  invoice_number TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  permanent_code TEXT UNIQUE NOT NULL,
  serial_number TEXT,
  mac_address TEXT,
  imei TEXT,
  ip_address TEXT,
  hostname TEXT,
  specifications TEXT,
  brand TEXT,
  model TEXT,
  current_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  current_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  current_assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  operational_status TEXT NOT NULL DEFAULT 'DISPONIBLE' CHECK(operational_status IN ('DISPONIBLE', 'ASIGNADO', 'RESERVADO', 'DEVOLUCION_PENDIENTE', 'EN_REVISION', 'AVERIADO', 'DADO_DE_BAJA', 'PERDIDO')),
  physical_condition TEXT NOT NULL DEFAULT 'BUENO' CHECK(physical_condition IN ('NUEVO', 'BUENO', 'USADO', 'DANADO', 'AVERIADO', 'EN_REPARACION', 'NO_EVALUADO')),
  purchase_date TEXT,
  reception_date TEXT,
  supplier TEXT,
  purchase_price REAL,
  replacement_value REAL,
  residual_value REAL,
  currency TEXT DEFAULT 'GTQ' CHECK(currency IN ('GTQ', 'USD')),
  warranty_expiration TEXT,
  invoice_number TEXT,
  purchase_order TEXT,
  warranty_document_url TEXT,
  invoice_document_url TEXT,
  notes TEXT,
  photo_url TEXT,
  is_broken INTEGER DEFAULT 0,
  broken_notes TEXT,
  replacement_item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  registered_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mobile_devices (
  id TEXT PRIMARY KEY,
  device_code TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT,
  mac_address TEXT,
  employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  imei TEXT UNIQUE NOT NULL,
  sim_iccid TEXT,
  carrier TEXT DEFAULT 'Tigo',
  plan_name TEXT,
  monthly_cost REAL DEFAULT 0,
  contract_number TEXT,
  contract_start_date TEXT,
  contract_end_date TEXT,
  renewal_alert_days INTEGER DEFAULT 30,
  delivery_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ASIGNADO' CHECK(status IN ('ASIGNADO', 'DISPONIBLE', 'DEVOLUCION_PENDIENTE', 'EN_REPARACION', 'DADO_DE_BAJA')),
  notes_history TEXT DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consumable_stocks (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  quantity REAL NOT NULL DEFAULT 0 CHECK(quantity >= 0),
  batch_number TEXT DEFAULT 'LOTE-GENERAL',
  unit_cost REAL DEFAULT 0,
  expiration_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  assignment_code TEXT UNIQUE NOT NULL,
  item_id TEXT REFERENCES inventory_items(id) ON DELETE RESTRICT,
  product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
  employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  quantity REAL DEFAULT 1,
  assigned_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  origin_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  target_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  charged_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_return_date TEXT,
  returned_at TEXT,
  return_condition TEXT CHECK(return_condition IN ('NUEVO', 'BUENO', 'USADO', 'DANADO', 'AVERIADO', 'EN_REPARACION', 'NO_EVALUADO') OR return_condition IS NULL),
  return_notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVA' CHECK(status IN ('ACTIVA', 'DEVUELTO', 'DEVOLUCION_PENDIENTE', 'PERDIDO', 'TRANSFERIDO')),
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  movement_type TEXT NOT NULL CHECK(movement_type IN ('RECEPCION', 'COMPRA', 'ENTRADA', 'ASIGNACION', 'TRANSFERENCIA', 'CONSUMO', 'DEVOLUCION', 'AJUSTE_AUTORIZADO', 'REPARACION', 'BAJA', 'PERDIDA')),
  item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_cost REAL,
  total_cost REAL,
  from_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  to_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  from_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  to_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  from_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  reference_code TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_counts (
  id TEXT PRIMARY KEY,
  count_code TEXT UNIQUE NOT NULL,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  executed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  executed_by_name TEXT,
  total_expected REAL DEFAULT 0,
  total_counted REAL DEFAULT 0,
  total_bodega REAL DEFAULT 0,
  total_assigned_employees REAL DEFAULT 0,
  discrepancies_count INTEGER DEFAULT 0,
  details_json TEXT DEFAULT '[]',
  notes TEXT,
  status TEXT DEFAULT 'COMPLETADO',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  reported_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scheduled_date TEXT,
  reported_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  fault_description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MODERADA' CHECK(severity IN ('LEVE', 'MODERADA', 'CRITICA')),
  technician_supplier TEXT,
  repair_cost REAL DEFAULT 0,
  currency TEXT DEFAULT 'GTQ' CHECK(currency IN ('GTQ', 'USD')),
  charged_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'REPORTADA' CHECK(status IN ('REPORTADA', 'AGENDADA', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'REPARADO', 'IRREPARABLE_REEMPLAZO', 'DADO_DE_BAJA')),
  solution_type TEXT CHECK(solution_type IN ('REPARACION_INTERNA', 'REPARACION_PROVEEDOR', 'COMPRA_REEMPLAZO', 'BAJA_SIN_REEMPLAZO') OR solution_type IS NULL),
  replacement_item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  replacement_reason TEXT,
  updates_json TEXT DEFAULT '[]',
  resolved_date TEXT,
  resolution_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS license_categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS digital_services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES license_categories(id) ON DELETE SET NULL,
  category_legacy TEXT,
  provider TEXT NOT NULL,
  contract_number TEXT,
  contract_type TEXT DEFAULT 'LICENCIA_SAAS',
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  sla_terms TEXT,
  responsible_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  charged_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  plan_type TEXT,
  license_type TEXT DEFAULT 'USUARIOS',
  seats_contracted INTEGER DEFAULT 1,
  seats_used INTEGER DEFAULT 1,
  cost_period TEXT NOT NULL CHECK(cost_period IN ('MENSUAL', 'ANUAL', 'UNICO', 'GRATUITO')),
  amount REAL,
  monthly_equivalent_cost REAL DEFAULT 0,
  currency TEXT DEFAULT 'GTQ' CHECK(currency IN ('GTQ', 'USD')),
  start_date TEXT,
  expiration_date TEXT,
  renewal_date TEXT,
  auto_renew TEXT DEFAULT 'SI' CHECK(auto_renew IN ('SI', 'NO', 'DESCONOCIDO')),
  status TEXT NOT NULL DEFAULT 'ACTIVA' CHECK(status IN ('ACTIVA', 'GRATUITA', 'PAGO_UNICO', 'CADUCADA_INACTIVA', 'CANCELADA', 'PENDIENTE')),
  payment_method_ref TEXT,
  invoice_number TEXT,
  warranty_document_url TEXT,
  invoice_document_url TEXT,
  assigned_users_text TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cost_records (
  id TEXT PRIMARY KEY,
  item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  digital_service_id TEXT REFERENCES digital_services(id) ON DELETE SET NULL,
  cost_nature TEXT NOT NULL CHECK(cost_nature IN ('ADQUISICION', 'ADICIONAL_FLETE_INSTALACION', 'REPOSICION_ESTIMADA', 'MANTENIMIENTO', 'LICENCIA_SUSCRIPCION', 'OPERATIVO')),
  concept TEXT NOT NULL,
  amount REAL NOT NULL,
  tax_amount REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  total_amount REAL NOT NULL,
  currency TEXT DEFAULT 'GTQ' CHECK(currency IN ('GTQ', 'USD')),
  exchange_rate REAL DEFAULT 1.0,
  expense_date TEXT NOT NULL,
  requesting_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  originating_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  recording_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  budget_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  charged_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  supplier TEXT,
  invoice_number TEXT,
  purchase_order TEXT,
  warranty_document_url TEXT,
  invoice_document_url TEXT,
  cost_center TEXT,
  status TEXT DEFAULT 'CONFIRMADO',
  notes TEXT,
  recorded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_reports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL CHECK(module IN ('INVENTARIO', 'CELULARES', 'MOVIMIENTOS', 'COSTOS', 'ASIGNACIONES', 'SERVICIOS', 'MANTENIMIENTO')),
  columns_json TEXT NOT NULL DEFAULT '[]',
  filters_json TEXT NOT NULL DEFAULT '[]',
  group_by TEXT,
  sort_by TEXT,
  sort_direction TEXT DEFAULT 'DESC',
  visualization_type TEXT DEFAULT 'TABLE',
  date_range_preset TEXT DEFAULT 'ALL',
  allowed_roles_json TEXT DEFAULT '["ADMIN","SUBADMIN","AREA_MANAGER","VIEWER"]',
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  before_state_json TEXT,
  after_state_json TEXT,
  reason TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
