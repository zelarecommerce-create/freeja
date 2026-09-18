import GlyphPortal from "@/components/ui/glyph-portal";

export default function Home() {
  return (
    <GlyphPortal
      word="FRETAJA"
      scrollLength={2.4}
      interactive
      enterLabel="Ver como funciona"
      front={
        <div style={{ position: "absolute", inset: "clamp(24px, 5vw, 64px)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.02em" }}>fretajá</span>
          <p style={{ maxWidth: "28ch", fontSize: 14, lineHeight: 1.5, color: "#dfe7e2", margin: 0 }}>
            Frete de São Paulo pro Brasil todo, com entregador certo pra cada carga.
          </p>
        </div>
      }
    >
      <div style={{ display: "grid", gap: "2rem", maxWidth: 640, margin: "0 auto" }}>
        <h2 style={{ margin: 0, fontSize: "clamp(1.75rem, 1.1rem + 2vw, 2.25rem)", fontWeight: 400, lineHeight: 1.25 }}>
          Sua carga sai de São Paulo. A gente cuida do resto.
        </h2>
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 500 }}>Rota postada, entregador certo</h3>
            <p style={{ margin: ".5rem 0 0", fontSize: ".9375rem", lineHeight: 1.55, opacity: 0.85 }}>
              Cada rota vai só pra quem tem veículo que aguenta a carga.
            </p>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 500 }}>Pagamento automático</h3>
            <p style={{ margin: ".5rem 0 0", fontSize: ".9375rem", lineHeight: 1.55, opacity: 0.85 }}>
              Entrega confirmada, repasse via PIX sai na hora.
            </p>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 500 }}>Rastreio simples</h3>
            <p style={{ margin: ".5rem 0 0", fontSize: ".9375rem", lineHeight: 1.55, opacity: 0.85 }}>
              Cliente acompanha status e previsão de chegada, sem precisar de app.
            </p>
          </div>
        </div>
      </div>
    </GlyphPortal>
  );
}
