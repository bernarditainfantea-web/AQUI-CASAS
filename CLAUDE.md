# Aquí Casas — contexto para Claude

Sitio web de **Aquí Casas** (www.aquicasas.cl): catálogo de casas en venta con filtros, ficha de propiedad, calculadora de dividendo y formularios de contacto.

La persona dueña de este repositorio **no es técnica**. Al trabajar con ella:
- Habla en español simple, sin jerga. Explica qué vas a cambiar antes de hacerlo y qué cambió después.
- Haz cambios mínimos y acotados a lo que pidió. No refactorices ni "mejores" cosas que no pidió.
- Si un pedido es ambiguo (qué casa, qué texto, qué mes), pregunta antes de tocar el código.
- Si algo puede romper el sitio en vivo, avísale claramente y propón la alternativa segura.

## Cómo está armado

| Pieza | Dónde | Notas |
|---|---|---|
| Frontend | `index.html` (todo en un solo archivo: HTML, CSS y JS) | ~6.200 líneas. Busca con grep, no lo leas completo. |
| Servidor | `server.js` (Node 20 + Express) | Sirve `index.html` y hace de proxy hacia OFINET. |
| Hosting | **Heroku** (`Procfile`: `web: node server.js`) | Lo que llega a la rama `main` es lo que se publica (verificar que el deploy automático esté activo). |
| Propiedades | **OFINET**, empresa externa | El catálogo, las fotos y los videos vienen de su API. Las casas se cargan y editan en el backoffice de OFINET, **no en este código**. |
| Contactos/leads | **Supabase**, proyecto "Aqui Casas" (`hdntatocmamcibeasypi`), tabla `contactos` | Los formularios insertan ahí. Seguridad (RLS): el público solo puede insertar; leer requiere usuario autenticado. No cambies eso. |
| Valor UF | API pública mindicador.cl (`/api/indicators/uf`) | Si falla, se usa un valor referencial en `index.html`. |
| Analítica | Google Tag Manager `GTM-TCNQ596H`, Google Analytics `G-18ZQ8VR01Q`, Google Ads `AW-17870870054` | En el `<head>` de `index.html`. No los borres. |

### Variables de entorno (configuradas en Heroku, nunca en el código)
- `OFINET_BASE_URL`, `OFINET_TOKEN`: acceso a la API de OFINET. **El token es secreto**: nunca lo escribas en un archivo ni en un commit.
- Otras opcionales con valores por defecto en `server.js` (`OFINET_ENDPOINT_*`, `LEGACY_*`, `DATA_PROVIDER`, `PORT`).
- Un archivo `.env` local está en `.gitignore`. No lo subas.

## Tareas habituales y dónde se hacen

Así se ve el historial de cambios del proyecto; la mayoría de los pedidos serán de este tipo:

- **Cambiar el mes del pop-up de descuento / precio especial**: busca el texto `Agenda <em>dentro de` en `index.html` (pop-up de visita, `id="vpHeading"`). Cambia solo el nombre del mes.
- **Marcar o quitar "Reservada" en una casa**: en `index.html`, `const RESERVED_PROPERTY_IDS = new Set([...])`. Usa los IDs de OFINET como texto, por ejemplo `new Set(['57', '84'])`. Para quitar todas: `new Set([])`. Confirma con la dueña el número de ID de la casa.
- **Valor referencial de la UF**: `ufIndicator.value` en `index.html` y el texto "40.784,98, puede variar" (aparece 2 veces). Solo es el respaldo si falla la API.
- **Textos de pop-ups** (pie, IVA de regalo, visita): búsquedas por el texto visible en `index.html`.
- **Fotos de comunas**: carpeta `Comunas/`. Logos: `Logos/` y archivos en la raíz.
- **Agregar, editar o sacar propiedades, precios o fotos de una casa**: eso **no** se hace aquí, se hace en el backoffice de OFINET. Díselo a la dueña.

## Cómo probar un cambio antes de publicarlo

```bash
npm install
npm start           # http://localhost:3000
```
Sin `OFINET_TOKEN`, el catálogo puede venir vacío o con datos de muestra. Es normal en local; los cambios de textos y estilos igual se pueden revisar.

Antes de terminar, revisa siempre:
1. Que `index.html` sigue siendo HTML válido (no quedaron etiquetas o llaves `{}` sin cerrar).
2. `node --check server.js` si tocaste el servidor.
3. Que el diff contiene **solo** lo pedido.

## Forma de trabajo con git

- Trabaja en una rama, haz commit con un mensaje en español que diga qué cambió ("Cambia mes de Octubre a Noviembre en pop-up de descuento").
- Para publicar, el cambio tiene que llegar a `main` (vía pull request o merge). Explícale a la dueña ese paso y pídele confirmación antes de mezclar a `main`, porque eso actualiza el sitio en vivo.
- Después de publicar, sugiere revisar www.aquicasas.cl (unos minutos después) para confirmar.

## Si el sitio falla

- **Catálogo vacío o "no hay propiedades"**: lo más probable es OFINET (caída de su API o token vencido/cambiado). Revisa `/api/health` y `/api/ofinet/config` del sitio y los logs de Heroku. Si es el token, lo tiene que entregar OFINET y se actualiza en Heroku → Settings → Config Vars.
- **El sitio no carga**: revisa en Heroku si el último deploy falló. Si un cambio reciente lo rompió, lo más seguro es revertir ese commit en `main`.
- **No llegan los contactos**: revisa la tabla `contactos` en Supabase y la consola del navegador.
