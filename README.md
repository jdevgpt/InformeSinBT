# Informes instalación sin BT

Webapp para crear proyectos, líneas y CD/PT, y generar el Word
`INFORME INSTALACION SIN BT - <CD/PT>.docx` a partir de `plantilla.docx`, con la foto, el nombre del técnico y su firma.

## Publicar en GitHub Pages
1. Crea un repositorio nuevo en GitHub y sube **todo el contenido de esta carpeta** (con las carpetas tal cual).
2. En el repositorio: Settings > Pages > Source: "Deploy from a branch" > rama `main`, carpeta `/ (root)` > Save.
3. En un minuto aparece la dirección `https://TU-USUARIO.github.io/NOMBRE-REPO/`. Ábrela en el móvil u ordenador y, si quieres, "Añadir a pantalla de inicio".

## Primer uso: técnico y firma
Al abrir la app por primera vez aparece "Configurar técnico":
- **Tratamiento y nombre** (D. / Dña. + nombre y apellidos): salen al principio del informe y junto a la firma.
- **Firma**: se dibuja con el dedo o el ratón, o se sube una imagen (foto o escaneo sobre papel blanco; el fondo se quita solo).
Se guardan en el navegador de cada persona y se usan en todos sus informes, de un trabajo a otro. Se pueden cambiar cuando se quiera desde la tarjeta "Técnico" de la pantalla de inicio.
Sin firma guardada, el Word sale con el hueco en blanco para firmar a mano.

## Uso
Proyecto > Línea > CD/PT (nombre único dentro del proyecto) > fecha de revisión, dirección, término municipal y foto > Generar Word.
En la línea o el proyecto se puede descargar un ZIP con todos los informes completos.

## Datos
Se guardan en el navegador del dispositivo (si se borran los datos del sitio, se pierden). Usa "Exportar copia" (pantalla de inicio) para guardar un .json de los proyectos y "Importar copia" para recuperarlo.
El nombre y la firma del técnico **no** van en esa copia: se configuran en cada navegador.

## Dirección automática desde la base de datos de centros
Al escribir el número del CD/PT, la dirección se rellena sola con la de `datos/centros.json` (número > dirección, sin distinguir mayúsculas ni espacios).
Sigue siendo editable: lo que corrijas a mano no se vuelve a sobrescribir, y debajo aparece la dirección de la base de datos con el botón "Usar esta" por si quieres recuperarla.
Si el número no está o no tiene dirección en la base de datos, el campo queda vacío.

Para actualizar la base de datos con un Excel nuevo (con las columnas `DENOM` e `INDIRIZZO`):
`python herramientas/convertir_centros.py "archivo.xlsx"` (necesita Python y `pip install openpyxl`) y sube el `datos/centros.json` resultante.
Ojo: si el repositorio es público, esa base de datos la puede leer cualquiera que tenga el enlace.

## Cambiar el modelo de Word
Edita `plantilla.docx` en Word manteniendo estos marcadores tal cual:
`{{FECHA}}`, `{{CODIGO}}`, `{{DIRECCION}}`, `{{MUNICIPIO}}`, `{{TRATAMIENTO}}`, `{{TECNICO}}`,
la imagen "INSERTAR IMAGEN" (se sustituye por la foto) y la imagen transparente de la firma (se sustituye por la firma del técnico).
Es mejor escribir cada marcador de una sola vez, sin cambiar el formato a mitad, para que Word no lo parta.
"Badajoz" está fijo en el texto de la plantilla.
