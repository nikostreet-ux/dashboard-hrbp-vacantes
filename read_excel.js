const XLSX = require('xlsx');
const fs = require('fs');

function excelDateToJS(serial) {
    if (!serial || isNaN(serial)) return new Date().toISOString().split('T')[0];
    const utc_days  = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return date_info.toISOString().split('T')[0];
}

try {
    const workbook = XLSX.readFile('vacancies.xlsx');
    const sheet = workbook.Sheets['Detalle Vacantes'];
    const rawData = XLSX.utils.sheet_to_json(sheet);

    const mappedData = rawData.map((item) => {
        return {
            "HRBP": item["HRBP"] || "",
            "País": item["País"] || "",
            "Coordinador TA Responsable": item["Coordinador TA Responsable"] || "",
            "Equipo TA": item["Equipo TA"] || "",
            "Gerencia": item["Gerencia"] || "",
            "Motivo de Busqueda": item["Motivo de Busqueda"] || "",
            "Líder": item["Líder"] || "",
            "Cargo": item["Cargo"] || "",
            "Familia de cargo": item["Familia de cargo"] || "",
            "¿A quién reemplaza?": item["¿A quién reemplaza?"] || "",
            "Estado": item["Estado"] || "",
            "TTF": item["TTF"] || 0,
            "Comentarios": item["Comentarios"] || "",
            "Fecha Inicio Búsqueda": excelDateToJS(item["Fecha Inicio Búsqueda"]),
            "Fecha Cubierta Búsqueda": excelDateToJS(item["Fecha Cubierta Búsqueda"]),
            "Forecast": item["Forecast"] || ""
        };
    });

    const content = `const vacanciesData = ${JSON.stringify(mappedData, null, 2)};\n\nexport default vacanciesData;`;
    fs.writeFileSync('data.js', content);
    console.log('Successfully updated data.js with', mappedData.length, 'vacancies.');
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
