# FretaJá — Plataforma de Rotas para Entregadores Autônomos

Data: 2026-09-16

## Contexto

FretaJá é broker logístico (sem frota própria) que intermedia frete entre
fornecedores em São Paulo e sellers do Mercado Livre em todo o Brasil,
usando rede de entregadores/motoristas autônomos e transportadoras
terceirizadas. Canal de aquisição inclui parceria com influencers/mentores
de e-commerce (comissão por indicação).

Este spec cobre o **subsistema de quadro de rotas e pagamento automatizado**
— a peça que falta pra intermediação funcionar sem esforço manual da
equipe além de postar a rota.

Fora de escopo deste documento (subsistemas separados, spec futuro se
necessário): sistema de código/comissão de indicação de influencer,
automação de postagem de rota (integração com pedido do seller).

## Objetivo

Equipe interna posta rota (origem, destino, valor/km, valor total).
Entregadores elegíveis recebem aviso no WhatsApp com link. O primeiro que
clicar "assumir" no link fica com a rota — sem risco de dois entregadores
ficarem com a mesma rota. Cliente (seller) já pagou a empresa antes da
rota ser liberada; ao entregador confirmar entrega (com foto), o sistema
repassa automaticamente a parte dele via PIX, descontando a margem da
empresa.

Restrição de público: parte relevante dos entregadores é motoboy mais
velho, pouco à vontade com tecnologia. Toda interação do entregador e do
cliente acontece por **link único, sem login e sem senha** — WhatsApp
avisa, um clique leva à ação.

## Arquitetura

- **Next.js** (App Router) — um único projeto cobre 3 superfícies:
  - Painel interno (equipe, com autenticação simples) — cadastro e
    gestão de rotas, entregadores, clientes.
  - Link do entregador (token único por rota+entregador, sem login).
  - Link do cliente/seller (token único por rota, sem login).
- **Postgres (Supabase)** — dados e transações atômicas (crítico pro
  mecanismo de "quem assume primeiro").
- **Asaas** (gateway de pagamento brasileiro, PIX + split) — cobrança do
  cliente e repasse automático ao entregador.
- **WhatsApp Business Cloud API** (Meta) — notificação de rota disponível
  aos entregadores elegíveis, e opcionalmente atualização de status ao
  cliente.

Escolha por custo (infra roda em planos gratuitos/baixo tráfego no
início) e por controle sobre a lógica de concorrência, que ferramentas
no-code ou bots de WhatsApp sozinhos não garantem de forma confiável.

## Modelo de dados (tabelas principais)

- `drivers` — id, nome, cpf, telefone, chave_pix, rntrc, cidade_base,
  status (ativo/inativo).
- `clients` — id, nome empresa/seller, telefone, email.
- `routes` — id, client_id, origem, destino, valor_km, valor_total,
  status (`aguardando_pagamento` | `disponivel` | `assumida` |
  `em_transporte` | `concluida` | `cancelada`), driver_id (nulo até
  assumida), created_at.
- `route_events` — id, route_id, tipo (postada, notificada, assumida,
  localizacao_atualizada, concluida, repasse_liberado), payload
  (cidade/hora/foto conforme tipo), created_at. Serve de trilha de
  auditoria e alimenta a tela do cliente.
- `payments` — id, route_id, asaas_charge_id, valor_recebido, status.
- `payouts` — id, route_id, driver_id, asaas_transfer_id, valor_repasse,
  status (pendente | pago | falhou).

## Fluxo principal

1. Equipe cadastra rota → status `aguardando_pagamento`. Sistema cria
   cobrança no Asaas pro cliente.
2. Webhook Asaas confirma pagamento → rota vira `disponivel` → sistema
   seleciona entregadores elegíveis (por cidade base) e dispara WhatsApp
   com link individual.
3. Entregador abre link, vê detalhes, aperta "ASSUMIR".
   - Backend roda `UPDATE routes SET status='assumida', driver_id=$1
     WHERE id=$2 AND status='disponivel'` numa transação. Se afetar 0
     linhas, a rota já foi pega — tela mostra "rota já assumida por
     outro entregador".
4. Entregador pode apertar "Atualizar localização" no mesmo link a cada
   parada — pede permissão de geolocalização do navegador uma única vez
   por clique (não fica rastreando em segundo plano). Grava evento em
   `route_events`.
5. Ao concluir, entregador anexa foto de comprovante e aperta "CONCLUÍDO"
   → status `concluida`.
6. Sistema dispara repasse automático (split) via Asaas pro PIX do
   entregador, descontando margem da empresa → grava em `payouts`.
7. Link do cliente mostra, a qualquer momento: status atual, ETA
   calculado na hora em que a rota foi assumida (distância ÷ velocidade
   média), e última localização informada.

## Tratamento de erros e casos de borda

- **Corrida de "assumir"**: resolvida pela atualização condicional
  atômica (passo 3) — garante exatamente um vencedor sem lock manual.
- **Cliente não paga**: rota não sai de `aguardando_pagamento`, nenhum
  entregador é notificado.
- **Entregador assume e desiste**: botão "desistir" no link volta rota
  pra `disponivel` e reenvia notificação aos demais elegíveis.
- **Repasse falha** (chave PIX inválida, conta bloqueada): `payouts`
  fica `falhou`, alerta interno pra equipe resolver manualmente — não
  bloqueia a rota já entregue.
- **Sem comprovante**: sistema não libera repasse sem foto anexada no
  passo 5.

## Testes

Foco de teste automatizado no núcleo que precisa estar certo:
- Transação de "assumir rota": teste simulando duas requisições
  concorrentes pro mesmo route_id, garantindo que só uma vence.
- Cálculo de valor de repasse (valor_total menos margem).
- Webhook do Asaas (pagamento confirmado → rota liberada; repasse
  confirmado → payout marcado pago).

Resto (telas simples, textos) verificado manualmente rodando o fluxo
ponta a ponta antes de cada entrega.

## Fora de escopo (fases futuras)

- App/rastreio com localização contínua em mapa.
- Automação da postagem de rota (hoje é manual pela equipe).
- Sistema de código de indicação de influencer (spec separado).
