/* Interfaz: los textos editables siempre se escapan antes de insertarse. */
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const formatNumber = value => value === null || value === undefined ? 'No definida' : typeof value === 'number'
    ? (Math.abs(value) >= 1e6 || (value !== 0 && Math.abs(value) < .0001) ? value.toExponential(4) : Number(value.toFixed(4)).toString()) : String(value);
const scalingLabel = mode => ({none: 'Sin escalado', zscore: 'Estandarización Z (desviación poblacional)', minmax: 'Normalización min–max [0, 1]'})[mode];
function notifyUser(message, error = false) {
    const element = $('notice'); element.textContent = message; element.hidden = false;
    element.classList.toggle('error', error);
    clearTimeout(notifyUser.timer); notifyUser.timer = setTimeout(() => { element.hidden = true; }, error ? 10000 : 5000);
}
function tableHTML(headers, rows, caption = '') {
    return `<div class="table-scroll"><table class="spss-table">${caption ? `<caption>${escapeHTML(caption)}</caption>` : ''}
        <thead><tr>${headers.map(h => `<th scope="col">${escapeHTML(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escapeHTML(formatNumber(value))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function columnLetter(index) {
    let value = index + 1, result = '';
    while (value) { value--; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
    return result;
}
function renderDataGrid() {
    const columns = [...appState.variables.map(v => ({key: v.key, title: v.name, subtitle: v.label})), ...appState.computedColumns];
    $('dataGridHead').innerHTML = `<tr><th scope="col">#</th>${columns.map((c, i) => `<th scope="col" class="min-w-[135px]"><div class="text-slate-400 text-[10px]">${columnLetter(i)}</div><div>${escapeHTML(c.title)}</div><div class="text-slate-500 text-[10px] font-normal">${escapeHTML(c.subtitle || '')}</div></th>`).join('')}</tr>`;
    let html = '';
    for (let i = 0; i < Math.max(18, appState.data.length + 3); i++) {
        const row = appState.data[i];
        html += `<tr class="${row?._isOutlier ? 'outlier-row' : ''}"><th scope="row" class="row-num">${i + 1}</th>`;
        html += columns.map((c, j) => `<td data-row="${i}" data-col="${j}" tabindex="${row && i === appState.selectedRowIndex && c.key === appState.selectedColKey ? '0' : '-1'}" class="${j > 2 ? 'computed-col' : ''} ${i === appState.selectedRowIndex && c.key === appState.selectedColKey ? 'active-cell' : ''} ${j ? 'text-right mono-num' : 'text-center font-semibold'}">${row ? escapeHTML(formatNumber(row[c.key] ?? '')) : ''}</td>`).join('') + '</tr>';
    }
    $('dataGridBody').innerHTML = html; syncFormulaBar();
}
function selectCell(rowIndex, key) {
    if (!appState.data[rowIndex]) { if (rowIndex === appState.data.length) addRow(); return; }
    appState.selectedRowIndex = rowIndex; appState.selectedColKey = key;
    document.querySelectorAll('#dataGridBody .active-cell').forEach(cell => { cell.classList.remove('active-cell'); cell.tabIndex = -1; });
    const keys = ['id', 'x', 'y', ...appState.computedColumns.map(c => c.key)];
    const selectedCell = document.querySelector(`#dataGridBody [data-row="${rowIndex}"][data-col="${keys.indexOf(key)}"]`);
    selectedCell?.classList.add('active-cell');
    if (selectedCell) selectedCell.tabIndex = 0;
    syncFormulaBar();
}
function syncFormulaBar() {
    const key = appState.selectedColKey, keys = ['id', 'x', 'y', ...appState.computedColumns.map(c => c.key)];
    $('cellCoordBox').textContent = `${columnLetter(Math.max(0, keys.indexOf(key)))}${appState.selectedRowIndex + 1}`;
    $('formulaInput').value = appState.data[appState.selectedRowIndex]?.[key] ?? '';
    $('formulaInput').readOnly = !['id', 'x', 'y'].includes(key);
}
function startInlineEdit(cell, rowIndex, key) {
    if (!['id', 'x', 'y'].includes(key) || !appState.data[rowIndex] || cell.querySelector('input')) return;
    selectCell(rowIndex, key);
    const input = document.createElement('input'); input.type = 'text'; input.className = 'cell-editor';
    if (key !== 'id') input.inputMode = 'decimal';
    input.value = appState.data[rowIndex][key]; input.setAttribute('aria-label', `Editar ${key}, fila ${rowIndex + 1}`);
    cell.replaceChildren(input); input.focus(); input.select();
    let finished = false;
    const commit = (focusCell = false) => {
        if (finished) return;
        finished = true; updateCell(rowIndex, key, input.value);
        if (focusCell) document.querySelector('#dataGridBody .active-cell')?.focus();
    };
    input.addEventListener('blur', () => commit());
    input.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key === 'Enter') { event.preventDefault(); commit(true); }
        if (event.key === 'Escape') { finished = true; renderDataGrid(); document.querySelector('#dataGridBody .active-cell')?.focus(); }
    });
}
function renderVariableView() {
    $('variableViewBody').innerHTML = appState.variables.map((v, i) => `<tr><td class="p-2.5">${i + 1}</td>
        <td class="p-2.5"><input aria-label="Nombre variable ${i + 1}" data-variable="${i}" data-field="name" value="${escapeHTML(v.name)}" class="metadata-input"></td>
        <td>${escapeHTML(v.type)}</td><td>${v.decimals}</td>
        <td class="p-2.5"><input aria-label="Etiqueta variable ${i + 1}" data-variable="${i}" data-field="label" value="${escapeHTML(v.label)}" class="metadata-input"></td>
        <td>${escapeHTML(v.measure)}</td><td>${escapeHTML(v.role)}</td></tr>`).join('');
}
function updateStatusBar() {
    $('statN').textContent = appState.data.length;
    for (const key of ['x', 'y']) $('statMean' + key.toUpperCase()).textContent = formatNumber(appState.data.reduce((s, p) => s + p[key], 0) / (appState.data.length || 1));
    $('undoButton').disabled = !editHistory.past.length; $('redoButton').disabled = !editHistory.future.length;
}
function renderAll() {
    renderDataGrid(); renderVariableView(); updateStatusBar();
    $('activeDatasetBadge').textContent = `Dataset: ${appState.datasetName}`;
    $('presetSelect').value = appState.activePreset; $('scalingSelect').value = appState.scaling;
    $('saveStatus').textContent = storageAvailable ? 'Autoguardado local activo' : 'Autoguardado no disponible; usa Guardar proyecto';
    if (typeof updateWelcome === 'function') updateWelcome();
}
function switchTab(tab) {
    if (!['home', 'data', 'variables', 'output'].includes(tab)) return;
    appState.currentTab = tab;
    for (const name of ['home', 'data', 'variables', 'output']) {
        $(`view-${name}`).classList.toggle('hidden', name !== tab); $(`tab-btn-${name}`).classList.toggle('active', name === tab);
        if (name === tab) $(`tab-btn-${name}`).setAttribute('aria-current', 'page');
        else $(`tab-btn-${name}`).removeAttribute('aria-current');
    }
    $('currentPageLabel').textContent = ({home: 'Inicio', data: 'Vista de datos', variables: 'Variables', output: 'Resultados'})[tab];
    if (typeof toggleNavigation === 'function') toggleNavigation(false);
    if (tab === 'home' && typeof updateWelcome === 'function') updateWelcome();
    $('formulaBar').classList.toggle('hidden', tab !== 'data');
    if (tab === 'output') requestAnimationFrame(ChartViews.redraw);
}
let modalPreviousFocus = null;
function showModal(title, content, run, buttonText = 'Ejecutar análisis') {
    if ($('configModal').classList.contains('hidden')) modalPreviousFocus = document.activeElement;
    $('modalTitle').textContent = title; $('modalBody').innerHTML = content + '<p id="modalError" role="alert" class="modal-error" hidden></p>';
    $('modalRunBtn').textContent = buttonText; $('modalRunBtn').onclick = run;
    $('configModal').classList.remove('hidden'); $('configModal').classList.add('flex');
    $('modalBody').querySelector('select, input, button')?.focus();
}
function closeConfigModal() { $('configModal').classList.add('hidden'); $('configModal').classList.remove('flex'); modalPreviousFocus?.focus(); }
function modalError(message) { $('modalError').textContent = message; $('modalError').hidden = false; }
function field(label, id, content, type = 'select') {
    return `<label class="config-field" for="${id}"><span>${escapeHTML(label)}</span>${type === 'select' ? `<select id="${id}">${content}</select>` : `<input id="${id}" ${content}>`}</label>`;
}
function openConfigModal(kind) {
    if (kind === 'outliers') {
        showModal('Detección de outliers · IQR y Z-Score', `<p>Se usan los datos originales. Cuartiles por interpolación lineal y límites de Tukey de 1.5 × IQR.</p>
            ${field('Variable', 'cfgOutlierVar', appState.variables.slice(1).map(v => `<option value="${v.key}">${escapeHTML(v.name)} — ${escapeHTML(v.label)}</option>`).join(''))}
            ${field('Umbral |Z|', 'cfgZThreshold', '<option value="2">Mayor que 2</option><option value="3">Mayor que 3</option>')}
            ${field('Desviación estándar', 'cfgStdType', '<option value="pop">Poblacional (N)</option><option value="samp">Muestral (N − 1)</option>')}`, () => {
                try { executeOutlierAnalysis({varKey: $('cfgOutlierVar').value, zThreshold: Number($('cfgZThreshold').value), stdType: $('cfgStdType').value}); closeConfigModal(); }
                catch (error) { modalError(error.message); }
            });
        return;
    }
    const isPAM = kind === 'kmedoids', max = Math.min(10, appState.data.length);
    showModal(isPAM ? 'K-Medoids · PAM con intercambios' : 'K-Means · Asignar y actualizar', `
        <p>${isPAM ? 'PAM prueba intercambios entre medoides y otras observaciones hasta que ningún intercambio reduce el costo (óptimo local).' : 'K-Means asigna puntos al centro más cercano y recalcula promedios hasta estabilizarse. Los grupos vacíos se recuperan.'}</p>
        <p><strong>Escalado:</strong> ${escapeHTML(scalingLabel(appState.scaling))}. Las coordenadas manuales se ingresan en la escala original.</p>
        ${field('Número de grupos K', 'cfgK', Array.from({length: max - 1}, (_, i) => `<option value="${i + 2}">${i + 2}</option>`).join(''))}
        ${field('Inicialización', 'cfgInit', `<option value="auto">Automática (puntos alejados)</option><option value="obs">Elegir observaciones</option>${isPAM ? '' : '<option value="custom">Coordenadas manuales</option>'}`)}
        <div id="initialCenters"></div>
        ${isPAM ? field('Distancia', 'cfgMetric', '<option value="euclidean">Euclidiana</option><option value="manhattan">Manhattan</option><option value="minkowski">Minkowski</option>') + field('q de Minkowski (≥ 1)', 'cfgQ', 'type="number" min="1" step="0.5" value="3"', 'input') : ''}
        <p class="text-slate-500">Límite: 100 iteraciones${isPAM ? ', hasta 250 observaciones' : ''}. Los gráficos y las distancias usan el escalado seleccionado.</p>`, () => {
            try {
                const k = Number($('cfgK').value), init = $('cfgInit').value, options = {k};
                if (init === 'obs') options.indices = Array.from({length: k}, (_, i) => Number($(`seed${i}`).value));
                if (init === 'custom') options.customC = Array.from({length: k}, (_, i) => ({x: FileFormats.number($(`seedX${i}`).value), y: FileFormats.number($(`seedY${i}`).value)}));
                if (isPAM) { options.metric = $('cfgMetric').value; options.q = FileFormats.number($('cfgQ').value); }
                (isPAM ? executeKMedoids : executeKMeans)(options); closeConfigModal();
            } catch (error) { modalError(error.message); }
        });
    const update = () => {
        const k = Number($('cfgK').value), mode = $('cfgInit').value;
        if (mode === 'auto') { $('initialCenters').replaceChildren(); return; }
        const seeds = [appState.defaultCentroids.c1Idx, appState.defaultCentroids.c2Idx, appState.defaultCentroids.c3Idx];
        $('initialCenters').innerHTML = Array.from({length: k}, (_, i) => {
            const index = Math.min(seeds[i] ?? i, appState.data.length - 1), p = appState.data[index];
            return mode === 'obs' ? field(`${isPAM ? 'Medoide' : 'Centroide'} ${i + 1}`, `seed${i}`, appState.data.map((r, j) => `<option value="${j}" ${j === index ? 'selected' : ''}>${escapeHTML(r.id)} = (${r.x}, ${r.y})</option>`).join(''))
                : `<div class="coordinate-pair">${field(`C${i + 1} · X`, `seedX${i}`, `type="text" inputmode="decimal" value="${p.x}"`, 'input')}${field(`C${i + 1} · Y`, `seedY${i}`, `type="text" inputmode="decimal" value="${p.y}"`, 'input')}</div>`;
        }).join('');
    };
    $('cfgK').addEventListener('change', update); $('cfgInit').addEventListener('change', update); update();
    if (isPAM) {
        const updateMetric = () => { $('cfgQ').disabled = $('cfgMetric').value !== 'minkowski'; };
        $('cfgMetric').addEventListener('change', updateMetric); updateMetric();
    }
}
function openCSVMapping() {
    const options = pendingCSV.headers.map((h, i) => `<option value="${i}">${escapeHTML(h)}</option>`).join('');
    showModal('Importar CSV · Selecciona las columnas', `<p>${escapeHTML(pendingCSV.name)} · ${pendingCSV.records.length} observaciones. Separador: ${pendingCSV.delimiter === '\t' ? 'tabulación' : escapeHTML(pendingCSV.delimiter)}.</p>
        <p>La primera fila contiene los encabezados. Las filas vacías se omiten; los valores ausentes o inválidos se rechazan.</p>
        ${field('Identificador', 'csvId', '<option value="-1">Generar identificadores</option>' + options)}
        ${field('Variable X', 'csvX', options)}${field('Variable Y', 'csvY', options)}
        ${tableHTML(pendingCSV.headers, pendingCSV.records.slice(0, 5), 'Vista previa: primeras 5 filas')}`, importMappedCSV, 'Importar datos');
    const idIndex = pendingCSV.headers.findIndex(h => /^(id|id_obs|identificador|caso)$/i.test(h));
    $('csvId').value = idIndex;
    const numeric = pendingCSV.headers.map((_, i) => i).filter(i => i !== idIndex);
    $('csvX').value = numeric[0]; $('csvY').value = numeric[1];
}
