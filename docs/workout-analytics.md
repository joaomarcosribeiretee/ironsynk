# Estatísticas de treino — issue #10

`GET /api/v1/profile/stats` exige autenticação e usa exclusivamente o ID do
usuário autenticado. Contratos e filtros estão em
`packages/shared/src/workout-analytics.ts`; cálculo puro em
`apps/api/src/lib/workout-analytics.ts`.

## Período e calendário

- `period`: `4`, `8` (padrão), `12` ou `all`.
- `timeZone`: fuso IANA validado, enviado pelo dispositivo; padrão UTC.
- Semanas começam segunda-feira. O período inclui a semana atual, parcial.
- Consistência = semanas com treino / semanas observadas no período. Semanas
  anteriores ao primeiro treino não entram no denominador; semanas sem treino
  posteriores entram. Não representa cumprimento de uma meta prescrita.
- Sequência semanal é geral, independente do filtro. A semana atual ainda sem
  treino não quebra a sequência da semana anterior.
- Em `all`, os totais incluem todo o histórico; o gráfico semanal mostra no
  máximo 12 semanas. A evolução mostra as últimas 12 sessões, com lista completa
  disponível por “Ver mais”.

## Elegibilidade e ausência de dados

- Sessões concluídas, sem datas futuras; séries marcadas, de trabalho, com reps
  positivas. Aquecimento/feeder não entram em reps, séries ou volume.
- Volume = carga externa registrada × reps. Não se estima o peso corporal.
  Carga zero preserva reps e séries; carga ausente não produz volume conhecido.
- Drop sets e muscle rounds usam cargas de cada bloco executado. Configurações
  ausentes/incompletas ou com soma de reps divergente não contribuem para volume.
  O painel informa quantas séries ficaram de fora; os totais são parciais.
- Uma técnica conta como uma série. Distribuição muscular usa número de séries
  por grupo principal, sem inferir músculos secundários ou ativação.
- Duração média inclui apenas sessões com duração registrada; ausência é `null`.
- Mesmo exercício repetido numa sessão conta uma sessão, agregando suas séries.
- 1RM é estimativa Epley, limitada a séries tradicionais de 1–12 reps. Uma única
  repetição usa a carga real. Ausência de estimativa é `null`; comparação exige
  duas sessões elegíveis. Não se classifica força entre exercícios diferentes.
- Recordes pessoais listam séries com a marca histórica `isPersonalRecord`,
  definida ao finalizar o treino. Não contam entradas do cache PersonalRecord
  nem tratam a primeira referência como recorde.
- Séries antigas sem `ExecutionExercise` também são lidas pela relação da sessão.

## Interface e atualização

Filtros de período, gráficos de frequência/volume, seleção de qualquer exercício,
carga máxima, reps, volume e 1RM por sessão, distribuição muscular, recordes e
histórico com navegação para a sessão. Listas extensas são reveladas por etapas.
Atualização manual, ao focar a tela e invalidação após finalizar um treino.
Chave de cache inclui usuário, período e fuso.

## Verificação

```sh
npx tsx --test apps/api/src/lib/workout-analytics.verify.ts
npm run api:build
npx tsc --noEmit -p apps/mobile/tsconfig.json
```

Os testes cobrem calendário/fuso, filtros, sessões abertas/futuras, ausência de
dados, duração, duplicação de exercícios, técnicas, PRs e limites de 1RM.
O endpoint ainda agrega o histórico do usuário em memória, como a implementação
anterior; paginação no servidor pode ser necessária para históricos muito grandes.
