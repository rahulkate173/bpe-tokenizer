import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import TokenizerSelector from "../components/TokenizerSelector";
import TokenViz from "../components/TokenViz";
import StatsBar from "../components/StatsBar";
import { getTokenizerById } from "../lib/registry";
import { BasicTokenizerJS, RegexTokenizerJS } from "../lib/tokenizer";

// Cache loaded model JSON files
const modelCache = new Map();

async function loadModel(path) {
  if (modelCache.has(path)) return modelCache.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load model from ${path} (${res.status})`);
  const data = await res.json();
  modelCache.set(path, data);
  return data;
}

// Create a JS tokenizer instance from a model definition
async function createTokenizer(tokDef) {
  if (tokDef.type === "gpt4") {
    // Return a shim that calls the API route
    return {
      async tokenize(text) {
        if (!text) return [];
        const res = await fetch("/api/tokenize-gpt4", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, model: tokDef.apiModel || "cl100k_base" }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Tokenization API error");
        }
        return await res.json();
      },
    };
  }

  const modelData = await loadModel(tokDef.modelPath);
  if (tokDef.type === "regex") {
    return new RegexTokenizerJS(modelData);
  }
  return new BasicTokenizerJS(modelData);
}

const PLACEHOLDER_TEXT = `Hello world! The quick brown fox jumps over the lazy dog.

Tokenization splits text into sub-word units called tokens.
Each token is mapped to an integer ID that a language model processes.`;

export default function Home() {
  const [selectedId, setSelectedId] = useState("basic_tokenizer");
  const [text, setText] = useState(PLACEHOLDER_TEXT);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modelStatus, setModelStatus] = useState("idle"); // "idle"|"loading"|"ready"|"missing"

  const tokenizerRef = useRef(null);
  const debounceRef = useRef(null);

  // Load tokenizer when selection changes
  useEffect(() => {
    const tokDef = getTokenizerById(selectedId);
    setModelStatus("loading");
    setError(null);
    setTokens([]);

    createTokenizer(tokDef)
      .then((tok) => {
        tokenizerRef.current = tok;
        setModelStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load tokenizer:", err);
        // For minbpe models: the JSON might not exist yet (before training)
        if (err.message.includes("404") || err.message.includes("Failed to load")) {
          setModelStatus("missing");
          setError(
            `Model file not found. Run 'python train_tokenizer.py' from the project root to train and generate the model file.`
          );
        } else {
          setModelStatus("idle");
          setError(err.message);
        }
        tokenizerRef.current = null;
      });
  }, [selectedId]);

  // Tokenize text whenever it changes (debounced)
  const runTokenize = useCallback(async (inputText) => {
    const tok = tokenizerRef.current;
    if (!tok || !inputText) {
      setTokens([]);
      return;
    }
    setLoading(true);
    try {
      const result = await tok.tokenize(inputText);
      setTokens(result);
      setError(null);
    } catch (err) {
      console.error("Tokenize error:", err);
      setError(err.message);
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-run when model becomes ready
  useEffect(() => {
    if (modelStatus === "ready") {
      runTokenize(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelStatus]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (modelStatus === "ready") runTokenize(val);
    }, 250);
  };

  const tokenIds = tokens.map((t) => t.id).join(", ");

  const tokDef = getTokenizerById(selectedId);

  return (
    <>
      <Head>
        <title>minbpe Tokenizer — Interactive BPE Visualizer</title>
        <meta
          name="description"
          content="Interactively visualize and explore Byte Pair Encoding (BPE) tokenization with minbpe. Compare BasicTokenizer, RegexTokenizer, and GPT-4 tokenizers."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="app-wrapper">
        {/* ── Header ── */}
        <header className="header">
          <div className="header-inner">
            <Link href="/" className="logo" aria-label="minbpe Tokenizer home">
              <div className="logo-icon" aria-hidden="true">⚡</div>
              <h1 className="logo-title">minbpe Tokenizer</h1>
            </Link>

            <div className="header-right">
              <div className="model-badge" aria-label={`Active model: ${tokDef?.label}`}>
                <span className="model-badge-dot" aria-hidden="true" />
                {modelStatus === "loading" ? "Loading…" : tokDef?.label}
              </div>

              <TokenizerSelector
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
              />
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="main" id="main-content">
          {/* Left panel — input */}
          <div className="panel">
            {/* Tokenizer description */}
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(139, 92, 246, 0.07)",
                border: "1px solid rgba(139, 92, 246, 0.18)",
                borderRadius: "var(--radius-md)",
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: "var(--accent-purple)" }}>{tokDef?.label}</strong>
              {" — "}
              {tokDef?.description}
            </div>

            {/* Text input */}
            <div className="card">
              <label htmlFor="text-input" className="sr-only">Text to tokenize</label>
              <textarea
                id="text-input"
                className="input-area"
                placeholder="Type or paste text here to tokenize…"
                value={text}
                onChange={handleTextChange}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
            </div>

            {/* Stats */}
            <StatsBar tokens={tokens} text={text} />
          </div>

          {/* Right panel — visualization */}
          <div className="panel">
            {/* Error state */}
            {error && (
              <div className="error-card" role="alert">
                <span>⚠️</span>
                <div>
                  <strong>Error:</strong> {error}
                </div>
              </div>
            )}

            {/* Loading state */}
            {(loading || modelStatus === "loading") && !error && (
              <div className="loading-indicator" aria-live="polite" aria-busy="true">
                <div className="loading-dots" aria-hidden="true">
                  <div className="loading-dot" />
                  <div className="loading-dot" />
                  <div className="loading-dot" />
                </div>
                {modelStatus === "loading" ? "Loading tokenizer model…" : "Tokenizing…"}
              </div>
            )}

            {/* Token visualization */}
            {!error && modelStatus !== "loading" && (
              <>
                <TokenViz tokens={tokens} />

                {/* Token IDs */}
                <div className="token-ids-card" aria-label="Token IDs">
                  <div className="token-viz-label">Token IDs</div>
                  <div
                    id="token-ids-output"
                    className="token-ids-content"
                    aria-live="polite"
                  >
                    {tokenIds || (
                      <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                        Token IDs will appear here…
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
