# SecureVault — Pruebas Unitarias e Integración

Suite de pruebas del proyecto SecureVault usando **Jest** + **Supertest** con soporte para Next.js App Router.

---

## Herramientas instaladas

| Paquete | Versión | Rol |
|---|---|---|
| `jest` | ^30 | Framework principal de pruebas |
| `ts-jest` | ^29 | Soporte TypeScript en Jest |
| `@types/jest` | ^30 | Tipos TypeScript para Jest |
| `supertest` | ^7 | Cliente HTTP para tests de integración |
| `@types/supertest` | ^7 | Tipos TypeScript para Supertest |
| `next-test-api-route-handler` | ^5 | Adaptador para probar rutas Next.js App Router sin levantar servidor |
| `jest-environment-node` | ^30 | Entorno Node.js para Jest |

---

## Estructura de tests

```
src/__tests__/
├── README.md
├── unit/                                      ← Tests unitarios (sin HTTP, sin BD real)
│   ├── lib/
│   │   ├── utils.test.ts                      → función cn() — combinación de clases Tailwind
│   │   └── role-access.test.ts               → mapeo de roles DB↔App, etiquetas, hasAccess()
│   └── modules/
│       ├── auth/
│       │   └── auth-service.test.ts           → getAuthUser() con mocks de Supabase y Prisma
│       └── audit/
│           └── audit-pagination.test.ts       → lógica de paginación de getAuditLogs()
└── integration/                               ← Tests de integración HTTP reales
    └── api/
        ├── auth/
        │   └── login.test.ts                  → POST /api/auth/login (400, 401, 404, 200)
        └── incidents/
            └── incidents.test.ts              → GET y POST /api/incidents (401, 400, 201)
```

### ¿Qué prueba cada archivo?

#### Unitarios

**`unit/lib/utils.test.ts`**
- Combina clases CSS simples
- Omite valores `false`, `null`, `undefined`
- Resuelve conflictos de Tailwind (último valor gana)
- Maneja objetos de clase condicional

**`unit/lib/role-access.test.ts`**
- Mapeo bidireccional de roles entre BD (`ADMIN`, `USER`...) y frontend (`admin`, `cliente`...)
- Etiquetas completas y cortas por rol
- Control de acceso por ruta para cada rol (`admin`, `admin_empresa`, `cliente`, `notario`)

**`unit/modules/auth/auth-service.test.ts`**
- Retorna `null` si Supabase no tiene sesión activa
- Retorna `null` si el usuario no existe en Prisma
- Retorna el usuario correcto cuando sesión y BD son válidos
- Retorna `null` de forma segura si Supabase o Prisma lanzan excepciones

**`unit/modules/audit/audit-pagination.test.ts`**
- Valores por defecto de página y límite
- Cálculo correcto de `totalPages` (`Math.ceil(total / limit)`)
- Cálculo correcto de `skip` según la página
- Filtros por `companyId`, acción y rango de fechas

#### Integración HTTP

**`integration/api/auth/login.test.ts`** — `POST /api/auth/login`
- `400` — email inválido, contraseña menor a 8 caracteres, body vacío
- `401` — Supabase rechaza las credenciales
- `404` — usuario autenticado en Supabase pero no existe en la BD
- `200` — login exitoso, retorna datos del usuario

**`integration/api/incidents/incidents.test.ts`** — `GET /api/incidents` y `POST /api/incidents`
- `401` — sin sesión activa (GET y POST)
- `400` — título muy corto, descripción muy corta, tipo inválido (POST)
- `200` — lista de incidentes correcta, filtrada por `companyId` (GET)
- `201` — incidente creado con los datos correctos (POST)

---

## Scripts disponibles

```bash
# Correr todos los tests una vez
npm test

# Modo watch — re-ejecuta al guardar cambios (ideal para desarrollo)
npm run test:watch

# Reporte de cobertura de código
npm run test:coverage
```

El reporte de cobertura se genera en la carpeta `coverage/` e incluye:
- `coverage/lcov-report/index.html` — reporte visual en el navegador
- `coverage/lcov.info` — formato estándar para integración con SonarQube u otras herramientas

---

## CI/CD — Integración con el deploy a Azure

Los tests se ejecutan **automáticamente antes de cada deploy** en el pipeline de GitHub Actions (`.github/workflows/main_securevault-ai.yml`).

```
push a main
    │
    ▼
┌─────────────┐     falla → ✗ deploy bloqueado
│  job: test  │ ──────────────────────────────►
│  npm test   │
└──────┬──────┘
       │ pasa
       ▼
┌─────────────┐
│ job: build  │  npm run build
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ job: deploy │  Azure Web App
└─────────────┘
```

Si cualquier test falla, el job de `build` y el `deploy` no se ejecutan. El reporte de cobertura se sube como artefacto de GitHub Actions y se conserva por **7 días**.

---

## Convenciones para nuevos tests

- **Tests unitarios** → carpeta `unit/` — mockear Prisma y Supabase con `jest.mock()`
- **Tests de integración** → carpeta `integration/api/` — usar `testApiHandler` de `next-test-api-route-handler`
- Nombrar archivos como `nombre-del-modulo.test.ts`
- Un `describe` por funcionalidad, un `it` por caso de uso específico
