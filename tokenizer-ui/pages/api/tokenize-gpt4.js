/**
 * API route: /api/tokenize-gpt4
 * Performs server-side tokenization using the tiktoken library.
 * Supports cl100k_base (GPT-4) and r50k_base (GPT-2) encodings.
 */

// We use the pure-JS tiktoken package that works in Node/Edge environments
// Install: npm install js-tiktoken
let tiktokenModule = null;

async function getTiktoken() {
  if (!tiktokenModule) {
    tiktokenModule = await import("js-tiktoken");
  }
  return tiktokenModule;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, model = "cl100k_base" } = req.body;

  if (typeof text !== "string") {
    return res.status(400).json({ error: "text must be a string" });
  }

  // Cap input to prevent abuse
  const MAX_CHARS = 100_000;
  const inputText = text.slice(0, MAX_CHARS);

  try {
    const tiktoken = await getTiktoken();

    let enc;
    if (model === "gpt2" || model === "r50k_base") {
      enc = tiktoken.getEncoding("r50k_base");
    } else {
      enc = tiktoken.getEncoding("cl100k_base");
    }

    const tokenIds = enc.encode(inputText);

    // Build token objects with decoded text
    const tokens = Array.from(tokenIds).map((id) => {
      const tokenBytes = enc.decode_single_token_bytes(id);
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const tokenText = decoder.decode(tokenBytes);
      return {
        id,
        text: tokenText,
        bytes: Array.from(tokenBytes),
      };
    });

    return res.status(200).json(tokens);
  } catch (err) {
    console.error("Tokenization error:", err);
    return res.status(500).json({ error: "Tokenization failed", details: err.message });
  }
}
