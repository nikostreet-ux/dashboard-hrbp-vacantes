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

    const mappedData = rawData.map((item, index) => {
        let status = item['Estado'] || 'Open';
        if (status === 'Activa') status = 'Open';
        else if (status === 'Cerrada') status = 'Closed';

        return {
            id: `VAC-${String(index + 1).padStart(3, '0')}`,
            role: item['Cargo'] || 'Sin Cargo',
            department: item['Gerencia'] || 'Sin Departamento',
            hrbp: item['HRBP'] || 'Sin HRBP',
            location: item['País'] || 'Desconocido',
            postedDate: excelDateToJS(item['Fecha Inicio Búsqueda']),
            status: status,
            priority: 'Medium', // Default
            applicants: 0 // Default
        };
    });

    const content = `const vacanciesData = ${JSON.stringify(mappedData, null, 2)};\n\nexport default vacanciesData;`;
    fs.writeFileSync('data.js', content);
    console.log('Successfully updated data.js with', mappedData.length, 'vacancies.');
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
