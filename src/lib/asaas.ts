function getBaseUrl(): string {
  return process.env.ASAAS_BASE_URL ?? "https://api.asaas.com/v3";
}

function getApiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY env var is required");
  return key;
}

export interface CreateChargeInput {
  customerAsaasId: string;
  valor: number;
  descricao: string;
  externalReference: string;
}

export interface AsaasCharge {
  id: string;
  status: string;
  invoiceUrl: string;
}

export async function createCharge(input: CreateChargeInput): Promise<AsaasCharge> {
  const response = await fetch(`${getBaseUrl()}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: getApiKey() },
    body: JSON.stringify({
      customer: input.customerAsaasId,
      billingType: "PIX",
      value: input.valor,
      description: input.descricao,
      externalReference: input.externalReference,
    }),
  });
  if (!response.ok) throw new Error(`Asaas createCharge failed: ${response.status}`);
  return response.json();
}

export interface CreateTransferInput {
  chavePix: string;
  valor: number;
  descricao: string;
}

export interface AsaasTransfer {
  id: string;
  status: string;
}

export async function createTransfer(input: CreateTransferInput): Promise<AsaasTransfer> {
  const response = await fetch(`${getBaseUrl()}/transfers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: getApiKey() },
    body: JSON.stringify({
      value: input.valor,
      pixAddressKey: input.chavePix,
      description: input.descricao,
    }),
  });
  if (!response.ok) throw new Error(`Asaas createTransfer failed: ${response.status}`);
  return response.json();
}
