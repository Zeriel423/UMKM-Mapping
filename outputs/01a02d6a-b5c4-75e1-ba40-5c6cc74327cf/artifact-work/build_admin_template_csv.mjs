import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Workbook } from '@oai/artifact-tool';

const outputDir = path.resolve('..');
const outputPath = path.join(outputDir, 'template-impor-umkm-admin.csv');
const previewPath = path.join(outputDir, 'preview-template-impor-umkm-admin.png');

const headers = [
  'id',
  'name',
  'product_type',
  'product_label',
  'brand',
  'owner',
  'address',
  'analysis_lat',
  'analysis_lng',
  'display_lat',
  'display_lng',
  'location_accuracy',
  'location_area',
  'is_active',
  'published',
];

const exampleRows = [
  [
    '',
    '[CONTOH - HAPUS BARIS INI] UMKM Tanpa Koordinat',
    'A0007',
    'Roti, Kue & Biskuit',
    'Brand Contoh',
    'Nama Pemilik Contoh',
    'Alamat lengkap UMKM, Kecamatan Wanea, Kota Manado, Sulawesi Utara',
    '',
    '',
    '',
    '',
    'belum_terverifikasi',
    'Kecamatan Wanea, Kota Manado',
    false,
    false,
  ],
  [
    '',
    '[CONTOH - HAPUS BARIS INI] UMKM Dengan Koordinat Perkiraan',
    'A0009',
    'Ikan & Olahan Laut',
    'Brand Contoh',
    'Nama Pemilik Contoh',
    'Alamat lengkap UMKM, Kecamatan Wenang, Kota Manado, Sulawesi Utara',
    1.4748,
    124.8421,
    1.4748,
    124.8421,
    'perkiraan_kecamatan',
    'Kecamatan Wenang, Kota Manado',
    false,
    false,
  ],
];

const matrix = [headers, ...exampleRows];
const workbook = Workbook.create();
const sheet = workbook.worksheets.add('Template Impor UMKM');
sheet.getRange('A1:O3').values = matrix;
sheet.freezePanes.freezeRows(1);
sheet.showGridLines = false;

sheet.getRange('A1:O1').format = {
  fill: '#155F56',
  font: { bold: true, color: '#FFFFFF' },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
  wrapText: true,
};
sheet.getRange('A2:O3').format = {
  fill: '#FFF7D6',
  font: { color: '#152523', italic: true },
  verticalAlignment: 'top',
  wrapText: true,
};
sheet.getRange('A1:O3').format.borders = {
  preset: 'all',
  style: 'thin',
  color: '#DCE6E3',
};
sheet.getRange('H2:K3').format.numberFormat = '0.000000';
sheet.getRange('N2:O3').format.horizontalAlignment = 'center';
sheet.getRange('A1:O3').format.autofitColumns();
sheet.getRange('A:A').format.columnWidthPx = 45;
sheet.getRange('B:B').format.columnWidthPx = 360;
sheet.getRange('C:C').format.columnWidthPx = 105;
sheet.getRange('D:D').format.columnWidthPx = 165;
sheet.getRange('E:F').format.columnWidthPx = 145;
sheet.getRange('G:G').format.columnWidthPx = 470;
sheet.getRange('H:K').format.columnWidthPx = 100;
sheet.getRange('L:L').format.columnWidthPx = 165;
sheet.getRange('M:M').format.columnWidthPx = 235;
sheet.getRange('N:O').format.columnWidthPx = 85;
sheet.getRange('A1:O1').format.rowHeightPx = 34;
sheet.getRange('A2:O3').format.rowHeightPx = 40;

const csvCell = (value) => {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text.trimStart()) && !/^-\d+(?:\.\d+)?$/.test(text.trim())) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const csvText = matrix.map((row) => row.map(csvCell).join(',')).join('\r\n');
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(outputPath, `\uFEFF${csvText}`, 'utf8');

const inspection = await workbook.inspect({
  kind: 'region',
  sheetId: 'Template Impor UMKM',
  range: 'A1:O3',
  include: 'values',
  maxChars: 8000,
});

const errorScan = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 100 },
  summary: 'final formula error scan',
});

const preview = await workbook.render({
  sheetName: 'Template Impor UMKM',
  range: 'A1:O3',
  scale: 1,
  format: 'png',
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const finalCsv = (await fs.readFile(outputPath, 'utf8')).replace(/^\uFEFF/, '');
const roundTrip = await Workbook.fromCSV(finalCsv, { sheetName: 'CSV Validation' });
const roundTripCheck = await roundTrip.inspect({
  kind: 'region',
  sheetId: 'CSV Validation',
  range: 'A1:O3',
  include: 'values',
  maxChars: 4000,
});

const projectRoot = path.resolve(outputDir, '..', '..');
const parserModuleUrl = pathToFileURL(
  path.join(projectRoot, 'web-app', 'src', 'admin', 'utils', 'csv.js'),
).href;
const { parseBusinessCsv } = await import(parserModuleUrl);
const applicationValidation = parseBusinessCsv(finalCsv);
if (applicationValidation.errors.length > 0) {
  throw new Error(`Parser aplikasi menolak template: ${applicationValidation.errors.join(' | ')}`);
}

if (
  applicationValidation.businesses.length !== exampleRows.length
  || applicationValidation.businesses.some((row) => row.is_active || row.published)
) {
  throw new Error('Validasi keamanan baris contoh gagal.');
}

console.log(JSON.stringify({
  outputPath,
  previewPath,
  dataRows: exampleRows.length,
  columnCount: headers.length,
  inspection: inspection.ndjson,
  errorScan: errorScan.ndjson,
  roundTrip: roundTripCheck.ndjson,
  applicationParser: {
    acceptedRows: applicationValidation.businesses.length,
    errors: applicationValidation.errors,
    examplesAreInactive: applicationValidation.businesses.every((row) => !row.is_active),
    examplesAreUnpublished: applicationValidation.businesses.every((row) => !row.published),
  },
}, null, 2));
