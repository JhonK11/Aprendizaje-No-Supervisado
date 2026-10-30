/* Bienvenida, navegación y ayudas del laboratorio. Sin dependencias externas. */
function iconHTML(name, className = 'icon') {
    return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}
function updateWelcome() {
    $('welcomeObservations').textContent = appState.data.length;
    $('welcomeVariables').textContent = appState.variables.filter(v => v.role === 'Entrada').length;
    $('welcomeAnalyses').textContent = appState.analyses.length;
    $('welcomeDatasetName').textContent = appState.datasetName;
    $('welcomeDatasetName').title = appState.datasetName;
    $('activeDatasetBadge').title = appState.datasetName;
}
function toggleNavigation(force) {
    const open = force ?? !document.body.classList.contains('sidebar-open');
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    const show = Boolean(open && mobile);
    document.body.classList.toggle('sidebar-open', show);
    $('sidebarBackdrop').hidden = !show;
    $('navigationToggle').setAttribute('aria-expanded', String(show));
    $('navigationToggle').setAttribute('aria-label', show ? 'Cerrar navegación' : 'Abrir navegación');
    document.querySelector('.workspace-shell').inert = show;
    if (show) $('mainSidebar').querySelector('button[aria-current="page"]')?.focus();
    else if (mobile && document.activeElement.closest('#mainSidebar')) $('navigationToggle').focus();
}
function openAnalysisPicker() {
    toggleNavigation(false);
    showModal('¿Qué te gustaría explorar?', `<p>Elige un método para analizar tu conjunto activo: <strong>${escapeHTML(appState.datasetName)}</strong>.</p><div class="picker-options">
        <button class="picker-option" onclick="openConfigModal('outliers')"><span class="method-icon sand">${iconHTML('scan')}</span><span><strong>Detectar outliers</strong><small>Valores atípicos con IQR y Z-Score.</small></span>${iconHTML('arrow')}</button>
        <button class="picker-option" onclick="openConfigModal('kmeans')"><span class="method-icon">${iconHTML('target')}</span><span><strong>K-Means</strong><small>Agrupaciones con centroides promedio.</small></span>${iconHTML('arrow')}</button>
        <button class="picker-option" onclick="openConfigModal('kmedoids')"><span class="method-icon lilac">${iconHTML('gem')}</span><span><strong>K-Medoids · PAM</strong><small>Observaciones reales como representantes.</small></span>${iconHTML('arrow')}</button></div>`, () => { closeConfigModal(); switchTab('data'); }, 'Revisar mis datos');
}
function startExample(key) {
    closeConfigModal(); loadPreset(key); switchTab('data');
}
function openExampleLibrary() {
    toggleNavigation(false);
    const entries = [
        ['pdf1_edades', 'Edades de estudiantes', '10 observaciones · IQR y Z-Score', 'scan', 'sand'],
        ['pdf1_salarios', 'Salarios mensuales', '10 observaciones · Un salario de S/ 8000', 'scan', 'sand'],
        ['pdf2_estudiantes', 'Horas de estudio y notas', '6 estudiantes · K-Means', 'target', ''],
        ['pdf2_clientes', 'Compras y gasto mensual', '6 clientes · K-Means', 'target', ''],
        ['pdf3_estudiantes', 'Estudiantes y representantes', '6 estudiantes · K-Medoids', 'gem', 'lilac'],
        ['pdf3_outlier', 'El efecto de un outlier', '7 observaciones · Punto G(30,30)', 'gem', 'lilac'],
        ['pdf3_ejercicio', 'Puntos en el plano', '6 observaciones · Ejercicio PAM', 'gem', 'lilac']
    ];
    showModal('Un punto de partida para cada idea', `<p>Los siete conjuntos de los PDFs del curso. Al elegir uno se guarda el cambio en el historial; puedes deshacerlo.</p><div class="picker-options">${entries.map(([key, title, description, icon, tone]) => `<button class="picker-option" onclick="startExample('${key}')"><span class="method-icon ${tone}">${iconHTML(icon)}</span><span><strong>${title}</strong><small>${description}</small></span>${iconHTML('arrow')}</button>`).join('')}</div>`, () => { closeConfigModal(); switchTab('data'); }, 'Continuar con mis datos');
}
function openQuickGuide() {
    toggleNavigation(false);
    showModal('De tu primera fila a tu primer hallazgo', `<p>No necesitas empezar desde cero. Usa un ejemplo o importa tus propios datos y sigue estos pasos.</p><ol class="guide-steps">
        <li><div><strong>Prepara tus datos</strong><p>Abre la vista de datos. Edita una celda con doble clic o importa un CSV con dos columnas numéricas y, si quieres, una columna de identificadores.</p></div></li>
        <li><div><strong>Elige cómo compararlos</strong><p>Si tus variables tienen escalas diferentes, prueba la estandarización Z o la normalización. Los valores originales se conservan.</p></div></li>
        <li><div><strong>Haz una pregunta</strong><p>Detecta outliers, crea grupos con K-Means o busca representantes con PAM. ¿No sabes cuántos grupos elegir? Usa Evaluar K.</p></div></li>
        <li><div><strong>Entiende el camino</strong><p>En Resultados puedes avanzar por las iteraciones, consultar distancias y explorar los puntos del gráfico con el cursor.</p></div></li>
        <li><div><strong>Conserva tus descubrimientos</strong><p>Guarda el proyecto para retomarlo, exporta la tabla CSV o descarga un informe que puedes imprimir como PDF.</p></div></li></ol>
        <p class="shortcut-note"><kbd>Ctrl</kbd> + <kbd>S</kbd> Guardar proyecto &nbsp; · &nbsp; <kbd>Ctrl</kbd> + <kbd>Z</kbd> Deshacer<br>En la hoja: flechas para navegar, Enter o F2 para editar y Escape para cancelar.<br>Los análisis se eliminan al editar datos para evitar resultados desactualizados.</p><p class="context-note">Aprendizaje No Supervisado · M.Sc. Amilkar Sucasaca Pacori<br>Facultad de Ingeniería Estadística e Informática · UNAP</p>`, () => { closeConfigModal(); switchTab('data'); }, 'Vamos a explorar');
}
function initializeShell() {
    // Ilustración decorativa determinista; no presenta resultados del conjunto activo.
    const groups = [
        {color: '#5f9878', points: [[73,168],[86,151],[90,184],[103,158],[108,188],[119,145],[129,180],[142,157],[151,139],[158,169],[99,171],[138,190]]},
        {color: '#a38aba', points: [[223,85],[237,71],[249,94],[255,58],[269,105],[282,63],[293,92],[306,54],[320,78],[334,68],[276,85],[307,107]]},
        {color: '#b9a064', points: [[279,182],[293,166],[299,199],[315,171],[326,205],[338,184],[350,196],[316,190],[332,168]]}
    ];
    $('illustrationPoints').innerHTML = groups.map(group => group.points.map(([cx,cy], i) => `<circle cx="${cx}" cy="${cy}" r="${i % 3 ? 3 : 3.8}" fill="${group.color}" opacity=".85"/>`).join('')).join('');
    window.matchMedia('(max-width: 760px)').addEventListener('change', () => toggleNavigation(false));
    document.addEventListener('keydown', event => {
        if (!document.body.classList.contains('sidebar-open')) return;
        if (event.key === 'Escape') { event.preventDefault(); toggleNavigation(false); }
        if (event.key === 'Tab') {
            const focusable = [...$('mainSidebar').querySelectorAll('a, button')];
            const first = focusable[0], last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    updateWelcome();
}
