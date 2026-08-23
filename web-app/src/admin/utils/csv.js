import { LOCATION_ACCURACY } from '../../utils/location.js';

const CSV_COLUMNS = [
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

const ALLOWED_LOCATION_ACCURACY = new Set(Object.values(LOCATION_ACCURACY));
const NEGATIVE_NUMBER_PATTERN = /^-(?:(?:\d+(?:[.,]\d*)?)|(?:[.,]\d+))(?:[eE][+-]?\d+)?$/;

const parseCsvRows = (text) => {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (quoted) {
    throw new Error('CSV memiliki tanda kutip yang tidak ditutup.');
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
};

const TRUE_VALUES = new Set(['true', '1', 'ya', 'yes', 'y', 'aktif', 'on']);
const FALSE_VALUES = new Set(['false', '0', 'tidak', 'no', 'n', 'nonaktif', 'off']);

const booleanValue = (value, label, rowNumber, errors, defaultValue = true) => {
  if (value === undefined || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  errors.push(`Baris ${rowNumber}: ${label} harus berupa true/false, ya/tidak, aktif/nonaktif, atau 1/0.`);
  return defaultValue;
};

const isBlank = (value) => value === undefined || value === null || value === '';

const parseCoordinate = (rawValue, label, minimum, maximum, rowNumber, errors) => {
  if (isBlank(rawValue)) return null;

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    errors.push(`Baris ${rowNumber}: ${label} tidak valid.`);
    return null;
  }

  if (value < minimum || value > maximum) {
    errors.push(`Baris ${rowNumber}: ${label} di luar rentang ${minimum} sampai ${maximum}.`);
  }

  return value;
};

const parseId = (rawValue, rowNumber, errors) => {
  if (isBlank(rawValue)) return undefined;

  if (!/^\d+$/.test(rawValue)) {
    errors.push(`Baris ${rowNumber}: ID harus berupa bilangan bulat non-negatif.`);
    return undefined;
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 0) {
    errors.push(`Baris ${rowNumber}: ID harus berupa bilangan bulat non-negatif yang valid.`);
    return undefined;
  }

  return value;
};

const hasValidCoordinatePair = (lat, lng) => (
  Number.isFinite(lat)
  && lat >= -90
  && lat <= 90
  && Number.isFinite(lng)
  && lng >= -180
  && lng <= 180
);

export const parseBusinessCsv = (text) => {
  if (typeof text !== 'string') throw new Error('Isi CSV tidak valid.');

  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('CSV tidak memiliki baris data.');

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const emptyHeaderIndexes = headers
    .map((header, index) => (header ? null : index + 1))
    .filter((index) => index !== null);
  if (emptyHeaderIndexes.length) {
    throw new Error(`Nama header CSV kosong pada kolom ${emptyHeaderIndexes.join(', ')}.`);
  }

  const duplicateHeaders = headers.filter(
    (header, index) => headers.indexOf(header) !== index,
  );
  if (duplicateHeaders.length) {
    throw new Error(`Header CSV duplikat ditemukan: ${[...new Set(duplicateHeaders)].join(', ')}.`);
  }

  const required = ['name', 'address'];
  const missing = required.filter((column) => !headers.includes(column));
  if (missing.length) {
    throw new Error(`Kolom wajib belum tersedia: ${missing.join(', ')}.`);
  }

  const errors = [];
  const businesses = rows.slice(1).map((cells, rowIndex) => {
    const rowNumber = rowIndex + 2;
    if (cells.length > headers.length) {
      errors.push(`Baris ${rowNumber}: terdapat ${cells.length - headers.length} kolom berlebih.`);
    }

    const record = Object.fromEntries(
      headers.map((header, index) => [header, cells[index]?.trim() ?? '']),
    );

    if (!record.name.trim()) errors.push(`Baris ${rowNumber}: name wajib diisi.`);
    if (!record.address.trim()) errors.push(`Baris ${rowNumber}: address wajib diisi.`);

    const id = parseId(record.id, rowNumber, errors);
    const hasAnalysisLat = !isBlank(record.analysis_lat);
    const hasAnalysisLng = !isBlank(record.analysis_lng);
    const hasDisplayLat = !isBlank(record.display_lat);
    const hasDisplayLng = !isBlank(record.display_lng);

    if (hasAnalysisLat !== hasAnalysisLng) {
      errors.push(`Baris ${rowNumber}: analysis_lat dan analysis_lng harus diisi berpasangan.`);
    }
    if (hasDisplayLat !== hasDisplayLng) {
      errors.push(`Baris ${rowNumber}: display_lat dan display_lng harus diisi berpasangan.`);
    }

    const lat = parseCoordinate(record.analysis_lat, 'analysis_lat', -90, 90, rowNumber, errors);
    const lng = parseCoordinate(record.analysis_lng, 'analysis_lng', -180, 180, rowNumber, errors);
    const parsedDisplayLat = parseCoordinate(record.display_lat, 'display_lat', -90, 90, rowNumber, errors);
    const parsedDisplayLng = parseCoordinate(record.display_lng, 'display_lng', -180, 180, rowNumber, errors);
    const hasExplicitDisplayCoordinates = hasDisplayLat || hasDisplayLng;
    const displayLat = hasExplicitDisplayCoordinates ? parsedDisplayLat : lat;
    const displayLng = hasExplicitDisplayCoordinates ? parsedDisplayLng : lng;

    const rawLocationAccuracy = String(record.location_accuracy ?? '').toLowerCase();
    const locationAccuracy = rawLocationAccuracy || LOCATION_ACCURACY.UNKNOWN;
    if (rawLocationAccuracy && !ALLOWED_LOCATION_ACCURACY.has(rawLocationAccuracy)) {
      errors.push(
        `Baris ${rowNumber}: location_accuracy harus salah satu dari ${[...ALLOWED_LOCATION_ACCURACY].join(', ')}.`,
      );
    }
    if (locationAccuracy === LOCATION_ACCURACY.EXACT) {
      errors.push(`Baris ${rowNumber}: status tepat hanya dapat diberikan melalui menu Verifikasi Lokasi.`);
    }

    if (
      locationAccuracy !== LOCATION_ACCURACY.UNKNOWN
      && !hasValidCoordinatePair(lat, lng)
    ) {
      errors.push(`Baris ${rowNumber}: status lokasi selain belum terverifikasi memerlukan koordinat analisis yang valid.`);
    }

    return {
      ...record,
      id,
      analysis_lat: lat,
      analysis_lng: lng,
      display_lat: displayLat,
      display_lng: displayLng,
      location_accuracy: ALLOWED_LOCATION_ACCURACY.has(locationAccuracy)
        ? locationAccuracy
        : LOCATION_ACCURACY.UNKNOWN,
      is_active: booleanValue(record.is_active, 'is_active', rowNumber, errors),
      published: booleanValue(record.published, 'published', rowNumber, errors),
    };
  });

  const duplicateIds = businesses
    .map((business) => business.id)
    .filter((id) => id !== undefined)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateIds.length) {
    errors.push(`ID duplikat ditemukan: ${[...new Set(duplicateIds)].slice(0, 10).join(', ')}.`);
  }

  return { businesses, errors };
};

const spreadsheetSafeText = (value) => {
  const text = String(value ?? '');
  if (typeof value !== 'string') return text;

  const candidate = text.trimStart();
  const beginsWithFormulaCharacter = /^[=+\-@]/.test(candidate);
  const isNegativeNumber = candidate.startsWith('-')
    && NEGATIVE_NUMBER_PATTERN.test(candidate.trim());

  return beginsWithFormulaCharacter && !isNegativeNumber ? `'${text}` : text;
};

const csvCell = (value) => {
  const text = spreadsheetSafeText(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const businessesToCsv = (businesses) => [
  CSV_COLUMNS.join(','),
  ...businesses.map((business) =>
    CSV_COLUMNS.map((column) => csvCell(business[column])).join(','),
  ),
].join('\r\n');

export const downloadCsv = (filename, contents) => {
  const blob = new Blob([`\uFEFF${contents}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
