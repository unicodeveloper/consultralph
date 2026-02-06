"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ padding: "2rem", fontFamily: "monospace" }}>
          <h2 style={{ color: "red" }}>Global Error Caught</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px", background: "#f0f0f0", padding: "1rem", borderRadius: "4px" }}>
            {error.message}
            {"\n\n"}
            {error.stack}
          </pre>
          <button onClick={reset} style={{ marginTop: "1rem", padding: "0.5rem 1rem", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
