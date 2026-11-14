# Mensajería (Azure Service Bus)

SecureVault publica **eventos de dominio** en un bus de mensajes y los procesa en
segundo plano. La operación del usuario (subir un documento, reportar un
incidente, pedir acceso) responde de inmediato; el trabajo lento o secundario lo
hacen consumidores independientes, con reintentos y cola de errores.

El broker es **Azure Service Bus**. En local se usa el emulador oficial de
Microsoft (Docker). Sin broker configurado la app funciona igual: los eventos se
procesan en línea, sin cola ni reintentos.

## Arquitectura

```
 Subir documento ─┐
 Crear incidente ─┼─ publishEvent ─► topic sv-events ─┬─► suscripción indexer  ─► indexa el PDF para el asistente (RAG)
 Solicitar acceso ┘                                   └─► suscripción notifier ─► avisos in-app (campana)
                                                              │
                                 agota 5 intentos · error permanente · expira
                                                              ▼
                                                     cola de errores (DLQ) ─► alerta a los administradores
                                                                              + panel /admin/messaging

 Panel «Probar worker» ──► cola sv-rpc-requests ──► worker
                       ◄── cola sv-rpc-replies (con sesiones) ◄──
```

Los mensajes solo llevan identificadores (patrón *claim-check*): el consumidor
relee de la base de datos o de Storage lo que necesita. Así el mensaje es chico y
ningún dato sensible viaja por el broker.

Los consumidores corren **dentro del mismo proceso de la app** y arrancan con el
servidor (`src/instrumentation.ts`).

## Qué se implementó

| Concepto | Cómo | Código |
|---|---|---|
| **Asíncrono** | `publishEvent` envía al topic y retorna; el trabajo lo hace un consumidor. | `publisher.ts`, `consumers.ts` |
| **Síncrono** (request/reply) | Una petición a una cola y la respuesta por otra, correlacionadas, con timeout. Lo usa «Probar worker». | `rpc.ts` |
| **Ack** | Modo *peek-lock*: el mensaje se confirma (`complete`) solo si el handler terminó bien; si falla se devuelve (`abandon`) o se manda a la DLQ. | `runner.ts`, `settlement.ts` |
| **Durabilidad** | El evento queda guardado en el broker hasta que alguien lo confirma: sobrevive a reinicios de la app. | — |
| **Publish/subscribe** | Un topic y dos suscripciones; cada una recibe su copia de los eventos que le interesan (filtro SQL por tipo). | `topology.ts`, `subscriptions.ts` |
| **Reintentos** | Hasta 5 entregas con backoff exponencial (2 s, 4 s, 8 s, 16 s). Un error permanente (PDF ilegible, mensaje mal formado) no se reintenta. | `settlement.ts` |
| **DLQ** | Cola de errores por suscripción, con motivo, descripción e intentos. Desde el panel se reprocesa o se descarta cada mensaje. | `dead-letter.ts` |
| **Retención** | TTL por entidad: 7 días para eventos (al expirar van a la DLQ), 30 s para peticiones síncronas y 1 min para sus respuestas (al expirar se descartan). | `topology.ts` |
| **Alertas** | Cada mensaje que cae a la DLQ —lo mande un consumidor o lo mueva el propio broker al vencer— genera un aviso para los administradores del sistema: aparece en la campana y como aviso emergente. El panel muestra además un banner. En Azure se complementa con una regla de Azure Monitor. | `consumers.ts`, `dead-letter.ts`, `notification.service.ts` |

Todo el código del bus está en `src/lib/messaging/`. Las entidades (topic,
suscripciones, colas y sus tiempos) se definen **una sola vez** en `topology.ts`;
de ahí salen la configuración del emulador y el aprovisionamiento en Azure.

### Eventos

| Evento | Lo publica | Lo consumen |
|---|---|---|
| `document.uploaded` | Subida de un documento | `indexer` (indexación RAG) y `notifier` (aviso si es de nivel ALTO o CRÍTICO) |
| `incident.created` | Reporte de un incidente | `notifier` |
| `access-request.created` | Solicitud de acceso | `notifier` |
| `access-request.reviewed` | Aprobación o rechazo | `notifier` |
| `messaging.dead-lettered` | Un consumidor, al mandar un mensaje a la DLQ | `notifier` |
| `demo.requested` | Los botones de *Demostración* del panel | `indexer` (simula el fallo pedido) y `notifier` (avisa a quien lo lanzó) |

Los consumidores son **idempotentes**, porque el broker puede entregar un mismo
mensaje más de una vez: la indexación reemplaza los fragmentos del documento, y
los avisos tienen una clave única `(usuario, evento)`.

## Desarrollo local

Requiere Docker Desktop. En Mac con Apple Silicon hay que activar *Use Rosetta for
x86_64/amd64 emulation* (Settings → General): el emulador usa SQL Server, que solo
existe para x86.

```bash
cp infra/servicebus/.env.example infra/servicebus/.env   # aceptar licencias y definir la contraseña
npm run mq:up                                            # levanta el emulador (tarda ~40 s)
```

En `.env.local`:

```
SERVICEBUS_CONNECTION_STRING="Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SAS_KEY_VALUE;UseDevelopmentEmulator=true;"
```

Esa cadena es pública y fija: es la del emulador, no un secreto. Al iniciar
`npm run dev` debe aparecer `[Messaging] Consumidores activos (emulator): indexer, notifier + rpc`.

| Script | Qué hace |
|---|---|
| `npm run mq:up` | Regenera `Config.json` desde la topología y (re)crea el emulador |
| `npm run mq:down` | Detiene el emulador |
| `npm run mq:logs` | Sigue los logs del emulador |
| `npm run mq:provision` | Crea o actualiza las entidades en un namespace de Azure |
| `npm run test:mq` | Tests de integración contra el emulador |

### Tests

- `npm test` — unitarios, sin broker: decisión de reintento/DLQ, ack, publicación
  con fallback, request/reply, topología y avisos.
- `npm run test:mq` — integración contra el emulador. Ejercitan el cableado real y
  solo reemplazan los handlers de negocio. Usan entidades con prefijo `test-`, así
  que conviven con `npm run dev`.

### Límites del emulador

- No persiste: al recrear el contenedor se pierden los mensajes.
- TTL máximo de 1 hora (por eso en local la retención es `PT1H` y no 7 días).
- Sin métricas ni alertas; pensado para pruebas secuenciales, con un máximo de 10
  conexiones simultáneas.
- Si en sus logs aparece `the namespace sbemulatorns is being throttled` (error
  50002), deja de atender peticiones y no se recupera solo: `npm run mq:up`.
  Mientras tanto la app sigue funcionando, porque publica en línea.

## Producción (Azure)

1. **Crear el namespace**, nivel **Standard** (Basic no tiene topics ni sesiones).

   ```bash
   az servicebus namespace create --resource-group <rg> --name <namespace> --location <región> --sku Standard
   ```

2. **Crear las entidades** con la clave de administración (`RootManageSharedAccessKey`):

   ```bash
   SERVICEBUS_ADMIN_CONNECTION_STRING='<connection string con permiso Manage>' npm run mq:provision
   ```

   Es idempotente: se vuelve a ejecutar cada vez que cambie `topology.ts`.

3. **Dar a la app una clave propia**, solo con permisos de envío y escucha, y
   configurarla en el App Service:

   ```bash
   az servicebus namespace authorization-rule create --resource-group <rg> --namespace-name <namespace> \
     --name securevault-app --rights Send Listen
   az servicebus namespace authorization-rule keys list --resource-group <rg> --namespace-name <namespace> \
     --name securevault-app --query primaryConnectionString -o tsv
   az webapp config appsettings set --resource-group <rg> --name <app> \
     --settings SERVICEBUS_CONNECTION_STRING='<connection string de securevault-app>'
   ```

4. **Activar *Always On*** en el App Service (requiere plan Basic o superior). Los
   consumidores viven en el proceso web: si Azure lo suspende por inactividad,
   los mensajes esperan en la cola hasta la siguiente visita.

   ```bash
   az webapp config set --resource-group <rg> --name <app> --always-on true
   ```

5. **Alerta de plataforma** (opcional): avisa por correo aunque la app esté caída.

   ```bash
   az monitor metrics alert create --name securevault-dlq --resource-group <rg> \
     --scopes "$(az servicebus namespace show --resource-group <rg> --name <namespace> --query id -o tsv)" \
     --condition "max DeadletteredMessages > 0" --window-size 5m --evaluation-frequency 5m \
     --action <id del action group> --description "Hay mensajes en la cola de errores de SecureVault"
   ```

6. **Verificar**: entrar como administrador del sistema a *Mensajería* y pulsar
   «Probar worker». Debe responder en milisegundos.

## Operación

El panel **Administración → Mensajería** (solo administrador del sistema) muestra,
por suscripción, los mensajes en cola, en la cola de errores y cuántos se
procesaron, reintentaron o mandaron a la DLQ. Se actualiza solo cada 10 s.

Los mensajes que el propio broker mueve a la DLQ (por ejemplo, los que vencen) no
pasan por ningún consumidor: una revisión cada 15 s los detecta y genera su alerta.

| Motivo en la DLQ | Qué pasó | Qué hacer |
|---|---|---|
| `MaxDeliveryCountExceeded` | Falló 5 veces por un error transitorio (Storage, API de embeddings…). La descripción trae el último error. | Corregir la causa y **Reprocesar**. |
| `PdfUnparseable` | El PDF no se puede leer. | **Descartar**, o volver a subir el documento. |
| `MalformedMessage` | El mensaje no es un evento válido. | **Descartar**. |
| `TTLExpiredException` | Nadie lo consumió antes de que venciera su retención. | Revisar por qué no había consumidores; **Reprocesar** si aún aplica. |

**Reprocesar** ejecuta de nuevo el handler de esa suscripción; si vuelve a fallar,
el mensaje se queda en la DLQ y el panel muestra el error.

## Demostración

La sección **Demostración** del panel provoca cada caso con eventos de prueba
(`demo.requested`), que recorren el mismo camino que los reales sin tocar
documentos ni incidentes.

| Para mostrar | Haz esto | Se ve en |
|---|---|---|
| Síncrono | **Probar worker** | «El worker respondió en N ms» |
| Asíncrono y pub/sub | **Publicar un evento** | El botón responde al instante; *Procesados* sube en las dos tarjetas y llega un aviso a la campana |
| Ack con reintentos | **Falla transitoria** | *Reintentos* +2 en el indexador y luego *Procesados* +1 |
| DLQ por error permanente | **Falla permanente** | Una fila en la cola de errores con 1 intento, y una alerta |
| DLQ por reintentos agotados | **Agotar reintentos** | Tras ~30 s, una fila con 5 intentos, y una alerta |
| Durabilidad | **Pausar consumidores**, publicar eventos y **Reanudar** | *En cola* sube mientras están en pausa y vuelve a 0 al reanudar |
| Retención | Con los consumidores en pausa, **Evento con vida de 10 s**; espera y **Reanuda** | Una fila `TTLExpiredException` con 0 intentos por suscripción, y sus alertas |
| Alertas | Cualquiera de los casos de DLQ | Aviso emergente y la campana con «Mensaje en la cola de errores» |

La pausa afecta solo a la instancia que atendió el clic y se levanta sola a los
5 minutos. Los avisos de demostración solo los recibe quien pulsó el botón; las
alertas de DLQ, todos los administradores del sistema.

## Decisiones y límites conocidos

- **Fallback en línea.** Si el broker no está configurado o no responde en 3 s, el
  evento se procesa en el mismo proceso, sin garantías. Una caída del broker no
  impide subir documentos.
- **Sin *outbox*.** El evento se publica después de confirmar la operación en la
  base de datos. Si el proceso muere justo entre ambos pasos, ese evento se
  pierde (el documento queda guardado pero sin indexar).
- **Consumidores en el proceso web.** Simple de desplegar; a cambio, un trabajo
  pesado comparte CPU con las peticiones. Con varias instancias, se reparten los
  mensajes sin configuración adicional.
- **Sin orden garantizado** entre eventos: ningún consumidor lo necesita.
- **Conteos por *peek*.** El panel cuenta mirando hasta 50 mensajes por cola
  (muestra «50+»), lo que solo requiere permiso de escucha.
