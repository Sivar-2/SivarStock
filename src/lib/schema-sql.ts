import fs from 'fs';
import path from 'path';

/**
 * ESQUEMA SQLITE EMBEBIDO DE SIVARSTOCK ENTERPRISE
 * Carga el esquema oficial desde schema.sql para consistencia 100% libre de discrepancias.
 */

let cachedSchema: string | null = null;

function loadSchema(): string {
  if (cachedSchema) return cachedSchema;
  try {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      cachedSchema = fs.readFileSync(schemaPath, 'utf8');
      return cachedSchema;
    }
  } catch (err) {
    console.warn('[Schema Loader] Fallback a lectura de directorio local:', err);
  }
  return FALLBACK_SCHEMA_SQL;
}

const FALLBACK_SCHEMA_SQL = `-- SIVARSTOCK ENTERPRISE SQLITE SCHEMA
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
  dpi_number TEXT,
  email TEXT,
  phone TEXT,
  job_title TEXT,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  immediate_supervisor_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  company_name TEXT DEFAULT 'Fábrica de Persianas y Complementos, S.A.',
  status TEXT NOT NULL DEFAULT 'ACTIVO' CHECK(status IN ('ACTIVO', 'INACTIVO', 'RETIRADO')),
  exit_date TEXT,
  exit_reason TEXT,
  notes TEXT,
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  pin_hash TEXT,
  quick_access_enabled INTEGER DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'VIEWER' CHECK(role IN ('SUPERADMIN', 'ADMIN', 'SUBADMIN', 'AREA_MANAGER', 'OPERATOR', 'VIEWER')),
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  initials TEXT NOT NULL,
  allowed_tabs_json TEXT DEFAULT '["INICIO","INVENTARIO","CELULARES","PRODUCTOS","MOVIMIENTOS","EMPLEADOS","MANTENIMIENTO","SERVICIOS","COSTOS","REPORTES","DEPARTAMENTOS","CONFIGURACION"]',
  allowed_actions_json TEXT DEFAULT '{"can_read":1,"can_write":1,"can_delete":0}',
  allowed_departments_json TEXT DEFAULT '[]',
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
  brand TEXT,
  model TEXT,
  current_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  current_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  current_assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  operational_status TEXT NOT NULL DEFAULT 'IN_WAREHOUSE' CHECK(operational_status IN (
    'IN_WAREHOUSE', 'ASSIGNED', 'ASSIGNED_OBSERVATION', 'EXTERNAL_REPAIR', 'DECOMMISSIONED', 'LOST', 'RESERVED',
    'DISPONIBLE', 'AVERIADO', 'DADO_DE_BAJA'
  )),
  physical_condition TEXT NOT NULL DEFAULT 'BUENO' CHECK(physical_condition IN (
    'NUEVO', 'BUENO', 'USADO', 'DANADO', 'AVERIADO', 'EN_REPARACION', 'NO_APLICA_DIGITAL', 'NO_EVALUADO'
  )),
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
  invoice_file_id TEXT,
  notes TEXT,
  photo_url TEXT,
  photo_file_id TEXT,
  is_broken INTEGER DEFAULT 0,
  broken_notes TEXT,
  replacement_item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  qr_data TEXT,
  registered_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mobile_devices (
  id TEXT PRIMARY KEY,
  device_code TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  imei TEXT UNIQUE NOT NULL,
  delivery_date TEXT NOT NULL,
  contract_carrier TEXT DEFAULT 'Claro',
  contract_renewal_date TEXT,
  contract_status TEXT DEFAULT 'ACTIVO' CHECK(contract_status IN ('ACTIVO', 'RENOVADO', 'POR_VENCER', 'CANCELADO')),
  status TEXT NOT NULL DEFAULT 'ASIGNADO' CHECK(status IN ('ASIGNADO', 'DISPONIBLE', 'DEVOLUCION_PENDIENTE', 'EN_REPARACION', 'DADO_DE_BAJA', 'CANCELADA')),
  notes_history TEXT DEFAULT '[]',
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
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
  return_condition TEXT,
  return_notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVA' CHECK(status IN ('ACTIVA', 'DEVUELTO', 'DEVOLUCION_PENDIENTE', 'PERDIDO', 'TRANSFERIDO')),
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  movement_type TEXT NOT NULL,
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
  replaced_item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  replacement_action TEXT,
  contract_status_tag TEXT,
  reason TEXT NOT NULL,
  reference_code TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  reported_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scheduled_date TEXT,
  reported_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  fault_description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MODERADA',
  stage TEXT NOT NULL DEFAULT 'REPORTED',
  technician_supplier TEXT,
  repair_cost REAL DEFAULT 0,
  currency TEXT DEFAULT 'GTQ',
  charged_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'REPORTADA',
  solution_type TEXT,
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
  is_archived INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS digital_services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES license_categories(id) ON DELETE SET NULL,
  category_legacy TEXT,
  provider TEXT NOT NULL,
  responsible_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  charged_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  plan_type TEXT,
  license_type TEXT DEFAULT 'USUARIOS',
  seats_contracted INTEGER DEFAULT 1,
  seats_used INTEGER DEFAULT 1,
  cost_period TEXT NOT NULL,
  amount REAL,
  monthly_equivalent_cost REAL DEFAULT 0,
  currency TEXT DEFAULT 'GTQ',
  start_date TEXT,
  expiration_date TEXT,
  renewal_date TEXT,
  auto_renew TEXT DEFAULT 'SI',
  status TEXT NOT NULL DEFAULT 'ACTIVA',
  payment_method_ref TEXT,
  invoice_number TEXT,
  warranty_document_url TEXT,
  invoice_document_url TEXT,
  invoice_file_id TEXT,
  assigned_users_text TEXT,
  credentials_note TEXT,
  is_archived INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS license_assignments (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES digital_services(id) ON DELETE CASCADE,
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  assigned_email TEXT,
  assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'ACTIVO'
);

CREATE TABLE IF NOT EXISTS cost_records (
  id TEXT PRIMARY KEY,
  item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  digital_service_id TEXT REFERENCES digital_services(id) ON DELETE SET NULL,
  cost_nature TEXT NOT NULL,
  concept TEXT NOT NULL,
  amount REAL NOT NULL,
  tax_amount REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  total_amount REAL NOT NULL,
  currency TEXT DEFAULT 'GTQ',
  exchange_rate REAL DEFAULT 1.0,
  expense_date TEXT NOT NULL,
  warranty_end_date TEXT,
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
  invoice_file_id TEXT,
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
  module TEXT NOT NULL,
  columns_json TEXT NOT NULL DEFAULT '[]',
  filters_json TEXT NOT NULL DEFAULT '[]',
  group_by TEXT,
  sort_by TEXT,
  sort_direction TEXT DEFAULT 'DESC',
  visualization_type TEXT DEFAULT 'TABLE',
  date_range_preset TEXT DEFAULT 'ALL',
  allowed_roles_json TEXT DEFAULT '["SUPERADMIN","ADMIN","SUBADMIN","AREA_MANAGER","VIEWER"]',
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

CREATE TABLE IF NOT EXISTS handover_acts (
  id TEXT PRIMARY KEY,
  act_number TEXT UNIQUE NOT NULL,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  qr_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNSIGNED',
  generated_date TEXT NOT NULL,
  signed_at TEXT,
  signature_canvas_data TEXT,
  signed_ip TEXT,
  legal_template_text TEXT NOT NULL,
  delivery_observations TEXT,
  pdf_storage_path TEXT,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS handover_act_items (
  id TEXT PRIMARY KEY,
  act_id TEXT NOT NULL REFERENCES handover_acts(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  digital_service_id TEXT REFERENCES digital_services(id) ON DELETE SET NULL,
  item_description TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_or_code TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1.0,
  condition_status TEXT NOT NULL DEFAULT 'Nuevo',
  observations TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stored_files (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256_hash TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  uploaded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT NOT NULL,
  is_completed INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'NORMAL',
  target_module TEXT,
  target_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY,
  operation_uuid TEXT UNIQUE NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  base_version INTEGER DEFAULT 1,
  device_id TEXT,
  user_id TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at_local TEXT NOT NULL,
  synced_at TEXT,
  error_message TEXT,
  attachment_refs TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS sync_operations_log (
  id TEXT PRIMARY KEY,
  operation_uuid TEXT UNIQUE NOT NULL,
  device_id TEXT,
  user_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  processed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'SUCCESS',
  server_version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY,
  operation_uuid TEXT NOT NULL,
  device_id TEXT,
  user_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL,
  local_payload_json TEXT,
  server_payload_json TEXT,
  resolution_status TEXT DEFAULT 'PENDING',
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_items_permanent_code ON inventory_items(permanent_code);
CREATE INDEX IF NOT EXISTS idx_items_status ON inventory_items(operational_status);
CREATE INDEX IF NOT EXISTS idx_items_employee ON inventory_items(current_employee_id);
CREATE INDEX IF NOT EXISTS idx_celulares_imei ON mobile_devices(imei);
CREATE INDEX IF NOT EXISTS idx_celulares_emp ON mobile_devices(employee_id);
CREATE INDEX IF NOT EXISTS idx_acts_token ON handover_acts(qr_token);
CREATE INDEX IF NOT EXISTS idx_acts_emp ON handover_acts(employee_id);
CREATE INDEX IF NOT EXISTS idx_stored_files_hash ON stored_files(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_sync_log_uuid ON sync_operations_log(operation_uuid);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status);
`;

export const SCHEMA_SQL = loadSchema();
