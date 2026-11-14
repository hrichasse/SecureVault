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
| Mensajería (opcional) | Azure Service Bus |
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

### 6. Mensajería (opcional)

La indexación de documentos y los avisos in-app se procesan en segundo plano con
Azure Service Bus. Sin `SERVICEBUS_CONNECTION_STRING` la app funciona igual, pero
en línea y sin reintentos. Para usar el emulador local (requiere Docker):

```bash
cp infra/servicebus/.env.example infra/servicebus/.env
npm run mq:up
```

Arquitectura, pruebas y puesta en producción: [docs/mensajeria.md](docs/mensajeria.md).

### 7. Streaming de datos con Apache Kafka (opcional, local)

Los eventos de negocio (documentos, accesos, incidentes, certificaciones) se
publican en el topic `securevault.eventos-negocio` y se consumen para calcular
métricas y alertas en tiempo real. Requiere Docker:

```bash
npm run kafka:up        # Kafka + topic + Kafka UI (http://localhost:8080)
npm run kafka:producer  # productor (simulador de eventos)
npm run kafka:consumer  # consumidor (métricas en vivo en la terminal)
```

Panel web en `/admin/streaming` con `KAFKA_BROKERS=localhost:9092`.
Detalle: [docs/streaming.md](docs/streaming.md).

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
│   └── messaging/        # Bus de mensajes (Azure Service Bus)
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
| `npm test` | Tests unitarios |
| `npm run mq:up` / `mq:down` | Levantar / detener el emulador de Service Bus |
| `npm run test:mq` | Tests de integración de la mensajería (requiere el emulador) |
| `npm run mq:provision` | Crear las entidades de mensajería en Azure |
| `npm run kafka:up` / `kafka:down` | Levantar / detener Kafka y Kafka UI (Docker) |
| `npm run kafka:producer` | Productor: simulador de eventos de negocio |
| `npm run kafka:relay` | Productor: acciones reales de la app (tabla AuditLog) |
| `npm run kafka:consumer` | Consumidor: métricas y alertas en tiempo real |

## Módulos Principales

- **Auth**: Registro, login, y gestión de sesiones vía Supabase Auth
- **Documents**: Carga, almacenamiento y gestión de documentos
- **Classification**: Clasificación automática por reglas de palabras clave con pesos (BAJO, MEDIO, ALTO, CRÍTICO), editable a mano
- **Permissions**: Control de acceso granular por rol y clasificación
- **Access Requests**: Flujo de solicitud y aprobación de acceso a documentos
- **Incidents**: Registro y gestión de incidentes de seguridad
- **Certifications**: Generación de certificados de autenticidad verificables
- **Audit**: Trazabilidad completa de todas las acciones del sistema
- **Notifications**: Avisos in-app generados a partir de eventos del bus de mensajes

## Licencia

Propietario — Todos los derechos reservados.
