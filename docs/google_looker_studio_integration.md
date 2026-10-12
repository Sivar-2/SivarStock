# Guía de Conexión: Google Looker Studio (Data Studio) con PostgreSQL & Supabase

## 1. Visión General de la Arquitectura
**SivarStock** está diseñado con una arquitectura lista para analítica empresarial (*Data Analytics*). La base de datos relacional alojada en **PostgreSQL (Supabase)** no solo alimenta la aplicación web en **Vercel**, sino que expone directamente vistas normalizadas y aplanadas (*Analytical Views / Data Marts*) para que herramientas de Business Intelligence como **Google Looker Studio (antes Google Data Studio)** se conecten de manera nativa sin necesidad de pipelines ETL complejos.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE (PostgreSQL 15+)                       │
│                                                                        │
│   ┌─────────────────────────────┐   ┌──────────────────────────────┐   │
│   │    Tablas Operativas        │   │  Vistas Analíticas Looker    │   │
│   │  - inventory_items          │──▶│  - vw_gds_inventory_assets   │   │
│   │  - cost_records (5D)        │──▶│  - vw_gds_cost_analytics     │   │
│   │  - consumable_stocks        │──▶│  - vw_gds_consumables_stock  │   │
│   │  - digital_services         │──▶│  - vw_gds_digital_services   │   │
│   │  - inventory_movements      │──▶│  - vw_gds_kardex_movements   │   │
│   │  - assignments              │──▶│  - vw_gds_assignments_history│   │
│   └─────────────────────────────┘   └──────────────────────────────┘   │
└───────────────────────▲────────────────────────────▲───────────────────┘
                        │                            │
             (HTTPS API / Next.js)         (Conexión Directa JDBC/SSL)
                        │                            │
             ┌──────────────────────┐      ┌─────────────────────────────┐
             │  VERCEL (Web App)    │      │  GOOGLE LOOKER STUDIO       │
             │     SivarStock       │      │  (Dashboards Gerenciales)   │
             └──────────────────────┘      └─────────────────────────────┘
```

---

## 2. Parámetros de Conexión en Google Looker Studio

Para conectar Looker Studio con la base de datos de SivarStock:

1. Ingrese a [Google Looker Studio](https://lookerstudio.google.com/).
2. Haga clic en **Crear > Fuente de datos**.
3. Seleccione el conector nativo oficial **PostgreSQL**.
4. Complete los siguientes campos según las credenciales de su proyecto Supabase:

| Parámetro | Valor de Configuración | Notas |
| :--- | :--- | :--- |
| **Nombre de host / IP** | `aws-0-[REGION].pooler.supabase.com` o el host directo de Supabase | Disponible en *Project Settings > Database* |
| **Puerto** | `5432` (conexión directa) o `6543` (Transaction Pooler PgBouncer) | Ambos admiten consultas SQL analíticas |
| **Base de datos** | `postgres` | Nombre estándar de base de datos en Supabase |
| **Nombre de usuario** | `postgres.[YOUR_PROJECT_REF]` o `postgres` | Usuario administrador o usuario analítico de solo lectura |
| **Contraseña** | `[TU_CONTRASEÑA_DE_SUPABASE]` | Contraseña establecida al crear el proyecto |
| **Habilitar SSL** | **Marcado (Obligatorio)** | Supabase requiere cifrado SSL en tránsito |

> [!NOTE]
> **Permisos de Red**: Las instancias de Supabase permiten conexiones entrantes desde las direcciones IP de Google Looker Studio por defecto. No requiere configuración adicional de firewall ni túneles VPN.

---

## 3. Catálogo de Vistas Analíticas Disponibles (`vw_gds_*`)

Cada vista fue diseñada específicamente con nombres de columnas amigables, desnormalizando tablas para evitar que el usuario tenga que hacer JOINs manuales dentro de Looker Studio.

### 3.1. `vw_gds_inventory_assets`
- **Propósito**: Informe general y ejecutivo de bienes y equipos físicos de la empresa.
- **Campos Principales**:
  - `permanent_code`: Identificador inmutable (ej. `SIV-IT-000001`).
  - `product_name`, `brand`, `model`, `serial_number`.
  - `current_department`: Nombre del área actual (ej. `IT`, `Producción`).
  - `location_name`: Nombre de la ubicación física en planta.
  - `assigned_user_name`: Nombre del responsable actual.
  - `operational_status`: `DISPONIBLE`, `ASIGNADO`, `EN_REVISION`, `DADO_DE_BAJA`.
  - `physical_condition`: `NUEVO`, `BUENO`, `USADO`, `AVERIADO`.
  - `purchase_price_gtq`: Precio de compra expresado en Quetzales.
  - `replacement_value_gtq`: Valor estimado de reposición en Quetzales.

### 3.2. `vw_gds_cost_analytics`
- **Propósito**: Matriz analítica de costos y gastos con las 5 dimensiones de departamento.
- **Dimensiones de Área Incluidas**:
  1. `requesting_department`: Área que solicitó la compra o servicio.
  2. `originating_department`: Área donde se originó el gasto físicamente.
  3. `recording_department`: Área que ingresó el registro contable en SivarStock.
  4. `budget_department`: Área dueña del presupuesto afectado.
  5. `charged_department`: Área a la que contablemente se le imputa el costo.
- **Campos Numéricos (en Quetzales)**:
  - `subtotal_gtq`, `tax_gtq` (IVA 12% Guatemala), `discount_gtq`, `total_gtq`.
  - `expense_year`, `expense_month`, `expense_year_month`.

### 3.3. `vw_gds_consumables_stock`
- **Propósito**: Control de existencias de consumibles en planta y bodega con semáforo de alerta.
- **Campos Principales**:
  - `product_name`, `category_name`, `department_name`, `location_name`.
  - `current_stock`: Existencia física actual.
  - `min_stock`: Nivel de inventario de seguridad.
  - `stock_alert_status`:
    - `'STOCK CRITICO (BAJO MINIMO)'`
    - `'STOCK EN REORDEN'`
    - `'STOCK NORMAL'`
  - `unit_cost_gtq`: Costo por unidad de medida (caja, rollo, metro).
  - `total_valuation_gtq`: Valuación monetaria total en Quetzales (`current_stock * unit_cost`).

### 3.4. `vw_gds_digital_services`
- **Propósito**: Gestión de plataformas SaaS, software corporativo, dominios y licencias en la nube.
- **Campos Principales**:
  - `service_name`, `provider`, `category`.
  - `responsible_department`, `charged_department`.
  - `seats_contracted`, `seats_used`, `available_seats`.
  - `cost_period`: `'MENSUAL'`, `'ANUAL'`, `'GRATUITO'`.
  - `amount_gtq`, `monthly_equivalent_gtq`, `annual_projected_cost_gtq`.
  - `days_remaining`: Días faltantes para la próxima fecha de renovación o cobro.
  - `renewal_status_alert`:
    - `'VENCIDO'`
    - `'ALERTA ROJA (<=7 DIAS)'`
    - `'ALERTA AMARILLA (<=15 DIAS)'`
    - `'ALERTA PREVENTIVA (<=30 DIAS)'`
    - `'AL DIA'`

### 3.5. `vw_gds_kardex_movements`
- **Propósito**: Auditoría completa de movimientos de entrada, salida, transferencias y consumos.
- **Campos Principales**:
  - `movement_timestamp`, `movement_type`.
  - `product_name`, `product_sku`, `asset_code`.
  - `quantity`, `unit_cost_gtq`, `total_cost_gtq`.
  - `source_department`, `target_department`.
  - `source_user`, `target_user`, `performed_by_user`.
  - `reason`, `reference_code`.

### 3.6. `vw_gds_assignments_history`
- **Propósito**: Trazabilidad de entregas con código de asignación reglamentario (`AM-2026-LAPD-001`).
- **Campos Principales**:
  - `assignment_code`, `asset_permanent_code`, `product_name`.
  - `assigned_user_name`, `user_initials`, `user_department`.
  - `assigned_at`, `expected_return_date`, `returned_at`.
  - `return_condition`, `assignment_status` (`'ACTIVA'`, `'DEVUELTO'`).

---

## 4. Creación de un Usuario de Solo Lectura para Looker Studio (Opcional pero Recomendado)

Por buenas prácticas de seguridad, se recomienda crear un rol exclusivo de lectura en PostgreSQL para la herramienta de reportería:

```sql
-- Ejecutar en el SQL Editor de Supabase:
CREATE USER looker_studio_reader WITH PASSWORD 'contraseña_fuerte_aqui';

-- Conceder permisos de conexión y uso de esquema
GRANT CONNECT ON DATABASE postgres TO looker_studio_reader;
GRANT USAGE ON SCHEMA public TO looker_studio_reader;

-- Permitir SELECT únicamente sobre las vistas analíticas
GRANT SELECT ON vw_gds_inventory_assets TO looker_studio_reader;
GRANT SELECT ON vw_gds_cost_analytics TO looker_studio_reader;
GRANT SELECT ON vw_gds_consumables_stock TO looker_studio_reader;
GRANT SELECT ON vw_gds_digital_services TO looker_studio_reader;
GRANT SELECT ON vw_gds_kardex_movements TO looker_studio_reader;
GRANT SELECT ON vw_gds_assignments_history TO looker_studio_reader;
```

---

## 5. Actualización Automática y Frecuencia de Refresco
En Looker Studio, configure la **Frecuencia de actualización de datos** (en la pestaña de fuentes de datos):
- **Opciones recomendadas**: Cada 15 minutos o cada hora.
- Looker Studio almacenará en caché temporal las consultas para ofrecer tiempos de carga inferiores a 500 ms a los usuarios de gerencia, mientras consulta la base de datos de Supabase de manera programada.
