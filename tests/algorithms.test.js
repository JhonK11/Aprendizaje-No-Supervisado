const test = require('node:test');
const assert = require('node:assert/strict');
const Stats = require('../algorithms.js');
const Files = require('../files.js');
const points = values => values.map(([x, y], i) => ({id: String(i), x, y}));
const close = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const sample = points([[2, 10], [3, 11], [4, 12], [8, 17], [9, 18], [10, 19]]);

test('K-Means calcula los promedios y la SSE del ejemplo del curso', () => {
    const result = Stats.kmeans(sample, {initial: [sample[0], sample[3]]});
    assert.equal(result.converged, true);
    assert.deepEqual(result.centers, [{x: 3, y: 11}, {x: 9, y: 18}]);
    assert.deepEqual(result.labels, [0, 0, 0, 1, 1, 1]);
    close(result.cost, 8);
});
test('K-Means rechaza centros repetidos y K mayor al número de puntos distintos', () => {
    assert.throws(() => Stats.kmeans(sample, {initial: [sample[0], sample[0]]}), /distintas/);
    assert.throws(() => Stats.kmeans(points([[1, 1], [1, 1]])), /puntos distintos/);
    assert.throws(() => Stats.kmeans(sample, {initial: [{x: NaN, y: 2}, sample[0]]}), /finitos/);
});
test('K-Means recupera grupos vacíos y no declara convergencia al agotar el límite', () => {
    const result = Stats.kmeans(sample, {k: 3, initial: [{x: 2, y: 10}, {x: 3, y: 11}, {x: 100, y: 100}]});
    assert.equal(new Set(result.labels).size, 3);
    assert.ok(result.steps.some(step => step.recovered > 0));
    assert.ok(result.centers.every(c => Number.isFinite(c.x) && Number.isFinite(c.y)));
    assert.equal(Stats.kmeans(sample, {maxIter: 1}).converged, false);
});
test('PAM busca intercambios fuera de los grupos iniciales y termina en un óptimo local', () => {
    const data = points([[0, 0], [1, 0], [2, 0], [10, 0], [11, 0], [25, 0]]);
    for (const metric of ['euclidean', 'manhattan', 'minkowski']) {
        const result = Stats.pam(data, {indices: [0, 1], metric, q: 3});
        assert.equal(result.converged, true);
        assert.ok(result.steps.length > 1);
        result.steps.slice(1).forEach((step, i) => assert.ok(step.cost < result.steps[i].cost));
        for (let slot = 0; slot < 2; slot++) for (let j = 0; j < data.length; j++) {
            if (result.medoids.includes(j)) continue;
            const trial = [...result.medoids]; trial[slot] = j;
            const cost = data.reduce((s, p) => s + Math.min(...trial.map(m => Stats.distance(p, data[m], metric, 3))), 0);
            assert.ok(cost >= result.cost - 1e-8);
        }
    }
});
test('PAM conserva medoides reales y admite K=3 y observaciones coincidentes', () => {
    const data = points([[0, 0], [0, 0], [1, 0], [10, 0], [11, 0], [30, 0]]);
    const result = Stats.pam(data, {k: 3, indices: [0, 1, 3]});
    assert.equal(new Set(result.labels).size, 3);
    result.centers.forEach(c => assert.ok(data.some(p => p.id === c.id && p.x === c.x && p.y === c.y)));
    assert.throws(() => Stats.pam(data, {indices: [0, 0]}), /distintas/);
    assert.throws(() => Stats.pam(data, {metric: 'minkowski', q: 0}), /q/);
});
test('Silueta: el grupo singleton vale cero y una partición inválida no tiene media', () => {
    const data = points([[0, 0], [2, 0], [10, 0]]);
    const result = Stats.silhouette(data, [0, 0, 1]);
    close(result.scores[0], .8); close(result.scores[1], .75); close(result.scores[2], 0);
    close(result.average, 1.55 / 3);
    assert.equal(Stats.silhouette(data, [0, 0, 0]).average, null);
    assert.equal(Stats.silhouette(data, [0, 1, 2]).average, null);
});
test('Escalado conserva datos originales y trata columnas constantes', () => {
    const data = points([[-2, 5], [0, 5], [2, 5]]), saved = structuredClone(data);
    const scaled = Stats.transform(data, 'zscore');
    close(scaled.points.reduce((s, p) => s + p.x, 0), 0);
    close(scaled.points.reduce((s, p) => s + p.x ** 2, 0) / 3, 1);
    assert.deepEqual(scaled.points.map(p => p.y), [0, 0, 0]);
    assert.deepEqual(Stats.transform(data, 'minmax').points.map(p => p.x), [0, .5, 1]);
    assert.deepEqual(data, saved);
});
test('Outliers calcula cuartiles y detecta el extremo; columnas constantes tienen Z=0', () => {
    const data = points([[1, 5], [2, 5], [3, 5], [4, 5], [100, 5]]);
    const result = Stats.outliers(data);
    close(result.q1, 2); close(result.median, 3); close(result.q3, 4);
    assert.equal(result.rows.at(-1).iqr, true);
    assert.ok(Stats.outliers(data, {varKey: 'y'}).rows.every(r => r.z === 0 && !r.iqr));
});
test('Evaluación de K incluye SSE de K=1 y elige la separación del ejemplo', () => {
    const rows = Stats.evaluateK(sample, 4);
    assert.deepEqual(rows.map(r => r.k), [1, 2, 3, 4]);
    assert.equal(rows[0].silhouette, null);
    const best = rows.filter(r => r.silhouette !== null).sort((a, b) => b.silhouette - a.silhouette)[0];
    assert.equal(best.k, 2);
    assert.ok(rows.every(r => Number.isFinite(r.cost)));
});
test('CSV reconoce BOM, comillas escapadas, saltos de línea y coma decimal con punto y coma', () => {
    const csv = '\uFEFFID;X;Y\r\n"A;uno";1,5;-2,25\r\n"B""dos\nsegunda línea";3;4\r\n';
    const parsed = Files.parseCSV(csv);
    const data = Files.mapCSV(parsed, {id: 0, x: 1, y: 2});
    assert.equal(data[0].id, 'A;uno'); close(data[0].x, 1.5); close(data[0].y, -2.25);
    assert.equal(data[1].id, 'B"dos\nsegunda línea');
});
test('CSV rechaza valores parciales, ausentes, comillas rotas y columnas inconsistentes', () => {
    for (const value of ['', '12abc', 'Infinity', 'NaN', '1e999', '0x10']) assert.throws(() => Files.number(value));
    assert.throws(() => Files.parseCSV('X,Y\n1,2\n"3,4'), /comillas/);
    assert.throws(() => Files.parseCSV('X,Y\n1,2\n3'), /columnas/);
    assert.throws(() => Files.mapCSV(Files.parseCSV('X,Y\n1,2\n3,4'), {x: 0, y: 0}), /distintas/);
});
test('CSV exporta encabezados escapados y protege textos interpretables como fórmulas', () => {
    const csv = Files.csv(['Identificador, caso', 'X', 'Y'], [['=1+1', -2, 4], ['A"B', 0, 3]]);
    assert.ok(csv.startsWith('\uFEFF"Identificador, caso"'));
    assert.ok(csv.includes('"\'=1+1"'));
    const result = Files.mapCSV(Files.parseCSV(csv), {id: 0, x: 1, y: 2});
    assert.equal(result[1].id, 'A"B'); assert.equal(result[0].x, -2);
});
