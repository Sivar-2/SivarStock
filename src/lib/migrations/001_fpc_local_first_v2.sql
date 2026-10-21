-- ============================================================================
-- MIGRACIÓN NO DESTRUCTIVA: SIVARSTOCK ENTERPRISE V2 (FPC LOCAL-FIRST)
-- Agrega columnas y tablas requeridas para los 15 módulos sin pérdida de datos
-- ============================================================================

-- 1. Modificaciones a EMPLOYEES
ALTER TABLE employees ADD COLUMN IF NOT EXISTS dpi_number VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title VARCHAR(120);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_deleted SMALLINT DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Modificaciones a USERS
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS quick_access_enabled SMALLINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_actions_json TEXT DEFAULT '{"can_read":1,"can_write":1,"can_delete":0}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_departments_json TEXT DEFAULT '[]';

-- 3. Modificaciones a INVENTORY_ITEMS
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS invoice_file_id TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS photo_file_id TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS qr_data TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_deleted SMALLINT DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Actualizar constraint de operational_status si existe
DO $$
BEGIN
  ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_operational_status_check;
  ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_operational_status_check 
    CHECK(operational_status IN (
      'IN_WAREHOUSE', 'ASSIGNED', 'ASSIGNED_OBSERVATION', 'EXTERNAL_REPAIR', 'DECOMMISSIONED', 'LOST', 'RESERVED',
      'DISPONIBLE', 'AVERIADO', 'DADO_DE_BAJA'
    ));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 4. Modificaciones a MOBILE_DEVICES
ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS contract_carrier VARCHAR(80) DEFAULT 'Claro';
ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS contract_renewal_date DATE;
ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS contract_status VARCHAR(30) DEFAULT 'ACTIVO';
ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS is_deleted SMALLINT DEFAULT 0;
ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE mobile_devices DROP CONSTRAINT IF EXISTS mobile_devices_status_check;
  ALTER TABLE mobile_devices ADD CONSTRAINT mobile_devices_status_check 
    CHECK(status IN ('ASIGNADO', 'DISPONIBLE', 'DEVOLUCION_PENDIENTE', 'EN_REPARACION', 'DADO_DE_BAJA', 'CANCELADA'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 5. Modificaciones a INVENTORY_MOVEMENTS
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS replaced_item_id TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS replacement_action VARCHAR(40);
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS contract_status_tag VARCHAR(30);

DO $$
BEGIN
  ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_movement_type_check;
  ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_movement_type_check 
    CHECK(movement_type IN (
      'RECEPCION', 'COMPRA', 'ENTRADA', 'ASIGNACION', 'TRANSFERENCIA', 'CONSUMO',
      'DEVOLUCION', 'AJUSTE_AUTORIZADO', 'REPARACION', 'BAJA', 'PERDIDA',
      'SUSTITUCION', 'RENOVACION_CONTRATO', 'CANCELACION_CONTRATO'
    ));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 6. Modificaciones a MAINTENANCE_RECORDS
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS assigned_employee_id TEXT;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS stage VARCHAR(30) DEFAULT 'REPORTED';

-- 7. Modificaciones a DIGITAL_SERVICES y LICENSE_CATEGORIES
ALTER TABLE license_categories ADD COLUMN IF NOT EXISTS is_archived SMALLINT DEFAULT 0;
ALTER TABLE digital_services ADD COLUMN IF NOT EXISTS credentials_note TEXT;
ALTER TABLE digital_services ADD COLUMN IF NOT EXISTS is_archived SMALLINT DEFAULT 0;
ALTER TABLE digital_services ADD COLUMN IF NOT EXISTS invoice_file_id TEXT;

-- 8. Modificaciones a COST_RECORDS
ALTER TABLE cost_records ADD COLUMN IF NOT EXISTS warranty_end_date DATE;
ALTER TABLE cost_records ADD COLUMN IF NOT EXISTS invoice_file_id TEXT;

-- 9. Creación de Nuevas Tablas (si no existen)

CREATE TABLE IF NOT EXISTS license_assignments (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES digital_services(id) ON DELETE CASCADE,
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  assigned_email VARCHAR(180),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'ACTIVO' CHECK(status IN ('ACTIVO', 'REVOCADO'))
);

CREATE TABLE IF NOT EXISTS handover_acts (
  id TEXT PRIMARY KEY,
  act_number VARCHAR(50) UNIQUE NOT NULL,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  qr_token VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'UNSIGNED' CHECK(status IN ('UNSIGNED', 'SIGNED', 'CANCELLED')),
  generated_date DATE NOT NULL,
  signed_at TIMESTAMPTZ,
  signature_canvas_data TEXT,
  signed_ip VARCHAR(50),
  legal_template_text TEXT NOT NULL,
  delivery_observations TEXT,
  pdf_storage_path TEXT,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS handover_act_items (
  id TEXT PRIMARY KEY,
  act_id TEXT NOT NULL REFERENCES handover_acts(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  digital_service_id TEXT REFERENCES digital_services(id) ON DELETE SET NULL,
  item_description TEXT NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  serial_or_code VARCHAR(100) NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1.0,
  condition_status VARCHAR(30) NOT NULL DEFAULT 'Nuevo' CHECK(condition_status IN (
    'Nuevo', 'Usado', 'Reparado', 'No aplica – digital'
  )),
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stored_files (
  id TEXT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256_hash VARCHAR(64) NOT NULL,
  relative_path TEXT NOT NULL,
  entity_type VARCHAR(50),
  entity_id TEXT,
  uploaded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  is_completed SMALLINT DEFAULT 0,
  priority VARCHAR(20) DEFAULT 'NORMAL' CHECK(priority IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),
  target_module VARCHAR(50),
  target_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY,
  operation_uuid VARCHAR(64) UNIQUE NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id TEXT NOT NULL,
  action_type VARCHAR(20) NOT NULL CHECK(action_type IN ('INSERT', 'UPDATE', 'DELETE')),
  payload_json TEXT NOT NULL,
  base_version INTEGER DEFAULT 1,
  device_id VARCHAR(100),
  user_id TEXT,
  status VARCHAR(30) DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT')),
  created_at_local TEXT NOT NULL,
  synced_at TIMESTAMPTZ,
  error_message TEXT,
  attachment_refs TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS sync_operations_log (
  id TEXT PRIMARY KEY,
  operation_uuid VARCHAR(64) UNIQUE NOT NULL,
  device_id VARCHAR(100),
  user_id TEXT,
  entity_type VARCHAR(50) NOT NULL,
  entity_id TEXT NOT NULL,
  action_type VARCHAR(20) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(30) DEFAULT 'SUCCESS',
  server_version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY,
  operation_uuid VARCHAR(64) NOT NULL,
  device_id VARCHAR(100),
  user_id TEXT,
  entity_type VARCHAR(50) NOT NULL,
  entity_id TEXT NOT NULL,
  conflict_type VARCHAR(50) NOT NULL,
  local_payload_json TEXT,
  server_payload_json TEXT,
  resolution_status VARCHAR(30) DEFAULT 'PENDING' CHECK(resolution_status IN ('PENDING', 'RESOLVED_LOCAL', 'RESOLVED_SERVER', 'RESOLVED_MANUAL')),
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_items_permanent_code ON inventory_items(permanent_code);
CREATE INDEX IF NOT EXISTS idx_items_status ON inventory_items(operational_status);
CREATE INDEX IF NOT EXISTS idx_items_employee ON inventory_items(current_employee_id);
CREATE INDEX IF NOT EXISTS idx_celulares_imei ON mobile_devices(imei);
CREATE INDEX IF NOT EXISTS idx_celulares_emp ON mobile_devices(employee_id);
CREATE INDEX IF NOT EXISTS idx_celulares_status ON mobile_devices(status);
CREATE INDEX IF NOT EXISTS idx_acts_token ON handover_acts(qr_token);
CREATE INDEX IF NOT EXISTS idx_acts_emp ON handover_acts(employee_id);
CREATE INDEX IF NOT EXISTS idx_stored_files_hash ON stored_files(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_sync_log_uuid ON sync_operations_log(operation_uuid);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status);
