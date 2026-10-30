// Ejemplos del curso: datos originales, sin resultados calculados.
const PRESET_DATASETS = {
    pdf1_edades: {
        badge: 'PDF 1 - Edades de Estudiantes (Detección Z-Score / IQR)',
        varXLabel: 'Edad del Estudiante (Años)',
        varYLabel: 'Índice Académico (Aux)',
        univariateOnly: true,
        defaultC1: 0,
        defaultC2: 9,
        rows: [
            { id: 'E1', x: 20, y: 14 },
            { id: 'E2', x: 21, y: 15 },
            { id: 'E3', x: 19, y: 14 },
            { id: 'E4', x: 22, y: 16 },
            { id: 'E5', x: 20, y: 15 },
            { id: 'E6', x: 21, y: 15 },
            { id: 'E7', x: 19, y: 13 },
            { id: 'E8', x: 23, y: 16 },
            { id: 'E9', x: 20, y: 14 },
            { id: 'E10', x: 45, y: 17 }
        ]
    },
    pdf1_salarios: {
        badge: 'PDF 1 - Ejercicio Salarios Mensuales en Soles (S/ 8000 Outlier)',
        varXLabel: 'Salario Mensual (Soles S/)',
        varYLabel: 'Años de Antigüedad',
        univariateOnly: true,
        defaultC1: 0,
        defaultC2: 9,
        rows: [
            { id: 'T1', x: 1500, y: 2 },
            { id: 'T2', x: 1600, y: 3 },
            { id: 'T3', x: 1550, y: 2 },
            { id: 'T4', x: 1700, y: 4 },
            { id: 'T5', x: 1650, y: 3 },
            { id: 'T6', x: 1580, y: 2 },
            { id: 'T7', x: 1620, y: 3 },
            { id: 'T8', x: 1680, y: 4 },
            { id: 'T9', x: 1600, y: 3 },
            { id: 'T10', x: 8000, y: 15 }
        ]
    },
    pdf2_estudiantes: {
        badge: 'PDF 2 - Ejemplo K-Means (Horas de estudio vs Nota)',
        varXLabel: 'Horas de estudio (X)',
        varYLabel: 'Nota promedio (Y)',
        univariateOnly: false,
        defaultC1: 0, // A=(2,10)
        defaultC2: 3, // D=(8,17)
        rows: [
            { id: 'A', x: 2, y: 10 },
            { id: 'B', x: 3, y: 11 },
            { id: 'C', x: 4, y: 12 },
            { id: 'D', x: 8, y: 17 },
            { id: 'E', x: 9, y: 18 },
            { id: 'F', x: 10, y: 19 }
        ]
    },
    pdf2_clientes: {
        badge: 'PDF 2 - Ejercicio Clientes K-Means (Compras vs Gasto)',
        varXLabel: 'Compras mensuales (X)',
        varYLabel: 'Gasto mensual S/ (Y)',
        univariateOnly: false,
        defaultC1: 0, // A=(2,100)
        defaultC2: 3, // D=(8,500)
        rows: [
            { id: 'A', x: 2, y: 100 },
            { id: 'B', x: 3, y: 120 },
            { id: 'C', x: 4, y: 140 },
            { id: 'D', x: 8, y: 500 },
            { id: 'E', x: 9, y: 520 },
            { id: 'F', x: 10, y: 550 }
        ]
    },
    pdf3_estudiantes: {
        badge: 'PDF 3 - Ejemplo K-Medoids PAM (Estudiantes Horas vs Nota)',
        varXLabel: 'Horas de estudio (X)',
        varYLabel: 'Calificación promedio (Y)',
        univariateOnly: false,
        defaultC1: 0, // A=(2,11)
        defaultC2: 3, // D=(8,17)
        rows: [
            { id: 'A', x: 2, y: 11 },
            { id: 'B', x: 3, y: 12 },
            { id: 'C', x: 4, y: 13 },
            { id: 'D', x: 8, y: 17 },
            { id: 'E', x: 9, y: 18 },
            { id: 'F', x: 10, y: 19 }
        ]
    },
    pdf3_outlier: {
        badge: 'PDF 3 - K-Medoids con Estudiante Atípico G(30,30)',
        varXLabel: 'Horas de estudio (X)',
        varYLabel: 'Calificación promedio (Y)',
        univariateOnly: false,
        defaultC1: 0, // A=(2,11)
        defaultC2: 3, // D=(8,17)
        rows: [
            { id: 'A', x: 2, y: 11 },
            { id: 'B', x: 3, y: 12 },
            { id: 'C', x: 4, y: 13 },
            { id: 'D', x: 8, y: 17 },
            { id: 'E', x: 9, y: 18 },
            { id: 'F', x: 10, y: 19 },
            { id: 'G', x: 30, y: 30 }
        ]
    },
    pdf3_ejercicio: {
        badge: 'PDF 3 - Ejercicio K-Medoids Puntos A(1,1) a F(10,8)',
        varXLabel: 'Coordenada X',
        varYLabel: 'Coordenada Y',
        univariateOnly: false,
        defaultC1: 0, // A=(1,1)
        defaultC2: 3, // D=(8,8)
        rows: [
            { id: 'A', x: 1, y: 1 },
            { id: 'B', x: 2, y: 2 },
            { id: 'C', x: 3, y: 2 },
            { id: 'D', x: 8, y: 8 },
            { id: 'E', x: 9, y: 9 },
            { id: 'F', x: 10, y: 8 }
        ]
    }
};
