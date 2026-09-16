"use client";
import { useEffect, useState } from "react";

interface Tracking {
  status: string;
  etaEstimado: string | null;
  ultimaLocalizacao: string | null;
}

export default function ClientPage({ params }: { params: { token: string } }) {
  const [tracking, setTracking] = useState<Tracking | null>(null);

  useEffect(() => {
    fetch(`/api/client/${params.token}`)
      .then((res) => res.json())
      .then(setTracking);
  }, [params.token]);

  if (!tracking) return <p>Carregando...</p>;

  return (
    <main style={{ padding: 24 }}>
      <h1>Status da sua entrega</h1>
      <p>Status: {tracking.status}</p>
      {tracking.etaEstimado && <p>Previsão de chegada: {new Date(tracking.etaEstimado).toLocaleString("pt-BR")}</p>}
      {tracking.ultimaLocalizacao && <p>Última localização: {tracking.ultimaLocalizacao}</p>}
    </main>
  );
}
