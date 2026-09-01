import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Workbook } from '@oai/artifact-tool';

const outputDir = path.resolve('..');
const outputPath = path.join(outputDir, 'data-dummy-umkm-demo.csv');
const previewPath = path.join(outputDir, 'preview-data-dummy-umkm.png');

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

const products = [
  ['A0001', 'Daging & Olahannya'],
  ['A0002', 'Minyak & Lemak'],
  ['A0003', 'Susu & Olahannya'],
  ['A0004', 'Makanan Olahan'],
  ['A0005', 'Buah & Sayur Olahan'],
  ['A0006', 'Tepung & Olahannya'],
  ['A0007', 'Roti, Kue & Biskuit'],
  ['A0009', 'Ikan & Olahan Laut'],
  ['A0010', 'Telur & Olahannya'],
  ['A0011', 'Bumbu & Rempah'],
  ['A0012', 'Kacang & Olahannya'],
  ['A0014', 'Makanan Ringan'],
  ['A0016', 'Jasa Boga / Katering'],
  ['B0001', 'Obat Tradisional / Jamu'],
];

const productThemes = {
  A0001: 'Daging Asap',
  A0002: 'Minyak Kelapa',
  A0003: 'Susu Segar',
  A0004: 'Dapur Rasa',
  A0005: 'Manisan Buah',
  A0006: 'Tepung Lokal',
  A0007: 'Kue Pesisir',
  A0009: 'Abon Cakalang',
  A0010: 'Telur Gurih',
  A0011: 'Bumbu Dapur',
  A0012: 'Kacang Garing',
  A0014: 'Camilan Nyiur',
  A0016: 'Katering Mapalus',
  B0001: 'Jamu Sehat',
};

const regions = [
  {
    short: 'Manado',
    city: 'Kota Manado',
    baseLat: 1.4748,
    baseLng: 124.8421,
    districts: ['Kecamatan Wenang', 'Kecamatan Sario', 'Kecamatan Wanea', 'Kecamatan Mapanget'],
  },
  {
    short: 'Minahasa',
    city: 'Kabupaten Minahasa',
    baseLat: 1.3054,
    baseLng: 124.913,
    districts: ['Kecamatan Tondano Barat', 'Kecamatan Tondano Timur', 'Kecamatan Kawangkoan', 'Kecamatan Remboken'],
  },
  {
    short: 'Kotamobagu',
    city: 'Kota Kotamobagu',
    baseLat: 0.733,
    baseLng: 124.312,
    districts: ['Kecamatan Kotamobagu Barat', 'Kecamatan Kotamobagu Timur', 'Kecamatan Kotamobagu Utara', 'Kecamatan Kotamobagu Selatan'],
  },
];

const records = regions.flatMap((region, regionIndex) => Array.from({ length: 20 }, (_, itemIndex) => {
  const sequence = regionIndex * 20 + itemIndex + 1;
  const regionalNumber = String(itemIndex + 1).padStart(2, '0');
  const product = products[(sequence * 3 + regionIndex) % products.length];
  const district = region.districts[itemIndex % region.districts.length];
  const isApproximate = itemIndex < 18;
  const latitudeOffset = ((itemIndex % 6) - 2.5) * 0.0042;
  const longitudeOffset = (Math.floor(itemIndex / 6) - 1) * 0.0054;
  const latitude = isApproximate ? Number((region.baseLat + latitudeOffset).toFixed(6)) : '';
  const longitude = isApproximate ? Number((region.baseLng + longitudeOffset).toFixed(6)) : '';

  return [
    '',
    `UMKM Demo ${region.short} ${regionalNumber}`,
    product[0],
    product[1],
    `${productThemes[product[0]]} Demo ${region.short} ${regionalNumber}`,
    `Pemilik Demo ${String(sequence).padStart(3, '0')}`,
    `Alamat Dummy No. ${regionalNumber}, ${district}, ${region.city}, Sulawesi Utara`,
    latitude,
    longitude,
    latitude,
    longitude,
    isApproximate ? 'perkiraan_kecamatan' : 'belum_terverifikasi',
    `${district}, ${region.city}`,
    true,
    true,
  ];
}));

const matrix = [headers, ...records];
const workbook = Workbook.create();
const sheet = workbook.worksheets.add('Data Demo UMKM');
sheet.getRange(`A1:O${matrix.length}`).values = matrix;
sheet.freezePanes.freezeRows(1);
sheet.showGridLines = false;

sheet.getRange('A1:O1').format = {
  fill: '#155F56',
  font: { bold: true, color: '#FFFFFF' },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
  wrapText: true,
};
sheet.getRange(`A2:O${matrix.length}`).format = {
  font: { color: '#152523' },
  verticalAlignment: 'top',
};
sheet.getRange(`H2:K${matrix.length}`).format.numberFormat = '0.000000';
sheet.getRange(`N2:O${matrix.length}`).format.horizontalAlignment = 'center';
sheet.getRange(`A1:O${matrix.length}`).format.autofitColumns();
sheet.getRange('A:A').format.columnWidthPx = 45;
sheet.getRange('B:B').format.columnWidthPx = 185;
sheet.getRange('D:D').format.columnWidthPx = 165;
sheet.getRange('E:E').format.columnWidthPx = 230;
sheet.getRange('F:F').format.columnWidthPx = 125;
sheet.getRange('G:G').format.columnWidthPx = 500;
sheet.getRange('H:K').format.columnWidthPx = 100;
sheet.getRange('L:L').format.columnWidthPx = 160;
sheet.getRange('M:M').format.columnWidthPx = 300;
sheet.getRange('N:O').format.columnWidthPx = 80;
sheet.getRange('A1:O1').format.rowHeightPx = 34;

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
  sheetId: 'Data Demo UMKM',
  range: 'A1:O8',
  include: 'values',
  maxChars: 7000,
});

const errorScan = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 100 },
  summary: 'final formula error scan',
});

const preview = await workbook.render({
  sheetName: 'Data Demo UMKM',
  range: 'A1:O12',
  scale: 1,
  format: 'png',
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const finalCsv = (await fs.readFile(outputPath, 'utf8')).replace(/^\uFEFF/, '');
const roundTrip = await Workbook.fromCSV(finalCsv, { sheetName: 'CSV Validation' });
const roundTripCheck = await roundTrip.inspect({
  kind: 'region',
  sheetId: 'CSV Validation',
  range: 'A1:O61',
  include: 'values',
  maxChars: 1200,
  tableMaxRows: 3,
  tableMaxCols: 15,
});

const projectRoot = path.resolve(outputDir, '..', '..');
const parserModuleUrl = pathToFileURL(
  path.join(projectRoot, 'web-app', 'src', 'admin', 'utils', 'csv.js'),
).href;
const { parseBusinessCsv } = await import(parserModuleUrl);
const applicationValidation = parseBusinessCsv(finalCsv);
if (applicationValidation.errors.length > 0) {
  throw new Error(`Parser aplikasi menolak CSV: ${applicationValidation.errors.join(' | ')}`);
}

const counts = records.reduce((summary, row) => {
  summary[row[11]] = (summary[row[11]] || 0) + 1;
  return summary;
}, {});

console.log(JSON.stringify({
  outputPath,
  previewPath,
  rowCount: records.length,
  columnCount: headers.length,
  locationAccuracyCounts: counts,
  regions: regions.map((region) => region.short),
  inspection: inspection.ndjson,
  errorScan: errorScan.ndjson,
  roundTrip: roundTripCheck.ndjson,
  applicationParser: {
    acceptedRows: applicationValidation.businesses.length,
    errors: applicationValidation.errors,
  },
}, null, 2));
