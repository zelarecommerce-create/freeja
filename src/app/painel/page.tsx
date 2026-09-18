"use client";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { CAPACIDADE_PADRAO } from "@/lib/vehicleDefaults";

const ERRO_CONEXAO = "Erro de conexão, tente de novo";

const TIPOS_VEICULO = [
  ["MOTO", "Moto"],
  ["CARRO", "Carro"],
  ["FIORINO", "Fiorino"],
  ["VAN", "Van"],
  ["CAMINHAO_VUC", "Caminhão VUC"],
  ["CAMINHAO_3_4", "Caminhão 3/4"],
  ["TRUCK", "Truck"],
] as const;
type TipoVeiculo = (typeof TIPOS_VEICULO)[number][0];
const rotuloVeiculo = (t: string) => TIPOS_VEICULO.find(([k]) => k === t)?.[1] ?? t;

type Cliente = { id: string; nome: string; cpfCnpj: string; telefone: string; email: string; asaasCustomerId: string | null };
type Entregador = { id: string; nome: string; telefone: string; cidadeBase: string; tipoVeiculo: string; capacidadeKg: number; capacidadeM3: number };
type Resp = { ok: boolean; status: number; data: any };
type Msg = { tipo: "ok" | "erro"; texto: string; url?: string };

// ---------- helpers ----------

// Lança se a rede falhar ou se uma resposta de sucesso não for JSON.
async function chamar(url: string, body?: unknown): Promise<Resp> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => undefined);
  if (res.ok && data === undefined) throw new Error("resposta inválida");
  return { ok: res.ok, status: res.status, data };
}

// Aceita vírgula decimal brasileira ("3,5"). Retorna NaN se não for número.
const numero = (s: string) => (s.trim() === "" ? NaN : Number(s.trim().replace(",", ".")));
const positivo = (n: number) => Number.isFinite(n) && n > 0;
const reais = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Estado de envio compartilhado pelos três formulários.
function useEnvio(expirou: () => void) {
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  async function enviar(req: () => Promise<Resp>, aoSucesso: (data: any) => Promise<Msg> | Msg) {
    setEnviando(true);
    setMsg(null);
    try {
      const r = await req();
      if (r.status === 401) return expirou();
      if (!r.ok) setMsg({ tipo: "erro", texto: r.data?.error ?? ERRO_CONEXAO });
      else setMsg(await aoSucesso(r.data));
    } catch {
      setMsg({ tipo: "erro", texto: ERRO_CONEXAO });
    } finally {
      setEnviando(false);
    }
  }
  return { enviando, msg, setMsg, enviar };
}

// ---------- estilos ----------

const inputStyle: CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", fontSize: 16, padding: 10, marginTop: 4, border: "1px solid #999", borderRadius: 6 };
const botaoStyle: CSSProperties = { fontSize: 16, padding: "10px 20px", border: "none", borderRadius: 6, background: "#0b57d0", color: "#fff", cursor: "pointer" };
const tabelaStyle: CSSProperties = { borderCollapse: "collapse", width: "100%", fontSize: 15 };
const celulaStyle: CSSProperties = { textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" };

// ---------- componentes pequenos ----------

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 14, fontSize: 16 }}>
      {label}
      {children}
    </label>
  );
}

function Entrada({ label, value, onChange, tipo = "text" }: { label: string; value: string; onChange: (v: string) => void; tipo?: string }) {
  return (
    <Campo label={label}>
      <input type={tipo} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </Campo>
  );
}

function Mensagem({ msg }: { msg: Msg | null }) {
  if (!msg) return null;
  return (
    <div style={{ margin: "12px 0", color: msg.tipo === "ok" ? "#0a7a2f" : "#c00", fontSize: 16 }}>
      <strong>{msg.texto}</strong>
      {msg.url && (
        <Campo label="Link de acompanhamento do cliente">
          <input readOnly value={msg.url} onFocus={(e) => e.target.select()} style={inputStyle} />
        </Campo>
      )}
    </div>
  );
}

function Botao({ enviando, texto, enviandoTexto }: { enviando: boolean; texto: string; enviandoTexto: string }) {
  return (
    <button type="submit" disabled={enviando} style={{ ...botaoStyle, opacity: enviando ? 0.6 : 1 }}>
      {enviando ? enviandoTexto : texto}
    </button>
  );
}

// ---------- abas ----------

type AbaProps = { clientes: Cliente[]; entregadores: Entregador[]; recarregar: () => Promise<void>; expirou: () => void };

function ClientesAba({ clientes, recarregar, expirou }: AbaProps) {
  const vazio = { nome: "", cpfCnpj: "", telefone: "", email: "" };
  const [form, setForm] = useState(vazio);
  const { enviando, msg, enviar } = useEnvio(expirou);
  const campo = (k: keyof typeof vazio) => (v: string) => setForm({ ...form, [k]: v });

  return (
    <section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(
            () => chamar("/api/clients", form),
            async () => {
              setForm(vazio);
              await recarregar();
              return { tipo: "ok", texto: "Cliente cadastrado!" };
            },
          );
        }}
      >
        <Entrada label="Nome" value={form.nome} onChange={campo("nome")} />
        <Entrada label="CPF ou CNPJ" value={form.cpfCnpj} onChange={campo("cpfCnpj")} />
        <Entrada label="Telefone" value={form.telefone} onChange={campo("telefone")} />
        <Entrada label="E-mail" value={form.email} onChange={campo("email")} tipo="email" />
        <Botao enviando={enviando} texto="Cadastrar cliente" enviandoTexto="Cadastrando..." />
      </form>
      <Mensagem msg={msg} />
      <h2>Clientes cadastrados</h2>
      <table style={tabelaStyle}>
        <thead>
          <tr>
            <th style={celulaStyle}>Nome</th>
            <th style={celulaStyle}>CPF/CNPJ</th>
            <th style={celulaStyle}>Telefone</th>
            <th style={celulaStyle}>Asaas</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id}>
              <td style={celulaStyle}>{c.nome}</td>
              <td style={celulaStyle}>{c.cpfCnpj}</td>
              <td style={celulaStyle}>{c.telefone}</td>
              <td style={celulaStyle}>{c.asaasCustomerId ? "Asaas: ok" : "Asaas: pendente"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EntregadoresAba({ entregadores, recarregar, expirou }: AbaProps) {
  const vazio = {
    nome: "",
    cpf: "",
    telefone: "",
    chavePix: "",
    rntrc: "",
    cidadeBase: "",
    tipoVeiculo: "MOTO" as TipoVeiculo,
    capacidadeKg: String(CAPACIDADE_PADRAO.MOTO.capacidadeKg),
    capacidadeM3: String(CAPACIDADE_PADRAO.MOTO.capacidadeM3),
  };
  const [form, setForm] = useState(vazio);
  const { enviando, msg, setMsg, enviar } = useEnvio(expirou);
  const campo = (k: keyof typeof vazio) => (v: string) => setForm({ ...form, [k]: v });

  function trocarVeiculo(tipo: TipoVeiculo) {
    const p = CAPACIDADE_PADRAO[tipo];
    setForm({ ...form, tipoVeiculo: tipo, capacidadeKg: String(p.capacidadeKg), capacidadeM3: String(p.capacidadeM3) });
  }

  function submeter() {
    const capacidadeKg = numero(form.capacidadeKg);
    const capacidadeM3 = numero(form.capacidadeM3);
    if (!positivo(capacidadeKg)) return setMsg({ tipo: "erro", texto: "Capacidade (kg) deve ser um número maior que zero" });
    if (!positivo(capacidadeM3)) return setMsg({ tipo: "erro", texto: "Capacidade (m³) deve ser um número maior que zero" });
    enviar(
      () => chamar("/api/drivers", { ...form, capacidadeKg, capacidadeM3 }),
      async () => {
        setForm(vazio);
        await recarregar();
        return { tipo: "ok", texto: "Entregador cadastrado!" };
      },
    );
  }

  return (
    <section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submeter();
        }}
      >
        <Entrada label="Nome" value={form.nome} onChange={campo("nome")} />
        <Entrada label="CPF" value={form.cpf} onChange={campo("cpf")} />
        <Entrada label="Telefone (WhatsApp, com DDD)" value={form.telefone} onChange={campo("telefone")} />
        <Entrada label="Chave PIX" value={form.chavePix} onChange={campo("chavePix")} />
        <Entrada label="RNTRC" value={form.rntrc} onChange={campo("rntrc")} />
        <Entrada label="Cidade base" value={form.cidadeBase} onChange={campo("cidadeBase")} />
        <Campo label="Tipo de veículo">
          <select value={form.tipoVeiculo} onChange={(e) => trocarVeiculo(e.target.value as TipoVeiculo)} style={inputStyle}>
            {TIPOS_VEICULO.map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Entrada label="Capacidade (kg)" value={form.capacidadeKg} onChange={campo("capacidadeKg")} />
        <Entrada label="Capacidade (m³)" value={form.capacidadeM3} onChange={campo("capacidadeM3")} />
        <Botao enviando={enviando} texto="Cadastrar entregador" enviandoTexto="Cadastrando..." />
      </form>
      <Mensagem msg={msg} />
      <h2>Entregadores cadastrados</h2>
      <table style={tabelaStyle}>
        <thead>
          <tr>
            <th style={celulaStyle}>Nome</th>
            <th style={celulaStyle}>Cidade base</th>
            <th style={celulaStyle}>Veículo</th>
            <th style={celulaStyle}>Telefone</th>
            <th style={celulaStyle}>Capacidade</th>
          </tr>
        </thead>
        <tbody>
          {entregadores.map((d) => (
            <tr key={d.id}>
              <td style={celulaStyle}>{d.nome}</td>
              <td style={celulaStyle}>{d.cidadeBase}</td>
              <td style={celulaStyle}>{rotuloVeiculo(d.tipoVeiculo)}</td>
              <td style={celulaStyle}>{d.telefone}</td>
              <td style={celulaStyle}>
                {d.capacidadeKg} kg / {d.capacidadeM3} m³
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RotasAba({ clientes, expirou }: AbaProps) {
  const vazio = { clientId: "", origem: "", destino: "", distanciaKm: "", valorKm: "", pesoKg: "", volumeM3: "" };
  const [form, setForm] = useState(vazio);
  const { enviando, msg, setMsg, enviar } = useEnvio(expirou);
  const campo = (k: keyof typeof vazio) => (v: string) => setForm({ ...form, [k]: v });

  const distancia = numero(form.distanciaKm);
  const valorKm = numero(form.valorKm);
  const total = positivo(distancia) && positivo(valorKm) ? distancia * valorKm : null;

  function submeter() {
    const erro = (texto: string) => setMsg({ tipo: "erro", texto });
    if (!form.clientId) return erro("Escolha um cliente");
    if (!form.origem.trim()) return erro("Preencha a origem");
    if (!form.destino.trim()) return erro("Preencha o destino");
    const numeros = { distanciaKm: distancia, valorKm, pesoKg: numero(form.pesoKg), volumeM3: numero(form.volumeM3) };
    const nomes = { distanciaKm: "Distância (km)", valorKm: "Valor por km (R$)", pesoKg: "Peso (kg)", volumeM3: "Volume (m³)" };
    for (const k of Object.keys(numeros) as (keyof typeof numeros)[]) {
      if (!positivo(numeros[k])) return erro(`${nomes[k]} deve ser um número maior que zero`);
    }
    enviar(
      () => chamar("/api/routes", { clientId: form.clientId, origem: form.origem, destino: form.destino, ...numeros }),
      (data) => {
        setForm(vazio);
        return { tipo: "ok", texto: "Rota criada!", url: data.clienteTrackingUrl };
      },
    );
  }

  return (
    <section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submeter();
        }}
      >
        <Campo label="Cliente">
          <select value={form.clientId} onChange={(e) => campo("clientId")(e.target.value)} style={inputStyle}>
            <option value="">Escolha um cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id} disabled={!c.asaasCustomerId}>
                {c.asaasCustomerId ? c.nome : `${c.nome} (sem Asaas)`}
              </option>
            ))}
          </select>
        </Campo>
        <Entrada label="Origem" value={form.origem} onChange={campo("origem")} />
        <Entrada label="Destino" value={form.destino} onChange={campo("destino")} />
        <Entrada label="Distância (km)" value={form.distanciaKm} onChange={campo("distanciaKm")} />
        <Entrada label="Valor por km (R$)" value={form.valorKm} onChange={campo("valorKm")} />
        {total !== null && (
          <p style={{ fontSize: 18 }}>
            <strong>Valor total: R$ {reais(total)}</strong>
          </p>
        )}
        <Entrada label="Peso (kg)" value={form.pesoKg} onChange={campo("pesoKg")} />
        <Entrada label="Volume (m³)" value={form.volumeM3} onChange={campo("volumeM3")} />
        <Botao enviando={enviando} texto="Criar rota" enviandoTexto="Criando..." />
      </form>
      <Mensagem msg={msg} />
    </section>
  );
}

// ---------- página ----------

const ABAS = ["Rotas", "Clientes", "Entregadores"] as const;

export default function PainelPage() {
  const [carregando, setCarregando] = useState(true);
  const [logado, setLogado] = useState(false);
  const [senha, setSenha] = useState("");
  const [erroLogin, setErroLogin] = useState("");
  const [aba, setAba] = useState<(typeof ABAS)[number]>("Rotas");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);

  const expirou = () => {
    setLogado(false);
    setErroLogin("Sessão expirada, entre de novo");
  };

  // Recarrega as duas listas; false se a sessão não vale (401).
  async function carregarTudo(): Promise<boolean> {
    const [c, d] = await Promise.all([chamar("/api/clients"), chamar("/api/drivers")]);
    if (c.status === 401 || d.status === 401) return false;
    if (!c.ok || !d.ok) throw new Error("falha ao carregar");
    setClientes(c.data);
    setEntregadores(d.data);
    return true;
  }

  async function recarregar() {
    if (!(await carregarTudo())) expirou();
  }

  // Verifica a sessão ao abrir a página: 401 mostra o login, 200 entra direto.
  useEffect(() => {
    carregarTudo()
      .then(setLogado)
      .catch(() => setErroLogin(ERRO_CONEXAO))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function entrar() {
    setErroLogin("");
    try {
      const r = await chamar("/api/internal/login", { senha });
      if (!r.ok) return setErroLogin(r.status === 401 ? "Senha incorreta" : ERRO_CONEXAO);
      setSenha("");
      setLogado(await carregarTudo());
    } catch {
      setErroLogin(ERRO_CONEXAO);
    }
  }

  if (carregando) return <main style={{ padding: 24, fontSize: 16 }}>Carregando...</main>;

  if (!logado) {
    return (
      <main style={{ padding: 24, maxWidth: 400 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            entrar();
          }}
        >
          <Campo label="Senha da equipe">
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} style={inputStyle} />
          </Campo>
          <button type="submit" style={botaoStyle}>
            Entrar
          </button>
        </form>
        <Mensagem msg={erroLogin ? { tipo: "erro", texto: erroLogin } : null} />
      </main>
    );
  }

  const props: AbaProps = { clientes, entregadores, recarregar, expirou };
  return (
    <main style={{ padding: 24, maxWidth: 800 }}>
      <nav style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {ABAS.map((nome) => (
          <button
            key={nome}
            type="button"
            onClick={() => setAba(nome)}
            style={{
              ...botaoStyle,
              background: aba === nome ? "#0b57d0" : "#e3e3e3",
              color: aba === nome ? "#fff" : "#222",
              fontWeight: aba === nome ? 700 : 400,
            }}
          >
            {nome}
          </button>
        ))}
      </nav>
      {aba === "Rotas" && <RotasAba {...props} />}
      {aba === "Clientes" && <ClientesAba {...props} />}
      {aba === "Entregadores" && <EntregadoresAba {...props} />}
    </main>
  );
}
