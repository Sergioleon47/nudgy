# Nudgy (antes "Mi Alarma")

App PWA de notas/alarmas bilingue (espanol/ingles) que vive en un solo archivo `index.html` (HTML/CSS/JS vanilla, sin frameworks ni build process). Detecta fechas, horas y patrones de recurrencia escritos en lenguaje natural dentro de las notas, y las convierte en alarmas.

## Archivos del proyecto

- `index.html` — toda la app (HTML, CSS y JS en un solo archivo, dentro de una etiqueta `<script>`)
- `manifest.json` — configuracion PWA (nombre, colores, icono)
- `sw.js` — service worker (cache offline + notificaciones con botones de accion)
- `icon.svg` — icono de la app (una campana simple)
- `COMO_PUBLICARLO.md` — instrucciones de publicacion antiguas (ya no se usan)

## Deploy

Repositorio en GitHub (`Sergioleon47/nudgy`), conectado a Netlify (proyecto "nudgyapp"). Se publica automaticamente con `git push`.

## Funciones ya implementadas

- Escribir una nota en texto libre; se guarda tal cual la escribio el usuario (nunca se le quita ni reformatea el texto)
- Deteccion de fecha/hora en espanol e ingles: dias de la semana, "hoy"/"manana", fechas especificas ("15 de agosto", "on the 21st"), rangos ("de lunes a viernes" / "monday to friday"), tiempo relativo ("en 3 dias", "en 2 semanas", "in 30 minutes")
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

## Limitaciones conocidas

- No hay sincronizacion entre dispositivos (todo vive en localStorage de ese navegador)
- No hay cuentas de usuario ni backend
- Ideas pendientes que requieren backend/Firebase (guardadas para el futuro, NO implementar todavia): autocompletado de contactos, compartir notas entre usuarios con permisos, busqueda automatica de telefonos de negocios via Google Places API

## Estilo de diseno

Tema "cielo soleado": degradado celeste de fondo, paneles blancos semi-transparentes, acento color naranja/ambar (`#D98A1F`), texto en azul oscuro (`#274257`). Iconos de Tabler Icons via CDN.
