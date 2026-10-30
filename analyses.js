/* Coordinación de algoritmos, tablas de resultados y aprendizaje paso a paso. */
function computeAnalysis(kind, input = {}, state = appState) {
    if (!['kmeans', 'kmedoids', 'outliers', 'evaluation', 'comparison'].includes(kind)) throw new Error('Tipo de análisis desconocido.');
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Parámetros inválidos.');
    const options = {}, scaled = Stats.transform(state.data, state.scaling);
    let result;
    if (kind === 'outliers') {
        Object.assign(options, {varKey: input.varKey ?? 'x', zThreshold: input.zThreshold ?? 2, stdType: input.stdType ?? 'pop'});
        result = Stats.outliers(state.data, options);
    } else if (kind === 'evaluation') {
        options.maxK = input.maxK ?? 8;
        if (!Number.isInteger(options.maxK) || options.maxK < 2 || options.maxK > 10) throw new Error('El máximo de K debe estar entre 2 y 10.');
        result = Stats.evaluateK(scaled.points, options.maxK);
    } else if (kind === 'comparison') {
        const km = Stats.kmeans(scaled.points), pam = Stats.pam(scaled.points);
        result = {km: {...km, silhouette: Stats.silhouette(scaled.points, km.labels)}, pam};
    } else {
        options.k = input.k ?? 2;
        if (input.indices !== undefined) {
            if (!Array.isArray(input.indices) || input.indices.length !== options.k || input.indices.some(i => !Number.isInteger(i) || i < 0 || i >= state.data.length) || new Set(input.indices).size !== options.k) throw new Error('Selecciona K observaciones iniciales distintas.');
            options.indices = [...input.indices];
        }
        if (kind === 'kmeans') {
            if (input.customC !== undefined) {
                if (!Array.isArray(input.customC) || input.customC.length !== options.k || input.customC.some(p => !p || ![p.x, p.y].every(Number.isFinite))) throw new Error('Coordenadas iniciales incompletas.');
                options.customC = input.customC.map(({x, y}) => ({x, y}));
            }
            const initial = options.customC ? options.customC.map(scaled.apply) : options.indices?.map(i => scaled.points[i]);
            result = Stats.kmeans(scaled.points, {k: options.k, initial});
            result.silhouette = Stats.silhouette(scaled.points, result.labels);
        } else {
            options.metric = input.metric ?? 'euclidean'; options.q = input.q ?? 3;
            result = Stats.pam(scaled.points, options);
        }
    }
    return {kind, options, result, points: kind === 'outliers' ? state.data.map(({id, x, y}) => ({id, x, y})) : scaled.points,
        scaling: kind === 'outliers' ? 'none' : state.scaling, parameters: scaled.parameters, stepIndex: 0};
}
function setComputedColumns(analysis) {
    const {kind, result, points} = analysis;
    appState.data = appState.data.map(({id, x, y}) => ({id, x, y}));
    if (kind === 'outliers') {
        appState.computedColumns = [{key: 'out_z', title: 'Z-Score'}, {key: 'out_iqr', title: 'Atípico IQR'}, {key: 'out_zflag', title: 'Atípico Z'}];
        appState.data.forEach((p, i) => Object.assign(p, {out_z: result.rows[i].z, out_iqr: result.rows[i].iqr ? 'Sí' : 'No', out_zflag: result.rows[i].zFlag ? 'Sí' : 'No', _isOutlier: result.rows[i].iqr || result.rows[i].zFlag}));
    } else if (kind === 'kmeans' || kind === 'kmedoids') {
        const prefix = kind === 'kmeans' ? 'km' : 'pam';
        appState.computedColumns = [{key: `${prefix}_group`, title: 'Grupo final'}, ...result.centers.map((_, c) => ({key: `${prefix}_d${c}`, title: `Distancia ${c + 1}`, subtitle: scalingLabel(analysis.scaling)})), {key: `${prefix}_sil`, title: 'Silueta'}];
        appState.data.forEach((p, i) => {
            p[`${prefix}_group`] = result.labels[i] + 1; p[`${prefix}_sil`] = result.silhouette.average === null ? 'No definida' : result.silhouette.scores[i];
            result.centers.forEach((center, c) => { p[`${prefix}_d${c}`] = Stats.distance(points[i], center, analysis.options.metric ?? 'euclidean', analysis.options.q ?? 3); });
        });
    } else appState.computedColumns = [];
    if (!['id', 'x', 'y', ...appState.computedColumns.map(c => c.key)].includes(appState.selectedColKey)) appState.selectedColKey = 'x';
    renderDataGrid();
}
function registerAnalysis(analysis, switchView = true) {
    analysis.id = `analysis_${++registerAnalysis.sequence}`;
    appState.analyses.push(analysis);
    if (appState.analyses.length > 20) appState.analyses.shift();
    appState.stale = false; setComputedColumns(analysis); renderOutputs();
    if (typeof updateWelcome === 'function') updateWelcome();
    $('analysisStatus').textContent = 'Resultados actualizados. Al editar los datos se eliminarán para evitar resultados desactualizados.';
    if (switchView) switchTab('output');
    autosave(); return analysis;
}
registerAnalysis.sequence = 0;
function executeKMeans(options = {}) { return registerAnalysis(computeAnalysis('kmeans', options), options.switchView !== false); }
function executeKMedoids(options = {}) { return registerAnalysis(computeAnalysis('kmedoids', options), options.switchView !== false); }
function executeOutlierAnalysis(options = {}) { return registerAnalysis(computeAnalysis('outliers', options), options.switchView !== false); }
function runComparisonKMeansVsKMedoids() {
    try { registerAnalysis(computeAnalysis('comparison')); } catch (error) { notifyUser(error.message, true); }
}
function runKEvaluation() {
    const button = $('evaluateKButton'); button.disabled = true;
    $('analysisStatus').textContent = 'Evaluando K…';
    setTimeout(() => {
        try { registerAnalysis(computeAnalysis('evaluation')); }
        catch (error) { notifyUser(error.message, true); $('analysisStatus').textContent = 'Evaluación no completada. Revisa los datos y el tamaño del conjunto.'; }
        finally { button.disabled = false; }
    }, 30);
}
function clearOutputViewer(silent = false, persist = true) {
    ChartViews.clear(); appState.analyses = []; appState.outputBlocks = [];
    $('outputMainContent').innerHTML = '<div class="empty-output"><svg class="icon" aria-hidden="true"><use href="#i-chart"/></svg><h3>Tu próximo hallazgo empieza aquí.</h3><p>Ejecuta un análisis para descubrir patrones y recorrer sus resultados.</p><button class="button button-primary" onclick="openAnalysisPicker()">Crear un análisis</button></div>';
    $('outputOutlineTree').textContent = 'Sin resultados activos'; $('outputCountBadge').textContent = '0';
    if (typeof updateWelcome === 'function') updateWelcome();
    if (persist) autosave();
    if (!silent) switchTab('data');
}
function analysisTitle(analysis) { return ({kmeans: 'Clustering K-Means', kmedoids: 'Clustering K-Medoids · PAM', outliers: 'Detección de outliers', evaluation: 'Elegir K · Codo y silueta', comparison: 'Comparación K-Means y PAM'})[analysis.kind]; }
function convergenceText(result) { return result.converged ? 'Proceso estabilizado (óptimo local)' : 'Se alcanzó el límite de 100 iteraciones; no se confirmó convergencia'; }
function clusterSummary(result, points, kind) {
    return `<p><strong>${escapeHTML(convergenceText(result))}.</strong> ${kind === 'kmeans' ? result.steps.length + ' iteraciones' : result.steps.length - 1 + ' intercambios aceptados'}. Costo ${kind === 'kmeans' ? 'SSE (distancias al cuadrado)' : 'J (suma de distancias)'}: <strong>${escapeHTML(formatNumber(result.cost))}</strong> · Silueta media: <strong>${escapeHTML(formatNumber(result.silhouette.average))}</strong>.</p>
        ${tableHTML(['Grupo', 'N', kind === 'kmeans' ? 'Centroide (X, Y)' : 'Medoide (ID, X, Y)', 'Observaciones'], result.centers.map((center, c) => [c + 1, result.labels.filter(label => label === c).length,
            `${center.id ? center.id + ': ' : ''}(${formatNumber(center.x)}, ${formatNumber(center.y)})`, points.filter((_, i) => result.labels[i] === c).map(p => p.id).join(', ')]), 'Resultado final')}`;
}
function renderOutputs() {
    ChartViews.clear();
    const reversed = [...appState.analyses].reverse();
    $('outputCountBadge').textContent = reversed.length;
    $('outputOutlineTree').innerHTML = reversed.map(a => `<button data-scroll="${a.id}" class="outline-button">${escapeHTML(analysisTitle(a))}</button>`).join('');
    $('outputMainContent').innerHTML = reversed.map(a => {
        const header = `<article id="${a.id}" class="analysis-card"><h2>${escapeHTML(analysisTitle(a))}</h2><p class="analysis-meta">${escapeHTML(appState.datasetName)} · N=${a.points.length} · ${escapeHTML(scalingLabel(a.scaling))}</p>`;
        let content = '';
        if (['kmeans', 'kmedoids'].includes(a.kind)) {
            content = clusterSummary(a.result, a.points, a.kind) + `<div class="learning-controls" data-no-report>
                <strong>Explorar el proceso</strong><button data-step="-1" data-analysis="${a.id}">← Anterior</button><span id="${a.id}_position"></span><button data-step="1" data-analysis="${a.id}">Siguiente →</button>
                <label>Ir al paso <input type="range" min="0" max="${a.result.steps.length - 1}" value="${a.stepIndex}" data-analysis="${a.id}" aria-label="Paso del algoritmo"></label></div>
                <div id="${a.id}_step"></div><canvas id="${a.id}_chart" role="img" aria-label="Dispersión de grupos; los valores también están en las tablas"></canvas>
                <p class="chart-hint">Pasa el cursor sobre un punto para consultar sus valores. Las cruces rojas representan los centros.</p>`;
            if (a.kind === 'kmedoids') {
                content += `<details><summary>Historial de intercambios y costo J</summary>${tableHTML(['Paso', 'Sale', 'Entra', 'Costo J'], a.result.steps.map((step, i) => [i, step.swap?.from ?? 'Inicial', step.swap?.to ?? 'Inicial', step.cost]))}</details>`;
                if (a.points.length <= 40) content += `<details><summary>Matriz de distancias entre observaciones</summary>${tableHTML(['ID', ...a.points.map(p => p.id)], a.points.map(p => [p.id, ...a.points.map(o => Stats.distance(p, o, a.options.metric, a.options.q))]))}</details>`;
                else content += '<p class="analysis-meta">La matriz completa de distancias se muestra para conjuntos de hasta 40 observaciones.</p>';
            }
        } else if (a.kind === 'outliers') {
            const r = a.result;
            content = `<p>Variable: <strong>${escapeHTML(appState.variables.find(v => v.key === a.options.varKey).label)}</strong> · |Z| &gt; ${a.options.zThreshold} · Desviación ${a.options.stdType === 'samp' ? 'muestral' : 'poblacional'}. Se marca como atípico si cumple IQR o Z.</p>
                ${tableHTML(['Media', 'Desviación', 'Q1', 'Mediana', 'Q3', 'IQR', 'Límite inferior', 'Límite superior'], [[r.mean, r.std, r.q1, r.median, r.q3, r.q3 - r.q1, r.lower, r.upper]])}
                <p>Cuartiles por interpolación lineal sobre (N − 1) × p. Con desviación cero se muestra Z = 0.</p>
                <canvas id="${a.id}_chart" role="img" aria-label="Diagrama de caja y observaciones"></canvas>
                ${tableHTML(['ID', 'Valor original', 'Z', 'Atípico IQR', 'Atípico Z'], r.rows.map(row => [row.id, row.value, row.z, row.iqr ? 'Sí' : 'No', row.zFlag ? 'Sí' : 'No']))}`;
        } else if (a.kind === 'evaluation') {
            const best = a.result.filter(r => r.silhouette !== null).reduce((best, row) => !best || row.silhouette > best.silhouette ? row : best, null);
            content = `<p>Se prueban hasta 5 inicializaciones deterministas por K y se conserva la menor SSE. Busca un cambio de pendiente en el codo y considera también el contexto de los datos.</p>
                <p>${best ? `Mayor silueta entre los valores probados: <strong>K = ${best.k}</strong> (${formatNumber(best.silhouette)}). Es una guía para elegir K.` : 'No hay una silueta definida para estos datos.'}</p>
                <canvas id="${a.id}_elbow" role="img" aria-label="Método del codo: K y SSE"></canvas><canvas id="${a.id}_sil" role="img" aria-label="Silueta media para cada K"></canvas>
                ${tableHTML(['K', 'SSE', 'Silueta media', 'Convergencia'], a.result.map(r => [r.k, r.cost, r.silhouette, r.converged ? 'Sí' : 'No']))}`;
        } else {
            content = '<p>Se ejecutan ambos algoritmos hasta estabilizarse o alcanzar su límite, con la misma inicialización automática y el mismo escalado. Sus costos usan criterios diferentes y no se comparan directamente.</p>';
            for (const [key, kind, label] of [['km', 'kmeans', 'K-Means'], ['pam', 'kmedoids', 'PAM']]) content += `<h3>${label}</h3>` + clusterSummary(a.result[key], a.points, kind) + `<canvas id="${a.id}_${key}" role="img" aria-label="Grupos de ${label}"></canvas>`;
            content += '<p>La diferencia entre un promedio y un medoide por sí sola no demuestra que exista un outlier. Revisa también la dispersión, la silueta y los valores atípicos.</p>';
        }
        const parameters = Object.entries(a.parameters).map(([key, p]) => [key.toUpperCase(), p.offset, p.scale]);
        return header + content + (a.scaling !== 'none' ? `<details><summary>Escalado: (valor − desplazamiento) / divisor</summary>${tableHTML(['Variable', 'Desplazamiento', 'Divisor'], parameters)}<p>Las columnas constantes usan divisor 1 y quedan en cero.</p></details>` : '') + '</article>';
    }).join('');
    reversed.forEach(a => {
        if (['kmeans', 'kmedoids'].includes(a.kind)) updateAnalysisStep(a);
        else if (a.kind === 'outliers') ChartViews.mount($(`${a.id}_chart`), 'boxplot', {result: a.result});
        else if (a.kind === 'evaluation') {
            ChartViews.mount($(`${a.id}_elbow`), 'line', {rows: a.result, key: 'cost', label: 'SSE'});
            const valid = a.result.filter(r => r.silhouette !== null);
            if (valid.length) ChartViews.mount($(`${a.id}_sil`), 'line', {rows: valid, key: 'silhouette', label: 'Silueta media'});
        } else for (const key of ['km', 'pam']) mountScatter($(`${a.id}_${key}`), a, a.result[key]);
    });
}
function mountScatter(canvas, analysis, step) {
    ChartViews.mount(canvas, 'scatter', {points: analysis.points, centers: step.centers, labels: step.labels,
        xLabel: appState.variables[1].label + (analysis.scaling !== 'none' ? ' (escalada)' : ''),
        yLabel: appState.variables[2].label + (analysis.scaling !== 'none' ? ' (escalada)' : ''), centerType: analysis.kind === 'kmeans' ? 'Centroide' : 'Centro'});
}
function updateAnalysisStep(a) {
    const step = a.result.steps[a.stepIndex], first = a.kind === 'kmedoids' && a.stepIndex === 0;
    $(`${a.id}_position`).textContent = `${a.stepIndex + 1} / ${a.result.steps.length}`;
    const card = $(a.id);
    card.querySelector('[data-step="-1"]').disabled = a.stepIndex === 0;
    card.querySelector('[data-step="1"]').disabled = a.stepIndex === a.result.steps.length - 1;
    card.querySelector('input[type="range"]').value = a.stepIndex;
    const centers = step.before ?? step.centers;
    const headings = ['ID', 'X', 'Y', ...centers.map((_, i) => `Dist. ${i + 1}`), 'Grupo'];
    const rows = a.points.map((p, i) => [p.id, p.x, p.y, ...centers.map(c => Stats.distance(p, c, a.options.metric ?? 'euclidean', a.options.q ?? 3)), step.labels[i] + 1]);
    $(`${a.id}_step`).innerHTML = `<h3>${a.kind === 'kmeans' ? `Iteración ${a.stepIndex + 1}: asignar y actualizar` : first ? 'Inicialización: asignación a medoides' : `Intercambio ${a.stepIndex}: ${escapeHTML(step.swap.from)} → ${escapeHTML(step.swap.to)}`}</h3>
        <p>Costo de este paso: ${escapeHTML(formatNumber(step.cost))}.${step.recovered ? ` Se recuperaron ${step.recovered} grupos vacíos moviendo puntos alejados; sus asignaciones pueden diferir del mínimo de la tabla.` : ''}</p>
        ${a.kind === 'kmeans' ? tableHTML(['Centro', 'Antes X', 'Antes Y', 'Después X', 'Después Y'], step.centers.map((c, i) => [i + 1, step.before[i].x, step.before[i].y, c.x, c.y]), 'Actualización: el nuevo centro es el promedio de su grupo') : ''}
        <details><summary>Asignaciones y distancias de este paso${a.kind === 'kmeans' ? ' a los centros anteriores' : ''}</summary>${tableHTML(headings, rows)}</details>
        <p class="chart-hint">Gráfico del paso ${a.stepIndex + 1}: grupos asignados y centros ${a.kind === 'kmeans' ? 'después de actualizar' : 'actuales'}. El resumen superior y la hoja de datos contienen el resultado final.</p>`;
    mountScatter($(`${a.id}_chart`), a, step);
}
