/* Inicio y eventos; scripts clásicos para admitir la apertura directa de index.html. */
document.addEventListener('DOMContentLoaded', () => {
    $('dataGridBody').addEventListener('click', event => {
        if (event.target.closest('input')) return;
        const cell = event.target.closest('td[data-row]'); if (!cell) return;
        selectCell(Number(cell.dataset.row), ['id', 'x', 'y', ...appState.computedColumns.map(c => c.key)][Number(cell.dataset.col)]);
    });
    $('dataGridBody').addEventListener('dblclick', event => {
        const cell = event.target.closest('td[data-row]'); if (!cell) return;
        startInlineEdit(cell, Number(cell.dataset.row), ['id', 'x', 'y', ...appState.computedColumns.map(c => c.key)][Number(cell.dataset.col)]);
    });
    $('dataGridBody').addEventListener('keydown', event => {
        if (event.target.matches('input')) return;
        const cell = event.target.closest('td[data-row]'); if (!cell) return;
        const keys = ['id', 'x', 'y', ...appState.computedColumns.map(c => c.key)];
        let row = Number(cell.dataset.row), col = Number(cell.dataset.col);
        if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); startInlineEdit(cell, row, keys[col]); return; }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'ArrowLeft') col--;
        if (event.key === 'ArrowRight') col++;
        if (event.key === 'ArrowUp') row--;
        if (event.key === 'ArrowDown') row++;
        row = Math.max(0, Math.min(appState.data.length - 1, row)); col = Math.max(0, Math.min(keys.length - 1, col));
        selectCell(row, keys[col]);
        document.querySelector(`#dataGridBody [data-row="${row}"][data-col="${col}"]`)?.focus();
    });
    $('variableViewBody').addEventListener('change', event => {
        const input = event.target.closest('input[data-variable]');
        if (input) updateVarMeta(Number(input.dataset.variable), input.dataset.field, input.value);
    });
    $('outputOutlineTree').addEventListener('click', event => {
        const button = event.target.closest('[data-scroll]');
        if (button) $(button.dataset.scroll)?.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
    $('outputMainContent').addEventListener('click', event => {
        const button = event.target.closest('button[data-step]'); if (!button) return;
        const analysis = appState.analyses.find(a => a.id === button.dataset.analysis);
        analysis.stepIndex = Math.min(analysis.result.steps.length - 1, Math.max(0, analysis.stepIndex + Number(button.dataset.step)));
        updateAnalysisStep(analysis);
    });
    $('outputMainContent').addEventListener('input', event => {
        if (!event.target.matches('input[type="range"][data-analysis]')) return;
        const analysis = appState.analyses.find(a => a.id === event.target.dataset.analysis);
        analysis.stepIndex = Number(event.target.value); updateAnalysisStep(analysis);
    });
    $('csvFileInput').addEventListener('change', event => { handleCSVFile(event.target.files[0]); event.target.value = ''; });
    $('projectFileInput').addEventListener('change', event => { handleProjectFile(event.target.files[0]); event.target.value = ''; });
    $('configModal').addEventListener('click', event => { if (event.target === $('configModal')) closeConfigModal(); });
    document.addEventListener('keydown', event => {
        const editing = event.target.matches('input, textarea, select, [contenteditable="true"]');
        if (!$('configModal').classList.contains('hidden')) {
            if (event.key === 'Escape') closeConfigModal();
            if (event.key === 'Tab') {
                const items = [...$('configModal').querySelectorAll('button, select, input')].filter(item => !item.disabled && item.getClientRects().length);
                const first = items[0], last = items.at(-1);
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
            return;
        }
        if (event.ctrlKey || event.metaKey) {
            if (event.key.toLowerCase() === 's') { event.preventDefault(); saveProject(); }
            if (!editing && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redoEdit() : undoEdit(); }
            if (!editing && event.key.toLowerCase() === 'y') { event.preventDefault(); redoEdit(); }
        }
    });
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try { openProjectDocument(JSON.parse(saved), false); notifyUser('Se restauró tu último proyecto de este navegador.'); }
            catch { loadPreset('pdf2_estudiantes'); notifyUser('No se pudo restaurar la sesión anterior. Se cargó el ejemplo inicial.', true); }
        } else loadPreset('pdf2_estudiantes');
    } catch { storageAvailable = false; loadPreset('pdf2_estudiantes'); }
    initializeShell(); switchTab('home'); renderAll();
});
