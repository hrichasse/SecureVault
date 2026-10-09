/**
 * Genera infra/servicebus/Config.json (entidades del emulador de Azure Service Bus)
 * a partir de la topología de la app, para que no se desincronicen.
 *
 * Emite dos juegos de entidades: el de la app y uno con prefijo "test-" que usan
 * los tests de integración para no competir con el servidor de desarrollo.
 *
 * Uso: npm run mq:config
 */

import { writeFileSync } from 'fs'
import { join } from 'path'
import { buildTopology, subjectFilter, SUBJECT_RULE, type Topology } from '../src/lib/messaging/topology'

const TEST_PREFIX = 'test-'

const prefixes = Array.from(new Set([process.env.SERVICEBUS_ENTITY_PREFIX ?? '', TEST_PREFIX]))
const topologies: Topology[] = prefixes.map((prefix) => buildTopology('emulator', prefix))

const config = {
  UserConfig: {
    Namespaces: [
      {
        // El emulador no permite renombrar su namespace.
        Name: 'sbemulatorns',
        Queues: topologies.flatMap((t) =>
          t.queues.map((q) => ({
            Name: q.name,
            Properties: {
              DeadLetteringOnMessageExpiration: q.deadLetteringOnMessageExpiration,
              DefaultMessageTimeToLive: q.defaultMessageTimeToLive,
              DuplicateDetectionHistoryTimeWindow: 'PT20S',
              ForwardDeadLetteredMessagesTo: '',
              ForwardTo: '',
              LockDuration: q.lockDuration,
              MaxDeliveryCount: q.maxDeliveryCount,
              RequiresDuplicateDetection: false,
              RequiresSession: q.requiresSession,
            },
          }))
        ),
        Topics: topologies.map((t) => ({
          Name: t.topic.name,
          Properties: {
            DefaultMessageTimeToLive: t.topic.defaultMessageTimeToLive,
            DuplicateDetectionHistoryTimeWindow: 'PT20S',
            RequiresDuplicateDetection: false,
          },
          Subscriptions: t.topic.subscriptions.map((s) => ({
            Name: s.name,
            Properties: {
              DeadLetteringOnMessageExpiration: s.deadLetteringOnMessageExpiration,
              DefaultMessageTimeToLive: s.defaultMessageTimeToLive,
              LockDuration: s.lockDuration,
              MaxDeliveryCount: s.maxDeliveryCount,
              ForwardDeadLetteredMessagesTo: '',
              ForwardTo: '',
              RequiresSession: false,
            },
            Rules: [
              {
                Name: SUBJECT_RULE,
                Properties: {
                  FilterType: 'Sql',
                  SqlFilter: { SqlExpression: subjectFilter(s.subjects) },
                },
              },
            ],
          })),
        })),
      },
    ],
    Logging: { Type: 'Console' },
  },
}

const target = join(__dirname, '..', 'infra', 'servicebus', 'Config.json')
writeFileSync(target, JSON.stringify(config, null, 2) + '\n')
console.log(`Config del emulador escrita en ${target} (prefijos: ${prefixes.map((p) => `"${p}"`).join(', ')})`)
