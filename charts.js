/* Canvas adaptable, coordenadas negativas y consulta de puntos al pasar el cursor. */
const ChartViews = (() => {
    const charts = new Map();
    const palette = ['#2c7b5c', '#9774ae', '#b18b42', '#4d819a', '#b56d60', '#567b42', '#a7618b', '#8571a3', '#947343', '#536c68'];
    let observer;
    function setup(canvas, height = 340) {
        canvas.style.width = '100%';
        const width = Math.max(120, canvas.getBoundingClientRect().width);
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr; canvas.height = height * dpr;
        canvas.style.width = '100%'; canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
        ctx.font = '11px sans-serif';
        return {ctx, width, height};
    }
    function extent(values) {
        const min = Math.min(...values), max = Math.max(...values), pad = (max - min || Math.max(Math.abs(min), 1)) * .18;
        return [min - pad, max + pad];
    }
    function axes(ctx, width, height, xs, ys, xLabel, yLabel, xTicks = null) {
        const left = 65, top = 24, pw = width - 90, ph = height - 85;
        const toX = x => left + (x - xs[0]) / (xs[1] - xs[0]) * pw;
        const toY = y => top + ph - (y - ys[0]) / (ys[1] - ys[0]) * ph;
        ctx.strokeStyle = '#e2e8f0'; ctx.fillStyle = '#475569'; ctx.lineWidth = 1;
        const tick = v => Math.abs(v) >= 1e5 || (v !== 0 && Math.abs(v) < .001) ? v.toExponential(1) : Number(v.toFixed(2)).toString();
        for (let i = 0; i <= 4; i++) {
            const y = ys[0] + (ys[1] - ys[0]) * i / 4;
            ctx.beginPath(); ctx.moveTo(left, toY(y)); ctx.lineTo(left + pw, toY(y)); ctx.stroke();
            ctx.textAlign = 'right'; ctx.fillText(tick(y), left - 7, toY(y) + 4);
        }
        const ticks = xTicks ?? Array.from({length: 5}, (_, i) => xs[0] + (xs[1] - xs[0]) * i / 4);
        ticks.forEach(x => {
            ctx.beginPath(); ctx.moveTo(toX(x), top); ctx.lineTo(toX(x), top + ph); ctx.stroke();
            ctx.textAlign = 'center'; ctx.fillText(tick(x), toX(x), top + ph + 18);
        });
        ctx.strokeStyle = '#64748b'; ctx.strokeRect(left, top, pw, ph);
        ctx.textAlign = 'center'; ctx.fillStyle = '#0f172a';
        ctx.fillText(xLabel.slice(0, 70), left + pw / 2, height - 13);
        ctx.save(); ctx.translate(14, top + ph / 2); ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel.slice(0, 45), 0, 0); ctx.restore();
        return {toX, toY};
    }
    function scatter(canvas, config) {
        const {ctx, width, height} = setup(canvas);
        const {points, centers, labels} = config;
        const {toX, toY} = axes(ctx, width, height,
            extent([...points, ...centers].map(p => p.x)), extent([...points, ...centers].map(p => p.y)), config.xLabel, config.yLabel);
        const targets = [];
        points.forEach((p, i) => {
            const center = centers[labels[i]], color = palette[labels[i] % palette.length];
            const x = toX(p.x), y = toY(p.y);
            ctx.strokeStyle = color + '44'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(toX(center.x), toY(center.y)); ctx.stroke();
            ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.stroke();
            if (points.length <= 30) { ctx.fillStyle = '#334155'; ctx.textAlign = 'left'; ctx.fillText(p.id.slice(0, 18), x + 7, y - 7); }
            targets.push({x, y, text: `${p.id} · X: ${p.x.toPrecision(5)} · Y: ${p.y.toPrecision(5)} · Grupo ${labels[i] + 1}`});
        });
        centers.forEach((c, i) => {
            const x = toX(c.x), y = toY(c.y);
            ctx.lineWidth = 3; ctx.strokeStyle = '#dc2626'; ctx.beginPath();
            ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y + 7); ctx.moveTo(x + 7, y - 7); ctx.lineTo(x - 7, y + 7); ctx.stroke(); ctx.lineWidth = 1;
            targets.push({x, y, text: `${config.centerType} ${i + 1}${c.id ? ': ' + c.id : ''} · (${c.x.toPrecision(5)}, ${c.y.toPrecision(5)})`});
        });
        return targets;
    }
    function boxplot(canvas, config) {
        const {ctx, width} = setup(canvas, 210);
        const result = config.result;
        const domain = extent([...result.rows.map(r => r.value), result.lower, result.upper]);
        const toX = v => 55 + (v - domain[0]) / (domain[1] - domain[0]) * (width - 110);
        const inside = result.rows.filter(r => !r.iqr).map(r => r.value);
        const low = Math.min(...inside), high = Math.max(...inside);
        ctx.strokeStyle = '#2c7b5c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(toX(low), 80); ctx.lineTo(toX(high), 80); ctx.stroke();
        for (const v of [low, high]) { ctx.beginPath(); ctx.moveTo(toX(v), 65); ctx.lineTo(toX(v), 95); ctx.stroke(); }
        ctx.fillStyle = '#e2eee5'; ctx.fillRect(toX(result.q1), 55, Math.max(2, toX(result.q3) - toX(result.q1)), 50);
        ctx.strokeRect(toX(result.q1), 55, Math.max(2, toX(result.q3) - toX(result.q1)), 50);
        ctx.strokeStyle = '#dc2626'; ctx.beginPath(); ctx.moveTo(toX(result.median), 55); ctx.lineTo(toX(result.median), 105); ctx.stroke();
        ctx.fillStyle = '#334155'; ctx.textAlign = 'center';
        ctx.fillText(`Q1: ${result.q1.toPrecision(4)} · Mediana: ${result.median.toPrecision(4)} · Q3: ${result.q3.toPrecision(4)}`, width / 2, 25);
        ctx.fillText(`Límites IQR: [${result.lower.toPrecision(4)}, ${result.upper.toPrecision(4)}]`, width / 2, 180);
        const targets = result.rows.map((r, i) => {
            const x = toX(r.value), y = 135 + (i % 3) * 7;
            ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = r.iqr || r.zFlag ? '#c26550' : '#2c7b5c'; ctx.fill();
            return {x, y, text: `${r.id} · Valor ${r.value} · Z ${r.z.toFixed(3)} · IQR: ${r.iqr ? 'Atípico' : 'Normal'}`};
        });
        return targets;
    }
    function line(canvas, config) {
        const {ctx, width, height} = setup(canvas, 260);
        const values = config.rows.map(r => r[config.key]);
        const ks = config.rows.map(r => r.k);
        const xs = [Math.min(...ks) - .2, Math.max(...ks) + .2];
        const ys = config.key === 'cost' ? [0, Math.max(...values) * 1.1 || 1] : [-1, 1];
        const {toX, toY} = axes(ctx, width, height, xs, ys, 'Número de grupos K', config.label, ks);
        ctx.strokeStyle = '#2c7b5c'; ctx.lineWidth = 2; ctx.beginPath();
        config.rows.forEach((r, i) => { if (i) ctx.lineTo(toX(r.k), toY(r[config.key])); else ctx.moveTo(toX(r.k), toY(r[config.key])); }); ctx.stroke();
        return config.rows.map(r => {
            const x = toX(r.k), y = toY(r[config.key]);
            ctx.fillStyle = '#2c7b5c'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
            return {x, y, text: `K=${r.k} · ${config.label}: ${r[config.key].toPrecision(5)}`};
        });
    }
    function draw(canvas) {
        const entry = charts.get(canvas);
        if (!entry || !canvas.isConnected || !canvas.getBoundingClientRect().width) return;
        entry.targets = ({scatter, boxplot, line})[entry.type](canvas, entry.config);
    }
    function mount(canvas, type, config) {
        if (!charts.has(canvas)) {
            if (!observer && typeof ResizeObserver !== 'undefined') observer = new ResizeObserver(entries => entries.forEach(e => draw(e.target)));
            observer?.observe(canvas);
            const showPoint = event => {
                const entry = charts.get(canvas), rect = canvas.getBoundingClientRect();
                const x = event.clientX - rect.left, y = event.clientY - rect.top;
                const target = [...(entry?.targets || [])].reverse().find(t => Math.hypot(t.x - x, t.y - y) <= 12);
                const tooltip = document.getElementById('chartTooltip');
                tooltip.hidden = !target;
                if (target) {
                    tooltip.textContent = target.text;
                    tooltip.style.left = `${Math.min(event.clientX + 12, window.innerWidth - 290)}px`;
                    tooltip.style.top = `${Math.max(8, event.clientY - 45)}px`;
                }
            };
            canvas.addEventListener('pointermove', showPoint);
            canvas.addEventListener('pointerdown', showPoint);
            canvas.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') document.getElementById('chartTooltip').hidden = true; });
        }
        charts.set(canvas, {type, config, targets: []}); draw(canvas);
    }
    function clear() { observer?.disconnect(); charts.clear(); }
    function redraw() { charts.forEach((_, canvas) => draw(canvas)); }
    function dispose(canvas) { observer?.unobserve(canvas); charts.delete(canvas); }
    document.addEventListener('pointerdown', event => {
        if (event.target.tagName !== 'CANVAS') document.getElementById('chartTooltip').hidden = true;
    });
    return {mount, redraw, clear, dispose};
})();
