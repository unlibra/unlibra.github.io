// Reads a WOFF2 font enough for the tests: its tables (brotli-decompressed),
// the characters its cmap maps to glyphs, the glyph count and the name table.
import { brotliDecompressSync } from "node:zlib";

/** The known table tags of WOFF2, by index (WOFF2 spec, 5.1). */
const KNOWN_TAGS = (
  "cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  " +
  "VORG EBDT EBLC gasp hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS " +
  "GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG  sbix acnt avar bdat bloc " +
  "bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop " +
  "trak Zapf Silf Glat Gloc Feat Sill"
)
  .match(/.{4}\s?/g)
  .map((tag) => tag.slice(0, 4));

const readBase128 = (buffer, offset) => {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buffer[offset + i];
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, next: offset + i + 1 };
  }
  throw new Error("bad UIntBase128");
};

/** The tables of a WOFF2 font, by tag (transformed tables as stored). */
export const woff2Tables = (buffer) => {
  if (buffer.toString("latin1", 0, 4) !== "wOF2") throw new Error("not WOFF2");
  const count = buffer.readUInt16BE(12);
  const compressedSize = buffer.readUInt32BE(20);
  let offset = 48;
  const entries = [];
  for (let i = 0; i < count; i++) {
    const flags = buffer[offset++];
    let tag = KNOWN_TAGS[flags & 0x3f];
    if ((flags & 0x3f) === 63) {
      tag = buffer.toString("latin1", offset, offset + 4);
      offset += 4;
    }
    const version = flags >> 6;
    const original = readBase128(buffer, offset);
    offset = original.next;
    let length = original.value;
    const transformed =
      tag === "glyf" || tag === "loca" ? version === 0 : version !== 0;
    if (transformed) {
      const stored = readBase128(buffer, offset);
      offset = stored.next;
      length = stored.value;
    }
    entries.push({ tag, length });
  }
  const data = brotliDecompressSync(
    buffer.subarray(offset, offset + compressedSize),
  );
  const tables = {};
  let position = 0;
  for (const { tag, length } of entries) {
    tables[tag] = data.subarray(position, position + length);
    position += length;
  }
  return tables;
};

/** The characters a cmap table maps to a glyph (formats 4 and 12). */
export const cmapCharacters = (cmap) => {
  const found = new Set();
  const subtables = cmap.readUInt16BE(2);
  for (let i = 0; i < subtables; i++) {
    const table = cmap.subarray(cmap.readUInt32BE(4 + i * 8 + 4));
    const format = table.readUInt16BE(0);
    if (format === 4) {
      const segments = table.readUInt16BE(6) / 2;
      const ends = 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const rangeOffsets = deltas + segments * 2;
      for (let s = 0; s < segments; s++) {
        const end = table.readUInt16BE(ends + s * 2);
        const start = table.readUInt16BE(starts + s * 2);
        const delta = table.readInt16BE(deltas + s * 2);
        const rangeOffset = table.readUInt16BE(rangeOffsets + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let glyph;
          if (rangeOffset === 0) {
            glyph = (c + delta) & 0xffff;
          } else {
            const at = rangeOffsets + s * 2 + rangeOffset + (c - start) * 2;
            glyph = table.readUInt16BE(at);
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph !== 0) found.add(String.fromCodePoint(c));
        }
      }
    } else if (format === 12) {
      const groups = table.readUInt32BE(12);
      for (let g = 0; g < groups; g++) {
        const start = table.readUInt32BE(16 + g * 12);
        const end = table.readUInt32BE(16 + g * 12 + 4);
        for (let c = start; c <= end; c++) found.add(String.fromCodePoint(c));
      }
    }
  }
  return found;
};

/** The glyph count (maxp). */
export const glyphCount = (maxp) => maxp.readUInt16BE(4);

/** A name of the name table (Windows platform), e.g. 0 copyright, 1 family. */
export const nameOf = (name, id) => {
  const count = name.readUInt16BE(2);
  const strings = name.readUInt16BE(4);
  for (let i = 0; i < count; i++) {
    const record = 6 + i * 12;
    if (name.readUInt16BE(record) !== 3) continue;
    if (name.readUInt16BE(record + 6) !== id) continue;
    const start = strings + name.readUInt16BE(record + 10);
    const bytes = Buffer.from(
      name.subarray(start, start + name.readUInt16BE(record + 8)),
    );
    return bytes.swap16().toString("utf16le");
  }
  return undefined;
};
