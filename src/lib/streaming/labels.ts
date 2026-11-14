/**
 * Etiquetas en español de los tipos de evento. Archivo aparte, sin dependencias
 * de Node, para poder usarlo también en componentes del navegador.
 */
export const EVENT_LABELS = {
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  REGISTER: 'Registro',
  UPLOAD_DOCUMENT: 'Documento subido',
  VIEW_DOCUMENT: 'Documento visto/descargado',
  DELETE_DOCUMENT: 'Documento eliminado',
  REQUEST_ACCESS: 'Solicitud de acceso',
  APPROVE_REQUEST: 'Acceso aprobado',
  REJECT_REQUEST: 'Acceso rechazado',
  CREATE_INCIDENT: 'Incidente reportado',
  UPDATE_INCIDENT: 'Incidente actualizado',
  CLOSE_INCIDENT: 'Incidente cerrado',
  CERTIFY_DOCUMENT: 'Documento certificado',
  VERIFY_DOCUMENT: 'Certificado verificado',
  GRANT_PERMISSION: 'Permiso otorgado',
  REVOKE_PERMISSION: 'Permiso revocado',
  CANCEL_SUBSCRIPTION: 'Suscripción cancelada',
} as const
