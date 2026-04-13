# SecureVault AI

> Plataforma de gestión documental segura con clasificación inteligente, control de acceso granular y trazabilidad completa.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend & Backend | Next.js 14 App Router + TypeScript |
| Estilos | Tailwind CSS |
| ORM | Prisma |
| Base de datos | Supabase PostgreSQL |
| Autenticación | Supabase Auth |
| Almacenamiento | Supabase Storage |
| Deploy | Azure App Service |

## Requisitos Previos

- Node.js 20+
- npm 10+
- Cuenta en [Supabase](https://supabase.com)

## Configuración Inicial

### 1. Clonar e instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase
```

### 3. Base de datos

```bash
# Generar el cliente Prisma
npm run db:generate

# Aplicar el schema a la base de datos
npm run db:push

# (Opcional) Ejecutar seeds iniciales
npm run db:seed
```

### 4. Desarrollo local

```bash
npm run dev
# → http://localhost:3000
```

### 5. Verificar salud del servidor

```bash
curl http://localhost:3000/api/health
# → {"status":"ok","timestamp":"...","version":"1.0.0"}
```

## Estructura del Proyecto

```
src/
├── app/                  # Next.js App Router
│   ├── (public)/         # Rutas públicas (landing, login, register)
│   ├── (dashboard)/      # Rutas protegidas (requieren sesión)
│   └── api/              # API Routes (REST endpoints)
├── modules/              # Módulos de negocio (DDD light)
│   ├── auth/
│   ├── documents/
│   ├── classification/
│   ├── permissions/
│   ├── access-requests/
│   ├── incidents/
│   ├── certifications/
│   └── audit/
├── components/           # Componentes React reutilizables
├── hooks/                # Custom React hooks
├── services/             # Servicios externos (Supabase, etc.)
├── lib/                  # Utilidades y clientes singleton
└── types/                # Tipos TypeScript globales
```

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | Linter ESLint |
| `npm run db:generate` | Generar cliente Prisma |
| `npm run db:migrate` | Ejecutar migraciones |
| `npm run db:push` | Push schema sin migraciones |
| `npm run db:seed` | Ejecutar seed de datos |
| `npm run db:studio` | Abrir Prisma Studio |

## Módulos Principales

- **Auth**: Registro, login, y gestión de sesiones vía Supabase Auth
- **Documents**: Carga, almacenamiento y gestión de documentos
- **Classification**: Clasificación automática con IA (CONFIDENCIAL, RESERVADO, PÚBLICO)
- **Permissions**: Control de acceso granular por rol y clasificación
- **Access Requests**: Flujo de solicitud y aprobación de acceso a documentos
- **Incidents**: Registro y gestión de incidentes de seguridad
- **Certifications**: Generación de certificados de autenticidad verificables
- **Audit**: Trazabilidad completa de todas las acciones del sistema

## Licencia

Propietario — Todos los derechos reservados.
