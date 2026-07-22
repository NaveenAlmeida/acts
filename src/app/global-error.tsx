"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/actions/observability";

/**
 * Último recurso: captura um crash no PRÓPRIO root layout (quando nem o
 * error.tsx normal renderiza). Substitui <html>/<body>, então não pode
 * depender de layout, fontes ou providers — estilos inline propositais.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // persiste para a plataforma enxergar (best-effort, nunca lança)
    void reportError({
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f4f4f0",
          color: "#1a1a1a",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "22rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>
            Ops, algo deu errado
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.5rem" }}>
            Tente novamente. Se persistir, atualize a página — seus dados estão
            salvos.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              height: "3rem",
              width: "100%",
              borderRadius: "9999px",
              border: "none",
              background: "#1a1a1a",
              color: "#fff",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
