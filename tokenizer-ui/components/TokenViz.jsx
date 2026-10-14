/**
 * TokenViz — renders the colorful token visualization panel.
 *
 * Props:
 *   tokens: Array<{id: number, text: string, bytes: number[]}>
 */

const TOKEN_COLORS = [
  { bg: "hsla(355,90%,75%,0.25)", border: "hsla(355,90%,65%,0.6)", text: "hsl(355,90%,80%)" },
  { bg: "hsla(30,90%,70%,0.25)",  border: "hsla(30,90%,60%,0.6)",  text: "hsl(30,90%,75%)" },
  { bg: "hsla(50,90%,72%,0.25)",  border: "hsla(50,90%,62%,0.6)",  text: "hsl(50,90%,77%)" },
  { bg: "hsla(120,55%,70%,0.25)", border: "hsla(120,55%,60%,0.6)", text: "hsl(120,55%,75%)" },
  { bg: "hsla(200,80%,72%,0.25)", border: "hsla(200,80%,62%,0.6)", text: "hsl(200,80%,77%)" },
  { bg: "hsla(270,60%,75%,0.25)", border: "hsla(270,60%,65%,0.6)", text: "hsl(270,60%,80%)" },
  { bg: "hsla(320,70%,75%,0.25)", border: "hsla(320,70%,65%,0.6)", text: "hsl(320,70%,80%)" },
  { bg: "hsla(175,60%,65%,0.25)", border: "hsla(175,60%,55%,0.6)", text: "hsl(175,60%,70%)" },
  { bg: "hsla(35,80%,68%,0.25)",  border: "hsla(35,80%,58%,0.6)",  text: "hsl(35,80%,73%)" },
  { bg: "hsla(85,60%,70%,0.25)",  border: "hsla(85,60%,60%,0.6)",  text: "hsl(85,60%,75%)" },
  { bg: "hsla(195,80%,70%,0.25)", border: "hsla(195,80%,60%,0.6)", text: "hsl(195,80%,75%)" },
  { bg: "hsla(285,50%,75%,0.25)", border: "hsla(285,50%,65%,0.6)", text: "hsl(285,50%,80%)" },
];

function getColor(idx) {
  return TOKEN_COLORS[idx % TOKEN_COLORS.length];
}

function escapeDisplay(text) {
  return text
    .replace(/\n/g, "↵\n")
    .replace(/\r/g, "↵")
    .replace(/\t/g, "→");
}

export default function TokenViz({ tokens }) {
  if (!tokens || tokens.length === 0) {
    return (
      <div className="token-viz-card">
        <div className="token-viz-label">Token Visualization</div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, fontStyle: "italic" }}>
          Start typing to see tokens highlighted…
        </div>
      </div>
    );
  }

  return (
    <div className="token-viz-card">
      <div className="token-viz-label">Token Visualization</div>
      <div className="token-viz-content" aria-label="Token visualization">
        {tokens.map((token, i) => {
          const color = getColor(i);
          const display = escapeDisplay(token.text || "");
          return (
            <span
              key={i}
              id={`token-chip-${i}`}
              className="token-chip"
              style={{
                background: color.bg,
                border: `1px solid ${color.border}`,
                color: color.text,
              }}
              title={`ID: ${token.id} | Bytes: [${token.bytes.join(", ")}]`}
            >
              {display || (
                <span style={{ opacity: 0.5, fontStyle: "italic" }}>
                  {`\\x${token.bytes.map((b) => b.toString(16).padStart(2, "0")).join("")}`}
                </span>
              )}
              <span className="token-chip-tooltip">
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {JSON.stringify(token.text)}
                </div>
                <div className="token-chip-tooltip-id">
                  Token ID: {token.id}
                </div>
                <div className="token-chip-tooltip-id">
                  Bytes: [{token.bytes.join(", ")}]
                </div>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
