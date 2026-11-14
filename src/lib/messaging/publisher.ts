/**
 * publisher.ts — Publica eventos de dominio.
 *
 * Con broker: el evento se envía al topic y recién entonces retorna; desde ese
 * momento está persistido en Service Bus y se procesará aunque la app se reinicie.
 *
 * Sin broker (no configurado o caído): se procesa en línea, en este mismo
 * proceso y sin garantías, igual que antes de tener mensajería. Así la app
 * funciona en entornos sin Service Bus y una caída del broker no rompe, por
 * ejemplo, la subida de documentos.
 *
 * Nunca lanza: publicar ocurre después de que la operación de negocio ya se
 * confirmó en la BD, y un fallo aquí no debe hacerla fracasar.
 */

import { describeError, getBrokerFlavor, getEventsSender, isMessagingEnabled } from './bus'
import { createEnvelope, type AnyEventEnvelope, type EventPayloads } from './events'
import { buildTopology, type EventType } from './topology'
import { SUBSCRIPTION_CONSUMERS } from './subscriptions'

const PUBLISH_TIMEOUT_MS = 3_000

export interface PublishOptions {
  /** Vida del mensaje en el broker; si nadie lo consume antes, vence. Por defecto, la de la suscripción. */
  timeToLive?: number
}

export async function publishEvent<T extends EventType>(
  type: T,
  data: EventPayloads[T],
  options: PublishOptions = {}
): Promise<void> {
  const envelope = createEnvelope(type, data) as unknown as AnyEventEnvelope

  if (isMessagingEnabled()) {
    try {
      await getEventsSender().sendMessages(
        {
          body: envelope,
          messageId: envelope.id,
          // Los filtros de las suscripciones enrutan por subject.
          subject: type,
          contentType: 'application/json',
          ...(options.timeToLive && { timeToLive: options.timeToLive }),
        },
        // Tope duro: quien publica es una operación de usuario (subir un documento,
        // crear un incidente) y no puede quedar esperando a un broker que no responde.
        { abortSignal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS) }
      )
      return
    } catch (error) {
      console.error(`[Messaging] No se pudo publicar ${type} en el broker (${describeError(error)}); se procesa en línea.`)
    }
  }

  dispatchInline(envelope)
}

/** Reparte el evento a los mismos handlers que lo recibirían por el topic. No espera a que terminen. */
function dispatchInline(envelope: AnyEventEnvelope): void {
  for (const subscription of buildTopology(getBrokerFlavor()).topic.subscriptions) {
    if (!subscription.subjects.includes(envelope.type)) continue
    const consumer = SUBSCRIPTION_CONSUMERS[subscription.name]
    if (!consumer) continue
    consumer.handler(envelope, { deliveryCount: 0 }).catch((error) => {
      console.error(`[Messaging] ${subscription.name}: fallo al procesar ${envelope.type} en línea.`, error)
    })
  }
}
