"use client";
import { useState } from "react";

export default function PainelPage() {
  const [senha, setSenha] = useState("");
  const [logado, setLogado] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    clientAsaasId: "",
    origem: "",
    destino: "",
    distanciaKm: "",
    valorKm: "",
    pesoKg: "",
    volumeM3: "",
  });
  const [message, setMessage] = useState("");

  async function login() {
    const res = await fetch("/api/internal/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha }),
    });
    setLogado(res.ok);
    if (!res.ok) setMessage("senha incorreta");
  }

  async function criarRota() {
    const res = await fetch("/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        distanciaKm: parseFloat(form.distanciaKm),
        valorKm: parseFloat(form.valorKm),
        pesoKg: parseFloat(form.pesoKg),
        volumeM3: parseFloat(form.volumeM3),
      }),
    });
    setMessage(res.ok ? "Rota criada!" : (await res.json()).error);
  }

  if (!logado) {
    return (
      <main style={{ padding: 24 }}>
        <input type="password" placeholder="Senha da equipe" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <button onClick={login}>Entrar</button>
        {message && <p>{message}</p>}
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Nova rota</h1>
      {Object.entries(form).map(([key, value]) => (
        <div key={key}>
          <label>{key}</label>
          <input value={value} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        </div>
      ))}
      <button onClick={criarRota}>Criar rota</button>
      {message && <p>{message}</p>}
    </main>
  );
}
