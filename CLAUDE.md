# Nudgy (antes "Mi Alarma")

App PWA de notas/alarmas bilingue (espanol/ingles) que vive en un solo archivo `index.html` (HTML/CSS/JS vanilla, sin frameworks ni build process). Detecta fechas, horas y patrones de recurrencia escritos en lenguaje natural dentro de las notas, y las convierte en alarmas.

## Archivos del proyecto

- `index.html` — toda la app (HTML, CSS y JS en un solo archivo, dentro de una etiqueta `<script>`)
- `manifest.json` — configuracion PWA (nombre, colores, icono)
- `sw.js` — service worker (cache offline + notificaciones con botones de accion)
- `icon.svg` — icono de la app (una campana simple)
- `firestore.rules` — reglas de seguridad de Firestore (se pegan a mano en la consola de Firebase, no se deployan por CLI)
- `COMO_PUBLICARLO.md` — instrucciones de publicacion antiguas (ya no se usan)

## Deploy

Repositorio en GitHub (`Sergioleon47/nudgy`), conectado a Netlify (proyecto "nudgyapp"). Se publica automaticamente con `git push`.

## Funciones ya implementadas

- Escribir una nota en texto libre; se guarda tal cual la escribio el usuario (nunca se le quita ni reformatea el texto)
- Deteccion de fecha/hora en espanol e ingles: dias de la semana, "hoy"/"manana", fechas especificas ("15 de agosto", "on the 21st"), rangos ("de lunes a viernes" / "monday to friday"), listas de dias sueltos no consecutivos ("lunes y miercoles" / "monday and wednesday"), tiempo relativo ("en 3 dias", "en 2 semanas", "in 30 minutes")
- La hora tambien se entiende hablada de forma natural: numeros en letras ("a las dos", "a la una", "at two"), "y media" / "y cuarto" ("a las cuatro y media" = 4:30), y "de la tarde" / "de la noche" / "de la manana" / "de la madrugada" (tambien "in the morning/afternoon/evening", "at night") como alternativa a poner "am"/"pm". Tambien entiende "mediodia"/"noon" y "medianoche"/"midnight" como horas exactas. Esto mismo aplica a la ventana horaria de "cada X horas hasta..." (p. ej. "cada 2 horas hasta las 8 de la noche"). Limitacion conocida: una nota sigue siendo una sola fecha/hora — un parrafo con varios eventos mezclados (ej. "el lunes tengo reunion a las 2 y despues cena a las 8") no se separa solo; cada evento necesita su propia nota (separadas por una linea en blanco)
- Los dias de la semana, meses y algunas palabras clave toleran errores de tipeo comunes, incluyendo letras traspuestas al principio de la palabra (p. ej. "imercoles" en vez de "miercoles" igual se reconoce como miercoles)
- Los numeros de cantidad ("cada X dias/horas/anos/meses", "en X dias/semanas/horas/minutos") tambien se entienden escritos en letras, en espanol e ingles, del 0 al 30: "cada dos horas", "en tres dias", "en una hora", "every two days". Es una conversion acotada solo a esas posiciones numericas (nunca un reemplazo general del texto), asi que palabras comunes como "una" en "una reunion" no se ven afectadas
- Recurrencia por intervalo fijo, pensada para turnos rotativos y vencimientos periodicos: "cada 3 dias" / "every 3 days" y "cada 2 anos" / "every 2 years" (se ancla a la fecha en que se escribio la nota, no a una fecha explicita del texto)
- Recurrencia mensual, pensada para pagos y controles que se repiten una vez al mes: "cada mes" / "every month" y "cada 2 meses" / "every 2 months" (se ancla al dia del mes en que se escribio la nota; si ese dia no existe en un mes mas corto, cae en el ultimo dia de ese mes)
- Recurrencia dentro del mismo dia, para hidratacion/medicacion durante entrenamientos largos u otras rutinas: "cada 2 horas" / "every 2 hours" (tambien "cada hora" / "every hour"). Se ancla a la hora exacta en que se escribio o edito la nota (o a una hora explicita si el usuario la da, ej. "cada 2 horas a las 8am"). Se puede limitar a una ventana horaria dentro del mismo dia con "hasta las 8pm" / "until 8pm" (p. ej. "cada 2 horas hasta las 8pm"): deja de sonar despues de esa hora y retoma al dia siguiente
- Fecha de corte para cualquier nota recurrente: "... hasta el 15 de diciembre" / "... until December 15" (tambien acepta solo el mes, "hasta diciembre", y usa el ultimo dia de ese mes). Pasada esa fecha, la nota deja de sonar y de aparecer en el calendario. Si la nota no tiene ningun patron recurrente, "hasta X" no se aplica como corte y se interpreta como la fecha propia de la nota (p. ej. "vacaciones hasta el 15 de agosto" sigue funcionando como antes)
- Notas sin fecha se anclan al dia en que se escribieron y se recuerdan cada ano (como cumpleanos)
- Alarmas con hora suenan con sonido + vibracion + notificacion del sistema con botones de accion (+5 min, +15 min, Apagar del todo)
- Alarmas que no se apagan del todo se reprograman solas cada 15 min
- Calendario visual con iconos segun el tipo de actividad detectado (pastel=cumpleanos, personas=reunion, telefono=llamada, etc), fondo verde estilo WhatsApp en dias con actividad
- Libreta de contactos local: si un nombre guardado aparece en una nota, se convierte en link "tel:" clickeable sin mostrar el numero
- Selector de idioma ES/EN que traduce toda la interfaz (el parsing de fechas siempre entiende ambos idiomas sin importar el idioma de la interfaz)
- Buscador de notas en tiempo real
- Exportar/Importar notas como respaldo (JSON)
- Persistencia con localStorage (las notas sobreviven a cerrar el navegador)
- Vibracion de bienvenida en el primer toque, primera vez que se abre la app
- Vista previa en vivo bajo el textarea: mientras escribes, muestra lo que el parser entendio (fecha, hora, recurrencia) antes de guardar
- Exportar cualquier nota como evento de calendario (.ics), compatible con el calendario nativo del telefono
- Adjuntar una foto a una nota (camara o galeria/capturas de pantalla) o pegarla directo con Ctrl+V; se comprime a JPEG antes de guardarse en localStorage, se muestra como miniatura en la nota y se puede ver en grande al tocarla
- Escanear un calendario fisico: se toma una foto de un calendario de papel escrito a mano, se ajustan las 4 esquinas de la cuadricula sobre la foto, y la app detecta automaticamente (por contraste de tinta, sin IA ni backend) que dias tienen algo escrito. Despues, un asistente rapido pregunta dia por dia que se escribio ahi y crea las notas/alarmas correspondientes
- Calculadora de fechas: cuantos dias faltan para una fecha especifica, y que dia sera sumando/restando dias, semanas o meses desde hoy
- Foto de recibo con recordatorio automatico de pago: se toma una foto de un recibo, la app lee el texto con OCR gratis en el navegador (Tesseract.js, cargado solo cuando se usa esta funcion, sin backend) y detecta la fecha de compra (formatos numericos DD/MM/YYYY o YYYY-MM-DD). El usuario confirma/corrige la fecha, elige 1 o 2 dias de anticipacion, y la app crea una alarma para recordar pagarlo antes de que se cumpla el mes
- Sincronizacion opcional con Firebase: un boton (icono de nube junto a los demas iconos del encabezado) permite iniciar sesion con Google. Sin iniciar sesion, la app funciona exactamente igual que siempre (100% localStorage, sin cuenta). Al iniciar sesion, las notas y contactos se guardan tambien en Firestore (`users/{uid}/notes`, `users/{uid}/contacts`) y se sincronizan en tiempo real entre dispositivos logueados con la misma cuenta. La primera vez que una cuenta inicia sesion: si no tiene notas en Firestore, sube las locales; si ya tiene, hace merge de las notas locales de este dispositivo con las que ya existen en la cuenta (re-numerando los ids para que no choquen), y los contactos se deduplican por telefono para no crear contactos repetidos

## Limitaciones conocidas

- No hay alarmas con el navegador completamente cerrado (requeriria Firebase Cloud Messaging + Cloud Functions programadas + plan de facturacion Blaze — evaluado pero no implementado, ver seccion de sync de Firebase arriba)
- Ideas pendientes que requieren backend/Firebase (guardadas para el futuro, NO implementar todavia): autocompletado de contactos, compartir notas entre usuarios con permisos, busqueda automatica de telefonos de negocios via Google Places API

## Estilo de diseno

Tema "cielo soleado" con toques tipo iOS: degradado celeste de fondo (`#6FBCEE` a `#EAF6FF`) con la campana radiante decorativa en la esquina superior derecha, pero las tarjetas ahora son blancas solidas (no semi-transparentes) con sombra suave y bordes bien redondeados (20px), botones circulares grises para iconos y botones tipo pildora solida para la accion principal (en vez de texto subrayado). Acento color naranja/ambar (`#D98A1F`), texto principal casi negro (`#1C1C1E`), texto secundario gris (`#5F5F63`, oscurecido desde el `#8E8E93` original para mejor contraste/legibilidad). El dia de hoy en el calendario se resalta con un relleno ambar solido en vez de un borde. Iconos de Tabler Icons via CDN.
