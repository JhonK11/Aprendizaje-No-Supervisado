/* Lectura y escritura de archivos; no interpreta HTML ni ejecuta contenido importado. */
const FileFormats = (() => {
    function parseCSV(source) {
        if (typeof source !== 'string' || source.length > 5_000_000) throw new Error('El CSV debe ocupar menos de 5 MB.');
        source = source.replace(/^\uFEFF/, '');
        const firstLine = source.split(/\r?\n/)[0];
        const counts = [',', ';', '\t'].map(delimiter => {
            let quoted = false, count = 0;
            for (let i = 0; i < firstLine.length; i++) {
                if (firstLine[i] === '"') {
                    if (quoted && firstLine[i + 1] === '"') i++; else quoted = !quoted;
                } else if (!quoted && firstLine[i] === delimiter) count++;
            }
            return {delimiter, count};
        }).sort((a, b) => b.count - a.count);
        const delimiter = counts[0].delimiter;
        let row = [], cell = '', quoted = false, closed = false;
        const records = [];
        const pushCell = () => { row.push(cell); cell = ''; closed = false; };
        const pushRow = () => {
            pushCell();
            if (row.some(v => v.trim() !== '')) records.push(row);
            row = [];
        };
        for (let i = 0; i < source.length; i++) {
            const char = source[i];
            if (quoted) {
                if (char === '"') {
                    if (source[i + 1] === '"') { cell += '"'; i++; }
                    else { quoted = false; closed = true; }
                } else cell += char;
            } else if (char === delimiter) pushCell();
            else if (char === '\n' || char === '\r') {
                if (char === '\r' && source[i + 1] === '\n') i++;
                pushRow();
            } else if (char === '"') {
                if (cell || closed) throw new Error('Comillas inesperadas en el CSV.');
                quoted = true;
            } else {
                if (closed) {
                    if (char.trim()) throw new Error('Hay texto después de una celda entre comillas.');
                } else cell += char;
            }
        }
        if (quoted) throw new Error('El CSV tiene comillas sin cerrar.');
        if (cell || row.length || closed) pushRow();
        if (records.length < 3) throw new Error('El CSV necesita encabezados y al menos 2 filas de datos.');
        const headers = records.shift().map(v => v.trim());
        if (headers.length < 2 || headers.some(v => !v) || new Set(headers).size !== headers.length) throw new Error('Usa al menos 2 encabezados únicos y no vacíos.');
        if (records.length > 1000) throw new Error('Puedes importar hasta 1000 observaciones.');
        records.forEach((r, i) => { if (r.length !== headers.length) throw new Error(`La fila de datos ${i + 1} no tiene ${headers.length} columnas.`); });
        return {headers, records, delimiter};
    }
    function number(value, decimalComma = false) {
        let text = String(value).trim();
        if (decimalComma) text = text.replace(',', '.');
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) throw new Error(`Valor numérico inválido: ${String(value).slice(0, 40)}`);
        const result = Number(text);
        if (!Number.isFinite(result) || Math.abs(result) > 1e100) throw new Error('El valor debe ser finito y no superar 1e100 en magnitud.');
        return result;
    }
    function mapCSV(parsed, {id = -1, x, y}) {
        if (![x, y].every(i => Number.isInteger(i) && i >= 0 && i < parsed.headers.length) || x === y || id === x || id === y || id < -1 || id >= parsed.headers.length) throw new Error('Selecciona columnas distintas para ID, X e Y.');
        return parsed.records.map((r, i) => {
            try {
                return {id: id < 0 ? `Obs_${i + 1}` : r[id].trim(), x: number(r[x], parsed.delimiter !== ','), y: number(r[y], parsed.delimiter !== ',')};
            } catch (error) { throw new Error(`Fila ${i + 1}: ${error.message}`); }
        });
    }
    function csv(headers, rows) {
        const quote = value => {
            let text = String(value ?? '');
            // Los textos que Excel trataría como fórmulas se exportan como texto.
            if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
            return '"' + text.replace(/"/g, '""') + '"';
        };
        return '\uFEFF' + [headers, ...rows].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
    }
    return {parseCSV, number, mapCSV, csv};
})();
if (typeof module !== 'undefined') module.exports = FileFormats;
