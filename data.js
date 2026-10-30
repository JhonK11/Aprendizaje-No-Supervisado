/* Datos originales, historial, persistencia y proyectos. */
const STORAGE_KEY = 'statstudio.project.v1';
const DEFAULT_VARIABLES = [
    {key: 'id', name: 'ID_Obs', type: 'Cadena', decimals: 0, label: 'Identificador', measure: 'Nominal', role: 'ID'},
    {key: 'x', name: 'Var_X', type: 'Numérico', decimals: 2, label: 'Horas de estudio (X)', measure: 'Escala', role: 'Entrada'},
    {key: 'y', name: 'Var_Y', type: 'Numérico', decimals: 2, label: 'Nota promedio (Y)', measure: 'Escala', role: 'Entrada'}
];
let appState = {
    currentTab: 'data', activePreset: 'pdf2_estudiantes', datasetName: '',
    selectedRowIndex: 0, selectedColKey: 'x', variables: structuredClone(DEFAULT_VARIABLES),
    computedColumns: [], data: [], scaling: 'none', analyses: [], outputBlocks: [],
    defaultCentroids: {c1Idx: 0, c2Idx: 3, c3Idx: 5}, stale: false
};
const editHistory = {past: [], future: []};
let storageAvailable = true;
let pendingCSV = null;

function baseSnapshot() {
    return structuredClone({activePreset: appState.activePreset, datasetName: appState.datasetName,
        data: appState.data.map(({id, x, y}) => ({id, x, y})), variables: appState.variables,
        scaling: appState.scaling, defaultCentroids: appState.defaultCentroids});
}
function projectDocument() {
    return {format: 'statstudio', version: 1, ...baseSnapshot(),
        analyses: appState.analyses.map(a => ({kind: a.kind, options: a.options}))};
}
function autosave() {
    if (!storageAvailable) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projectDocument())); }
    catch { storageAvailable = false; document.getElementById('saveStatus').textContent = 'Autoguardado no disponible; usa Guardar proyecto'; }
}
function checkpoint() {
    editHistory.past.push(baseSnapshot());
    if (editHistory.past.length > 50) editHistory.past.shift();
    editHistory.future = [];
}
function invalidateResults(message = 'Datos modificados: vuelve a ejecutar el análisis.') {
    appState.analyses = [];
    appState.computedColumns = [];
    appState.data = appState.data.map(({id, x, y}) => ({id, x, y}));
    if (!['id', 'x', 'y'].includes(appState.selectedColKey)) appState.selectedColKey = 'x';
    appState.stale = true;
    clearOutputViewer(true, false);
    document.getElementById('analysisStatus').textContent = message;
    renderAll();
    autosave();
}
function restoreSnapshot(snapshot) {
    Object.assign(appState, structuredClone(snapshot));
    appState.selectedRowIndex = Math.min(appState.selectedRowIndex, appState.data.length - 1);
    appState.selectedColKey = 'x';
    invalidateResults();
}
function undoEdit() {
    if (!editHistory.past.length) return;
    editHistory.future.push(baseSnapshot());
    restoreSnapshot(editHistory.past.pop());
    notifyUser('Cambio deshecho.');
}
function redoEdit() {
    if (!editHistory.future.length) return;
    editHistory.past.push(baseSnapshot());
    restoreSnapshot(editHistory.future.pop());
    notifyUser('Cambio rehecho.');
}
function changeScaling(mode) {
    if (!['none', 'zscore', 'minmax'].includes(mode) || appState.scaling === mode) return;
    checkpoint(); appState.scaling = mode;
    invalidateResults('Escalado modificado: vuelve a ejecutar el análisis. Los datos originales se conservan.');
}
function loadPreset(key) {
    const preset = PRESET_DATASETS[key];
    if (!preset) return;
    if (appState.data.length) checkpoint();
    appState.activePreset = key; appState.datasetName = preset.badge;
    appState.data = structuredClone(preset.rows);
    appState.variables = structuredClone(DEFAULT_VARIABLES);
    appState.variables[1].label = preset.varXLabel; appState.variables[2].label = preset.varYLabel;
    appState.defaultCentroids = {c1Idx: preset.defaultC1, c2Idx: preset.defaultC2, c3Idx: preset.rows.length - 1};
    appState.selectedRowIndex = 0; appState.selectedColKey = 'x';
    invalidateResults();
    if (key.startsWith('pdf1')) executeOutlierAnalysis({switchView: false});
    else if (key.startsWith('pdf2')) executeKMeans({indices: [preset.defaultC1, preset.defaultC2], switchView: false});
    else executeKMedoids({indices: [preset.defaultC1, preset.defaultC2], switchView: false});
}
function updateCell(rowIndex, key, value) {
    if (!['id', 'x', 'y'].includes(key) || !appState.data[rowIndex]) return;
    try {
        const parsed = key === 'id' ? String(value).trim() : FileFormats.number(value);
        if (key === 'id' && (!parsed || parsed.length > 120 || appState.data.some((r, i) => i !== rowIndex && r.id === parsed))) throw new Error('Usa un ID único de 1 a 120 caracteres.');
        if (appState.data[rowIndex][key] === parsed) { renderDataGrid(); return; }
        checkpoint(); appState.data[rowIndex][key] = parsed; invalidateResults();
    } catch (error) { notifyUser(error.message, true); renderDataGrid(); }
}
function updateCellFromFormulaBar(value) { updateCell(appState.selectedRowIndex, appState.selectedColKey, value); }
function addRow() {
    if (appState.data.length >= 1000) return notifyUser('Se admiten hasta 1000 observaciones.', true);
    checkpoint();
    let n = appState.data.length + 1;
    while (appState.data.some(r => r.id === `Obs_${n}`)) n++;
    appState.data.push({id: `Obs_${n}`, x: 0, y: 0});
    appState.selectedRowIndex = appState.data.length - 1;
    invalidateResults();
}
function deleteSelectedRow() {
    if (appState.data.length <= 2) return notifyUser('Conserva al menos 2 observaciones.', true);
    checkpoint(); appState.data.splice(appState.selectedRowIndex, 1);
    appState.selectedRowIndex = Math.min(appState.selectedRowIndex, appState.data.length - 1);
    invalidateResults();
}
function injectOutlierG() {
    if (appState.data.some(r => r.id === 'G' && r.x === 30 && r.y === 30)) return;
    if (appState.data.length >= 1000) return notifyUser('Se admiten hasta 1000 observaciones.', true);
    checkpoint();
    let id = 'G', suffix = 1;
    while (appState.data.some(r => r.id === id)) id = `G_${suffix++}`;
    appState.data.push({id, x: 30, y: 30}); invalidateResults();
}
function clearComputedColumns() { invalidateResults('Columnas calculadas eliminadas. Ejecuta un análisis para generarlas.'); }
function updateVarMeta(index, field, value) {
    if (!['name', 'label'].includes(field) || !appState.variables[index]) return;
    value = String(value).trim();
    if (!value || value.length > 160 || (field === 'name' && appState.variables.some((v, i) => i !== index && v.name === value))) {
        notifyUser('Usa nombres únicos y textos de 1 a 160 caracteres.', true); renderVariableView(); return;
    }
    if (appState.variables[index][field] === value) return;
    checkpoint(); appState.variables[index][field] = value; invalidateResults();
}
function downloadFile(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCSV() {
    const keys = ['id', 'x', 'y', ...appState.computedColumns.map(c => c.key)];
    const headers = [...appState.variables.map(v => v.name), ...appState.computedColumns.map(c => c.title)];
    downloadFile(FileFormats.csv(headers, appState.data.map(r => keys.map(k => r[k]))), 'datos_statstudio.csv', 'text/csv;charset=utf-8');
}
function saveProject() {
    downloadFile(JSON.stringify(projectDocument(), null, 2), 'proyecto_statstudio.json', 'application/json');
    notifyUser('Proyecto descargado con datos, parámetros y análisis.');
}
function validateProject(input) {
    if (!input || input.format !== 'statstudio' || input.version !== 1) throw new Error('El archivo no es un proyecto StatStudio v1.');
    Stats.validatePoints(input.data);
    if (input.data.some(p => p.id.length > 120)) throw new Error('Los ID admiten hasta 120 caracteres.');
    if (!Array.isArray(input.variables) || input.variables.length !== 3) throw new Error('Metadatos incompletos.');
    const variables = DEFAULT_VARIABLES.map((v, i) => {
        const candidate = input.variables[i];
        if (!candidate || ['name', 'label'].some(k => typeof candidate[k] !== 'string' || !candidate[k].trim() || candidate[k].length > 160)) throw new Error('Metadatos inválidos.');
        return {...v, name: candidate.name.trim(), label: candidate.label.trim()};
    });
    if (new Set(variables.map(v => v.name)).size !== 3) throw new Error('Los nombres de variables deben ser únicos.');
    if (!['none', 'zscore', 'minmax'].includes(input.scaling)) throw new Error('Escalado inválido.');
    if (typeof input.datasetName !== 'string' || input.datasetName.length > 200) throw new Error('Nombre de proyecto inválido.');
    if (!Array.isArray(input.analyses) || input.analyses.length > 20) throw new Error('El proyecto admite hasta 20 análisis.');
    const state = {data: input.data.map(({id, x, y}) => ({id, x, y})), variables, scaling: input.scaling,
        activePreset: Object.hasOwn(PRESET_DATASETS, input.activePreset) ? input.activePreset : 'custom',
        datasetName: input.datasetName, defaultCentroids: {c1Idx: 0, c2Idx: Math.min(3, input.data.length - 1), c3Idx: input.data.length - 1}};
    // Los resultados se recalculan; nunca se carga HTML desde un proyecto.
    const analyses = input.analyses.map(a => computeAnalysis(a.kind, a.options, state));
    return {state, analyses};
}
function openProjectDocument(input, recordHistory = true) {
    const {state, analyses} = validateProject(input);
    if (recordHistory && appState.data.length) checkpoint();
    Object.assign(appState, state, {selectedRowIndex: 0, selectedColKey: 'x'});
    invalidateResults('Proyecto abierto.');
    analyses.forEach(a => registerAnalysis(a, false));
    if (!analyses.length) document.getElementById('analysisStatus').textContent = 'Proyecto abierto; ejecuta un análisis.';
    autosave();
}
async function handleProjectFile(file) {
    if (!file) return;
    try {
        if (file.size > 5_000_000) throw new Error('El proyecto debe ocupar menos de 5 MB.');
        openProjectDocument(JSON.parse(await file.text())); notifyUser('Proyecto abierto y resultados recalculados.');
    } catch (error) { notifyUser(`No se pudo abrir: ${error.message}`, true); }
}
async function handleCSVFile(file) {
    if (!file) return;
    try {
        if (file.size > 5_000_000) throw new Error('El CSV debe ocupar menos de 5 MB.');
        pendingCSV = {...FileFormats.parseCSV(await file.text()), name: file.name.slice(0, 180)};
        openCSVMapping();
    } catch (error) { notifyUser(error.message, true); }
}
function importMappedCSV() {
    try {
        if (!pendingCSV) throw new Error('Selecciona un CSV.');
        const mapping = {id: Number(document.getElementById('csvId').value), x: Number(document.getElementById('csvX').value), y: Number(document.getElementById('csvY').value)};
        const points = FileFormats.mapCSV(pendingCSV, mapping);
        Stats.validatePoints(points);
        if (points.some(p => p.id.length > 120)) throw new Error('Los ID admiten hasta 120 caracteres.');
        if ([mapping.id, mapping.x, mapping.y].filter(i => i >= 0).some(i => pendingCSV.headers[i].length > 160)) throw new Error('Los encabezados admiten hasta 160 caracteres.');
        checkpoint(); appState.data = points; appState.activePreset = 'custom'; appState.datasetName = pendingCSV.name;
        appState.variables = structuredClone(DEFAULT_VARIABLES);
        for (const [index, column] of [[0, mapping.id], [1, mapping.x], [2, mapping.y]]) {
            if (column >= 0) appState.variables[index].name = appState.variables[index].label = pendingCSV.headers[column];
        }
        // Un encabezado de entrada puede coincidir con el ID generado.
        if (mapping.id < 0) { while (appState.variables.slice(1).some(v => v.name === appState.variables[0].name)) appState.variables[0].name += '_ID'; }
        appState.defaultCentroids = {c1Idx: 0, c2Idx: Math.min(3, points.length - 1), c3Idx: points.length - 1};
        appState.selectedRowIndex = 0; appState.selectedColKey = 'x';
        invalidateResults(); closeConfigModal(); switchTab('data'); pendingCSV = null;
        notifyUser(`Se importaron ${points.length} observaciones.`);
    } catch (error) { modalError(error.message); }
}
