# Reglas de SivarStock para Antigravity

## Base de datos
- Siempre usar `?` como placeholder en SQL, nunca `$1` directamente.
- IDs son siempre TEXT (UUID o codigo), nunca enteros autoincrementales.
- Importar funciones de DB desde `@/lib/db`: query, queryOne, run, exec, transaction.
- Fechas en formato ISO TEXT (YYYY-MM-DDTHH:mm:ss).

## Moneda y Localizacion
- Moneda principal: GTQ (Quetzales). Simbolo: Q (antes del monto, ej: Q 1,250.00).
- Zona horaria: America/Guatemala (UTC-6).
- Idioma de la UI: Espanol (Guatemala).
- Comentarios del codigo: espanol. Nombres de variables/funciones: ingles.

## Autenticacion
- Siempre verificar sesion en API Routes con `getSession()` de `@/lib/auth`.
- Verificar permisos con `session.role` y los flags: `can_edit`, `can_export`, `can_view_financials`.

## Auditoria
- Todo cambio de datos (INSERT, UPDATE, DELETE critico) debe llamar a `logAudit()`.
- La tabla `audit_logs` es INMUTABLE — nunca modificar ni eliminar registros.

## Convenciones de Codigo
- Stack: Next.js 14 App Router + TypeScript + TailwindCSS + pnpm.
- No usar `npm` ni `yarn`, solo `pnpm`.
- Iconos: lucide-react (ya instalado).
- Graficos: Recharts (ya instalado).
