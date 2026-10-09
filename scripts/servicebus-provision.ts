/**
 * Crea o actualiza en un namespace de Azure Service Bus las entidades de la
 * topología de la app: el topic, sus suscripciones (con el filtro por subject)
 * y las colas de request/reply.
 *
 * Es idempotente: se puede ejecutar las veces que haga falta, por ejemplo tras
 * cambiar src/lib/messaging/topology.ts. Nunca borra entidades ni mensajes.
 *
 * Uso:
 *   SERVICEBUS_ADMIN_CONNECTION_STRING='Endpoint=sb://<namespace>.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=…' \
 *     npm run mq:provision
 *
 * - La clave debe tener permiso Manage. La app en ejecución solo necesita Send + Listen.
 * - El namespace debe ser Standard o Premium: Basic no tiene topics ni sesiones.
 * - Con SERVICEBUS_ENTITY_PREFIX se crea un juego de entidades con ese prefijo.
 */

import { ServiceBusAdministrationClient, type SqlRuleFilter } from '@azure/service-bus'
import {
  buildTopology,
  flavorFromConnectionString,
  subjectFilter,
  SUBJECT_RULE,
  type QueueSpec,
  type SubscriptionSpec,
  type Topology,
} from '../src/lib/messaging/topology'

const connectionString = process.env.SERVICEBUS_ADMIN_CONNECTION_STRING ?? process.env.SERVICEBUS_CONNECTION_STRING ?? ''
const flavor = flavorFromConnectionString(connectionString)

const EMULATOR_MANAGEMENT_PORT = 5300

/**
 * El emulador expone la API de administración por HTTP en otro puerto, y el SDK
 * siempre habla HTTPS: se reescribe la URL de cada petición. Solo sirve para
 * probar este script en local; las entidades del emulador salen de Config.json.
 */
function emulatorAdminClient(): ServiceBusAdministrationClient {
  const admin = new ServiceBusAdministrationClient(
    connectionString.replace(/Endpoint=sb:\/\/([^;:/]+)[^;]*/i, `Endpoint=sb://$1:${EMULATOR_MANAGEMENT_PORT}`)
  )
  admin.pipeline.addPolicy(
    {
      name: 'emulatorHttpPolicy',
      sendRequest(request, next) {
        request.url = request.url.replace(/^https:/, 'http:')
        request.allowInsecureConnection = true
        return next(request)
      },
    },
    { afterPhase: 'Sign' }
  )
  return admin
}

/**
 * El emulador aplica las actualizaciones de colas y topics, pero responde con un
 * XML incompleto que el SDK no sabe leer (PARSE_ERROR): el cambio sí queda hecho.
 */
function ignoreEmulatorParseError(error: unknown) {
  if (flavor === 'emulator' && (error as { code?: string }).code === 'PARSE_ERROR') return
  throw error
}

/** "PT1M" → 60. Azure devuelve las duraciones normalizadas (P7D puede volver como P7DT0H0M0S). */
function durationSeconds(iso: string): number {
  const match = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/)
  if (!match) return NaN
  const [, d = '0', h = '0', m = '0', s = '0'] = match
  return Number(d) * 86_400 + Number(h) * 3_600 + Number(m) * 60 + Number(s)
}

function sameValue(current: unknown, desired: unknown): boolean {
  if (typeof current === 'string' && typeof desired === 'string' && desired.startsWith('P')) {
    return durationSeconds(current) === durationSeconds(desired)
  }
  return current === desired
}

/** Nombres de las propiedades cuyo valor actual difiere del deseado. */
function changedProperties<T extends object>(current: T, desired: Partial<T>): string[] {
  return (Object.keys(desired) as (keyof T & string)[]).filter((key) => !sameValue(current[key], desired[key]))
}

function report(kind: string, name: string, outcome: string) {
  console.log(`  ${kind.padEnd(12)} ${name.padEnd(28)} ${outcome}`)
}

const describeChange = (changed: string[]) => (changed.length ? `actualizado (${changed.join(', ')})` : 'sin cambios')

async function ensureTopic(admin: ServiceBusAdministrationClient, topic: Topology['topic']) {
  const desired = { defaultMessageTimeToLive: topic.defaultMessageTimeToLive }

  if (!(await admin.topicExists(topic.name))) {
    await admin.createTopic(topic.name, desired)
    return report('topic', topic.name, 'creado')
  }
  const current = await admin.getTopic(topic.name)
  const changed = changedProperties(current, desired)
  if (changed.length) await admin.updateTopic({ ...current, ...desired }).catch(ignoreEmulatorParseError)
  report('topic', topic.name, describeChange(changed))
}

async function ensureSubscription(admin: ServiceBusAdministrationClient, topicName: string, spec: SubscriptionSpec) {
  const label = `${topicName}/${spec.name}`
  const sqlExpression = subjectFilter(spec.subjects)
  const desired = {
    lockDuration: spec.lockDuration,
    maxDeliveryCount: spec.maxDeliveryCount,
    defaultMessageTimeToLive: spec.defaultMessageTimeToLive,
    deadLetteringOnMessageExpiration: spec.deadLetteringOnMessageExpiration,
  }

  if (!(await admin.subscriptionExists(topicName, spec.name))) {
    // El filtro se crea junto con la suscripción: así nunca existe con la regla
    // por defecto, que acepta todos los eventos del topic.
    await admin.createSubscription(topicName, spec.name, {
      ...desired,
      defaultRuleOptions: { name: SUBJECT_RULE, filter: { sqlExpression } },
    })
    return report('suscripción', label, 'creada')
  }

  const current = await admin.getSubscription(topicName, spec.name)
  const changed = changedProperties(current, desired)
  if (changed.length) await admin.updateSubscription({ ...current, ...desired })

  // Primero se asegura el filtro propio y después se quitan los demás: en ningún
  // momento la suscripción queda sin reglas (perdería eventos).
  if (!(await admin.ruleExists(topicName, spec.name, SUBJECT_RULE))) {
    await admin.createRule(topicName, spec.name, SUBJECT_RULE, { sqlExpression })
    changed.push('filtro')
  } else {
    const rule = await admin.getRule(topicName, spec.name, SUBJECT_RULE)
    if ((rule.filter as SqlRuleFilter).sqlExpression !== sqlExpression) {
      await admin.updateRule(topicName, spec.name, { ...rule, filter: { sqlExpression } })
      changed.push('filtro')
    }
  }
  for await (const rule of admin.listRules(topicName, spec.name)) {
    if (rule.name === SUBJECT_RULE) continue
    await admin.deleteRule(topicName, spec.name, rule.name)
    changed.push(`regla "${rule.name}" eliminada`)
  }

  report('suscripción', label, describeChange(changed))
}

async function ensureQueue(admin: ServiceBusAdministrationClient, spec: QueueSpec) {
  const desired = {
    lockDuration: spec.lockDuration,
    maxDeliveryCount: spec.maxDeliveryCount,
    defaultMessageTimeToLive: spec.defaultMessageTimeToLive,
    deadLetteringOnMessageExpiration: spec.deadLetteringOnMessageExpiration,
  }

  if (!(await admin.queueExists(spec.name))) {
    await admin.createQueue(spec.name, { ...desired, requiresSession: spec.requiresSession })
    return report('cola', spec.name, spec.requiresSession ? 'creada (con sesiones)' : 'creada')
  }

  const current = await admin.getQueue(spec.name)
  if (current.requiresSession !== spec.requiresSession) {
    throw new Error(
      `La cola "${spec.name}" ya existe con requiresSession=${current.requiresSession} y esa propiedad no se puede cambiar. ` +
        'Bórrala a mano (perderá sus mensajes) y vuelve a ejecutar.'
    )
  }
  const changed = changedProperties(current, desired)
  if (changed.length) await admin.updateQueue({ ...current, ...desired }).catch(ignoreEmulatorParseError)
  report('cola', spec.name, describeChange(changed))
}

async function main() {
  if (!connectionString) {
    throw new Error('Falta SERVICEBUS_ADMIN_CONNECTION_STRING: la connection string del namespace, con permiso Manage.')
  }
  const admin = flavor === 'emulator' ? emulatorAdminClient() : new ServiceBusAdministrationClient(connectionString)

  const namespace = await admin.getNamespaceProperties()
  console.log(`Namespace "${namespace.name}" (${flavor === 'emulator' ? 'emulador' : `nivel ${namespace.messagingSku}`})`)
  if (namespace.messagingSku === 'Basic') {
    throw new Error('El nivel Basic no admite topics ni sesiones. Cambia el namespace a Standard o Premium.')
  }

  const topology = buildTopology(flavor)
  await ensureTopic(admin, topology.topic)
  for (const subscription of topology.topic.subscriptions) await ensureSubscription(admin, topology.topic.name, subscription)
  for (const queue of topology.queues) await ensureQueue(admin, queue)

  console.log('Listo. La app necesita SERVICEBUS_CONNECTION_STRING con permisos Send y Listen sobre este namespace.')
}

main().catch((error) => {
  console.error(`\nNo se pudo aprovisionar: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
