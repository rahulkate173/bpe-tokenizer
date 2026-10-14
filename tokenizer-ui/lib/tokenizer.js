/**
 * Client-side BPE tokenizer implementation in JavaScript.
 * Mirrors the minbpe Python library logic.
 *
 * Supports:
 *   - BasicTokenizer  (byte-level BPE, no regex splitting)
 *   - RegexTokenizer  (byte-level BPE + regex chunk splitting)
 *   - GPT4Tokenizer   (uses js-tiktoken via CDN, requires dynamic import)
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Encode a JS string to a Uint8Array (UTF-8). */
function encodeUTF8(str) {
  return new TextEncoder().encode(str);
}

/** Decode a Uint8Array to a JS string (UTF-8, replace errors). */
function decodeUTF8(bytes) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/**
 * Count consecutive pairs in an integer array.
 * Returns a Map of "p0,p1" -> count.
 */
function getStats(ids) {
  const counts = new Map();
  for (let i = 0; i < ids.length - 1; i++) {
    const key = `${ids[i]},${ids[i + 1]}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/**
 * Replace all consecutive occurrences of (pair[0], pair[1]) in ids with idx.
 */
function mergeIds(ids, p0, p1, idx) {
  const result = [];
  let i = 0;
  while (i < ids.length) {
    if (i < ids.length - 1 && ids[i] === p0 && ids[i + 1] === p1) {
      result.push(idx);
      i += 2;
    } else {
      result.push(ids[i]);
      i++;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Token colors (for the highlighted visualization)
// ---------------------------------------------------------------------------

const TOKEN_COLORS = [
  "#ffd6d6", // soft red
  "#ffd9b3", // soft orange
  "#fffab3", // soft yellow
  "#d4f7d4", // soft green
  "#b3e5fc", // soft blue
  "#e1bee7", // soft purple
  "#f8bbd0", // soft pink
  "#b2dfdb", // soft teal
  "#ffe0b2", // soft amber
  "#dcedc8", // soft lime
  "#b3e0f2", // sky blue
  "#f3e5f5", // lavender
];

export function getTokenColor(tokenId) {
  return TOKEN_COLORS[tokenId % TOKEN_COLORS.length];
}

// ---------------------------------------------------------------------------
// Vocab builder from merges JSON
// ---------------------------------------------------------------------------

/**
 * Build a vocab Map<number, Uint8Array> from the loaded model JSON.
 *
 * Model JSON shape:
 * {
 *   merges: [[p0, p1, idx], ...],   // sorted by idx
 *   vocab: { "idx": [byte0, ...] }  // optional pre-built vocab
 * }
 */
export function buildVocab(modelData) {
  // If vocab is already present in JSON, use it
  if (modelData.vocab) {
    const vocab = new Map();
    for (const [idxStr, bytes] of Object.entries(modelData.vocab)) {
      vocab.set(parseInt(idxStr, 10), new Uint8Array(bytes));
    }
    return vocab;
  }

  // Rebuild from merges
  const vocab = new Map();
  for (let i = 0; i < 256; i++) {
    vocab.set(i, new Uint8Array([i]));
  }
  for (const [p0, p1, idx] of modelData.merges) {
    const merged = new Uint8Array(vocab.get(p0).length + vocab.get(p1).length);
    merged.set(vocab.get(p0), 0);
    merged.set(vocab.get(p1), vocab.get(p0).length);
    vocab.set(idx, merged);
  }
  return vocab;
}

// ---------------------------------------------------------------------------
// BasicTokenizer encoder (JS)
// ---------------------------------------------------------------------------

export class BasicTokenizerJS {
  constructor(modelData) {
    this.merges = new Map(); // "p0,p1" -> idx
    this.vocab = buildVocab(modelData);
    for (const [p0, p1, idx] of modelData.merges) {
      this.merges.set(`${p0},${p1}`, idx);
    }
  }

  encode(text) {
    const bytes = encodeUTF8(text);
    let ids = Array.from(bytes);

    while (ids.length >= 2) {
      const stats = getStats(ids);
      // Find the pair with the lowest merge index
      let bestKey = null;
      let bestIdx = Infinity;
      for (const key of stats.keys()) {
        const idx = this.merges.get(key);
        if (idx !== undefined && idx < bestIdx) {
          bestIdx = idx;
          bestKey = key;
        }
      }
      if (bestKey === null) break;
      const [p0, p1] = bestKey.split(",").map(Number);
      ids = mergeIds(ids, p0, p1, bestIdx);
    }
    return ids;
  }

  decode(ids) {
    const byteArrays = ids.map((id) => this.vocab.get(id) || new Uint8Array());
    const total = byteArrays.reduce((s, a) => s + a.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const arr of byteArrays) {
      merged.set(arr, offset);
      offset += arr.length;
    }
    return decodeUTF8(merged);
  }

  /** Returns [{id, text, bytes}] for visualization */
  tokenize(text) {
    const ids = this.encode(text);
    return ids.map((id) => ({
      id,
      bytes: Array.from(this.vocab.get(id) || []),
      text: decodeUTF8(this.vocab.get(id) || new Uint8Array()),
    }));
  }
}

// ---------------------------------------------------------------------------
// RegexTokenizer encoder (JS)
// Uses the same GPT-4 split pattern via a JS-compatible regex approach.
// ---------------------------------------------------------------------------

// GPT-2 split pattern (JS-compatible, no \p{} Unicode categories in older envs)
// We use a simplified version that works in modern browsers with Unicode flag
const GPT2_SPLIT_PATTERN =
  /'(?:[sdmt]|ll|ve|re)|(?:\s)?\p{L}+|(?:\s)?\p{N}+|(?:\s)?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

// GPT-4 split pattern (modern browsers support Unicode property escapes with /u flag)
const GPT4_SPLIT_PATTERN =
  /'(?:i)(?:[sdmt]|ll|ve|re)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}|(?:\s)?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]|\s+(?!\S)|\s+/gu;

export class RegexTokenizerJS {
  constructor(modelData) {
    this.merges = new Map();
    this.vocab = buildVocab(modelData);
    this.pattern = modelData.pattern || "";

    for (const [p0, p1, idx] of modelData.merges) {
      this.merges.set(`${p0},${p1}`, idx);
    }
  }

  _splitText(text) {
    // Try GPT-4 pattern first; fall back to simple word split
    try {
      const re = new RegExp(GPT4_SPLIT_PATTERN, "gu");
      return text.match(re) || [text];
    } catch {
      // Fallback: split on whitespace boundaries
      return text.match(/\S+|\s+/g) || [text];
    }
  }

  _encodeChunk(bytes) {
    let ids = Array.from(bytes);
    while (ids.length >= 2) {
      const stats = getStats(ids);
      let bestKey = null;
      let bestIdx = Infinity;
      for (const key of stats.keys()) {
        const idx = this.merges.get(key);
        if (idx !== undefined && idx < bestIdx) {
          bestIdx = idx;
          bestKey = key;
        }
      }
      if (bestKey === null) break;
      const [p0, p1] = bestKey.split(",").map(Number);
      ids = mergeIds(ids, p0, p1, bestIdx);
    }
    return ids;
  }

  encode(text) {
    const chunks = this._splitText(text);
    const ids = [];
    for (const chunk of chunks) {
      const bytes = encodeUTF8(chunk);
      ids.push(...this._encodeChunk(bytes));
    }
    return ids;
  }

  decode(ids) {
    const byteArrays = ids.map((id) => this.vocab.get(id) || new Uint8Array());
    const total = byteArrays.reduce((s, a) => s + a.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const arr of byteArrays) {
      merged.set(arr, offset);
      offset += arr.length;
    }
    return decodeUTF8(merged);
  }

  tokenize(text) {
    const ids = this.encode(text);
    return ids.map((id) => ({
      id,
      bytes: Array.from(this.vocab.get(id) || []),
      text: decodeUTF8(this.vocab.get(id) || new Uint8Array()),
    }));
  }
}

// ---------------------------------------------------------------------------
// GPT-4 Tokenizer shim — calls our Next.js API route
// ---------------------------------------------------------------------------

export class GPT4TokenizerJS {
  constructor() {
    this.name = "GPT-4 (cl100k_base)";
  }

  async tokenize(text) {
    const res = await fetch("/api/tokenize-gpt4", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("GPT-4 tokenizer API error");
    return await res.json(); // [{id, text, bytes}, ...]
  }

  async encode(text) {
    const tokens = await this.tokenize(text);
    return tokens.map((t) => t.id);
  }
}
