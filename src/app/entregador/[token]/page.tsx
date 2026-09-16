"use client";
import { useState } from "react";

export default function DriverPage({ params }: { params: { token: string } }) {
  const [message, setMessage] = useState("");
  const [concluindo, setConcluindo] = useState(false);

  async function assumir() {
    const res = await fetch(`/api/driver/${params.token}/assume`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? "Rota assumida!" : data.error);
  }

  async function desistir() {
    if (!window.confirm("Tem certeza que quer DESISTIR desta rota? Ela será oferecida a outro entregador.")) return;
    const res = await fetch(`/api/driver/${params.token}/release`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? "Você desistiu da rota." : data.error);
  }

  async function atualizarLocalizacao() {
    const cidade = window.prompt("Em qual cidade você está agora?");
    if (!cidade) return;
    const res = await fetch(`/api/driver/${params.token}/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cidade }),
    });
    setMessage(res.ok ? "Localização atualizada!" : (await res.json()).error);
  }

  async function concluir() {
    if (concluindo) return;
    if (!window.confirm("Confirmar a ENTREGA desta rota? O pagamento será enviado e isso não pode ser desfeito.")) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        setConcluindo(true);
        try {
          const res = await fetch(`/api/driver/${params.token}/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ comprovanteBase64: reader.result }),
          });
          setMessage(res.ok ? "Entrega concluída!" : (await res.json()).error);
        } finally {
          setConcluindo(false);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  return (
    <main style={{ padding: 24, fontSize: 18 }}>
      <h1>Rota disponível</h1>
      <button onClick={assumir} style={{ fontSize: 24, padding: 16, margin: 8 }}>
        ASSUMIR
      </button>
      <button onClick={desistir} style={{ fontSize: 24, padding: 16, margin: 8 }}>
        DESISTIR
      </button>
      <button onClick={atualizarLocalizacao} style={{ fontSize: 24, padding: 16, margin: 8 }}>
        Atualizar localização
      </button>
      <button onClick={concluir} disabled={concluindo} style={{ fontSize: 24, padding: 16, margin: 8 }}>
        {concluindo ? "ENVIANDO..." : "CONCLUÍDO"}
      </button>
      {message && <p>{message}</p>}
    </main>
  );
}
