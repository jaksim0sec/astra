import {deflateRawSync} from 'node:zlib';
import {randomUUID} from 'node:crypto';

const STORE = new Map();
const TTL_MS = 2 * 60 * 60 * 1000;
const MAX_TEXT_CHARS = 600000;

const FORMAT_INFO = {
  PDF:  {ext: 'pdf',  mime: 'application/pdf'},
  DOCX: {ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},
  XLSX: {ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},
  CSV:  {ext: 'csv',  mime: 'text/csv; charset=utf-8'},
  TXT:  {ext: 'txt',  mime: 'text/plain; charset=utf-8'},
  MD:   {ext: 'md',   mime: 'text/markdown; charset=utf-8'},
  JSON: {ext: 'json', mime: 'application/json; charset=utf-8'},
  HTML: {ext: 'html', mime: 'text/html; charset=utf-8'},
  RTF:  {ext: 'rtf',  mime: 'application/rtf'}
};

function prune() {
  const now = Date.now();
  for (const [id, item] of STORE.entries()) {
    if (now - item.createdAt > TTL_MS) STORE.delete(id);
  }
}

function formatName(value) {
  const raw = String(value || 'TXT').trim().toUpperCase().replace(/^\./, '');
  if (FORMAT_INFO[raw]) return raw;
  if (raw === 'MARKDOWN') return 'MD';
  if (raw === 'TEXT') return 'TXT';
  if (raw === 'WORD') return 'DOCX';
  if (raw === 'EXCEL' || raw === 'SHEET') return 'XLSX';
  return 'TXT';
}

function safeBaseName(value) {
  const clean = String(value || 'result')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return clean || 'result';
}

function withExtension(name, ext) {
  const base = safeBaseName(name);
  const dot = base.lastIndexOf('.');
  if (dot > 0 && base.slice(dot + 1).toLowerCase() === ext.toLowerCase()) return base;
  return base + '.' + ext;
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function compactValue(value, depth = 0) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (depth > 5) return '[nested]';
  if (Array.isArray(value)) return value.map(item => compactValue(item, depth + 1)).join('\n');
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => key + ': ' + compactValue(item, depth + 1)).join('\n');
  }
  return String(value);
}

function sourceText(sources) {
  const list = Array.isArray(sources) ? sources : [sources];
  return list.map(item => compactValue(item)).filter(Boolean).join('\n\n').slice(0, MAX_TEXT_CHARS);
}

function tableRows(sources) {
  const list = Array.isArray(sources) ? sources : [sources];
  const candidate = list.length === 1 ? list[0] : list;
  if (Array.isArray(candidate) && candidate.length && candidate.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
    const keys = [...new Set(candidate.flatMap(item => Object.keys(item)))].slice(0, 40);
    return [keys, ...candidate.slice(0, 5000).map(item => keys.map(key => compactValue(item[key])))];
  }
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    return [['항목', '값'], ...Object.entries(candidate).slice(0, 5000).map(([key, value]) => [key, compactValue(value)])];
  }
  return sourceText(sources).split(/\r?\n/).slice(0, 5000).map(line => [line]);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function csvBuffer(sources) {
  const body = tableRows(sources).map(row => row.map(csvEscape).join(',')).join('\r\n');
  return Buffer.from('\uFEFF' + body, 'utf8');
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimeDate(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function zipBuffer(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const stamp = dosTimeDate();
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const localBuffer = Buffer.concat(locals);
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(localBuffer.length, 16);
  return Buffer.concat([localBuffer, centralBuffer, end]);
}

function docxBuffer(sources) {
  const paragraphs = sourceText(sources).split(/\r?\n/).map(line =>
    '<w:p><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Malgun Gothic"/></w:rPr><w:t xml:space="preserve">' + xmlEscape(line || ' ') + '</w:t></w:r></w:p>'
  ).join('');
  const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>';
  return zipBuffer([
    {name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
    {name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
    {name: 'word/document.xml', data: documentXml}
  ]);
}

function columnName(index) {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function xlsxBuffer(sources) {
  const rows = tableRows(sources).slice(0, 10000);
  const sheetRows = rows.map((row, r) => {
    const cells = row.slice(0, 100).map((value, c) => '<c r="' + columnName(c) + (r + 1) + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEscape(value) + '</t></is></c>').join('');
    return '<row r="' + (r + 1) + '">' + cells + '</row>';
  }).join('');
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + sheetRows + '</sheetData></worksheet>';
  return zipBuffer([
    {name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'},
    {name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Result" sheetId="1" r:id="rId1"/></sheets></workbook>'},
    {name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'},
    {name: 'xl/worksheets/sheet1.xml', data: sheet}
  ]);
}

function wrapLine(line, width = 44) {
  const chars = Array.from(String(line));
  const out = [];
  for (let i = 0; i < chars.length; i += width) out.push(chars.slice(i, i + width).join(''));
  return out.length ? out : [''];
}

function utf16Hex(value) {
  const buffer = Buffer.from('\uFEFF' + String(value), 'utf16le');
  for (let i = 0; i + 1 < buffer.length; i += 2) {
    const a = buffer[i];
    buffer[i] = buffer[i + 1];
    buffer[i + 1] = a;
  }
  return buffer.toString('hex').toUpperCase();
}

function pdfBuffer(sources) {
  const lines = sourceText(sources).split(/\r?\n/).flatMap(line => wrapLine(line));
  const pages = [];
  for (let i = 0; i < Math.max(1, lines.length); i += 42) pages.push(lines.slice(i, i + 42));
  const fontId = 3 + pages.length * 2;
  const cidId = fontId + 1;
  const objects = new Map();
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(2, '<< /Type /Pages /Kids [' + pages.map((_, i) => (3 + i * 2) + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>');
  pages.forEach((pageLines, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    const commands = ['BT', '/F1 10 Tf', '48 792 Td', '17 TL'];
    for (const line of pageLines) { commands.push('<' + utf16Hex(line) + '> Tj'); commands.push('T*'); }
    commands.push('ET');
    const stream = commands.join('\n');
    objects.set(pageId, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ' + fontId + ' 0 R >> >> /Contents ' + contentId + ' 0 R >>');
    objects.set(contentId, '<< /Length ' + Buffer.byteLength(stream, 'ascii') + ' >>\nstream\n' + stream + '\nendstream');
  });
  objects.set(fontId, '<< /Type /Font /Subtype /Type0 /BaseFont /HYSMyeongJo-Medium /Encoding /UniKS-UCS2-H /DescendantFonts [' + cidId + ' 0 R] >>');
  objects.set(cidId, '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HYSMyeongJo-Medium /CIDSystemInfo << /Registry (Adobe) /Ordering (Korea1) /Supplement 2 >> >>');
  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  const offsets = [0];
  let offset = chunks[0].length;
  for (let id = 1; id <= cidId; id++) {
    offsets[id] = offset;
    const chunk = Buffer.from(id + ' 0 obj\n' + objects.get(id) + '\nendobj\n', 'ascii');
    chunks.push(chunk);
    offset += chunk.length;
  }
  const xrefOffset = offset;
  let xref = 'xref\n0 ' + (cidId + 1) + '\n0000000000 65535 f \n';
  for (let id = 1; id <= cidId; id++) xref += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
  xref += 'trailer\n<< /Size ' + (cidId + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
  chunks.push(Buffer.from(xref, 'ascii'));
  return Buffer.concat(chunks);
}

function rtfBuffer(sources) {
  let body = '';
  for (const char of sourceText(sources)) {
    if (char === '\\' || char === '{' || char === '}') body += '\\' + char;
    else if (char === '\n') body += '\\par\n';
    else {
      const code = char.charCodeAt(0);
      body += code > 127 ? '\\u' + (code > 32767 ? code - 65536 : code) + '?' : char;
    }
  }
  return Buffer.from('{\\rtf1\\ansi\\deff0 ' + body + '}', 'utf8');
}

function htmlBuffer(sources) {
  const body = sourceText(sources).split(/\r?\n/).map(line => '<p>' + xmlEscape(line || ' ') + '</p>').join('');
  return Buffer.from('<!doctype html><html><head><meta charset="utf-8"><title>ovll result</title></head><body>' + body + '</body></html>', 'utf8');
}

function buildBuffer(format, sources) {
  if (format === 'PDF') return pdfBuffer(sources);
  if (format === 'DOCX') return docxBuffer(sources);
  if (format === 'XLSX') return xlsxBuffer(sources);
  if (format === 'CSV') return csvBuffer(sources);
  if (format === 'JSON') return Buffer.from(JSON.stringify(Array.isArray(sources) && sources.length === 1 ? sources[0] : sources, null, 2), 'utf8');
  if (format === 'HTML') return htmlBuffer(sources);
  if (format === 'RTF') return rtfBuffer(sources);
  return Buffer.from(sourceText(sources), 'utf8');
}

export function createStoredArtifact(input = {}) {
  prune();
  const format = formatName(input.format);
  const info = FORMAT_INFO[format];
  const sources = Array.isArray(input.sources) ? input.sources : [input.sources].filter(value => value !== undefined);
  const buffer = buildBuffer(format, sources);
  const id = randomUUID();
  const name = withExtension(input.filename || 'result', info.ext);
  const item = {id, name, format, mime: info.mime, size: buffer.length, createdAt: Date.now(), buffer, previewText: sourceText(sources).slice(0, 240)};
  STORE.set(id, item);
  return {id: item.id, name: item.name, format: item.format, mime: item.mime, size: item.size, previewText: item.previewText, downloadUrl: '/api/artifacts/' + encodeURIComponent(item.id)};
}

export function getStoredArtifact(id) {
  prune();
  return STORE.get(String(id || '')) || null;
}
