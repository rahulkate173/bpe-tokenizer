/**
 * StatsBar — shows token count, character count, and compression ratio.
 */
export default function StatsBar({ tokens, text }) {
  const tokenCount = tokens?.length ?? 0;
  const charCount = text?.length ?? 0;
  const ratio =
    tokenCount > 0 && charCount > 0
      ? (charCount / tokenCount).toFixed(2)
      : "—";

  return (
    <div className="stats-bar" role="status" aria-live="polite" aria-label="Tokenization statistics">
      <div className="stat-item">
        <div className="stat-label">Tokens</div>
        <div className="stat-value" id="stat-token-count">{tokenCount.toLocaleString()}</div>
      </div>

      <div className="stat-divider" role="separator" />

      <div className="stat-item">
        <div className="stat-label">Characters</div>
        <div className="stat-value" id="stat-char-count">{charCount.toLocaleString()}</div>
      </div>

      <div className="stat-divider" role="separator" />

      <div className="stat-item">
        <div className="stat-label">Chars / Token</div>
        <div className="stat-value" id="stat-ratio">{ratio}</div>
      </div>
    </div>
  );
}
