---
name: sivarstock
description: >-
  Skill de contexto completo para el proyecto SivarStock: sistema empresarial
  de inventario fisico y digital para manufactura (Guatemala). Usalo cuando
  el usuario pida agregar, modificar o depurar funcionalidades de SivarStock.
  Incluye arquitectura, esquema de base de datos, patrones de codigo, convenciones
  de rutas API, modulos disponibles y variables de entorno.
---

# SivarStock — Guia de Arquitectura y Convenciones

SivarStock es un **sistema empresarial de inventario** construido con Next.js 14
(App Router), TypeScript y TailwindCSS, desplegado en Vercel. Soporta dos
motores de base de datos sin cambiar codigo: **PostgreSQL/Supabase** (produccion)
y **SQLite via sql.js WASM** (local/fallback).

---

## Stack Tecnologico

| Capa | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| Lenguaje | TypeScript 5 |
| Estilos | TailwindCSS 3 + lucide-react |
| BD Produccion | PostgreSQL (Supabase) |
| BD Local/Fallback | SQLite via sql.js WASM |
| Graficos | Recharts |
| PDF | jsPDF + jspdf-autotable |
| Excel | xlsx (SheetJS) |
| QR | qrcode |
| Package Manager | pnpm |

---

## Arquitectura del Proyecto

```
src/
├── app/
│   ├── api/            ← API Routes (Next.js Route Handlers)
│   │   ├── auth/
│   │   ├── inventory/  ← items, consumables, lifecycle, return
│   │   ├── reports/
│   │   ├── users/
│   │   └── ...
│   ├── inventario/     ← Pagina de activos fisicos
│   ├── celulares/      ← Dispositivos moviles
│   ├── productos/      ← Catalogo de productos
│   ├── movimientos/    ← Kardex / movimientos
│   ├── asignaciones/   ← Asignaciones a empleados
│   ├── mantenimiento/  ← Averias y reparaciones
│   ├── servicios-digitales/ ← Licencias, SaaS, dominios
│   ├── costos/         ← Registro de gastos
│   ├── reportes/       ← Reportes personalizados
│   ├── departamentos/  ← CRUD de areas
│   ├── auditoria/      ← Logs inmutables (solo ADMIN)
│   ├── configuracion/  ← Settings del sistema
│   └── usuarios/       ← Gestion de usuarios
├── lib/
│   ├── db.ts           ← CAPA DE ACCESO A DATOS (principal)
│   ├── auth.ts         ← Autenticacion basada en sesiones
│   ├── schema-sql.ts   ← Schema SQLite embebido
│   ├── postgres-schema.sql ← Schema PostgreSQL
│   ├── seed-data.ts    ← Datos iniciales
│   ├── audit.ts        ← Registro de auditoria
│   ├── codes.ts        ← Generacion de codigos unicos
│   └── export.ts       ← Exportacion Excel/PDF
└── components/         ← Componentes reutilizables UI
```

---

## Base de Datos — Capa de Acceso (db.ts)

**Importaciones clave:**
```typescript
import { query, queryOne, run, exec, transaction, isPostgresConfigured, getDatabaseEngine } from '@/lib/db';
```

### Funciones disponibles

| Funcion | Uso |
|---|---|
| `query<T>(sql, params)` | SELECT multiples filas |
| `queryOne<T>(sql, params)` | SELECT una fila o null |
| `run(sql, params)` | INSERT / UPDATE / DELETE |
| `exec(sql)` | DDL o bloques SQL directos |
| `transaction(callback)` | Bloque ACID (PostgreSQL + SQLite) |
| `isPostgresConfigured` | boolean - true si hay PostgreSQL activo |
| `getDatabaseEngine()` | 'POSTGRESQL' o 'SQLITE' |

### Reglas criticas de SQL

1. **Usar siempre `?` como placeholder** — `translateQueryForPostgres()` los convierte a `$1, $2...` automaticamente para PG.
2. **Fechas SQLite** → `datetime('now')`, `date('now')`, `julianday(...)` — la funcion de traduccion los convierte.
3. **INSERT OR IGNORE INTO** se traduce a `INSERT INTO ... ON CONFLICT DO NOTHING`.
4. **Nunca usar sintaxis exclusiva de PostgreSQL** directamente en las queries — siempre usar la sintaxis SQLite que `translateQueryForPostgres` entiende.
5. **IDs** siempre son `TEXT` (UUID o codigo personalizado), nunca enteros autoincrementales.

---

## Esquema de Base de Datos — Tablas Principales

| Tabla | Proposito |
|---|---|
| `departments` | Areas/departamentos de la empresa |
| `locations` | Ubicaciones fisicas dentro de departamentos |
| `employees` | Personal de la empresa |
| `users` | Cuentas del sistema con roles y permisos |
| `categories` | Categorias de productos (INDIVIDUAL, QUANTITY, BATCH) |
| `products` | Catalogo maestro de productos |
| `product_suppliers` | Proveedores por producto |
| `product_price_history` | Historial de precios de compra |
| `inventory_items` | Activos fisicos individuales (codigo SIV-{DEPT}-{SEQ:6}) |
| `mobile_devices` | Celulares/lineas (codigo CEL-{SEQ}) |
| `consumable_stocks` | Stock de consumibles por departamento |
| `assignments` | Asignaciones a empleados (codigo AM-{YYYY}-{DEPT}-{SEQ}) |
| `inventory_movements` | Kardex auditable de movimientos |
| `maintenance_records` | Averias y mantenimiento de equipos |
| `license_categories` | Categorias de servicios digitales |
| `digital_services` | Licencias, SaaS, dominios |
| `cost_records` | Registros de costos y gastos |
| `custom_reports` | Reportes personalizados guardados |
| `audit_logs` | Auditoria inmutable (triggers bloquean UPDATE/DELETE) |
| `system_settings` | Configuraciones clave-valor del sistema |

### Estados de Activos (operational_status)
DISPONIBLE, ASIGNADO, RESERVADO, DEVOLUCION_PENDIENTE, EN_REVISION, AVERIADO, DADO_DE_BAJA, PERDIDO

### Condicion Fisica (physical_condition)
NUEVO, BUENO, USADO, DANADO, AVERIADO, EN_REPARACION, NO_EVALUADO

### Roles de Usuario
ADMIN, SUBADMIN, AREA_MANAGER, VIEWER

### Moneda
- Principal: GTQ (Quetzales guatemaltecos, simbolo Q)
- Secundaria: USD

---

## Patron de API Routes

Todas las rutas van en `src/app/api/`. Patron estandar:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query, run, transaction } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const rows = await query<MiTipo>('SELECT * FROM mi_tabla WHERE is_active = ?', [1]);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const body = await req.json();
  await transaction(async () => {
    await run('INSERT INTO mi_tabla (id, campo) VALUES (?, ?)', [id, body.campo]);
    await logAudit({ ... });
  });
  return NextResponse.json({ success: true });
}
```

---

## Autenticacion y Sesiones

```typescript
import { getSession } from '@/lib/auth';
const session = await getSession();
// session: { id, username, full_name, role, department_id, can_edit, can_export, ... } | null
```

Permisos granulares en `users`:
- `only_own_department` — restringe vista al propio departamento
- `can_view_financials` — acceso a datos de costos/precios
- `can_export` — permite exportar datos
- `can_manage_users` — gestion de usuarios
- `can_edit` — puede crear/editar registros

---

## Generacion de Codigos Unicos

```typescript
import { generatePermanentCode, generateAssignmentCode } from '@/lib/codes';
const code = await generatePermanentCode(departmentCode);   // SIV-IT-000001
const assignCode = await generateAssignmentCode(deptCode);  // AM-2026-IT-001
```

---

## Auditoria

```typescript
import { logAudit } from '@/lib/audit';
await logAudit({
  userId: session.id,
  username: session.username,
  userRole: session.role,
  action: 'CREAR' | 'EDITAR' | 'ELIMINAR' | 'ASIGNAR' | 'DEVOLVER',
  module: 'INVENTARIO' | 'CELULARES' | 'PRODUCTOS' | 'MOVIMIENTOS' | ...,
  entityId: item.id,
  entityName: item.name,
  beforeState: beforeSnapshot,
  afterState: afterSnapshot,
  reason: 'Descripcion del cambio',
});
```
IMPORTANTE: `audit_logs` es inmutable — triggers impiden UPDATE y DELETE.

---

## Variables de Entorno Clave

- `DATABASE_URL` — PostgreSQL connection string (prioridad)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_PATH` — ruta SQLite local (default: ./data/sivarstock.db)
- `SESSION_SECRET` — secreto de sesion
- `DEMO_MODE` — activa modo demo
- `NEXT_PUBLIC_DEFAULT_CURRENCY` = "GTQ"
- `NEXT_PUBLIC_CURRENCY_SYMBOL` = "Q"

---

## Convenciones Importantes

1. Comentarios en **espanol**, codigo en ingles estandar
2. Moneda por defecto: GTQ. Mostrar simbolo `Q` antes del monto
3. Zona horaria: America/Guatemala (UTC-6, sin cambio de hora)
4. IDs: siempre TEXT (UUID o codigo custom), NUNCA INTEGER AUTOINCREMENT
5. Fechas: TEXT en formato ISO (YYYY-MM-DDTHH:mm:ss)
6. Exportacion: Excel via xlsx, PDF via jsPDF+autoTable (ver src/lib/export.ts)
7. Modo Vercel: SQLite usa /tmp/sivarstock.db como ruta escribible

---

## Comandos de Desarrollo

```bash
pnpm dev      # Servidor local en :3000
pnpm build    # Build de produccion
pnpm seed     # Sembrar datos iniciales SQLite
pnpm test     # Ejecutar tests
```

---

## Modulos de la Aplicacion

| Ruta | Modulo |
|---|---|
| /inventario | INVENTARIO — Activos fisicos individuales |
| /celulares | CELULARES — Lineas y dispositivos moviles |
| /productos | PRODUCTOS — Catalogo y consumibles |
| /movimientos | MOVIMIENTOS — Kardex entradas/salidas |
| /asignaciones | ASIGNACIONES — Asignacion a empleados |
| /mantenimiento | MANTENIMIENTO — Averias y reparaciones |
| /servicios-digitales | SERVICIOS — Licencias SaaS, dominios |
| /costos | COSTOS — Control de gastos |
| /reportes | REPORTES — Reportes personalizados |
| /departamentos | DEPARTAMENTOS — Areas y ubicaciones |
| /auditoria | AUDITORIA — Log del sistema (solo ADMIN) |
| /configuracion | CONFIGURACION — Settings generales |
| /usuarios | USUARIOS — Cuentas y permisos |
