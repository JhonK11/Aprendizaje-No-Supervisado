/* Motor numérico independiente de la interfaz. */
const Stats = (() => {
    const EPS = 1e-12;
    function validatePoints(points) {
        if (!Array.isArray(points) || points.length < 2 || points.length > 1000) {
            throw new Error('Se requieren entre 2 y 1000 observaciones.');
        }
        const ids = new Set();
        points.forEach(p => {
            if (!p || typeof p.id !== 'string' || !p.id.trim() || ids.has(p.id)) {
                throw new Error('Cada observación debe tener un ID único y no vacío.');
            }
            ids.add(p.id);
            if (![p.x, p.y].every(Number.isFinite)) throw new Error('X e Y deben ser números finitos.');
            if (Math.max(Math.abs(p.x), Math.abs(p.y)) > 1e100) throw new Error('Los valores son demasiado grandes para analizarlos.');
        });
    }
    function distance(a, b, metric = 'euclidean', q = 3) {
        const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
        if (metric === 'manhattan') return dx + dy;
        if (metric === 'euclidean') return Math.hypot(dx, dy);
        if (metric !== 'minkowski' || !Number.isFinite(q) || q < 1) throw new Error('Minkowski requiere q ≥ 1.');
        const m = Math.max(dx, dy);
        return m === 0 ? 0 : m * ((dx / m) ** q + (dy / m) ** q) ** (1 / q);
    }
    function transform(points, mode = 'none') {
        validatePoints(points);
        if (!['none', 'zscore', 'minmax'].includes(mode)) throw new Error('Escalado desconocido.');
        const parameters = {};
        for (const key of ['x', 'y']) {
            const values = points.map(p => p[key]);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
            const min = Math.min(...values), max = Math.max(...values);
            parameters[key] = mode === 'zscore' ? {offset: mean, scale: std || 1}
                : mode === 'minmax' ? {offset: min, scale: max - min || 1} : {offset: 0, scale: 1};
        }
        const apply = p => ({...p, x: (p.x - parameters.x.offset) / parameters.x.scale,
            y: (p.y - parameters.y.offset) / parameters.y.scale});
        return {points: points.map(apply), parameters, apply};
    }
    function seeds(points, k) {
        const selected = [0];
        while (selected.length < k) {
            let best = -1, farthest = -1;
            points.forEach((p, i) => {
                if (selected.includes(i)) return;
                const d = Math.min(...selected.map(j => distance(p, points[j])));
                if (d > farthest) { farthest = d; best = i; }
            });
            selected.push(best);
        }
        return selected;
    }
    function validateK(points, k) {
        validatePoints(points);
        const unique = new Set(points.map(p => JSON.stringify([p.x, p.y]))).size;
        if (!Number.isInteger(k) || k < 2 || k > Math.min(10, points.length, unique)) {
            throw new Error('K debe estar entre 2 y 10 y no superar el número de puntos distintos.');
        }
    }
    function assign(points, centers, metric = 'euclidean', q = 3, medoidIndices = null) {
        return points.map((p, i) => {
            // Cada medoide conserva su grupo incluso si hay observaciones coincidentes.
            if (medoidIndices?.includes(i)) return medoidIndices.indexOf(i);
            let best = 0;
            for (let j = 1; j < centers.length; j++) {
                if (distance(p, centers[j], metric, q) < distance(p, centers[best], metric, q)) best = j;
            }
            return best;
        });
    }
    function kmeans(points, {k = 2, initial = null, maxIter = 100} = {}) {
        validateK(points, k);
        if (!Number.isInteger(maxIter) || maxIter < 1 || maxIter > 1000) throw new Error('Límite de iteraciones inválido.');
        let centers = initial ? initial.map(p => ({x: p.x, y: p.y}))
            : seeds(points, k).map(i => ({x: points[i].x, y: points[i].y}));
        if (centers.length !== k || centers.some(c => ![c.x, c.y].every(Number.isFinite))) {
            throw new Error('Completa todas las coordenadas iniciales con números finitos.');
        }
        if (centers.some(c => Math.max(Math.abs(c.x), Math.abs(c.y)) > 1e100)) throw new Error('Los centros son demasiado grandes.');
        if (new Set(centers.map(c => JSON.stringify([c.x, c.y]))).size !== k) {
            throw new Error('Los centroides iniciales deben tener coordenadas distintas.');
        }
        const steps = [];
        let previous = null, converged = false, labels;
        for (let iteration = 0; iteration < maxIter; iteration++) {
            const before = centers.map(c => ({...c}));
            labels = assign(points, centers);
            const counts = Array(k).fill(0);
            labels.forEach(c => counts[c]++);
            let recovered = 0;
            for (let c = 0; c < k; c++) {
                if (counts[c]) continue;
                let farthest = -1, best = -1;
                points.forEach((p, i) => {
                    const d = distance(p, centers[labels[i]]);
                    if (counts[labels[i]] > 1 && d > farthest) { best = i; farthest = d; }
                });
                counts[labels[best]]--; labels[best] = c; counts[c]++; recovered++;
            }
            centers = Array.from({length: k}, (_, c) => {
                const members = points.filter((_, i) => labels[i] === c);
                return {x: members.reduce((s, p) => s + p.x, 0) / members.length,
                    y: members.reduce((s, p) => s + p.y, 0) / members.length};
            });
            const cost = points.reduce((s, p, i) => s + distance(p, centers[labels[i]]) ** 2, 0);
            converged = previous !== null && labels.every((c, i) => c === previous[i]);
            steps.push({before, centers: centers.map(c => ({...c})), labels: [...labels], cost, recovered});
            if (converged) break;
            previous = [...labels];
        }
        return {centers, labels, steps, converged, cost: steps.at(-1).cost};
    }
    function silhouette(points, labels, metric = 'euclidean', q = 3, matrix = null) {
        const groups = [...new Set(labels)];
        if (groups.length < 2 || groups.length >= points.length) return {scores: points.map(() => 0), average: null};
        const d = (i, j) => matrix ? matrix[i][j] : distance(points[i], points[j], metric, q);
        const scores = points.map((_, i) => {
            const same = labels.map((c, j) => c === labels[i] && j !== i ? j : -1).filter(j => j >= 0);
            if (!same.length) return 0;
            const a = same.reduce((s, j) => s + d(i, j), 0) / same.length;
            const b = Math.min(...groups.filter(c => c !== labels[i]).map(c => {
                const indices = labels.map((g, j) => g === c ? j : -1).filter(j => j >= 0);
                return indices.reduce((s, j) => s + d(i, j), 0) / indices.length;
            }));
            return Math.max(a, b) ? (b - a) / Math.max(a, b) : 0;
        });
        return {scores, average: scores.reduce((s, v) => s + v, 0) / points.length};
    }
    function pam(points, {k = 2, indices = null, metric = 'euclidean', q = 3, maxIter = 100} = {}) {
        validateK(points, k);
        if (!Number.isInteger(maxIter) || maxIter < 1 || maxIter > 1000) throw new Error('Límite de iteraciones inválido.');
        if (points.length > 250) throw new Error('PAM admite hasta 250 observaciones para mantener la interfaz ágil.');
        distance(points[0], points[0], metric, q);
        let medoids = indices ? [...indices] : seeds(points, k);
        if (medoids.length !== k || new Set(medoids).size !== k || medoids.some(i => !Number.isInteger(i) || i < 0 || i >= points.length)) {
            throw new Error('Selecciona K observaciones distintas como medoides iniciales.');
        }
        const matrix = points.map(p => points.map(o => distance(p, o, metric, q)));
        const evaluate = ms => points.reduce((s, _, i) => s + Math.min(...ms.map(j => matrix[i][j])), 0);
        let cost = evaluate(medoids);
        const steps = [{centers: medoids.map(i => ({...points[i]})), labels: assign(points, medoids.map(i => points[i]), metric, q, medoids), cost, swap: null}];
        let converged = false;
        for (let iter = 0; iter < maxIter; iter++) {
            const nearest = matrix.map(row => {
                const ranked = medoids.map((m, slot) => ({slot, d: row[m]})).sort((a, b) => a.d - b.d);
                return {slot: ranked[0].slot, first: ranked[0].d, second: ranked[1].d};
            });
            let best = null, bestCost = cost;
            for (let slot = 0; slot < k; slot++) {
                for (let candidate = 0; candidate < points.length; candidate++) {
                    if (medoids.includes(candidate)) continue;
                    const trialCost = nearest.reduce((s, near, i) => s + Math.min(matrix[i][candidate], near.slot === slot ? near.second : near.first), 0);
                    if (trialCost < bestCost - EPS * Math.abs(cost)) { best = {slot, candidate}; bestCost = trialCost; }
                }
            }
            if (!best) { converged = true; break; }
            const swap = {from: points[medoids[best.slot]].id, to: points[best.candidate].id};
            medoids[best.slot] = best.candidate; cost = bestCost;
            const centers = medoids.map(i => ({...points[i]}));
            steps.push({centers, labels: assign(points, centers, metric, q, medoids), cost, swap});
        }
        const final = steps.at(-1);
        return {...final, steps, medoids, converged, silhouette: silhouette(points, final.labels, metric, q, matrix)};
    }
    function percentile(sorted, p) {
        const position = (sorted.length - 1) * p, lower = Math.floor(position), fraction = position - lower;
        return sorted[lower] + fraction * (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]);
    }
    function outliers(points, {varKey = 'x', zThreshold = 2, stdType = 'pop'} = {}) {
        validatePoints(points);
        if (!['x', 'y'].includes(varKey) || !Number.isFinite(zThreshold) || zThreshold <= 0 || !['pop', 'samp'].includes(stdType)) throw new Error('Parámetros de outliers inválidos.');
        const values = points.map(p => p[varKey]).sort((a, b) => a - b);
        const mean = values.reduce((s, v) => s + v, 0) / values.length;
        const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - (stdType === 'samp' ? 1 : 0)));
        const q1 = percentile(values, .25), median = percentile(values, .5), q3 = percentile(values, .75);
        const lower = q1 - 1.5 * (q3 - q1), upper = q3 + 1.5 * (q3 - q1);
        const rows = points.map(p => {
            const value = p[varKey], z = std ? (value - mean) / std : 0;
            return {id: p.id, value, z, iqr: value < lower || value > upper, zFlag: Math.abs(z) > zThreshold};
        });
        return {mean, std, q1, median, q3, lower, upper, rows};
    }
    function evaluateK(points, maxK = 8) {
        validatePoints(points);
        if (!Number.isInteger(maxK) || maxK < 2 || maxK > 10) throw new Error('El máximo de K debe estar entre 2 y 10.');
        if (points.length > 400) throw new Error('La evaluación de K admite hasta 400 observaciones.');
        const limit = Math.min(maxK, points.length - 1, new Set(points.map(p => JSON.stringify([p.x, p.y]))).size);
        if (limit < 2) throw new Error('Se necesitan al menos 3 observaciones y 2 puntos distintos para evaluar K.');
        const center = {x: points.reduce((s, p) => s + p.x, 0) / points.length,
            y: points.reduce((s, p) => s + p.y, 0) / points.length};
        const rows = [{k: 1, cost: points.reduce((s, p) => s + distance(p, center) ** 2, 0), silhouette: null, converged: true}];
        for (let k = 2; k <= limit; k++) {
            // Varios inicios deterministas para reducir la dependencia del primer punto.
            let best = null;
            for (let shift = 0; shift < Math.min(points.length, 5); shift++) {
                const rotated = [...points.slice(shift), ...points.slice(0, shift)];
                const initial = seeds(rotated, k).map(i => rotated[i]);
                const result = kmeans(points, {k, initial});
                if (!best || result.cost < best.cost) best = result;
            }
            rows.push({k, cost: best.cost, silhouette: silhouette(points, best.labels).average, converged: best.converged});
        }
        return rows;
    }
    return {validatePoints, distance, transform, seeds, kmeans, pam, silhouette, outliers, evaluateK, percentile};
})();
if (typeof module !== 'undefined') module.exports = Stats;
