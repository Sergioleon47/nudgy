# Mi Alarma — como ponerlo en linea (gratis)

Estos 4 archivos son tu app completa: `index.html`, `manifest.json`, `icon.svg`, `sw.js`.

## Opcion mas facil: Netlify Drop (2 minutos, sin cuenta)

1. Ve a https://app.netlify.com/drop
2. Arrastra la carpeta completa `mi-alarma` a la pagina
3. Netlify te da un link publico al instante (algo como `nombre-al-azar.netlify.app`)
4. Abre ese link desde tu celular
5. En Chrome (Android) o Safari (iPhone), usa "Agregar a pantalla de inicio" para que se vea como una app de verdad

## Opcion con cuenta (para poder editarlo despues): GitHub Pages

1. Crea una cuenta gratis en https://github.com si no tienes
2. Crea un repositorio nuevo, sube estos 4 archivos
3. Ve a Settings → Pages → selecciona la rama `main` como fuente
4. En un par de minutos tendras un link tipo `tuusuario.github.io/nombre-repo`

## Que SI funciona una vez publicado

- Tus notas se guardan en el navegador de tu telefono (ya no se borran al cerrar)
- Notificaciones del sistema si le das permiso, mientras el navegador siga corriendo
- Se puede "instalar" como app en la pantalla de inicio (PWA)

## Que sigue sin funcionar (limite real, no de este codigo)

- Si cierras completamente el navegador o reinicias el telefono, las alarmas no sonaran
- Para eso necesitarias una app nativa de verdad (Swift/Kotlin) o un backend con notificaciones push — un proyecto bastante mas grande

## Si quieres seguir editandolo

Todo el codigo esta en `index.html` en JavaScript plano, sin dependencias que instalar. Puedes abrirlo con cualquier editor de texto y modificarlo directamente.
