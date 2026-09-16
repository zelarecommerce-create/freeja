# Plataforma de Rotas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the route board — internal team posts a route, eligible
drivers get a WhatsApp link, first to click "assume" wins atomically,
completion triggers an automatic PIX payout via Asaas, and the client
gets a no-login tracking link.

**Architecture:** Single Next.js (App Router, TypeScript) app. Postgres
(Supabase) via Prisma for data + the atomic claim. HMAC-signed tokens
(no session/login) identify drivers and clients on their magic links.
Asaas REST API handles the PIX charge and the payout transfer. WhatsApp
Cloud API sends the notification. Supabase Storage holds delivery-proof
photos.

**Tech Stack:** Next.js 14, TypeScript, Prisma 5 + PostgreSQL, Vitest,
Supabase (Postgres + Storage), Asaas API, WhatsApp Cloud API.

**Spec:** [docs/superpowers/specs/2026-09-16-plataforma-rotas-design.md](../specs/2026-09-16-plataforma-rotas-design.md)

## Global Constraints

- `TOKEN_SECRET` env var required — HMAC key signing every driver/client link. Never hardcode it.
- `MARGEM_EMPRESA_PERCENTUAL` env var (e.g. `0.20` for 20%) — the company's cut of `valorTotal`, deducted before the driver payout. Configurable because the business will tune it; do not hardcode a percentage in code.
- Average speed for ETA is a fixed constant (60 km/h) — a deliberate simplification, not a maps API call. See ponytail comment in `src/lib/eta.ts`.
- Internal team auth is a single shared password (`INTERNAL_PANEL_PASSWORD` env var), not per-user accounts — MVP simplification per spec's "equipe pequena posta manualmente" scope.
- Delivery-proof photos are uploaded as base64 JSON to the API, not direct signed upload — MVP simplification for low initial volume.
- Every driver/client interaction is a signed link — never add a login/password screen for drivers or clients; that contradicts the spec's core UX requirement.
- Database is PostgreSQL (via Supabase) — do not substitute SQLite, even for local dev, since the atomic claim (`updateMany` conditional on `status`) must run against the real engine it will deploy on.

---

## Task 1: Project scaffolding + Prisma schema + Postgres connection

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Test: `src/lib/db.test.ts`

**Interfaces:**
- Produces: `prisma` (singleton `PrismaClient` instance) from `src/lib/db.ts`, imported by every later task as `import { prisma } from "@/lib/db"`.
- Produces: Prisma models `Client`, `Driver`, `Route`, `RouteEvent`, `Payment`, `Payout` with the enums `TipoVeiculo`, `DriverStatus`, `RouteStatus`, matching the spec's data model exactly (field names below are the ones every later task uses).

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "fretaja",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "@prisma/client": "5.18.0",
    "@supabase/supabase-js": "2.45.4"
  },
  "devDependencies": {
    "typescript": "5.5.4",
    "@types/node": "20.14.15",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "prisma": "5.18.0",
    "vitest": "2.0.5"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "next-env.d.ts", ".next/types/**/*.ts", "vitest.config.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node" },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules
.next
.env
```

- [ ] **Step 6: Write `.env.example`**

```
DATABASE_URL="postgresql://user:password@host:5432/fretaja"
TOKEN_SECRET="replace-with-a-long-random-string"
MARGEM_EMPRESA_PERCENTUAL="0.20"
INTERNAL_PANEL_PASSWORD="replace-with-a-shared-team-password"
ASAAS_API_KEY="replace-with-asaas-sandbox-key"
ASAAS_BASE_URL="https://sandbox.asaas.com/api/v3"
WHATSAPP_PHONE_NUMBER_ID="replace-with-meta-phone-number-id"
WHATSAPP_TOKEN="replace-with-meta-access-token"
SUPABASE_URL="https://replace.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="replace-with-service-role-key"
```

- [ ] **Step 7: Write minimal app shell**

`src/app/layout.tsx`:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
export default function Home() {
  return <p>FretaJá</p>;
}
```

- [ ] **Step 8: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum TipoVeiculo {
  MOTO
  CARRO
  FIORINO
  VAN
  CAMINHAO_VUC
  CAMINHAO_3_4
  TRUCK
}

enum DriverStatus {
  ATIVO
  INATIVO
}

enum RouteStatus {
  AGUARDANDO_PAGAMENTO
  DISPONIVEL
  ASSUMIDA
  EM_TRANSPORTE
  CONCLUIDA
  CANCELADA
}

model Client {
  id        String   @id @default(cuid())
  nome      String
  telefone  String
  email     String
  createdAt DateTime @default(now())
  routes    Route[]
}

model Driver {
  id           String       @id @default(cuid())
  nome         String
  cpf          String       @unique
  telefone     String
  chavePix     String
  rntrc        String
  cidadeBase   String
  tipoVeiculo  TipoVeiculo
  capacidadeKg Float
  capacidadeM3 Float
  status       DriverStatus @default(ATIVO)
  createdAt    DateTime     @default(now())
  routes       Route[]
}

model Route {
  id          String      @id @default(cuid())
  clientId    String
  client      Client      @relation(fields: [clientId], references: [id])
  driverId    String?
  driver      Driver?     @relation(fields: [driverId], references: [id])
  origem      String
  destino     String
  distanciaKm Float
  valorKm     Float
  valorTotal  Float
  pesoKg      Float
  volumeM3    Float
  status      RouteStatus @default(AGUARDANDO_PAGAMENTO)
  createdAt   DateTime    @default(now())
  events      RouteEvent[]
  payment     Payment?
  payout      Payout?
}

model RouteEvent {
  id        String   @id @default(cuid())
  routeId   String
  route     Route    @relation(fields: [routeId], references: [id])
  tipo      String
  payload   Json?
  createdAt DateTime @default(now())
}

model Payment {
  id             String   @id @default(cuid())
  routeId        String   @unique
  route          Route    @relation(fields: [routeId], references: [id])
  asaasChargeId  String
  valorRecebido  Float
  status         String
  createdAt      DateTime @default(now())
}

model Payout {
  id              String   @id @default(cuid())
  routeId         String   @unique
  route           Route    @relation(fields: [routeId], references: [id])
  driverId        String
  asaasTransferId String?
  valorRepasse    Float
  status          String   @default("pendente")
  createdAt       DateTime @default(now())
}
```

- [ ] **Step 9: Write `src/lib/db.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 10: Install dependencies**

```bash
npm install
```

- [ ] **Step 11: Create a real Postgres database and set `DATABASE_URL`**

Create a free Supabase project (or a local Postgres instance), copy the
connection string into a new `.env` file (copy `.env.example` to `.env`
first). This is a manual step — the migration in the next step needs a
real, reachable Postgres.

- [ ] **Step 12: Run the migration**

```bash
npx prisma migrate dev --name init
```

Expected: creates the tables and generates the Prisma client with no errors.

- [ ] **Step 13: Write the failing test**

`src/lib/db.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "./db";

describe("db connection", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("can write and read a Client row", async () => {
    const client = await prisma.client.create({
      data: { nome: "Seller Teste", telefone: "11999999999", email: "teste@example.com" },
    });

    const found = await prisma.client.findUnique({ where: { id: client.id } });

    expect(found?.nome).toBe("Seller Teste");

    await prisma.client.delete({ where: { id: client.id } });
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

Run: `npx vitest run src/lib/db.test.ts`
Expected: FAIL (schema/client not generated yet, or connection missing) if steps above were skipped — otherwise this should already pass since Step 12 generated the client. If it passes here, that's fine, continue.

- [ ] **Step 15: Run test to verify it passes**

Run: `npx vitest run src/lib/db.test.ts`
Expected: PASS

- [ ] **Step 16: Commit**

```bash
git add package.json tsconfig.json next.config.mjs vitest.config.ts .gitignore .env.example src prisma
git commit -m "chore: scaffold Next.js project with Prisma/Postgres schema"
```

---

## Task 2: Token library (sign/verify magic links)

**Files:**
- Create: `src/lib/tokens.ts`
- Test: `src/lib/tokens.test.ts`

**Interfaces:**
- Consumes: `process.env.TOKEN_SECRET` (from Global Constraints).
- Produces: `signToken(payload: TokenPayload): string` and `verifyToken(token: string): TokenPayload | null`, and the `TokenPayload` type `{ routeId: string; subjectId: string; kind: "driver" | "client"; exp: number }` — every later task that builds a driver/client link uses these exact names.

- [ ] **Step 1: Write the failing test**

`src/lib/tokens.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { signToken, verifyToken } from "./tokens";

beforeAll(() => {
  process.env.TOKEN_SECRET = "test-secret";
});

describe("tokens", () => {
  it("round-trips a valid token", () => {
    const token = signToken({ routeId: "r1", subjectId: "d1", kind: "driver", exp: Math.floor(Date.now() / 1000) + 3600 });
    const payload = verifyToken(token);
    expect(payload).toEqual({ routeId: "r1", subjectId: "d1", kind: "driver", exp: expect.any(Number) });
  });

  it("rejects a tampered token", () => {
    const token = signToken({ routeId: "r1", subjectId: "d1", kind: "driver", exp: Math.floor(Date.now() / 1000) + 3600 });
    const tampered = token.slice(0, -2) + "xx";
    expect(verifyToken(tampered)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signToken({ routeId: "r1", subjectId: "d1", kind: "driver", exp: Math.floor(Date.now() / 1000) - 10 });
    expect(verifyToken(token)).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(verifyToken("not-a-token")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tokens.test.ts`
Expected: FAIL with "Cannot find module './tokens'"

- [ ] **Step 3: Write the implementation**

`src/lib/tokens.ts`:
```ts
import crypto from "node:crypto";

export interface TokenPayload {
  routeId: string;
  subjectId: string;
  kind: "driver" | "client";
  exp: number;
}

function getSecret(): string {
  const secret = process.env.TOKEN_SECRET;
  if (!secret) throw new Error("TOKEN_SECRET env var is required");
  return secret;
}

export function signToken(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  const expected = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tokens.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tokens.ts src/lib/tokens.test.ts
git commit -m "feat: add HMAC-signed token library for driver/client magic links"
```

---

## Task 3: Vehicle capacity matching

**Files:**
- Create: `src/lib/vehicleMatch.ts`
- Test: `src/lib/vehicleMatch.test.ts`

**Interfaces:**
- Produces: `filterEligibleDrivers(drivers, cargo, cidadeBase): T[]` and `CargoRequirement = { pesoKg: number; volumeM3: number }` — used by Task 9's notifier to select who gets the WhatsApp link.

- [ ] **Step 1: Write the failing test**

`src/lib/vehicleMatch.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { filterEligibleDrivers } from "./vehicleMatch";

const baseDriver = {
  cidadeBase: "São Paulo",
  status: "ATIVO" as const,
};

describe("filterEligibleDrivers", () => {
  it("excludes a driver whose vehicle can't carry the weight", () => {
    const drivers = [{ ...baseDriver, id: "1", capacidadeKg: 50, capacidadeM3: 1 }];
    const result = filterEligibleDrivers(drivers, { pesoKg: 100, volumeM3: 0.5 }, "São Paulo");
    expect(result).toHaveLength(0);
  });

  it("excludes a driver in a different city", () => {
    const drivers = [{ ...baseDriver, id: "1", cidadeBase: "Campinas", capacidadeKg: 500, capacidadeM3: 5 }];
    const result = filterEligibleDrivers(drivers, { pesoKg: 100, volumeM3: 0.5 }, "São Paulo");
    expect(result).toHaveLength(0);
  });

  it("excludes an inactive driver", () => {
    const drivers = [{ ...baseDriver, id: "1", status: "INATIVO" as const, capacidadeKg: 500, capacidadeM3: 5 }];
    const result = filterEligibleDrivers(drivers, { pesoKg: 100, volumeM3: 0.5 }, "São Paulo");
    expect(result).toHaveLength(0);
  });

  it("includes a driver whose vehicle fits exactly", () => {
    const drivers = [{ ...baseDriver, id: "1", capacidadeKg: 100, capacidadeM3: 0.5 }];
    const result = filterEligibleDrivers(drivers, { pesoKg: 100, volumeM3: 0.5 }, "São Paulo");
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/vehicleMatch.test.ts`
Expected: FAIL with "Cannot find module './vehicleMatch'"

- [ ] **Step 3: Write the implementation**

`src/lib/vehicleMatch.ts`:
```ts
export interface CargoRequirement {
  pesoKg: number;
  volumeM3: number;
}

interface DriverForMatch {
  capacidadeKg: number;
  capacidadeM3: number;
  cidadeBase: string;
  status: "ATIVO" | "INATIVO";
}

export function filterEligibleDrivers<T extends DriverForMatch>(
  drivers: T[],
  cargo: CargoRequirement,
  cidadeBase: string
): T[] {
  return drivers.filter(
    (d) =>
      d.status === "ATIVO" &&
      d.cidadeBase === cidadeBase &&
      d.capacidadeKg >= cargo.pesoKg &&
      d.capacidadeM3 >= cargo.volumeM3
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/vehicleMatch.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/vehicleMatch.ts src/lib/vehicleMatch.test.ts
git commit -m "feat: add vehicle capacity matching for route eligibility"
```

---

## Task 4: ETA calculation

**Files:**
- Create: `src/lib/eta.ts`
- Test: `src/lib/eta.test.ts`

**Interfaces:**
- Produces: `calcularHorarioChegada(distanciaKm: number, agora?: Date): Date` — used by Task 11 (route creation) to stamp the ETA shown on the client tracking page.

- [ ] **Step 1: Write the failing test**

`src/lib/eta.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { calcularHorarioChegada, calcularEtaMinutos } from "./eta";

describe("eta", () => {
  it("calcula minutos com base em 60km/h", () => {
    expect(calcularEtaMinutos(60)).toBe(60);
    expect(calcularEtaMinutos(30)).toBe(30);
  });

  it("retorna 0 pra distancia zero ou negativa", () => {
    expect(calcularEtaMinutos(0)).toBe(0);
    expect(calcularEtaMinutos(-5)).toBe(0);
  });

  it("soma os minutos ao horario base", () => {
    const agora = new Date("2026-09-16T10:00:00Z");
    const chegada = calcularHorarioChegada(120, agora);
    expect(chegada.toISOString()).toBe("2026-09-16T12:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/eta.test.ts`
Expected: FAIL with "Cannot find module './eta'"

- [ ] **Step 3: Write the implementation**

`src/lib/eta.ts`:
```ts
// ponytail: fixed average speed, not live traffic/maps data.
// Upgrade path: swap for a maps/directions API call if ETA accuracy
// starts mattering (e.g. client complaints about wrong estimates).
const VELOCIDADE_MEDIA_KMH = 60;

export function calcularEtaMinutos(distanciaKm: number): number {
  if (distanciaKm <= 0) return 0;
  return Math.round((distanciaKm / VELOCIDADE_MEDIA_KMH) * 60);
}

export function calcularHorarioChegada(distanciaKm: number, agora: Date = new Date()): Date {
  const minutos = calcularEtaMinutos(distanciaKm);
  return new Date(agora.getTime() + minutos * 60_000);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/eta.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/eta.ts src/lib/eta.test.ts
git commit -m "feat: add fixed-speed ETA calculation"
```

---

## Task 5: Claim logic + driver "assume" endpoint

**Files:**
- Create: `src/lib/claimRoute.ts`
- Create: `src/app/api/driver/[token]/assume/route.ts`
- Test: `src/lib/claimRoute.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/db.ts` (Task 1), `verifyToken` from `src/lib/tokens.ts` (Task 2).
- Produces: `claimRoute(routeId: string, driverId: string): Promise<ClaimResult>` where `ClaimResult = { claimed: true } | { claimed: false; reason: "already_claimed" | "not_found" }` — this is the function every "who gets the route" guarantee rests on; no other code should update `Route.status` to `ASSUMIDA`.

- [ ] **Step 1: Write the failing test**

`src/lib/claimRoute.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "./db";
import { claimRoute } from "./claimRoute";

async function createDisponivelRoute() {
  const client = await prisma.client.create({
    data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
  });
  return prisma.route.create({
    data: {
      clientId: client.id,
      origem: "São Paulo",
      destino: "Campinas",
      distanciaKm: 100,
      valorKm: 3,
      valorTotal: 300,
      pesoKg: 50,
      volumeM3: 1,
      status: "DISPONIVEL",
    },
  });
}

describe("claimRoute", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lets the first driver claim an available route", async () => {
    const route = await createDisponivelRoute();
    const result = await claimRoute(route.id, "driver-1");
    expect(result).toEqual({ claimed: true });

    const updated = await prisma.route.findUnique({ where: { id: route.id } });
    expect(updated?.status).toBe("ASSUMIDA");
    expect(updated?.driverId).toBe("driver-1");
  });

  it("rejects a second driver claiming the same route", async () => {
    const route = await createDisponivelRoute();
    await claimRoute(route.id, "driver-1");
    const result = await claimRoute(route.id, "driver-2");
    expect(result).toEqual({ claimed: false, reason: "already_claimed" });
  });

  it("reports not_found for a nonexistent route", async () => {
    const result = await claimRoute("does-not-exist", "driver-1");
    expect(result).toEqual({ claimed: false, reason: "not_found" });
  });

  it("logs a route event on successful claim", async () => {
    const route = await createDisponivelRoute();
    await claimRoute(route.id, "driver-1");
    const events = await prisma.routeEvent.findMany({ where: { routeId: route.id } });
    expect(events.map((e) => e.tipo)).toContain("assumida");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/claimRoute.test.ts`
Expected: FAIL with "Cannot find module './claimRoute'"

- [ ] **Step 3: Write the implementation**

`src/lib/claimRoute.ts`:
```ts
import { prisma } from "./db";

export type ClaimResult =
  | { claimed: true }
  | { claimed: false; reason: "already_claimed" | "not_found" };

export async function claimRoute(routeId: string, driverId: string): Promise<ClaimResult> {
  const result = await prisma.route.updateMany({
    where: { id: routeId, status: "DISPONIVEL" },
    data: { status: "ASSUMIDA", driverId },
  });

  if (result.count === 0) {
    const route = await prisma.route.findUnique({ where: { id: routeId } });
    return route ? { claimed: false, reason: "already_claimed" } : { claimed: false, reason: "not_found" };
  }

  await prisma.routeEvent.create({
    data: { routeId, tipo: "assumida", payload: { driverId } },
  });

  return { claimed: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/claimRoute.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the API endpoint**

`src/app/api/driver/[token]/assume/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";
import { claimRoute } from "@/lib/claimRoute";

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const payload = verifyToken(params.token);
  if (!payload || payload.kind !== "driver") {
    return NextResponse.json({ error: "link inválido ou expirado" }, { status: 401 });
  }

  const result = await claimRoute(payload.routeId, payload.subjectId);
  if (!result.claimed) {
    const message =
      result.reason === "already_claimed"
        ? "rota já assumida por outro entregador"
        : "rota não encontrada";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/claimRoute.ts src/lib/claimRoute.test.ts "src/app/api/driver/[token]/assume"
git commit -m "feat: add atomic route claim and driver assume endpoint"
```

---

## Task 6: Driver location update endpoint

**Files:**
- Create: `src/lib/logLocation.ts`
- Create: `src/app/api/driver/[token]/location/route.ts`
- Test: `src/lib/logLocation.test.ts`

**Interfaces:**
- Consumes: `prisma`, `verifyToken`.
- Produces: `logLocation(routeId: string, driverId: string, cidade: string): Promise<void>` — appends a `RouteEvent` with `tipo: "localizacao_atualizada"`, read by Task 14's client tracking endpoint.

- [ ] **Step 1: Write the failing test**

`src/lib/logLocation.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "./db";
import { logLocation } from "./logLocation";

describe("logLocation", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("records a localizacao_atualizada event with the city", async () => {
    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        origem: "São Paulo",
        destino: "Rio de Janeiro",
        distanciaKm: 430,
        valorKm: 3,
        valorTotal: 1290,
        pesoKg: 50,
        volumeM3: 1,
        status: "ASSUMIDA",
        driverId: "driver-1",
      },
    });

    await logLocation(route.id, "driver-1", "Volta Redonda");

    const events = await prisma.routeEvent.findMany({ where: { routeId: route.id } });
    expect(events).toHaveLength(1);
    expect(events[0].tipo).toBe("localizacao_atualizada");
    expect(events[0].payload).toMatchObject({ cidade: "Volta Redonda", driverId: "driver-1" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/logLocation.test.ts`
Expected: FAIL with "Cannot find module './logLocation'"

- [ ] **Step 3: Write the implementation**

`src/lib/logLocation.ts`:
```ts
import { prisma } from "./db";

export async function logLocation(routeId: string, driverId: string, cidade: string): Promise<void> {
  await prisma.routeEvent.create({
    data: { routeId, tipo: "localizacao_atualizada", payload: { driverId, cidade } },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/logLocation.test.ts`
Expected: PASS

- [ ] **Step 5: Write the API endpoint**

`src/app/api/driver/[token]/location/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";
import { logLocation } from "@/lib/logLocation";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const payload = verifyToken(params.token);
  if (!payload || payload.kind !== "driver") {
    return NextResponse.json({ error: "link inválido ou expirado" }, { status: 401 });
  }

  const body = await req.json();
  const cidade = typeof body.cidade === "string" ? body.cidade : null;
  if (!cidade) {
    return NextResponse.json({ error: "cidade é obrigatória" }, { status: 400 });
  }

  await logLocation(payload.routeId, payload.subjectId, cidade);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/logLocation.ts src/lib/logLocation.test.ts "src/app/api/driver/[token]/location"
git commit -m "feat: add driver location update endpoint"
```

---

## Task 7: Asaas client wrapper

**Files:**
- Create: `src/lib/asaas.ts`
- Test: `src/lib/asaas.test.ts`

**Interfaces:**
- Consumes: `process.env.ASAAS_API_KEY`, `process.env.ASAAS_BASE_URL`.
- Produces: `createCharge(input: CreateChargeInput): Promise<AsaasCharge>` and `createTransfer(input: CreateTransferInput): Promise<AsaasTransfer>` — used by Task 11 (route creation) and Task 13 (payout) respectively.

- [ ] **Step 1: Write the failing test**

`src/lib/asaas.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createCharge, createTransfer } from "./asaas";

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.ASAAS_API_KEY = "test-key";
  process.env.ASAAS_BASE_URL = "https://sandbox.asaas.com/api/v3";
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("asaas", () => {
  it("creates a PIX charge", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "chg_123", status: "PENDING", invoiceUrl: "https://asaas/x" }),
    }) as unknown as typeof fetch;

    const charge = await createCharge({
      customerAsaasId: "cus_1",
      valor: 300,
      descricao: "Frete SP-Campinas",
      externalReference: "route-1",
    });

    expect(charge.id).toBe("chg_123");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://sandbox.asaas.com/api/v3/payments",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws when the charge request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch;
    await expect(
      createCharge({ customerAsaasId: "cus_1", valor: 300, descricao: "x", externalReference: "route-1" })
    ).rejects.toThrow("Asaas createCharge failed: 400");
  });

  it("creates a PIX transfer", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "trf_123", status: "PENDING" }),
    }) as unknown as typeof fetch;

    const transfer = await createTransfer({ chavePix: "11999999999", valor: 240, descricao: "Repasse rota" });

    expect(transfer.id).toBe("trf_123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/asaas.test.ts`
Expected: FAIL with "Cannot find module './asaas'"

- [ ] **Step 3: Write the implementation**

`src/lib/asaas.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/asaas.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/asaas.ts src/lib/asaas.test.ts
git commit -m "feat: add Asaas PIX charge and transfer client"
```

---

## Task 8: WhatsApp client wrapper

**Files:**
- Create: `src/lib/whatsapp.ts`
- Test: `src/lib/whatsapp.test.ts`

**Interfaces:**
- Consumes: `process.env.WHATSAPP_PHONE_NUMBER_ID`, `process.env.WHATSAPP_TOKEN`.
- Produces: `sendTextMessage(toPhone: string, message: string): Promise<void>` — used by Task 9's notifier.

- [ ] **Step 1: Write the failing test**

`src/lib/whatsapp.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendTextMessage } from "./whatsapp";

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
  process.env.WHATSAPP_TOKEN = "test-token";
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("whatsapp", () => {
  it("sends a text message to the given phone", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;

    await sendTextMessage("5511999999999", "Nova rota disponível: SP-Campinas");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v19.0/123456/messages",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws when the API call fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    await expect(sendTextMessage("5511999999999", "x")).rejects.toThrow("WhatsApp send failed: 401");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/whatsapp.test.ts`
Expected: FAIL with "Cannot find module './whatsapp'"

- [ ] **Step 3: Write the implementation**

`src/lib/whatsapp.ts`:
```ts
function getConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneNumberId || !token) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_TOKEN env vars are required");
  }
  return { phoneNumberId, token };
}

export async function sendTextMessage(toPhone: string, message: string): Promise<void> {
  const { phoneNumberId, token } = getConfig();
  const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body: message },
    }),
  });
  if (!response.ok) throw new Error(`WhatsApp send failed: ${response.status}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/whatsapp.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp.ts src/lib/whatsapp.test.ts
git commit -m "feat: add WhatsApp Cloud API text message client"
```

---

## Task 9: Eligible-driver notifier

**Files:**
- Create: `src/lib/notifyEligibleDrivers.ts`
- Test: `src/lib/notifyEligibleDrivers.test.ts`

**Interfaces:**
- Consumes: `prisma`, `filterEligibleDrivers` (Task 3), `signToken`/`verifyToken` (Task 2), `sendTextMessage` (Task 8).
- Produces: `notifyEligibleDrivers(routeId: string): Promise<number>` (returns how many drivers were notified) — called by Task 11's Asaas webhook once a route becomes `DISPONIVEL`. Also produces `releaseRoute(routeId: string, driverId: string): Promise<ReleaseResult>` where `ReleaseResult = { released: true } | { released: false; reason: "not_assigned_to_driver" }`, and the `POST /api/driver/[token]/release` endpoint that calls it — this is the spec's "entregador desiste" case.

- [ ] **Step 1: Write the failing test**

`src/lib/notifyEligibleDrivers.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "./db";
import * as whatsapp from "./whatsapp";
import { notifyEligibleDrivers } from "./notifyEligibleDrivers";

beforeEach(() => {
  process.env.TOKEN_SECRET = "test-secret";
  vi.spyOn(whatsapp, "sendTextMessage").mockResolvedValue();
});

describe("notifyEligibleDrivers", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("notifies only drivers whose vehicle and city fit the route", async () => {
    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        origem: "São Paulo",
        destino: "Campinas",
        distanciaKm: 100,
        valorKm: 3,
        valorTotal: 300,
        pesoKg: 80,
        volumeM3: 1,
        status: "DISPONIVEL",
      },
    });

    const fits = await prisma.driver.create({
      data: {
        nome: "Motorista Apto",
        cpf: "11111111111",
        telefone: "5511911111111",
        chavePix: "chave1",
        rntrc: "RNTRC1",
        cidadeBase: "São Paulo",
        tipoVeiculo: "FIORINO",
        capacidadeKg: 500,
        capacidadeM3: 3,
      },
    });
    await prisma.driver.create({
      data: {
        nome: "Motorista Moto",
        cpf: "22222222222",
        telefone: "5511922222222",
        chavePix: "chave2",
        rntrc: "RNTRC2",
        cidadeBase: "São Paulo",
        tipoVeiculo: "MOTO",
        capacidadeKg: 20,
        capacidadeM3: 0.1,
      },
    });

    const count = await notifyEligibleDrivers(route.id);

    expect(count).toBe(1);
    expect(whatsapp.sendTextMessage).toHaveBeenCalledTimes(1);
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith(fits.telefone, expect.stringContaining("São Paulo"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notifyEligibleDrivers.test.ts`
Expected: FAIL with "Cannot find module './notifyEligibleDrivers'"

- [ ] **Step 3: Write the implementation**

`src/lib/notifyEligibleDrivers.ts`:
```ts
import { prisma } from "./db";
import { filterEligibleDrivers } from "./vehicleMatch";
import { signToken } from "./tokens";
import { sendTextMessage } from "./whatsapp";

const LINK_EXPIRATION_SECONDS = 60 * 60 * 24; // 24h

export async function notifyEligibleDrivers(routeId: string): Promise<number> {
  const route = await prisma.route.findUniqueOrThrow({ where: { id: routeId } });
  const drivers = await prisma.driver.findMany({ where: { status: "ATIVO" } });

  const eligible = filterEligibleDrivers(
    drivers,
    { pesoKg: route.pesoKg, volumeM3: route.volumeM3 },
    route.origem
  );

  for (const driver of eligible) {
    const token = signToken({
      routeId: route.id,
      subjectId: driver.id,
      kind: "driver",
      exp: Math.floor(Date.now() / 1000) + LINK_EXPIRATION_SECONDS,
    });
    const link = `${process.env.APP_URL ?? ""}/entregador/${token}`;
    await sendTextMessage(
      driver.telefone,
      `Nova rota disponível: ${route.origem} → ${route.destino}. Valor: R$${route.valorTotal}. Assuma aqui: ${link}`
    );
  }

  return eligible.length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/notifyEligibleDrivers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifyEligibleDrivers.ts src/lib/notifyEligibleDrivers.test.ts
git commit -m "feat: notify only capacity-and-city-eligible drivers via WhatsApp"
```

- [ ] **Step 6: Write the failing test for releasing a route**

Add to `src/lib/notifyEligibleDrivers.test.ts`:
```ts
import { releaseRoute } from "./notifyEligibleDrivers";

describe("releaseRoute", () => {
  it("puts the route back to DISPONIVEL and re-notifies eligible drivers", async () => {
    const client = await prisma.client.create({
      data: { nome: "Seller2", telefone: "11999999999", email: "seller2@example.com" },
    });
    const driver = await prisma.driver.create({
      data: {
        nome: "Motorista Desistente",
        cpf: "55555555555",
        telefone: "5511955555555",
        chavePix: "chave3",
        rntrc: "RNTRC5",
        cidadeBase: "São Paulo",
        tipoVeiculo: "VAN",
        capacidadeKg: 500,
        capacidadeM3: 5,
      },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        driverId: driver.id,
        origem: "São Paulo",
        destino: "Osasco",
        distanciaKm: 20,
        valorKm: 3,
        valorTotal: 60,
        pesoKg: 30,
        volumeM3: 0.5,
        status: "ASSUMIDA",
      },
    });

    const result = await releaseRoute(route.id, driver.id);
    expect(result).toEqual({ released: true });

    const updated = await prisma.route.findUnique({ where: { id: route.id } });
    expect(updated?.status).toBe("DISPONIVEL");
    expect(updated?.driverId).toBeNull();
  });

  it("rejects releasing a route assigned to a different driver", async () => {
    const client = await prisma.client.create({
      data: { nome: "Seller3", telefone: "11999999999", email: "seller3@example.com" },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        driverId: "driver-x",
        origem: "São Paulo",
        destino: "Osasco",
        distanciaKm: 20,
        valorKm: 3,
        valorTotal: 60,
        pesoKg: 30,
        volumeM3: 0.5,
        status: "ASSUMIDA",
      },
    });

    const result = await releaseRoute(route.id, "driver-y");
    expect(result).toEqual({ released: false, reason: "not_assigned_to_driver" });
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/lib/notifyEligibleDrivers.test.ts`
Expected: FAIL with "releaseRoute is not exported"

- [ ] **Step 8: Add `releaseRoute` to the implementation**

Append to `src/lib/notifyEligibleDrivers.ts`:
```ts
export type ReleaseResult =
  | { released: true }
  | { released: false; reason: "not_assigned_to_driver" };

export async function releaseRoute(routeId: string, driverId: string): Promise<ReleaseResult> {
  const result = await prisma.route.updateMany({
    where: { id: routeId, driverId },
    data: { status: "DISPONIVEL", driverId: null },
  });

  if (result.count === 0) {
    return { released: false, reason: "not_assigned_to_driver" };
  }

  await prisma.routeEvent.create({
    data: { routeId, tipo: "desistiu", payload: { driverId } },
  });

  await notifyEligibleDrivers(routeId);

  return { released: true };
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/lib/notifyEligibleDrivers.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 10: Write the release API endpoint**

`src/app/api/driver/[token]/release/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";
import { releaseRoute } from "@/lib/notifyEligibleDrivers";

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const payload = verifyToken(params.token);
  if (!payload || payload.kind !== "driver") {
    return NextResponse.json({ error: "link inválido ou expirado" }, { status: 401 });
  }

  const result = await releaseRoute(payload.routeId, payload.subjectId);
  if (!result.released) {
    return NextResponse.json({ error: "essa rota não está com você" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 11: Commit**

```bash
git add src/lib/notifyEligibleDrivers.ts src/lib/notifyEligibleDrivers.test.ts "src/app/api/driver/[token]/release"
git commit -m "feat: let a driver give up a route, reopening and re-notifying"
```

---

## Task 10: Route creation endpoint (internal)

**Files:**
- Create: `src/lib/createRoute.ts`
- Create: `src/app/api/routes/route.ts`
- Test: `src/lib/createRoute.test.ts`

**Interfaces:**
- Consumes: `prisma`, `createCharge` (Task 7).
- Produces: `createRouteWithCharge(input: CreateRouteInput): Promise<Route>` where the created route starts in `AGUARDANDO_PAGAMENTO` and has a linked `Payment` row — consumed by Task 11's webhook, which flips the route to `DISPONIVEL` once Asaas confirms payment.

- [ ] **Step 1: Write the failing test**

`src/lib/createRoute.test.ts`:
```ts
import { describe, it, expect, vi, afterAll } from "vitest";
import { prisma } from "./db";
import * as asaas from "./asaas";
import { createRouteWithCharge } from "./createRoute";

describe("createRouteWithCharge", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a route in AGUARDANDO_PAGAMENTO with a linked Payment", async () => {
    vi.spyOn(asaas, "createCharge").mockResolvedValue({
      id: "chg_1",
      status: "PENDING",
      invoiceUrl: "https://asaas/invoice/chg_1",
    });

    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });

    const route = await createRouteWithCharge({
      clientId: client.id,
      clientAsaasId: "cus_1",
      origem: "São Paulo",
      destino: "Belo Horizonte",
      distanciaKm: 590,
      valorKm: 3.5,
      pesoKg: 200,
      volumeM3: 2,
    });

    expect(route.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(route.valorTotal).toBe(590 * 3.5);

    const payment = await prisma.payment.findUnique({ where: { routeId: route.id } });
    expect(payment?.asaasChargeId).toBe("chg_1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/createRoute.test.ts`
Expected: FAIL with "Cannot find module './createRoute'"

- [ ] **Step 3: Write the implementation**

`src/lib/createRoute.ts`:
```ts
import { prisma } from "./db";
import { createCharge } from "./asaas";
import type { Route } from "@prisma/client";

export interface CreateRouteInput {
  clientId: string;
  clientAsaasId: string;
  origem: string;
  destino: string;
  distanciaKm: number;
  valorKm: number;
  pesoKg: number;
  volumeM3: number;
}

export async function createRouteWithCharge(input: CreateRouteInput): Promise<Route> {
  const valorTotal = input.distanciaKm * input.valorKm;

  const route = await prisma.route.create({
    data: {
      clientId: input.clientId,
      origem: input.origem,
      destino: input.destino,
      distanciaKm: input.distanciaKm,
      valorKm: input.valorKm,
      valorTotal,
      pesoKg: input.pesoKg,
      volumeM3: input.volumeM3,
      status: "AGUARDANDO_PAGAMENTO",
    },
  });

  const charge = await createCharge({
    customerAsaasId: input.clientAsaasId,
    valor: valorTotal,
    descricao: `Frete ${input.origem} -> ${input.destino}`,
    externalReference: route.id,
  });

  await prisma.payment.create({
    data: {
      routeId: route.id,
      asaasChargeId: charge.id,
      valorRecebido: 0,
      status: charge.status,
    },
  });

  return route;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/createRoute.test.ts`
Expected: PASS

- [ ] **Step 5: Write the API endpoint**

`src/app/api/routes/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { createRouteWithCharge } from "@/lib/createRoute";
import { requireInternalAuth } from "@/lib/internalAuth";

export async function POST(req: NextRequest) {
  const authError = requireInternalAuth(req);
  if (authError) return authError;

  const body = await req.json();
  const required = ["clientId", "clientAsaasId", "origem", "destino", "distanciaKm", "valorKm", "pesoKg", "volumeM3"];
  for (const field of required) {
    if (body[field] === undefined) {
      return NextResponse.json({ error: `campo obrigatório: ${field}` }, { status: 400 });
    }
  }

  const route = await createRouteWithCharge(body);
  return NextResponse.json(route, { status: 201 });
}
```

Note: `requireInternalAuth` is implemented in Task 15. This endpoint's
route handler will not compile/run standalone until Task 15 lands — that
is expected; run only the Step 4 unit test (which calls
`createRouteWithCharge` directly) until then.

- [ ] **Step 6: Commit**

```bash
git add src/lib/createRoute.ts src/lib/createRoute.test.ts src/app/api/routes
git commit -m "feat: add route creation with Asaas PIX charge"
```

---

## Task 11: Asaas webhook (payment confirmed → release route)

**Files:**
- Create: `src/lib/handlePaymentConfirmed.ts`
- Create: `src/app/api/webhooks/asaas/route.ts`
- Test: `src/lib/handlePaymentConfirmed.test.ts`

**Interfaces:**
- Consumes: `prisma`, `notifyEligibleDrivers` (Task 9).
- Produces: `handlePaymentConfirmed(asaasChargeId: string, valorRecebido: number): Promise<void>` — marks `Payment.status = "CONFIRMED"`, flips the route to `DISPONIVEL`, and triggers driver notification.

- [ ] **Step 1: Write the failing test**

`src/lib/handlePaymentConfirmed.test.ts`:
```ts
import { describe, it, expect, vi, afterAll } from "vitest";
import { prisma } from "./db";
import * as notifier from "./notifyEligibleDrivers";
import { handlePaymentConfirmed } from "./handlePaymentConfirmed";

describe("handlePaymentConfirmed", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("releases the route and notifies drivers", async () => {
    vi.spyOn(notifier, "notifyEligibleDrivers").mockResolvedValue(2);

    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        origem: "São Paulo",
        destino: "Santos",
        distanciaKm: 80,
        valorKm: 3,
        valorTotal: 240,
        pesoKg: 50,
        volumeM3: 1,
        status: "AGUARDANDO_PAGAMENTO",
      },
    });
    await prisma.payment.create({
      data: { routeId: route.id, asaasChargeId: "chg_1", valorRecebido: 0, status: "PENDING" },
    });

    await handlePaymentConfirmed("chg_1", 240);

    const updatedRoute = await prisma.route.findUnique({ where: { id: route.id } });
    expect(updatedRoute?.status).toBe("DISPONIVEL");

    const updatedPayment = await prisma.payment.findUnique({ where: { routeId: route.id } });
    expect(updatedPayment?.status).toBe("CONFIRMED");
    expect(updatedPayment?.valorRecebido).toBe(240);

    expect(notifier.notifyEligibleDrivers).toHaveBeenCalledWith(route.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/handlePaymentConfirmed.test.ts`
Expected: FAIL with "Cannot find module './handlePaymentConfirmed'"

- [ ] **Step 3: Write the implementation**

`src/lib/handlePaymentConfirmed.ts`:
```ts
import { prisma } from "./db";
import { notifyEligibleDrivers } from "./notifyEligibleDrivers";

export async function handlePaymentConfirmed(asaasChargeId: string, valorRecebido: number): Promise<void> {
  const payment = await prisma.payment.findFirst({ where: { asaasChargeId } });
  if (!payment) return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "CONFIRMED", valorRecebido },
  });

  await prisma.route.update({
    where: { id: payment.routeId },
    data: { status: "DISPONIVEL" },
  });

  await notifyEligibleDrivers(payment.routeId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/handlePaymentConfirmed.test.ts`
Expected: PASS

- [ ] **Step 5: Write the webhook endpoint**

`src/app/api/webhooks/asaas/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { handlePaymentConfirmed } from "@/lib/handlePaymentConfirmed";

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.event === "PAYMENT_CONFIRMED" || body.event === "PAYMENT_RECEIVED") {
    await handlePaymentConfirmed(body.payment.id, body.payment.value);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/handlePaymentConfirmed.ts src/lib/handlePaymentConfirmed.test.ts src/app/api/webhooks
git commit -m "feat: release route and notify drivers on Asaas payment webhook"
```

---

## Task 12: Delivery-proof photo storage

**Files:**
- Create: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

**Interfaces:**
- Consumes: `process.env.SUPABASE_URL`, `process.env.SUPABASE_SERVICE_ROLE_KEY`, `@supabase/supabase-js`.
- Produces: `uploadComprovante(routeId: string, base64Image: string): Promise<string>` (returns the public URL) — used by Task 13's complete endpoint.

- [ ] **Step 1: Write the failing test**

`src/lib/storage.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const uploadMock = vi.fn().mockResolvedValue({ error: null });
const getPublicUrlMock = vi.fn().mockReturnValue({ data: { publicUrl: "https://supabase/x.jpg" } });

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }),
    },
  }),
}));

beforeEach(() => {
  process.env.SUPABASE_URL = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
});

describe("uploadComprovante", () => {
  it("uploads the decoded image and returns its public URL", async () => {
    const { uploadComprovante } = await import("./storage");
    const url = await uploadComprovante("route-1", "data:image/jpeg;base64,aGVsbG8=");
    expect(url).toBe("https://supabase/x.jpg");
    expect(uploadMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL with "Cannot find module './storage'"

- [ ] **Step 3: Write the implementation**

`src/lib/storage.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

const BUCKET = "comprovantes";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required");
  return createClient(url, key);
}

// ponytail: base64 JSON upload, simplest path for MVP photo volume.
// Upgrade path: switch to a signed direct-upload URL if photo size or
// volume starts straining API route payload limits.
export async function uploadComprovante(routeId: string, base64Image: string): Promise<string> {
  const supabase = getClient();
  const buffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ""), "base64");
  const path = `${routeId}-${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: "image/jpeg" });
  if (error) throw new Error(`upload comprovante failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: add delivery-proof photo upload to Supabase Storage"
```

---

## Task 13: Complete route endpoint + automatic payout

**Files:**
- Create: `src/lib/completeRoute.ts`
- Create: `src/app/api/driver/[token]/complete/route.ts`
- Test: `src/lib/completeRoute.test.ts`

**Interfaces:**
- Consumes: `prisma`, `uploadComprovante` (Task 12), `createTransfer` (Task 7), `process.env.MARGEM_EMPRESA_PERCENTUAL`.
- Produces: `completeRoute(routeId: string, driverId: string, comprovanteBase64: string): Promise<void>` — marks the route `CONCLUIDA` (delivery itself always succeeds once a photo is provided) and creates a `Payout` row either `status: "pago"` with `asaasTransferId` set, or — if the Asaas transfer call fails (bad PIX key, blocked account) — `status: "falhou"` with `asaasTransferId: null`, per the spec's error handling: a payout failure never blocks the already-completed delivery, it just needs manual follow-up.

- [ ] **Step 1: Write the failing test**

`src/lib/completeRoute.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "./db";
import * as storage from "./storage";
import * as asaas from "./asaas";
import { completeRoute } from "./completeRoute";

beforeEach(() => {
  process.env.MARGEM_EMPRESA_PERCENTUAL = "0.20";
  vi.spyOn(storage, "uploadComprovante").mockResolvedValue("https://supabase/proof.jpg");
  vi.spyOn(asaas, "createTransfer").mockResolvedValue({ id: "trf_1", status: "PENDING" });
});

describe("completeRoute", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("marks the route complete and pays out 80% of the value to the driver", async () => {
    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });
    const driver = await prisma.driver.create({
      data: {
        nome: "Motorista",
        cpf: "33333333333",
        telefone: "5511933333333",
        chavePix: "chave-pix-driver",
        rntrc: "RNTRC3",
        cidadeBase: "São Paulo",
        tipoVeiculo: "VAN",
        capacidadeKg: 500,
        capacidadeM3: 5,
      },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        driverId: driver.id,
        origem: "São Paulo",
        destino: "Santos",
        distanciaKm: 80,
        valorKm: 3,
        valorTotal: 240,
        pesoKg: 50,
        volumeM3: 1,
        status: "ASSUMIDA",
      },
    });

    await completeRoute(route.id, driver.id, "data:image/jpeg;base64,aGVsbG8=");

    const updatedRoute = await prisma.route.findUnique({ where: { id: route.id } });
    expect(updatedRoute?.status).toBe("CONCLUIDA");

    const payout = await prisma.payout.findUnique({ where: { routeId: route.id } });
    expect(payout?.valorRepasse).toBe(192); // 240 * (1 - 0.20)
    expect(payout?.asaasTransferId).toBe("trf_1");
    expect(payout?.status).toBe("pago");

    expect(asaas.createTransfer).toHaveBeenCalledWith({
      chavePix: driver.chavePix,
      valor: 192,
      descricao: expect.stringContaining(route.id),
    });
  });

  it("rejects completion without a photo", async () => {
    const client = await prisma.client.create({
      data: { nome: "Seller2", telefone: "11999999999", email: "seller2@example.com" },
    });
    const driver = await prisma.driver.create({
      data: {
        nome: "Motorista2",
        cpf: "44444444444",
        telefone: "5511944444444",
        chavePix: "chave-pix-driver2",
        rntrc: "RNTRC4",
        cidadeBase: "São Paulo",
        tipoVeiculo: "VAN",
        capacidadeKg: 500,
        capacidadeM3: 5,
      },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        driverId: driver.id,
        origem: "São Paulo",
        destino: "Santos",
        distanciaKm: 80,
        valorKm: 3,
        valorTotal: 240,
        pesoKg: 50,
        volumeM3: 1,
        status: "ASSUMIDA",
      },
    });

    await expect(completeRoute(route.id, driver.id, "")).rejects.toThrow("comprovante é obrigatório");
  });

  it("keeps the route CONCLUIDA and records a failed payout when the transfer fails", async () => {
    vi.spyOn(asaas, "createTransfer").mockRejectedValue(new Error("chave PIX inválida"));

    const client = await prisma.client.create({
      data: { nome: "Seller3", telefone: "11999999999", email: "seller3@example.com" },
    });
    const driver = await prisma.driver.create({
      data: {
        nome: "Motorista3",
        cpf: "66666666666",
        telefone: "5511966666666",
        chavePix: "chave-invalida",
        rntrc: "RNTRC6",
        cidadeBase: "São Paulo",
        tipoVeiculo: "VAN",
        capacidadeKg: 500,
        capacidadeM3: 5,
      },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        driverId: driver.id,
        origem: "São Paulo",
        destino: "Santos",
        distanciaKm: 80,
        valorKm: 3,
        valorTotal: 240,
        pesoKg: 50,
        volumeM3: 1,
        status: "ASSUMIDA",
      },
    });

    await completeRoute(route.id, driver.id, "data:image/jpeg;base64,aGVsbG8=");

    const updatedRoute = await prisma.route.findUnique({ where: { id: route.id } });
    expect(updatedRoute?.status).toBe("CONCLUIDA");

    const payout = await prisma.payout.findUnique({ where: { routeId: route.id } });
    expect(payout?.status).toBe("falhou");
    expect(payout?.asaasTransferId).toBeNull();
    expect(payout?.valorRepasse).toBe(192);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/completeRoute.test.ts`
Expected: FAIL with "Cannot find module './completeRoute'"

- [ ] **Step 3: Write the implementation**

`src/lib/completeRoute.ts`:
```ts
import { prisma } from "./db";
import { uploadComprovante } from "./storage";
import { createTransfer } from "./asaas";

function getMargemPercentual(): number {
  const raw = process.env.MARGEM_EMPRESA_PERCENTUAL;
  if (!raw) throw new Error("MARGEM_EMPRESA_PERCENTUAL env var is required");
  return parseFloat(raw);
}

export async function completeRoute(routeId: string, driverId: string, comprovanteBase64: string): Promise<void> {
  if (!comprovanteBase64) throw new Error("comprovante é obrigatório");

  const route = await prisma.route.findUniqueOrThrow({ where: { id: routeId } });
  const driver = await prisma.driver.findUniqueOrThrow({ where: { id: driverId } });

  const comprovanteUrl = await uploadComprovante(routeId, comprovanteBase64);

  await prisma.route.update({ where: { id: routeId }, data: { status: "CONCLUIDA" } });
  await prisma.routeEvent.create({
    data: { routeId, tipo: "concluida", payload: { driverId, comprovanteUrl } },
  });

  const valorRepasse = route.valorTotal * (1 - getMargemPercentual());

  try {
    const transfer = await createTransfer({
      chavePix: driver.chavePix,
      valor: valorRepasse,
      descricao: `Repasse rota ${routeId}`,
    });
    await prisma.payout.create({
      data: { routeId, driverId, asaasTransferId: transfer.id, valorRepasse, status: "pago" },
    });
  } catch {
    // Delivery is already confirmed above — a payout failure (bad PIX
    // key, blocked account) never undoes that. It just needs a human
    // to fix and retry the transfer manually.
    await prisma.payout.create({
      data: { routeId, driverId, asaasTransferId: null, valorRepasse, status: "falhou" },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/completeRoute.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the API endpoint**

`src/app/api/driver/[token]/complete/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";
import { completeRoute } from "@/lib/completeRoute";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const payload = verifyToken(params.token);
  if (!payload || payload.kind !== "driver") {
    return NextResponse.json({ error: "link inválido ou expirado" }, { status: 401 });
  }

  const body = await req.json();
  try {
    await completeRoute(payload.routeId, payload.subjectId, body.comprovanteBase64 ?? "");
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/completeRoute.ts src/lib/completeRoute.test.ts "src/app/api/driver/[token]/complete"
git commit -m "feat: add route completion with automatic PIX payout"
```

---

## Task 14: Client tracking endpoint

**Files:**
- Create: `src/lib/getRouteTracking.ts`
- Create: `src/app/api/client/[token]/route.ts`
- Test: `src/lib/getRouteTracking.test.ts`

**Interfaces:**
- Consumes: `prisma`, `calcularHorarioChegada` (Task 4).
- Produces: `getRouteTracking(routeId: string): Promise<RouteTracking>` where `RouteTracking = { status: string; etaEstimado: string | null; ultimaLocalizacao: string | null; eventos: { tipo: string; createdAt: Date }[] }`.

- [ ] **Step 1: Write the failing test**

`src/lib/getRouteTracking.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "./db";
import { getRouteTracking } from "./getRouteTracking";

describe("getRouteTracking", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns status, eta and last known location", async () => {
    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        origem: "São Paulo",
        destino: "Curitiba",
        distanciaKm: 60,
        valorKm: 3,
        valorTotal: 180,
        pesoKg: 30,
        volumeM3: 0.5,
        status: "ASSUMIDA",
      },
    });
    await prisma.routeEvent.create({
      data: { routeId: route.id, tipo: "assumida", payload: { driverId: "d1" } },
    });
    await prisma.routeEvent.create({
      data: { routeId: route.id, tipo: "localizacao_atualizada", payload: { cidade: "Registro" } },
    });

    const tracking = await getRouteTracking(route.id);

    expect(tracking.status).toBe("ASSUMIDA");
    expect(tracking.ultimaLocalizacao).toBe("Registro");
    expect(tracking.etaEstimado).not.toBeNull();
    expect(tracking.eventos).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/getRouteTracking.test.ts`
Expected: FAIL with "Cannot find module './getRouteTracking'"

- [ ] **Step 3: Write the implementation**

`src/lib/getRouteTracking.ts`:
```ts
import { prisma } from "./db";
import { calcularHorarioChegada } from "./eta";

export interface RouteTracking {
  status: string;
  etaEstimado: string | null;
  ultimaLocalizacao: string | null;
  eventos: { tipo: string; createdAt: Date }[];
}

export async function getRouteTracking(routeId: string): Promise<RouteTracking> {
  const route = await prisma.route.findUniqueOrThrow({ where: { id: routeId } });
  const eventos = await prisma.routeEvent.findMany({
    where: { routeId },
    orderBy: { createdAt: "asc" },
  });

  const locationEvents = eventos.filter((e) => e.tipo === "localizacao_atualizada");
  const lastLocation = locationEvents.at(-1);
  const ultimaLocalizacao = lastLocation
    ? (lastLocation.payload as { cidade?: string } | null)?.cidade ?? null
    : null;

  const etaEstimado =
    route.status === "ASSUMIDA" || route.status === "EM_TRANSPORTE"
      ? calcularHorarioChegada(route.distanciaKm).toISOString()
      : null;

  return {
    status: route.status,
    etaEstimado,
    ultimaLocalizacao,
    eventos: eventos.map((e) => ({ tipo: e.tipo, createdAt: e.createdAt })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/getRouteTracking.test.ts`
Expected: PASS

- [ ] **Step 5: Write the API endpoint**

`src/app/api/client/[token]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";
import { getRouteTracking } from "@/lib/getRouteTracking";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const payload = verifyToken(params.token);
  if (!payload || payload.kind !== "client") {
    return NextResponse.json({ error: "link inválido ou expirado" }, { status: 401 });
  }

  const tracking = await getRouteTracking(payload.routeId);
  return NextResponse.json(tracking);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/getRouteTracking.ts src/lib/getRouteTracking.test.ts "src/app/api/client/[token]"
git commit -m "feat: add client tracking endpoint with status, ETA and last location"
```

---

## Task 15: Internal panel shared-password auth

**Files:**
- Create: `src/lib/internalAuth.ts`
- Create: `src/app/api/internal/login/route.ts`
- Test: `src/lib/internalAuth.test.ts`

**Interfaces:**
- Consumes: `process.env.INTERNAL_PANEL_PASSWORD`, `signToken`/`verifyToken` (Task 2).
- Produces: `requireInternalAuth(req: NextRequest): NextResponse | null` (returns an error response if unauthorized, `null` if OK) — used by Task 10's route creation endpoint.

- [ ] **Step 1: Write the failing test**

`src/lib/internalAuth.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signToken } from "./tokens";
import { requireInternalAuth } from "./internalAuth";

beforeEach(() => {
  process.env.TOKEN_SECRET = "test-secret";
});

function requestWithCookie(cookieValue?: string): NextRequest {
  const headers = new Headers();
  if (cookieValue) headers.set("cookie", `internal_session=${cookieValue}`);
  return new NextRequest("http://localhost/api/routes", { headers });
}

describe("requireInternalAuth", () => {
  it("rejects a request with no session cookie", () => {
    const result = requireInternalAuth(requestWithCookie());
    expect(result).not.toBeNull();
  });

  it("rejects a request with an invalid session token", () => {
    const result = requireInternalAuth(requestWithCookie("garbage"));
    expect(result).not.toBeNull();
  });

  it("accepts a request with a valid internal session token", () => {
    const token = signToken({ routeId: "internal", subjectId: "equipe", kind: "client", exp: Math.floor(Date.now() / 1000) + 3600 });
    const result = requireInternalAuth(requestWithCookie(token));
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/internalAuth.test.ts`
Expected: FAIL with "Cannot find module './internalAuth'"

- [ ] **Step 3: Write the implementation**

`src/lib/internalAuth.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./tokens";

const COOKIE_NAME = "internal_session";

export function requireInternalAuth(req: NextRequest): NextResponse | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }
  return null;
}

export { COOKIE_NAME };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/internalAuth.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the login endpoint**

`src/app/api/internal/login/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { signToken } from "@/lib/tokens";
import { COOKIE_NAME } from "@/lib/internalAuth";

export async function POST(req: NextRequest) {
  const { senha } = await req.json();
  if (senha !== process.env.INTERNAL_PANEL_PASSWORD) {
    return NextResponse.json({ error: "senha incorreta" }, { status: 401 });
  }

  const token = signToken({
    routeId: "internal",
    subjectId: "equipe",
    kind: "client",
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, { httpOnly: true, sameSite: "strict", path: "/" });
  return response;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/internalAuth.ts src/lib/internalAuth.test.ts src/app/api/internal
git commit -m "feat: add shared-password internal panel auth"
```

---

## Task 16: Minimal UI pages

**Files:**
- Create: `src/app/entregador/[token]/page.tsx`
- Create: `src/app/cliente/[token]/page.tsx`
- Create: `src/app/painel/page.tsx`

**Interfaces:**
- Consumes: the API endpoints from Tasks 5, 6, 13, 14, 10, 15 (all called client-side via `fetch`).

These are thin presentational pages calling the already-tested endpoints;
per the spec's own testing approach, verify these manually end-to-end
rather than with component tests.

- [ ] **Step 1: Write the driver page**

`src/app/entregador/[token]/page.tsx`:
```tsx
"use client";
import { useState } from "react";

export default function DriverPage({ params }: { params: { token: string } }) {
  const [message, setMessage] = useState("");

  async function assumir() {
    const res = await fetch(`/api/driver/${params.token}/assume`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? "Rota assumida!" : data.error);
  }

  async function desistir() {
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
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const res = await fetch(`/api/driver/${params.token}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comprovanteBase64: reader.result }),
        });
        setMessage(res.ok ? "Entrega concluída!" : (await res.json()).error);
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
      <button onClick={concluir} style={{ fontSize: 24, padding: 16, margin: 8 }}>
        CONCLUÍDO
      </button>
      {message && <p>{message}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Write the client tracking page**

`src/app/cliente/[token]/page.tsx`:
```tsx
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
```

- [ ] **Step 3: Write the internal panel page**

`src/app/painel/page.tsx`:
```tsx
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
```

- [ ] **Step 4: Manual verification**

```bash
npm run dev
```

Open `/painel`, log in with `INTERNAL_PANEL_PASSWORD`, create a route with
real IDs from the database, confirm the Asaas sandbox charge appears,
simulate the webhook, open the generated `/entregador/<token>` link and
confirm ASSUMIR/atualizar/concluir all work end to end, then open
`/cliente/<token>` and confirm status/ETA/location show up.

- [ ] **Step 5: Commit**

```bash
git add src/app/entregador src/app/cliente src/app/painel
git commit -m "feat: add driver, client and internal panel pages"
```
