# IronSynk

App de treino + nutrição + social (iOS/Android). Monorepo.

## Arquitetura

```
apps/mobile   → Expo (React Native)
apps/api      → Fastify (Node)
packages/shared → Zod / tipos compartilhados
prisma/       → schema do banco
```

Mobile fala com a API. API fala com Postgres (Supabase) + Auth.

## Stack

| Camada | Tech |
|--------|------|
| Mobile | Expo, TypeScript, NativeWind, Zustand, TanStack Query |
| API | Fastify, Prisma, Zod |
| Auth / DB / Storage | Supabase |
| Cache | Upstash Redis |

Detalhes de produto e fases: `CLAUDE.md`  
Agents/skills do time: `AGENTS.md`

## Como rodar

### 1. Instalar

```bash
npm install
```

### 2. Env

```bash
cp .env.example .env
```

Preenche as keys (Supabase, `DATABASE_URL`, etc.).

Mobile precisa da URL da API. No `.env` (ou `apps/mobile/.env`):

```env
# Emulador Android
EXPO_PUBLIC_API_URL=http://10.0.2.2:3333

# iOS simulator / web
# EXPO_PUBLIC_API_URL=http://localhost:3333

# Celular físico (mesmo Wi-Fi): IP do seu PC
# EXPO_PUBLIC_API_URL=http://192.168.x.x:3333
```

### 3. Banco

```bash
npm run db:generate
npm run db:migrate
```

### 4. Subir API + app

Dois terminais:

```bash
npm run api:dev
```

```bash
npm run mobile:start
```

API: `http://localhost:3333`  
Mobile: Expo (QR code / emulador).

## Agents (opcional)

Depois de clonar ou editar `.agents/`:

```bash
npm run sync-agents
```

## PR

Todo PR usa o template em `.github/PULL_REQUEST_TEMPLATE.md`.  
Antes de abrir: sync com `main`.
