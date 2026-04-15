# AZURE — PASO A PASO PARA PRINCIPIANTES
## Deploy completo en Azure App Service

Nunca usaste Azure · Sigue cada paso en orden · ~30 minutos
Guía visual completa desde cero. Cada paso tiene exactamente qué hacer y dónde hacer clic.

### AZ.1 Crear cuenta en Azure (si no tienes)
Ir a portal.azure.com → Crear cuenta gratuita. Azure da $200 USD de crédito por 30 días y servicios gratis por 12 meses. Para este proyecto el plan F1 (gratuito) es suficiente.

> ✓ Si ya tienes cuenta con el correo de DuocUC, úsala directamente — puede tener créditos universitarios activos.

---

### AZ.2 Crear el App Service (el servidor que corre tu app)
En el portal de Azure, sigue exactamente estos pasos:

1. Click en **+ Create a resource** (botón arriba a la izquierda)
2. Buscar **"Web App"** → seleccionar → click **Create**
3. En el formulario que aparece, llenar así:

**Valores exactos para el formulario de Web App:**
- **Subscription:** la que tienes disponible
- **Resource Group:** Click "Create new" → escribir: `securevault-rg`
- **Name:** `securevault-ai` ← esta será tu URL: `securevault-ai.azurewebsites.net`
- **Publish:** Code
- **Runtime stack:** Node 20 LTS
- **Operating System:** Linux
- **Region:** East US ← o la más cercana a Chile: Brazil South
- **Pricing plan:** Free F1 ← click "Explore pricing plans" → seleccionar F1 (Free)

4. Click en **Review + create** → **Create**. Esperar ~2 minutos hasta que diga "Deployment complete".

> ✓ Click en "Go to resource" para ir a tu App Service recién creado.

---

### AZ.3 Configurar las variables de entorno en Azure
*Equivalente al `.env.local` pero en el servidor de Azure*

Dentro de tu App Service, en el menú lateral izquierdo:
1. Click en **Configuration** (bajo la sección Settings)
2. Estás en la pestaña **Application settings**
3. Click en **+ New application setting** para agregar cada variable

Agregar estas variables una por una (Name = el nombre, Value = el valor real de tu proyecto):

| Name | Value (tu valor real) |
|---|---|
| `DATABASE_URL` | Tu connection string de Supabase con `?pgbouncer=true` |
| `DIRECT_URL` | Tu connection string de Supabase sin pgbouncer |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://[tu-proyecto].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tu anon public key de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Tu service_role key de Supabase |
| `JWT_SECRET` | El mismo valor que tienes en tu `.env.local` |
| `NEXT_PUBLIC_APP_URL` | `https://securevault-ai.azurewebsites.net` |
| `NODE_ENV` | `production` |

4. Al terminar de agregar todas, click en **Save** arriba. Azure te preguntará si quieres reiniciar — click **Continue**.

> ⚠ Si te falta alguna variable, la app arranca pero falla silenciosamente. Asegúrate de agregar las 8.

---

### AZ.4 Conectar GitHub con Azure para deploy automático
*Cada vez que hagas `git push`, Azure actualiza la app automáticamente*

Dentro de tu App Service, en el menú lateral izquierdo:
1. Click en **Deployment Center** (bajo la sección Deployment)
2. En **Source** seleccionar **GitHub**
3. Click en **Authorize** → se abre una ventana de GitHub → autorizar Azure
4. **Organization:** tu usuario de GitHub
5. **Repository:** securevault-ai
6. **Branch:** main
7. Click en **Save**

Azure crea automáticamente un archivo `.github/workflows/azure.yml` en tu repositorio y hace el primer deploy. Puedes ver el progreso en la pestaña Logs.

> 💡 El primer deploy tarda 5–10 minutos porque instala dependencias y compila Next.js. Los deploys siguientes son más rápidos.

---

### AZ.5 Configurar el startup command de Node.js
*Azure necesita saber cómo arrancar tu app*

Dentro de tu App Service, en el menú lateral:
1. Click en **Configuration** → pestaña **General settings**
2. Buscar el campo **Startup Command**
3. Escribir exactamente esto:

**Startup Command — copiar exacto:**
```bash
npx prisma migrate deploy && npm start
```

4. Click en **Save**. Esto le dice a Azure: primero aplica las migraciones de la BD, luego arranca la app.

> ⚠ Usar `migrate deploy` nunca `migrate dev`. Si usas `dev` en producción, Prisma falla con error de permisos.

---

### AZ.6 Agregar la URL de Azure en Supabase
*Sin esto, el login no funciona en producción*

Supabase bloquea requests de dominios no autorizados. Debes agregar tu URL de Azure:
1. Ir a tu proyecto en supabase.com
2. Click en **Authentication** → **URL Configuration**
3. En **Site URL** cambiar a: `https://securevault-ai.azurewebsites.net`
4. En **Redirect URLs** agregar: `https://securevault-ai.azurewebsites.net/**`
5. Click en **Save**

> ✓ Ahora Supabase Auth acepta logins desde tu dominio de Azure.

---

### AZ.7 Verificar que todo funciona
*Pruebas en producción real*

Abre tu navegador y prueba en este orden:
1. Abrir `https://securevault-ai.azurewebsites.net/api/health` → debe responder `{"status":"ok"}`
2. Abrir `https://securevault-ai.azurewebsites.net` → debe aparecer la landing
3. Ir a `/register` → registrar una empresa nueva desde Azure
4. Hacer login → debe llegar al dashboard
5. Subir un documento → debe guardarse en Supabase Storage
6. Abrir `/verify/cualquier-codigo` sin login → debe cargar la página pública

> 🚨 Si el health check no responde después de 10 minutos: ir a tu App Service → Log stream en el menú lateral → ver los errores en tiempo real. El error más frecuente es una variable de entorno mal copiada.

> 💡 Para ver logs en cualquier momento: App Service → Log stream. Es como la consola de tu servidor en vivo.

---

### AZ.8 Errores comunes y cómo resolverlos

- **Application Error / 500** → ir a Log stream. Casi siempre es una variable de entorno faltante o mal copiada. Revisar que las 8 variables estén en Configuration → Application settings.
- **La app carga pero el login falla** → revisar AZ.6. Supabase no tiene la URL de Azure en los dominios autorizados.
- **"PrismaClientInitializationError"** → `DATABASE_URL` incorrecta en Azure. Copiarla de nuevo desde Supabase → Settings → Database → asegurarse de incluir `?pgbouncer=true` al final.
- **El deploy falla en GitHub Actions** → ir al repositorio en GitHub → pestaña Actions → ver el log del workflow. Buscar la línea roja. Frecuentemente es que falta el secret de Azure en GitHub.
- **Si necesitas redesployar manualmente:** App Service → Deployment Center → click en Sync. Esto fuerza un nuevo deploy sin necesidad de hacer git push.
