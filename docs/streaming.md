# Streaming de datos con Apache Kafka

SecureVault publica sus **eventos de negocio** (subir o ver un documento, pedir
acceso, aprobarlo, reportar un incidente, certificar...) en un topic de Apache
Kafka. Consumidores independientes leen ese flujo continuo y calculan **métricas
en tiempo real** y **alertas de seguridad**, sin tocar la base de datos ni frenar
a la aplicación.

Todo corre en local con Docker. En producción (Azure) no hay Kafka: la app
funciona igual y el panel indica que el streaming no está configurado.

## Arquitectura

```
                               ┌──────────────────────── Docker (infra/kafka) ────────────────────────┐
 App SecureVault               │                                                                      │
 (acciones reales)             │   Apache Kafka 3.9 (KRaft, 1 broker)                                 │
   │ escribe                   │   topic: securevault.eventos-negocio                                 │
   ▼                           │     ├─ partición 0 ┐                                                 │
 tabla AuditLog ──► relay de ──┼──►  ├─ partición 1 ├─ clave = empresa (orden garantizado por empresa)│
 (misma transacción) auditoría │     └─ partición 2 ┘   retención 7 días                             │
                               │            │                                                         │
 simulador de eventos ─────────┼──► (productor)                     Kafka UI → http://localhost:8080  │
 (flujo continuo para la demo) │            │                                                         │
                               └────────────┼─────────────────────────────────────────────────────────┘
                                            │  cada grupo de consumidores recibe su copia del flujo
                       ┌────────────────────┴────────────────────┐
                       ▼                                         ▼
          consumidor de terminal                     panel web /admin/streaming
          (grupo sv-metricas-terminal)               (grupo sv-panel-web-xxxx, vía SSE)
          métricas + alertas en vivo                 gráficos, alertas y eventos en vivo
```

| Pieza | Rol | Código |
|---|---|---|
| **Topic** `securevault.eventos-negocio` | 3 particiones, clave = empresa, retención 7 días | `infra/kafka/docker-compose.yaml` |
| **Productor: simulador** | Flujo continuo de eventos realistas (4 empresas ficticias) y una ráfaga sospechosa cada 45 s | `scripts/kafka/producer-simulator.ts`, `src/lib/streaming/simulator.ts` |
| **Productor: relay de auditoría** | Conecta Kafka con el sistema existente: publica cada fila nueva de `AuditLog` (patrón *Transactional Outbox*) | `scripts/kafka/audit-relay.ts` |
| **Consumidor de terminal** | Panel en la consola: ev/s, por tipo, por nivel, por empresa, alertas, partición y offset de cada evento | `scripts/kafka/consumer-metrics.ts` |
| **Consumidor del panel web** | Consumidor dentro del servidor de Next; envía las métricas al navegador cada segundo por Server-Sent Events | `src/lib/streaming/live-feed.ts`, `src/app/api/admin/streaming/route.ts` |
| **Métricas** | Ventana deslizante de 60 s y reglas de alerta (lógica pura, con tests) | `src/lib/streaming/metrics.ts` |

### El evento

Cada mensaje es un JSON con la acción y su contexto. La clave del mensaje es el
`companyId`, así todos los eventos de una empresa caen en la misma partición y
se procesan en orden.

```json
{
  "id": "9b2c…",
  "type": "VIEW_DOCUMENT",
  "occurredAt": "2026-11-14T23:35:41.120Z",
  "source": "simulator",
  "companyId": "demo-norte",
  "companyName": "Retail Norte (demo)",
  "userId": "demo-u-09",
  "userName": "Sofía Fuentes",
  "documentId": "demo-d-18",
  "documentName": "Proyección de ventas",
  "confidentialityLevel": "ALTO",
  "priority": null
}
```

Los tipos son los mismos de `AuditAction` en la base de datos.

### Métricas y alertas en tiempo real

Sobre una ventana deslizante de **60 segundos**:

- eventos por segundo (promedio de los últimos 10 s) y la serie segundo a segundo
- conteo por tipo de evento, por nivel de confidencialidad y por empresa
- origen de los eventos: acciones reales de la app o simulador

Alertas (procesamiento del flujo, sin consultar la base):

| Alerta | Regla |
|---|---|
| **Posible fuga de información** (`EXFILTRACION`) | un mismo usuario ve o descarga **6 o más documentos ALTO/CRÍTICO en menos de 5 s** (con el uso normal un usuario ve unos 5 por minuto, por eso la ventana es corta) |
| **Incidente crítico** (`INCIDENTE_CRITICO`) | se reporta un incidente de prioridad CRÍTICA |

El simulador provoca una ráfaga sospechosa cada 45 s para ver la primera alerta en vivo.

### ¿Por qué Kafka además de Service Bus?

Son herramientas para problemas distintos y conviven:

| | Azure Service Bus (mensajería) | Apache Kafka (streaming) |
|---|---|---|
| Para qué | Trabajo que hay que hacer **una vez** (indexar un PDF, enviar un aviso) | **Flujo continuo** de hechos que varios leen y analizan |
| Qué pasa con el mensaje | Se borra al confirmarlo (ack) | Queda en el log del topic (7 días) y se puede releer |
| Varios lectores | Una suscripción por lector | Un grupo de consumidores por lector, cada uno con su offset |
| Orden | Por sesión | Por partición (aquí, por empresa) |
| Uso en SecureVault | Indexación RAG, avisos, DLQ, request/reply | Métricas en tiempo real y detección de patrones |

## Cómo correrlo

Requiere Docker Desktop.

```bash
npm run kafka:up          # Kafka + creación del topic + Kafka UI (http://localhost:8080)
```

En terminales separadas:

```bash
npm run kafka:producer    # productor: simulador (~4 eventos/s)
npm run kafka:consumer    # consumidor: métricas en vivo en la terminal
npm run kafka:relay       # (opcional) productor: acciones reales de la app vía AuditLog
```

Panel web: agrega `KAFKA_BROKERS=localhost:9092` a `.env.local`, ejecuta
`npm run dev` e inicia sesión como ADMIN del sistema → **Streaming (Kafka)** en el
menú (`/admin/streaming`).

```bash
npm run kafka:down        # detiene y borra los contenedores
```

### Opciones

| Comando | Opción | Efecto |
|---|---|---|
| `kafka:producer` | `-- --rate=10` | eventos por segundo (por defecto 4) |
| | `-- --burst-every=0` | sin ráfagas sospechosas (por defecto cada 45 s) |
| | `-- --duration=60` | se detiene a los 60 s |
| `kafka:consumer` | `-- --log` | una línea por evento con partición y offset (estilo `tail -f`) |
| | `-- --from-beginning` | relee todo lo que retiene el topic |
| | `-- --group=otro` | otro grupo de consumidores (recibe su propia copia del flujo) |
| `kafka:relay` | `-- --since=60` | publica también las acciones de los últimos 60 minutos |

### Para la demo

1. `npm run kafka:up` y abrir Kafka UI: se ve el topic con sus 3 particiones.
2. `npm run kafka:consumer` en una terminal y `npm run kafka:producer` en otra: el
   panel de la terminal empieza a moverse.
3. Esperar la ráfaga (≤ 45 s): aparece la alerta de posible fuga de información.
4. Abrir `/admin/streaming` en la app: el mismo flujo con gráficos.
5. Con `npm run kafka:relay` corriendo, hacer algo en la app (subir o ver un
   documento): el evento real aparece en el panel con origen **App**.
6. Escalar: abrir un segundo `npm run kafka:consumer` (mismo grupo) → Kafka reparte
   las particiones entre los dos. Con `--group=otro` cada uno recibe todo.

### Variables de entorno

| Variable | Por defecto | Uso |
|---|---|---|
| `KAFKA_BROKERS` | — (scripts: `localhost:9092`) | Brokers separados por coma. Sin ella, la app no usa Kafka |
| `KAFKA_TOPIC` | `securevault.eventos-negocio` | Topic de eventos de negocio |
| `KAFKA_CLIENT_ID` | `securevault` | Prefijo del client id |

### Tests

`npm test` incluye `__tests__/lib/streaming/streaming.test.ts`: formato del
evento, simulador, ventana de métricas y reglas de alerta. No necesitan Kafka.
