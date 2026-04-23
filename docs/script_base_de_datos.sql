-- ================================================================
-- SecureVault AI — Script Base de Datos Completo
-- PostgreSQL 15+
-- Incluye: ENUMs, Tablas, Índices, Claves Foráneas,
--          Procedimientos Almacenados, Datos de Prueba
-- ================================================================

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 1: TIPOS ENUMERADOS (ENUMs)
-- ──────────────────────────────────────────────────────────────

CREATE TYPE "UserRole" AS ENUM (
  'ADMIN',
  'ADMIN_COMPANY',
  'USER',
  'NOTARY'
);

CREATE TYPE "ConfidentialityLevel" AS ENUM (
  'BAJO',
  'MEDIO',
  'ALTO',
  'CRITICO'
);

CREATE TYPE "DocumentStatus" AS ENUM (
  'ACTIVE',
  'ARCHIVED',
  'DELETED'
);

CREATE TYPE "RequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "IncidentStatus" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED'
);

CREATE TYPE "IncidentPriority" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "IncidentType" AS ENUM (
  'ACCESS_DENIED',
  'DOCUMENT_LOST',
  'DATA_BREACH',
  'PERMISSION_EXPIRED',
  'INTEGRITY_FAILURE',
  'CLASSIFICATION_ERROR',
  'OTHER'
);

CREATE TYPE "AuditAction" AS ENUM (
  'LOGIN',
  'LOGOUT',
  'REGISTER',
  'UPLOAD_DOCUMENT',
  'VIEW_DOCUMENT',
  'DELETE_DOCUMENT',
  'REQUEST_ACCESS',
  'APPROVE_REQUEST',
  'REJECT_REQUEST',
  'CREATE_INCIDENT',
  'UPDATE_INCIDENT',
  'CLOSE_INCIDENT',
  'CERTIFY_DOCUMENT',
  'VERIFY_DOCUMENT',
  'GRANT_PERMISSION',
  'REVOKE_PERMISSION'
);

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 2: TABLAS
-- ──────────────────────────────────────────────────────────────

-- Tabla: Company
CREATE TABLE "Company" (
  "id"             TEXT        NOT NULL,
  "name"           TEXT        NOT NULL,
  "email"          TEXT        NOT NULL,
  "rut"            TEXT,
  "address"        TEXT,
  "businessLine"   TEXT,
  "adminName"      TEXT,
  "description"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_email_key" ON "Company"("email");

-- Tabla: User
CREATE TABLE "User" (
  "id"          TEXT        NOT NULL,
  "supabaseId"  TEXT        NOT NULL,
  "email"       TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "role"        "UserRole"  NOT NULL DEFAULT 'USER',
  "companyId"   TEXT        NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");
CREATE UNIQUE INDEX "User_email_key"      ON "User"("email");

-- Tabla: Document
CREATE TABLE "Document" (
  "id"                   TEXT                   NOT NULL,
  "name"                 TEXT                   NOT NULL,
  "originalName"         TEXT                   NOT NULL,
  "mimeType"             TEXT                   NOT NULL,
  "sizeBytes"            INTEGER                NOT NULL,
  "sha256Hash"           TEXT                   NOT NULL,
  "storagePath"          TEXT                   NOT NULL,
  "confidentialityLevel" "ConfidentialityLevel" NOT NULL DEFAULT 'BAJO',
  "classificationScore"  DOUBLE PRECISION       NOT NULL DEFAULT 0,
  "status"               "DocumentStatus"       NOT NULL DEFAULT 'ACTIVE',
  "description"          TEXT,
  "companyId"            TEXT                   NOT NULL,
  "uploadedById"         TEXT                   NOT NULL,
  "createdAt"            TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3)           NOT NULL,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- Tabla: DocumentPermission
CREATE TABLE "DocumentPermission" (
  "id"                  TEXT        NOT NULL,
  "documentId"          TEXT        NOT NULL,
  "userId"              TEXT        NOT NULL,
  "canRead"             BOOLEAN     NOT NULL DEFAULT true,
  "canDownload"         BOOLEAN     NOT NULL DEFAULT false,
  "expiresAt"           TIMESTAMP(3),
  "grantedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdFromRequest"  TEXT,
  CONSTRAINT "DocumentPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentPermission_documentId_userId_key"
  ON "DocumentPermission"("documentId", "userId");

-- Tabla: AccessRequest
CREATE TABLE "AccessRequest" (
  "id"            TEXT            NOT NULL,
  "documentId"    TEXT            NOT NULL,
  "requestedById" TEXT            NOT NULL,
  "reviewedById"  TEXT,
  "status"        "RequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason"        TEXT            NOT NULL,
  "reviewNote"    TEXT,
  "expiresAt"     TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)    NOT NULL,
  CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- Tabla: Incident
CREATE TABLE "Incident" (
  "id"           TEXT               NOT NULL,
  "title"        TEXT               NOT NULL,
  "description"  TEXT               NOT NULL,
  "type"         "IncidentType"     NOT NULL,
  "priority"     "IncidentPriority" NOT NULL DEFAULT 'MEDIUM',
  "status"       "IncidentStatus"   NOT NULL DEFAULT 'OPEN',
  "documentId"   TEXT,
  "companyId"    TEXT               NOT NULL,
  "createdById"  TEXT               NOT NULL,
  "assignedToId" TEXT,
  "resolution"   TEXT,
  "resolvedAt"   TIMESTAMP(3),
  "closedAt"     TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)       NOT NULL,
  CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- Tabla: Certification
CREATE TABLE "Certification" (
  "id"                 TEXT        NOT NULL,
  "documentId"         TEXT        NOT NULL,
  "certifiedById"      TEXT        NOT NULL,
  "notaryLicenseNumber" TEXT,
  "sha256Hash"         TEXT        NOT NULL,
  "verificationCode"   TEXT        NOT NULL,
  "certificateUrl"     TEXT,
  "isValid"            BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Certification_verificationCode_key"
  ON "Certification"("verificationCode");

-- Tabla: AuditLog
CREATE TABLE "AuditLog" (
  "id"          TEXT          NOT NULL,
  "action"      "AuditAction" NOT NULL,
  "userId"      TEXT,
  "companyId"   TEXT,
  "documentId"  TEXT,
  "incidentId"  TEXT,
  "metadata"    JSONB,
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");
CREATE INDEX "AuditLog_documentId_idx"           ON "AuditLog"("documentId");
CREATE INDEX "AuditLog_userId_idx"               ON "AuditLog"("userId");

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 3: CLAVES FORÁNEAS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "User"
  ADD CONSTRAINT "User_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentPermission"
  ADD CONSTRAINT "DocumentPermission_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentPermission"
  ADD CONSTRAINT "DocumentPermission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccessRequest"
  ADD CONSTRAINT "AccessRequest_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccessRequest"
  ADD CONSTRAINT "AccessRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccessRequest"
  ADD CONSTRAINT "AccessRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Incident"
  ADD CONSTRAINT "Incident_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Incident"
  ADD CONSTRAINT "Incident_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Incident"
  ADD CONSTRAINT "Incident_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Incident"
  ADD CONSTRAINT "Incident_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Certification"
  ADD CONSTRAINT "Certification_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Certification"
  ADD CONSTRAINT "Certification_certifiedById_fkey"
  FOREIGN KEY ("certifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_incidentId_fkey"
  FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 4: PROCEDIMIENTOS ALMACENADOS
-- ──────────────────────────────────────────────────────────────

-- PA-01: Registrar acción en el log de auditoría
CREATE OR REPLACE FUNCTION sp_registrar_auditoria(
  p_action      "AuditAction",
  p_userId      TEXT,
  p_companyId   TEXT,
  p_documentId  TEXT   DEFAULT NULL,
  p_incidentId  TEXT   DEFAULT NULL,
  p_metadata    JSONB  DEFAULT NULL,
  p_ipAddress   TEXT   DEFAULT NULL,
  p_userAgent   TEXT   DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_id TEXT;
BEGIN
  v_id := gen_random_uuid()::TEXT;
  INSERT INTO "AuditLog" (
    "id", "action", "userId", "companyId",
    "documentId", "incidentId", "metadata",
    "ipAddress", "userAgent", "createdAt"
  ) VALUES (
    v_id, p_action, p_userId, p_companyId,
    p_documentId, p_incidentId, p_metadata,
    p_ipAddress, p_userAgent, NOW()
  );
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- PA-02: Obtener documentos activos de una empresa con su nivel de confidencialidad
CREATE OR REPLACE FUNCTION sp_obtener_documentos_empresa(
  p_companyId TEXT
)
RETURNS TABLE (
  id                   TEXT,
  name                 TEXT,
  originalName         TEXT,
  mimeType             TEXT,
  sizeBytes            INTEGER,
  confidentialityLevel "ConfidentialityLevel",
  classificationScore  DOUBLE PRECISION,
  uploaderName         TEXT,
  createdAt            TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      d."id",
      d."name",
      d."originalName",
      d."mimeType",
      d."sizeBytes",
      d."confidentialityLevel",
      d."classificationScore",
      u."name" AS uploaderName,
      d."createdAt"
    FROM "Document" d
    JOIN "User" u ON u."id" = d."uploadedById"
    WHERE d."companyId" = p_companyId
      AND d."status" = 'ACTIVE'
    ORDER BY d."createdAt" DESC;
END;
$$ LANGUAGE plpgsql;

-- PA-03: Aprobar solicitud de acceso y crear permiso automáticamente
CREATE OR REPLACE FUNCTION sp_aprobar_solicitud(
  p_requestId   TEXT,
  p_reviewerId  TEXT,
  p_reviewNote  TEXT,
  p_expiresAt   TIMESTAMP DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_documentId TEXT;
  v_userId     TEXT;
BEGIN
  SELECT "documentId", "requestedById"
    INTO v_documentId, v_userId
    FROM "AccessRequest"
   WHERE "id" = p_requestId AND "status" = 'PENDING';

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE "AccessRequest"
     SET "status"       = 'APPROVED',
         "reviewedById" = p_reviewerId,
         "reviewNote"   = p_reviewNote,
         "expiresAt"    = p_expiresAt,
         "updatedAt"    = NOW()
   WHERE "id" = p_requestId;

  INSERT INTO "DocumentPermission" (
    "id", "documentId", "userId",
    "canRead", "canDownload", "expiresAt",
    "grantedAt", "createdFromRequest"
  ) VALUES (
    gen_random_uuid()::TEXT,
    v_documentId, v_userId,
    true, false, p_expiresAt,
    NOW(), p_requestId
  )
  ON CONFLICT ("documentId", "userId") DO UPDATE
    SET "canRead"    = true,
        "expiresAt"  = p_expiresAt,
        "grantedAt"  = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- PA-04: Estadísticas generales del sistema (para dashboard admin)
CREATE OR REPLACE FUNCTION sp_estadisticas_sistema()
RETURNS TABLE (
  total_empresas   BIGINT,
  total_usuarios   BIGINT,
  total_documentos BIGINT,
  total_incidentes BIGINT,
  incidentes_abiertos BIGINT,
  certificaciones  BIGINT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      (SELECT COUNT(*) FROM "Company"),
      (SELECT COUNT(*) FROM "User"),
      (SELECT COUNT(*) FROM "Document" WHERE "status" = 'ACTIVE'),
      (SELECT COUNT(*) FROM "Incident"),
      (SELECT COUNT(*) FROM "Incident" WHERE "status" IN ('OPEN','IN_PROGRESS')),
      (SELECT COUNT(*) FROM "Certification" WHERE "isValid" = true);
END;
$$ LANGUAGE plpgsql;

-- PA-05: Cerrar incidente y registrar resolución
CREATE OR REPLACE FUNCTION sp_cerrar_incidente(
  p_incidentId TEXT,
  p_resolution TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE "Incident"
     SET "status"     = 'CLOSED',
         "resolution" = p_resolution,
         "resolvedAt" = NOW(),
         "closedAt"   = NOW(),
         "updatedAt"  = NOW()
   WHERE "id" = p_incidentId
     AND "status" NOT IN ('CLOSED');

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 5: DATOS DE PRUEBA
-- ──────────────────────────────────────────────────────────────

-- Empresa 1
INSERT INTO "Company" ("id","name","email","rut","address","businessLine","adminName","description","createdAt","updatedAt")
VALUES (
  'company-demo-001',
  'TechCorp Chile SA',
  'admin@techcorp.cl',
  '76.543.210-K',
  'Av. Providencia 1234, Santiago',
  'Tecnología de la Información',
  'Carlos Ramírez',
  'Empresa de software y servicios TI',
  NOW(), NOW()
);

-- Empresa 2
INSERT INTO "Company" ("id","name","email","rut","address","businessLine","adminName","description","createdAt","updatedAt")
VALUES (
  'company-demo-002',
  'Notaría Central Ltda.',
  'admin@notariacentral.cl',
  '65.432.100-3',
  'Calle Moneda 789, Santiago',
  'Servicios Notariales',
  'María González',
  'Notaría con servicios de certificación digital',
  NOW(), NOW()
);

-- Usuarios (supabaseId simulado para pruebas)
INSERT INTO "User" ("id","supabaseId","email","name","role","companyId","createdAt","updatedAt")
VALUES
  ('user-admin-001', 'supa-admin-001', 'sysadmin@securevault.cl', 'Administrador Sistema', 'ADMIN', 'company-demo-001', NOW(), NOW()),
  ('user-ac-001',    'supa-ac-001',    'carlos@techcorp.cl',      'Carlos Ramírez',        'ADMIN_COMPANY', 'company-demo-001', NOW(), NOW()),
  ('user-001',       'supa-user-001',  'ana@techcorp.cl',         'Ana Pérez',             'USER',          'company-demo-001', NOW(), NOW()),
  ('user-002',       'supa-user-002',  'pedro@techcorp.cl',       'Pedro López',           'USER',          'company-demo-001', NOW(), NOW()),
  ('user-notary-001','supa-notary-001','maria@notariacentral.cl', 'María González',        'NOTARY',        'company-demo-002', NOW(), NOW());

-- Documentos de prueba
INSERT INTO "Document" (
  "id","name","originalName","mimeType","sizeBytes",
  "sha256Hash","storagePath","confidentialityLevel",
  "classificationScore","status","description",
  "companyId","uploadedById","createdAt","updatedAt"
) VALUES
  ('doc-001','contrato_2026.pdf','Contrato Proveedores 2026.pdf','application/pdf',
   245760,'abc123hash001','techcorp/docs/contrato_2026.pdf','ALTO',0.87,'ACTIVE',
   'Contrato marco con proveedores estratégicos','company-demo-001','user-001',NOW(),NOW()),

  ('doc-002','politica_seguridad.pdf','Politica de Seguridad TI.pdf','application/pdf',
   102400,'abc123hash002','techcorp/docs/politica_seguridad.pdf','CRITICO',0.95,'ACTIVE',
   'Política interna de seguridad de la información','company-demo-001','user-ac-001',NOW(),NOW()),

  ('doc-003','reporte_auditoria.xlsx','Reporte Auditoría Q1 2026.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
   87040,'abc123hash003','techcorp/docs/reporte_q1.xlsx','MEDIO',0.62,'ACTIVE',
   'Resultados de auditoría primer trimestre','company-demo-001','user-001',NOW(),NOW()),

  ('doc-004','manual_usuario.pdf','Manual de Usuario SecureVault.pdf','application/pdf',
   512000,'abc123hash004','techcorp/docs/manual_usuario.pdf','BAJO',0.10,'ACTIVE',
   'Manual de uso del sistema para trabajadores','company-demo-001','user-ac-001',NOW(),NOW());

-- Solicitudes de acceso
INSERT INTO "AccessRequest" (
  "id","documentId","requestedById","reviewedById",
  "status","reason","reviewNote","expiresAt","createdAt","updatedAt"
) VALUES
  ('req-001','doc-002','user-002',NULL,
   'PENDING','Necesito revisar la política para certificar cumplimiento',NULL,
   NULL,NOW(),NOW()),

  ('req-002','doc-001','user-002','user-ac-001',
   'APPROVED','Revisión de contrato para validación interna','Acceso aprobado por 30 días',
   NOW() + INTERVAL '30 days',NOW(),NOW());

-- Permisos
INSERT INTO "DocumentPermission" (
  "id","documentId","userId","canRead","canDownload","expiresAt","grantedAt","createdFromRequest"
) VALUES
  ('perm-001','doc-001','user-002',true,false,NOW() + INTERVAL '30 days',NOW(),'req-002'),
  ('perm-002','doc-004','user-001',true,true,NULL,NOW(),NULL),
  ('perm-003','doc-004','user-002',true,false,NULL,NOW(),NULL);

-- Incidentes
INSERT INTO "Incident" (
  "id","title","description","type","priority","status",
  "documentId","companyId","createdById","assignedToId",
  "resolution","resolvedAt","closedAt","createdAt","updatedAt"
) VALUES
  ('inc-001',
   'Acceso no autorizado detectado',
   'Se detectó un intento de acceso sin credenciales al documento de política de seguridad.',
   'ACCESS_DENIED','HIGH','IN_PROGRESS',
   'doc-002','company-demo-001','user-001','user-ac-001',
   NULL,NULL,NULL,NOW(),NOW()),

  ('inc-002',
   'Error en clasificación de documento',
   'El sistema clasificó un contrato confidencial como nivel BAJO por error en el motor de IA.',
   'CLASSIFICATION_ERROR','MEDIUM','RESOLVED',
   'doc-001','company-demo-001','user-ac-001',NULL,
   'Se reentrenó el modelo con los documentos afectados y se reclasificaron correctamente.',
   NOW(),NULL,NOW(),NOW());

-- Certificaciones
INSERT INTO "Certification" (
  "id","documentId","certifiedById","notaryLicenseNumber",
  "sha256Hash","verificationCode","certificateUrl","isValid","createdAt"
) VALUES
  ('cert-001','doc-001','user-notary-001','NL-2024-0892',
   'abc123hash001','VERIFY-SVAI-2026-001',
   'https://securevault.cl/certificados/cert-001.pdf',true,NOW()),

  ('cert-002','doc-002','user-notary-001','NL-2024-0892',
   'abc123hash002','VERIFY-SVAI-2026-002',
   NULL,true,NOW());

-- Logs de auditoría
INSERT INTO "AuditLog" (
  "id","action","userId","companyId","documentId","incidentId","metadata","ipAddress","userAgent","createdAt"
) VALUES
  ('log-001','LOGIN','user-001','company-demo-001',NULL,NULL,
   '{"browser":"Chrome","os":"Windows 11"}','192.168.1.10','Mozilla/5.0 Chrome/124',NOW()),

  ('log-002','UPLOAD_DOCUMENT','user-001','company-demo-001','doc-001',NULL,
   '{"fileName":"Contrato Proveedores 2026.pdf","sizeBytes":245760}','192.168.1.10','Mozilla/5.0 Chrome/124',NOW()),

  ('log-003','VIEW_DOCUMENT','user-002','company-demo-001','doc-004',NULL,
   '{"documentName":"Manual de Usuario"}','192.168.1.25','Mozilla/5.0 Firefox/125',NOW()),

  ('log-004','CREATE_INCIDENT','user-001','company-demo-001',NULL,'inc-001',
   '{"incidentType":"ACCESS_DENIED","priority":"HIGH"}','192.168.1.10','Mozilla/5.0 Chrome/124',NOW()),

  ('log-005','CERTIFY_DOCUMENT','user-notary-001','company-demo-002','doc-001',NULL,
   '{"verificationCode":"VERIFY-SVAI-2026-001"}','10.0.0.5','Mozilla/5.0 Safari/17',NOW()),

  ('log-006','REQUEST_ACCESS','user-002','company-demo-001','doc-002',NULL,
   '{"reason":"Revisión de cumplimiento"}','192.168.1.25','Mozilla/5.0 Firefox/125',NOW()),

  ('log-007','APPROVE_REQUEST','user-ac-001','company-demo-001','doc-001',NULL,
   '{"requestId":"req-002","approvedFor":"Pedro López"}','192.168.1.50','Mozilla/5.0 Chrome/124',NOW());

-- ──────────────────────────────────────────────────────────────
-- FIN DEL SCRIPT
-- ──────────────────────────────────────────────────────────────
