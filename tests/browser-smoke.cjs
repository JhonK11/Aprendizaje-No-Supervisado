/* Integración en Edge/Chromium sin dependencias npm. Ejecutar: node tests/browser-smoke.cjs */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const browserPath = process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'statstudio-browser-'));
const child = spawn(browserPath, ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
    '--no-sandbox', '--disable-gpu', '--disable-extensions', '--disable-background-networking', `--user-data-dir=${profile}`, 'about:blank'], {windowsHide: true, stdio: 'ignore'});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, page;
class CDP {
    constructor(ws) {
        this.ws = ws; this.sequence = 0; this.pending = new Map(); this.events = [];
        ws.addEventListener('message', event => {
            const message = JSON.parse(event.data);
            if (message.id) {
                const pending = this.pending.get(message.id); if (!pending) return;
                this.pending.delete(message.id); clearTimeout(pending.timer);
                if (message.error) pending.reject(new Error(JSON.stringify(message.error))); else pending.resolve(message.result);
            } else this.events.push(message);
        });
    }
    static async connect(url) {
        const ws = new WebSocket(url);
        await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, {once: true}); ws.addEventListener('error', reject, {once: true}); });
        return new CDP(ws);
    }
    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = ++this.sequence;
            const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 20000);
            this.pending.set(id, {resolve, reject, timer}); this.ws.send(JSON.stringify({id, method, params}));
        });
    }
    async evaluate(expression) {
        const result = await this.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
    }
}
(async () => {
    let active;
    for (let i = 0; i < 100; i++) {
        if (fs.existsSync(path.join(profile, 'DevToolsActivePort'))) { active = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/); break; }
        if (child.exitCode !== null) throw new Error(`El navegador terminó con ${child.exitCode}`);
        await pause(100);
    }
    if (!active) throw new Error('No se pudo iniciar el navegador.');
    browser = await CDP.connect(`ws://127.0.0.1:${active[0]}${active[1]}`);
    const targets = await browser.send('Target.getTargets');
    const target = targets.targetInfos.find(t => t.type === 'page');
    const list = await (await fetch(`http://127.0.0.1:${active[0]}/json/list`)).json();
    page = await CDP.connect(list.find(t => t.id === target.targetId).webSocketDebuggerUrl);
    await page.send('Runtime.enable'); await page.send('Page.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false});
    // La prueba no necesita servicios externos; evita esperas por red al abrir los archivos.
    await page.send('Network.enable');
    if (!process.env.STATSTUDIO_ALLOW_CDN) await page.send('Network.setBlockedURLs', {urls: ['https://*', 'http://*']});
    await page.send('Page.navigate', {url: pathToFileURL(path.resolve(__dirname, '../index.html')).href});
    for (let i = 0; i < 100; i++) {
        if (await page.evaluate('typeof appState !== "undefined" && appState.analyses.length === 1')) break;
        await pause(100);
    }
    const initial = await page.evaluate(`({n: appState.data.length, analyses: appState.analyses.length, cost: appState.analyses[0]?.result.cost})`);
    assert.equal(initial.n, 6); assert.equal(initial.analyses, 1); assert.ok(Math.abs(initial.cost - 8) < 1e-8);
    assert.equal(await page.evaluate('appState.currentTab'), 'home');
    assert.equal(await page.evaluate("getComputedStyle(document.getElementById('view-output')).display"), 'none');
    if (process.env.STATSTUDIO_SCREENSHOTS) {
        fs.mkdirSync(process.env.STATSTUDIO_SCREENSHOTS, {recursive: true});
        await pause(600);
        const shot = await page.send('Page.captureScreenshot', {format: 'png'});
        fs.writeFileSync(path.join(process.env.STATSTUDIO_SCREENSHOTS, 'welcome-desktop.png'), Buffer.from(shot.data, 'base64'));
    }
    await page.evaluate(`
        window.check = (condition, message) => { if (!condition) throw new Error(message); };
        const before = JSON.stringify(projectDocument());
        openQuickGuide(); check(!$('configModal').classList.contains('hidden'), 'No abrió la guía');
        $('modalRunBtn').click();
        check(appState.currentTab === 'data' && JSON.stringify(projectDocument()) === before, 'La bienvenida modificó los datos');
        openExampleLibrary(); check($('modalBody').querySelectorAll('.picker-option').length === 7, 'Faltan ejemplos');
        closeConfigModal();
        openAnalysisPicker(); $('modalBody').querySelectorAll('.picker-option')[1].click();
        check($('cfgK') !== null, 'El selector no abrió la configuración'); closeConfigModal();
        selectCell(0, 'x');
        document.querySelector('#dataGridBody .active-cell').dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true}));
        check(appState.selectedRowIndex === 1 && appState.selectedColKey === 'x', 'No navegó con flechas');
        let cell = document.querySelector('#dataGridBody .active-cell');
        cell.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
        let editor = cell.querySelector('input'); check(editor !== null, 'Enter no abrió el editor');
        editor.value = '999'; editor.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
        check(appState.data[1].x === 3 && appState.analyses.length === 1, 'Escape confirmó el cambio');
        cell = document.querySelector('#dataGridBody .active-cell');
        cell.dispatchEvent(new KeyboardEvent('keydown', {key:'F2', bubbles:true}));
        editor = cell.querySelector('input'); editor.value = '3.5';
        editor.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
        check(appState.data[1].x === 3.5 && document.activeElement.classList.contains('active-cell'), 'No confirmó o no restauró el foco');
        undoEdit();
    `);
    console.log('OK inicio y ejemplo del curso');
    await page.evaluate(`
        window.check = (condition, message) => { if (!condition) throw new Error(message); };
        loadPreset('pdf3_outlier');
        check(appState.analyses[0].result.converged, 'PAM no convergió');
        check(appState.analyses[0].result.steps.length > 1, 'PAM no hizo intercambios');
        switchTab('output');
        check(getComputedStyle($('formulaBar')).display === 'none' && getComputedStyle($('view-data')).display === 'none', 'Las pestañas no ocultan las vistas');
        openConfigModal('kmeans'); $('cfgInit').value = 'obs'; $('cfgInit').dispatchEvent(new Event('change'));
        $('seed0').value = 0; $('seed1').value = 0; $('modalRunBtn').click();
        check(!$('modalError').hidden && $('modalError').textContent.includes('distintas'), 'No rechazó centroides repetidos');
        $('seed1').value = 3; $('modalRunBtn').click();
        check($('configModal').classList.contains('hidden'), 'No cerró el diálogo');
        const a = appState.analyses.at(-1);
        $(a.id).querySelector('[data-step="1"]').click();
        check(a.stepIndex === 1, 'No avanzó la iteración');
        check($(a.id + '_chart').width > 0, 'No dibujó el gráfico');
    `);
    console.log('OK diálogos, PAM, validación y navegación de iteraciones');
    await page.evaluate(`
        const previous = appState.data[0].x;
        updateCell(0, 'x', '7.25');
        check(appState.data[0].x === 7.25 && appState.analyses.length === 0 && appState.computedColumns.length === 0, 'No invalidó resultados');
        undoEdit(); check(appState.data[0].x === previous, 'No deshizo');
        redoEdit(); check(appState.data[0].x === 7.25, 'No rehízo');
        const base = JSON.stringify(appState.data.map(({id,x,y}) => ({id,x,y})));
        changeScaling('zscore'); executeKMeans();
        check(base === JSON.stringify(appState.data.map(({id,x,y}) => ({id,x,y}))), 'El escalado alteró los originales');
        const saved = projectDocument(), expectedCost = appState.analyses[0].result.cost;
        openProjectDocument(saved);
        check(appState.analyses.length === 1 && Math.abs(appState.analyses[0].result.cost - expectedCost) < 1e-8, 'No restauró los análisis');
        const bad = structuredClone(saved); bad.data[0].x = null;
        try { openProjectDocument(bad); throw new Error('Aceptó proyecto inválido'); } catch(e) { if(e.message === 'Aceptó proyecto inválido') throw e; }
        check(appState.analyses.length === 1, 'El proyecto inválido cambió el estado');
    `);
    console.log('OK edición, historial, escalado y proyectos');
    await page.evaluate(`
        updateCell(0, 'id', '<img src=x onerror="window.injected=true">');
        check(!$('dataGridBody').querySelector('img') && !window.injected, 'Interpretó HTML');
        pendingCSV = {...FileFormats.parseCSV('ID;Horas;Nota\\nA;1,5;10\\nB;2,5;12\\nC;8;18'), name:'prueba.csv'};
        openCSVMapping(); $('csvId').value=0; $('csvX').value=1; $('csvY').value=2; $('modalRunBtn').click();
        check(appState.data.length === 3 && appState.data[0].x === 1.5 && appState.activePreset === 'custom', 'Falló la importación');
        executeKMeans(); executeKMedoids(); executeOutlierAnalysis(); runComparisonKMeansVsKMedoids();
        window.downloads = [];
        downloadFile = (content, name, type) => downloads.push({content, name, type});
        exportCSV(); saveProject(); exportReport();
        check(downloads.length === 3, 'Faltan exportaciones');
        check(downloads[2].content.includes('data:image/png;base64,') && downloads[2].content.includes('Datos originales'), 'Informe sin imágenes o datos');
        const exported = new DOMParser().parseFromString(downloads[2].content, 'text/html');
        check(!exported.querySelector('canvas') && !exported.querySelector('[data-no-report]'), 'Informe contiene controles');
    `);
    console.log('OK escape de textos, importación CSV y exportaciones');
    await page.evaluate('runKEvaluation()'); await pause(200);
    assert.equal(await page.evaluate("appState.analyses.at(-1).kind"), 'evaluation');
    if (process.env.STATSTUDIO_SCREENSHOTS) {
        fs.mkdirSync(process.env.STATSTUDIO_SCREENSHOTS, {recursive: true});
        const shot = await page.send('Page.captureScreenshot', {format: 'png'});
        fs.writeFileSync(path.join(process.env.STATSTUDIO_SCREENSHOTS, 'desktop.png'), Buffer.from(shot.data, 'base64'));
    }
    await page.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
    await page.evaluate(`
        switchTab('home'); toggleNavigation(true);
        check(document.querySelector('.workspace-shell').inert && !$('sidebarBackdrop').hidden, 'No abrió el menú móvil');
        $('tab-btn-data').click();
        check(appState.currentTab === 'data' && !document.querySelector('.workspace-shell').inert && $('sidebarBackdrop').hidden, 'No cerró el menú al navegar');
        switchTab('home');
        check(document.documentElement.scrollWidth <= window.innerWidth, 'La bienvenida se desborda en móvil');
    `);
    if (process.env.STATSTUDIO_SCREENSHOTS) {
        await pause(600);
        const shot = await page.send('Page.captureScreenshot', {format: 'png'});
        fs.writeFileSync(path.join(process.env.STATSTUDIO_SCREENSHOTS, 'welcome-mobile.png'), Buffer.from(shot.data, 'base64'));
    }
    await page.evaluate(`switchTab('output'); ChartViews.redraw(); check($('outputMainContent').clientHeight > 150, 'Sin espacio para resultados en móvil');`);
    if (process.env.STATSTUDIO_SCREENSHOTS) {
        const shot = await page.send('Page.captureScreenshot', {format: 'png'});
        fs.writeFileSync(path.join(process.env.STATSTUDIO_SCREENSHOTS, 'mobile.png'), Buffer.from(shot.data, 'base64'));
        console.log('Capturas:', process.env.STATSTUDIO_SCREENSHOTS);
    }
    const errors = page.events.filter(e => e.method === 'Runtime.exceptionThrown');
    assert.equal(errors.length, 0, JSON.stringify(errors));
    console.log('OK evaluación de K, vista móvil y ausencia de excepciones');
    const expectedProject = await page.evaluate('JSON.stringify(projectDocument())');
    await page.send('Page.reload', {ignoreCache: true});
    let restored;
    for (let i = 0; i < 100; i++) {
        restored = await page.evaluate('typeof appState !== "undefined" && appState.data.length > 0 ? JSON.stringify(projectDocument()) : null');
        if (restored === expectedProject) break;
        await pause(100);
    }
    assert.equal(restored, expectedProject);
    assert.equal(await page.evaluate('appState.currentTab'), 'home');
    console.log('OK autoguardado y restauración después de recargar');
    for (const width of [320, 600, 800, 1024]) {
        await page.send('Emulation.setDeviceMetricsOverride', {width, height: 900, deviceScaleFactor: 1, mobile: width <= 600});
        const layout = await page.evaluate('({viewport: innerWidth, content: document.documentElement.scrollWidth})');
        assert.ok(layout.content <= layout.viewport, `Desbordamiento horizontal a ${width}px: ${JSON.stringify(layout)}`);
    }
    console.log('OK bienvenida adaptable entre 320 y 1440 px y edición por teclado');
    console.log('Todas las comprobaciones de integración pasaron.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    page?.ws.close();
    if (browser) { await browser.send('Browser.close').catch(() => {}); browser.ws.close(); }
    child.kill();
    await pause(500);
    // Solo elimina el perfil temporal creado por esta ejecución, dentro de os.tmpdir().
    const resolved = path.resolve(profile), root = path.resolve(os.tmpdir());
    if (resolved.startsWith(root + path.sep) && path.basename(resolved).startsWith('statstudio-browser-')) {
        try { fs.rmSync(resolved, {recursive: true, force: true, maxRetries: 5, retryDelay: 100}); } catch {}
    }
});
