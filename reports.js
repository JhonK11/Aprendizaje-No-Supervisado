/* Informe autónomo: incluye imágenes PNG y permite imprimir a PDF desde el navegador. */
function exportReport() {
    if (!appState.analyses.length) return notifyUser('Ejecuta un análisis antes de exportar el informe.', true);
    switchTab('output'); ChartViews.redraw();
    const copy = $('outputMainContent').cloneNode(true);
    const originals = $('outputMainContent').querySelectorAll('canvas');
    copy.querySelectorAll('canvas').forEach((canvas, i) => {
        const img = document.createElement('img'); img.src = originals[i].toDataURL('image/png'); img.alt = originals[i].getAttribute('aria-label'); canvas.replaceWith(img);
    });
    copy.querySelectorAll('[data-no-report], .chart-hint').forEach(node => node.remove());
    copy.querySelectorAll('details').forEach(node => { node.open = true; });
    const date = new Intl.DateTimeFormat('es-PE', {dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima'}).format(new Date());
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe StatStudio</title>
        <style>body{font:14px system-ui;color:#172033;max-width:1100px;margin:35px auto;padding:0 20px}h1,h2,h3{color:#1e3a8a}article{border-top:2px solid #cbd5e1;margin:30px 0;padding:20px 0}table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12px}th,td{padding:7px;border:1px solid #cbd5e1;text-align:right;overflow-wrap:anywhere}th:first-child,td:first-child{text-align:left}th{background:#f1f5f9}img{max-width:100%;height:auto}p{line-height:1.6}.table-scroll{overflow-x:auto}summary{font-weight:600}button{padding:8px 16px}@media print{button{display:none}thead{display:table-header-group}img,tr{break-inside:avoid}.table-scroll{overflow:visible}body{margin:0;max-width:none;padding:0}}</style></head><body>
        <button onclick="window.print()">Imprimir / Guardar como PDF</button><h1>Informe de análisis · StatStudio UNAP</h1>
        <p>${escapeHTML(appState.datasetName)} · ${escapeHTML(date)} (Lima)</p>
        <h2>Datos originales</h2>${tableHTML(appState.variables.map(v => v.name), appState.data.map(p => [p.id, p.x, p.y]))}
        ${copy.innerHTML}</body></html>`;
    downloadFile(html, 'informe_statstudio.html', 'text/html;charset=utf-8');
    notifyUser('Informe HTML descargado con tablas y gráficos. Ábrelo para imprimirlo o guardarlo como PDF.');
}
