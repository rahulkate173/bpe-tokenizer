import { useState, useRef, useEffect } from "react";
import { TOKENIZER_REGISTRY, TOKENIZER_GROUPS, getTokenizerById } from "../lib/registry";

/**
 * TokenizerSelector — mimics the tiktokenizer dropdown with search.
 */
export default function TokenizerSelector({ selectedId, onSelect }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  const selected = getTokenizerById(selectedId);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = TOKENIZER_REGISTRY.filter((t) =>
    t.label.toLowerCase().includes(query.toLowerCase())
  );

  const groups = [...new Set(filtered.map((t) => t.group))];

  return (
    <div className="selector-wrapper" ref={ref}>
      <button
        id="tokenizer-selector-btn"
        className={`selector-button ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select tokenizer"
      >
        <span>{selected?.label || "Select tokenizer…"}</span>
        <span className="selector-chevron">▾</span>
      </button>

      {open && (
        <div
          className="selector-dropdown"
          role="listbox"
          aria-label="Tokenizer options"
        >
          <div className="selector-search">
            <span className="selector-search-icon">🔍</span>
            <input
              id="tokenizer-search-input"
              type="text"
              placeholder="Search tokenizer…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              aria-label="Search tokenizers"
            />
          </div>

          <div className="selector-list">
            {groups.map((group) => (
              <div key={group}>
                <div className="selector-group-label">{group}</div>
                {filtered
                  .filter((t) => t.group === group)
                  .map((t) => (
                    <div
                      key={t.id}
                      id={`tokenizer-option-${t.id}`}
                      className={`selector-item ${t.id === selectedId ? "active" : ""}`}
                      role="option"
                      aria-selected={t.id === selectedId}
                      onClick={() => {
                        onSelect(t.id);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <span className="selector-item-dot" />
                      {t.label}
                    </div>
                  ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "16px 14px", color: "var(--text-muted)", fontSize: 13 }}>
                No tokenizers match your search.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
