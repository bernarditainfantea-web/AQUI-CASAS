# Guía para administrar la web de Aquí Casas

Esta guía es para ti, aunque nunca hayas programado. No necesitas saber código: le pides los cambios a **Claude** en español y Claude los hace.

---

## 1. Las piezas de tu web (en simple)

| Qué es | Dónde está | Para qué sirve |
|---|---|---|
| **GitHub** | github.com | Guarda el código de la web (las "instrucciones" de la página). |
| **Heroku** | heroku.com | Es el computador donde la web está publicada. Lo que se aprueba en GitHub aparece aquí. |
| **OFINET** | Empresa externa | Ahí se cargan las **casas, precios, fotos y videos**. Eso **no** se cambia con Claude, se cambia en el sistema de OFINET. |
| **Supabase** | supabase.com | Guarda los **contactos** de las personas que llenan los formularios de la web. |
| **Claude** | claude.ai | Tu asistente: le pides cambios y los hace en el código. |
| **Dominio** | aquicasas.cl | La dirección de la web. Ya es de ustedes. |

---

## 2. Cómo pedirle un cambio a Claude

1. Entra a **claude.ai/code** e inicia una sesión nueva con el repositorio **AQUI-CASAS**.
2. Escribe lo que quieres en español, como se lo dirías a una persona. Sé específica.
3. Claude te va a explicar qué cambió. Si algo no te queda claro, pregúntale.
4. Para que el cambio aparezca en la web, pídele: **"publícalo en main"**. Claude te va a pedir confirmación porque eso cambia la web real.
5. Espera unos minutos y revisa www.aquicasas.cl. Si no ves el cambio, recarga la página con Ctrl+F5 (o Cmd+Shift+R en Mac).

### Ejemplos de pedidos que funcionan bien

- *"Cambia el mes del pop-up de precio especial de Octubre a Noviembre."*
- *"Marca como Reservada la casa con ID 84."* (el ID lo ves en OFINET)
- *"Quita el Reservada de todas las casas."*
- *"Cambia el texto del pop-up de 'Te ayudamos con el pie' por: ..."*
- *"Actualiza el valor referencial de la UF a 41.000."*

### Pedidos que NO se hacen con Claude

- Agregar o sacar una casa, cambiar su precio, fotos o descripción → **en OFINET**.
- Ver quién dejó sus datos en el formulario → **en Supabase** (Table Editor → tabla `contactos`).

---

## 3. Reglas de oro

1. **Un cambio a la vez.** Pide una cosa, revísala en la web, y recién ahí pide la siguiente.
2. **Nunca compartas contraseñas ni "tokens"** (claves de OFINET, Heroku, Supabase) en chats, correos ni WhatsApp. Guárdalas en un gestor de contraseñas.
3. **Si no entiendes lo que Claude propone, no lo publiques.** Pregúntale "explícamelo simple" o pide ayuda.
4. **No borres** cosas que no sabes para qué sirven (por ejemplo los códigos de Google al inicio de la página: miden las visitas y los anuncios).

---

## 4. Si algo se rompe

| Qué pasa | Qué hacer |
|---|---|
| La web muestra **"no hay propiedades"** o el catálogo está vacío | Probablemente es OFINET. Contáctalos primero. Si te entregan una clave nueva, pídele a Claude que te guíe para cambiarla en Heroku (Settings → Config Vars). |
| **La web no carga** después de un cambio | Dile a Claude: *"El último cambio rompió la web, revierte el último cambio en main."* |
| **No llegan contactos** | Revisa la tabla `contactos` en Supabase. Si no aparecen, cuéntale a Claude qué pasa. |
| No sabes qué pasa | Pídele a Claude: *"Revisa por qué la web no funciona y explícamelo simple."* Si sigue sin funcionar, llama a tu contacto técnico. |

**Contacto técnico de emergencia:** _(completar: nombre y teléfono de una persona técnica de confianza)_

**Contacto OFINET:** _(completar)_

---

## 5. Tus cuentas (completar y guardar en un lugar seguro, NO en este archivo)

- [ ] GitHub: usuario _______
- [ ] Heroku: email _______ (la app de Aquí Casas debe estar a tu nombre)
- [ ] Supabase: email _______ (el proyecto "Aqui Casas" debe estar en tu organización)
- [ ] Claude (plan con Claude Code): email _______
- [ ] OFINET: usuario del backoffice _______
- [ ] Dominio aquicasas.cl: dónde está registrado _______
