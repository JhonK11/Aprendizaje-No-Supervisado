# StatStudio UNAP

Aplicación educativa de aprendizaje no supervisado. Abre `index.html` en un navegador moderno; no requiere instalación ni servidor. Conserva los siete ejemplos originales del curso.

## Herramientas

- **Bienvenida:** al abrir la aplicación verás Inicio, con un resumen de tu sesión, accesos a las herramientas y ejemplos listos para explorar. Continuar o abrir una vista conserva el proyecto activo.
- **Navegación:** barra lateral para Inicio, Datos, Variables y Resultados; menú desplegable en pantallas pequeñas. El botón Nuevo análisis reúne los tres métodos. La guía de inicio explica el flujo de trabajo y los atajos.
- **Hoja accesible con teclado:** selecciona una celda y usa las flechas para navegar. Enter o F2 inicia la edición; Escape la cancela y Enter confirma. Los valores calculados se mantienen de solo lectura.
- **Importar CSV:** admite comas, punto y coma y tabulaciones. La primera fila debe contener encabezados únicos. Puedes elegir las columnas ID, X e Y o generar los ID. Con punto y coma/tabulación se permite coma decimal. Los datos incompletos o inválidos se rechazan antes de modificar la hoja.
- **Guardar / Abrir proyecto:** descarga o abre un JSON con datos originales, metadatos, escalado y parámetros de los análisis. Los resultados se recalculan al abrir. También se restaura la última sesión desde el almacenamiento local del navegador, si está disponible.
- **Deshacer / Rehacer:** conserva hasta 50 cambios en datos y configuración durante la sesión. Atajos: Ctrl+Z, Ctrl+Y o Ctrl+Shift+Z. Ctrl+S descarga el proyecto. Dentro de una celda, el navegador conserva sus atajos habituales de edición.
- **Escalado:** sin transformación, Z con desviación poblacional o min–max. Se aplica solo al clustering; la hoja conserva sus valores originales y la detección de outliers usa esos valores. Los resultados documentan los desplazamientos y divisores utilizados.
- **K-Means:** K entre 2 y 10, inicialización automática, observaciones elegidas o coordenadas manuales. Rechaza centros repetidos, recupera grupos vacíos y distingue convergencia de agotamiento del límite de iteraciones.
- **K-Medoids (PAM):** K entre 2 y 10; distancias euclidiana, Manhattan o Minkowski con q ≥ 1. Prueba intercambios con observaciones no seleccionadas hasta que ninguno reduce el costo, con un máximo de 100 iteraciones. Alcanza un óptimo local; no garantiza el óptimo global.
- **Evaluar K:** grafica SSE desde K=1 y silueta desde K=2, hasta K=8 o el máximo válido para los datos. Prueba hasta cinco inicializaciones deterministas y destaca la mayor silueta como orientación.
- **Modo paso a paso:** botones y deslizador para consultar asignaciones, distancias, centros y gráficos por iteración o intercambio. La tabla de resumen y las columnas de la hoja siempre contienen el resultado final. Los gráficos permiten consultar puntos con el cursor.
- **Exportar CSV:** incluye las columnas calculadas del análisis activo; escapa encabezados y valores. Los textos que podrían interpretarse como fórmulas se prefijan con un apóstrofo para abrirlos como texto en hojas de cálculo.
- **Exportar informe:** descarga un HTML independiente con datos, tablas, parámetros y gráficos PNG. Abre el archivo y usa **Imprimir / Guardar como PDF**. Los gráficos del modo paso a paso corresponden al paso que estabas consultando.

Al modificar datos, etiquetas o escalado se eliminan los análisis anteriores y las columnas calculadas. Así se evita presentar resultados que ya no corresponden a la hoja. Deshacer recupera datos y configuración, y requiere ejecutar nuevamente el análisis.

## Límites y criterios

Hasta 1000 observaciones por CSV/proyecto; 250 para PAM y comparaciones; 400 para evaluar K. Archivos de hasta 5 MB. Se mantienen los últimos 20 análisis. La matriz de distancias completa de PAM se muestra hasta 40 observaciones.

La silueta de una observación aislada es 0. La media no se define si existe un solo grupo o si cada observación forma su propio grupo. Los cuartiles usan interpolación lineal sobre `(N - 1) × p`. Las columnas constantes quedan en cero al escalar. Las comparaciones distinguen SSE de K-Means de la suma de distancias J de PAM.

Los datos se procesan en el navegador. La interfaz usa estilos, iconos SVG y fuentes de sistema locales; no requiere servicios externos. Respeta la preferencia de movimiento reducido y adapta su navegación a móviles. La ilustración de la bienvenida es decorativa y no representa los datos activos.

## Organización

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Estructura y controles |
| `styles.css` | Estilos propios y adaptación de pantalla |
| `utilities.css` | Utilidades de presentación locales, sin dependencia de Tailwind CDN |
| `datasets.js` | Ejemplos del curso |
| `algorithms.js` | Motor numérico independiente de la interfaz |
| `files.js` | CSV y validación de números |
| `data.js` | Datos, historial, importaciones, proyectos y autoguardado |
| `charts.js` | Gráficos Canvas, tamaño adaptable y consulta de puntos |
| `ui.js` | Hoja editable, metadatos y diálogos |
| `analyses.js` | Análisis, resultados y navegación de iteraciones |
| `reports.js` | Informe descargable |
| `shell.js` | Bienvenida, navegación móvil, biblioteca de ejemplos y guía |
| `script.js` | Inicialización y eventos |

Se usan scripts clásicos en orden de dependencia para permitir abrir la aplicación directamente como archivo local.

## Verificación

Con Node.js:

```text
node --test tests/algorithms.test.js
node tests/browser-smoke.cjs
```

La prueba de navegador usa Edge en Windows y un perfil temporal independiente. Puedes indicar otro ejecutable Chromium mediante `BROWSER_PATH`. No requiere paquetes npm. Por defecto bloquea servicios externos para verificar la funcionalidad local.
