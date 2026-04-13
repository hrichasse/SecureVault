# Documentación Técnica — SecureVault AI

## Módulos

| Módulo | Descripción |
|--------|-------------|
| `auth` | Autenticación y gestión de sesiones |
| `companies` | Gestión multi-tenant de organizaciones |
| `users` | Perfiles de usuario y asignación de roles |
| `documents` | Carga, almacenamiento y gestión de documentos |
| `classification` | Clasificación automática con IA |
| `permissions` | Control de acceso granular |
| `access-requests` | Flujo de solicitud y aprobación de acceso |
| `incidents` | Gestión de incidentes de seguridad |
| `certifications` | Certificados de autenticidad verificables |
| `audit` | Trazabilidad completa de acciones |

## Arquitectura de Capas

```
Request → Middleware (auth check) → Route Handler → Module Service → Prisma → Supabase DB
                                                                   ↘ Supabase Storage
```

## Niveles de Clasificación

| Nivel | Descripción | Acceso |
|-------|-------------|--------|
| `PUBLIC` | Información pública | Todos |
| `INTERNAL` | Uso interno | Empleados |
| `CONFIDENTIAL` | Sensible | Gerencias + Autorización |
| `RESTRICTED` | Altamente sensible | Dirección + Aprobación explícita |
| `TOP_SECRET` | Máxima seguridad | Solo propietario + Admin |

## Variables de Entorno Requeridas

Ver `.env.example` en la raíz del proyecto.
