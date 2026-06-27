# To do — versión web

La misma app (mismo diseño, misma navegación, mismo flujo GTD de 7 pasos) pero como **página web**:
se abre desde el navegador en la compu y en el celular, con los **mismos datos compartidos**.

Es **un solo archivo** (`index.html`). No necesita instalar nada para probarla.

---

## 1. Probarla ya (sin configurar nada)

Doble clic en `index.html` y se abre en tu navegador. Funciona completa y **guarda en ese navegador**
(localStorage). Perfecto para verla, pero los datos viven solo en ese dispositivo.

> En esta etapa, el celular y la compu NO comparten datos todavía. Para eso → paso 3.

## 2. Ponerla en internet (para abrirla desde el celular)

Necesitas que el archivo esté en una URL. Lo más fácil y gratis:

**Opción Netlify Drop (sin cuenta técnica):**
1. Entra a https://app.netlify.com/drop
2. Arrastra la carpeta `todo-web` completa a la página.
3. Te da una URL tipo `https://algo.netlify.app`. Ábrela en tu iPhone.
4. En Safari: botón compartir → **"Agregar a inicio"**. Queda como un ícono "To do".

**Opción Vercel:** crea cuenta gratis en vercel.com, "Add New → Project", sube esta carpeta, deploy.

## 3. Sincronizar celular ⇄ compu (base de datos en la nube, gratis)

Para que veas las **mismas tareas** en todos lados:

1. Crea una cuenta gratis en https://supabase.com y un proyecto nuevo.
2. En el proyecto: menú **SQL Editor → New query**, pega el contenido de `supabase-schema.sql` y dale **Run**.
3. Ve a **Project Settings → API** y copia:
   - **Project URL** (ej. `https://xxxx.supabase.co`)
   - **anon public key** (una cadena larga)
4. Abre `index.html` con un editor de texto y pega esas 2 claves aquí (cerca del inicio):
   ```js
   window.SUPABASE_URL = "https://xxxx.supabase.co";
   window.SUPABASE_ANON_KEY = "tu-anon-key";
   ```
5. Vuelve a subir la carpeta (paso 2). Listo: ahora todo se guarda en la nube y se sincroniza
   entre tu celular y tu compu automáticamente.

En **Ajustes** (botón ⋯ en "Hoy" → Ajustes) verás un indicador verde cuando la nube esté activa.

---

## Qué incluye

- Navegación: **Hoy · Inbox · Áreas · Proyectos · Calendario** + menú **⋯ Más**.
- **Flujo de 7 pasos** para crear tareas (captura → resultado → next action → proyecto → contexto → área → cuándo).
- Tocar el círculo = completar. Tocar la tarjeta = **editar** (todos los campos + línea de tiempo + archivar/restaurar/borrar).
- **Inbox** con captura rápida; tocar un item lo procesa con las 7 preguntas.
- **Esperando**, **Algún día**, **Archivo** (completadas/eliminadas/canceladas), **Búsqueda** y **Ajustes** (vaciar papelera).
- **Modo claro/oscuro** automático según el sistema. Soft delete en todo.
- Datos de ejemplo la primera vez.

## Editar el código (opcional)

`index.html` ya trae el JavaScript listo para correr. El código fuente legible (con JSX) está en
`app.jsx`. Si cambias `app.jsx`, hay que recompilarlo dentro de `index.html`; te ayudo con eso
cuando quieras. Para solo pegar las claves de Supabase **no** necesitas recompilar: eso se edita
directo en `index.html` (paso 3).

> Nota: `index.html` carga React y Supabase desde internet (CDN), así que para abrirlo localmente
> con doble clic necesitas conexión. Una vez subido a Netlify/Vercel funciona normal.

## Notas

- Sin login (es personal). Quien tenga tu URL + anon key puede acceder a los datos; para uso propio
  está bien. Si quieres privacidad real, se agrega Supabase Auth y se filtra por usuario.
- La carpeta `../ToDo` es la versión nativa de iPhone (SwiftUI). Para tu objetivo de "web + celular
  con datos compartidos", **esta versión web es la que te sirve**.
