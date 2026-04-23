# IronSynk — Project Context for Claude Code

> Read this file entirely before doing anything. This is the single source of truth for the project.

---

## What is IronSynk?

A mobile SaaS app (iOS + Android) for the science-based fitness community.
It combines workout tracking, nutrition, social features, and RPG-style gamification in one place.
The core philosophy: **feature-rich but minimalist UI** — powerful under the hood, clean on the surface.

**Target users:** Athletes who train with a science-based approach (progressive overload, RIR/RPE, volume tracking) + general public + personal trainers running their consultancy inside the app.

**Positioning:** Everything in one place (training + nutrition + social + gamification), unlike fragmented existing apps. Visual identity: dark, modern, minimal, young.

---

## Branding & Design System

```
App Name:     IronSynk
Tagline:      (TBD)

COLORS
──────────────────────────────────────────
Primary Cyan:        #4FC3F7
Primary Blue:        #2979FF
Primary Deep:        #1A237E
Background:          #141418
Surface (cards):     #1E1E24
Border subtle:       #2A2A35
Text primary:        #F0F0F5
Text secondary:      #8A8A9A
Text disabled:       #4A4A5A
Success (PR, check): #00E676
Warning:             #FFB300
Error:               #FF5252

GRADIENT (brand)
──────────────────────────────────────────
linear-gradient(135deg, #4FC3F7 0%, #2979FF 50%, #1A237E 100%)
Used on: logo, primary buttons, badges, gamification highlights

TYPOGRAPHY
──────────────────────────────────────────
Display/Titles:  Inter Bold (700–800)
Body:            Inter Regular (400–500)
Numbers/Stats:   Inter Mono / Tabular numbers

STYLE RULES
──────────────────────────────────────────
border-radius:   12–16px
Icons:           Lucide or Phosphor (outline style)
Animations:      200–300ms, spring physics
Shadows:         subtle blue glow, never heavy
Cards:           #1E1E24 background, subtle border
```

---

## Tech Stack

### Mobile (Frontend)
| Layer | Technology |
|---|---|
| Framework | React Native + Expo (SDK latest) |
| Language | TypeScript |
| Styling | NativeWind (Tailwind for RN) |
| Global state | Zustand |
| Server state / cache | TanStack Query (React Query) |
| Navigation | React Navigation v6 |
| UI Components | Custom + NativeWind |
| Icons | Lucide React Native |
| Animations | React Native Reanimated |

### Backend (API)
| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Fastify |
| Language | TypeScript |
| ORM | Prisma |
| Validation | Zod |
| Auth | Supabase Auth + Google OAuth |

### Infrastructure
| Service | Technology |
|---|---|
| Database | PostgreSQL via Supabase |
| File storage | Supabase Storage (images, videos) |
| Cache | Upstash Redis |
| API deploy | Railway |
| Realtime (social) | Supabase Realtime |

### External APIs
| Purpose | Service |
|---|---|
| Exercise database | ExerciseDB API (RapidAPI, free tier) |
| Food/nutrition database | Open Food Facts (open source, free) |
| AI features (future) | OpenAI API or Groq |

---

## User Types

```
ATHLETE  — trains alone or under a trainer. Focuses on execution and progress.
TRAINER  — prescribes workouts/diets, manages clients, runs consultancy.
```

Both share the same app. Role is selected at signup and determines UI layout and available features.

---

## Project Structure (Monorepo)

```
ironsynk/
├── apps/
│   ├── mobile/          ← Expo React Native app
│   └── api/             ← Fastify backend
├── packages/
│   └── shared/          ← Shared types, schemas (Zod), constants
├── prisma/
│   └── schema.prisma    ← Single source of truth for DB
├── CLAUDE.md            ← This file
└── package.json         ← Root workspace config
```

---

## Database Schema (Prisma)

```prisma
// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

enum Role {
  ATHLETE
  TRAINER
  ADMIN
}

enum SetType {
  WORKING      // counts toward volume
  WARMUP       // does NOT count toward volume
  FEEDER       // does NOT count toward volume
}

enum SetTechnique {
  NONE
  DROP_SET
  BACK_OFF
  REST_PAUSE
  CLUSTER_SET
  MUSCLE_ROUND
  MYOREP
}

enum MuscleGroup {
  CHEST
  BACK
  SHOULDERS
  BICEPS
  TRICEPS
  FOREARMS
  QUADS
  HAMSTRINGS
  GLUTES
  CALVES
  ABS
  FULL_BODY
  OTHER
}

enum TrainingGoal {
  HYPERTROPHY
  STRENGTH
  FAT_LOSS
  ENDURANCE
  HEALTH
  PERFORMANCE
}

enum DietGoal {
  BULK
  CUT
  MAINTENANCE
  RECOMP
  HEALTH
}

// ─────────────────────────────────────────────
// AUTH & PROFILE
// ─────────────────────────────────────────────

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String?   // null if OAuth only
  role          Role      @default(ATHLETE)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  profile             Profile?
  trainerProfile      TrainerProfile?

  // Workouts
  createdPrograms     Program[]
  trainingLogs        TrainingLog[]

  // Nutrition
  nutritionPlans      NutritionPlan[]
  dailyNutritionLogs  DailyNutritionLog[]

  // Consultancy
  asTrainer           Consultation[]  @relation("TrainerConsultations")
  asAthlete           Consultation[]  @relation("AthleteConsultations")

  // Social
  posts               Post[]
  likes               Like[]
  comments            Comment[]
  following           Follow[]        @relation("Follower")
  followers           Follow[]        @relation("Following")
  notifications       Notification[]

  // Gamification
  gameProfile         GameProfile?
  achievements        UserAchievement[]
  missionProgress     MissionProgress[]
  challenges          ChallengeParticipant[]

  // Discovery
  gym                 UserGym?
}

model Profile {
  id            String    @id @default(uuid())
  userId        String    @unique
  name          String
  avatar        String?   // Supabase Storage URL
  bio           String?
  birthDate     DateTime?
  sex           String?   // "male" | "female" | "other"
  weightKg      Float?
  heightCm      Float?
  goal          TrainingGoal?
  experience    String?   // "beginner" | "intermediate" | "advanced"
  daysPerWeek   Int?
  isPrivate     Boolean   @default(false)
  gymName       String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user          User      @relation(fields: [userId], references: [id])
}

model TrainerProfile {
  id              String   @id @default(uuid())
  userId          String   @unique
  cref            String?
  specialties     String[]
  acceptingClients Boolean @default(true)
  bio             String?

  user            User     @relation(fields: [userId], references: [id])
}

// ─────────────────────────────────────────────
// WORKOUTS
// ─────────────────────────────────────────────

model Exercise {
  id            String       @id @default(uuid())
  name          String
  muscleGroup   MuscleGroup
  equipment     String?
  description   String?
  gifUrl        String?      // future: exercise demo gif
  videoUrl      String?
  isCustom      Boolean      @default(false)
  createdById   String?      // null = global bank; set = user-created
  sourceId      String?      // ExerciseDB external ID if imported

  trainingExercises TrainingExercise[]
}

model Program {
  id            String    @id @default(uuid())
  name          String
  description   String?
  goal          TrainingGoal?
  isTemplate    Boolean   @default(false)  // global template visible to all
  isPublic      Boolean   @default(false)
  createdById   String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  createdBy     User      @relation(fields: [createdById], references: [id])
  workouts      Workout[]
  prescriptions PrescribedProgram[]
}

model Workout {
  id          String    @id @default(uuid())
  programId   String?   // null = quick workout (no program)
  name        String
  order       Int?
  notes       String?
  createdAt   DateTime  @default(now())

  program             Program?           @relation(fields: [programId], references: [id])
  exercises           TrainingExercise[]
  logs                TrainingLog[]
}

model TrainingExercise {
  id           String        @id @default(uuid())
  workoutId    String
  exerciseId   String
  order        Int
  targetSets   Int
  targetReps   String        // "8-12" or "failure" or "5"
  targetRIR    Int?          // Reps In Reserve
  targetRPE    Float?        // Rate of Perceived Exertion
  restSeconds  Int?
  notes        String?       // trainer tip visible to athlete

  workout      Workout          @relation(fields: [workoutId], references: [id])
  exercise     Exercise         @relation(fields: [exerciseId], references: [id])
  setLogs      SetLog[]
}

model TrainingLog {
  id          String    @id @default(uuid())
  userId      String
  workoutId   String?   // null = quick workout
  startedAt   DateTime  @default(now())
  finishedAt  DateTime?
  durationMin Int?
  notes       String?
  isPosted    Boolean   @default(false)  // shared to social feed

  user        User      @relation(fields: [userId], references: [id])
  workout     Workout?  @relation(fields: [workoutId], references: [id])
  sets        SetLog[]
  post        Post?
}

model SetLog {
  id                   String         @id @default(uuid())
  trainingLogId        String
  trainingExerciseId   String?        // null = quick workout exercise
  exerciseId           String         // always set for PR tracking
  setNumber            Int
  setType              SetType        @default(WORKING)
  technique            SetTechnique   @default(NONE)
  repsCompleted        Int
  weightKg             Float
  rir                  Int?
  rpe                  Float?
  isPersonalRecord     Boolean        @default(false)
  notes                String?

  trainingLog          TrainingLog     @relation(fields: [trainingLogId], references: [id])
  trainingExercise     TrainingExercise? @relation(fields: [trainingExerciseId], references: [id])
}

model PersonalRecord {
  id          String    @id @default(uuid())
  userId      String
  exerciseId  String
  weightKg    Float
  reps        Int
  estimated1RM Float?
  achievedAt  DateTime  @default(now())

  @@unique([userId, exerciseId])
}

// ─────────────────────────────────────────────
// NUTRITION
// ─────────────────────────────────────────────

model Food {
  id            String   @id @default(uuid())
  name          String
  brand         String?
  calories      Float    // per 100g
  proteinG      Float
  carbsG        Float
  fatG          Float
  fiberG        Float?
  isCustom      Boolean  @default(false)
  createdById   String?
  sourceId      String?  // Open Food Facts barcode/id

  mealFoods     MealFood[]
}

model NutritionPlan {
  id            String    @id @default(uuid())
  userId        String
  name          String
  goal          DietGoal?
  targetCalories Float?
  targetProteinG Float?
  targetCarbsG   Float?
  targetFatG     Float?
  targetWaterMl  Int?
  notes         String?
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user          User      @relation(fields: [userId], references: [id])
  meals         Meal[]
  supplements   PlanSupplement[]
  prescriptions PrescribedNutrition[]
}

model Meal {
  id              String   @id @default(uuid())
  nutritionPlanId String
  name            String   // "Breakfast", "Pre-workout", etc.
  order           Int
  targetTimeHour  Int?     // suggested hour of day

  plan            NutritionPlan  @relation(fields: [nutritionPlanId], references: [id])
  foods           MealFood[]
  logs            MealLog[]
}

model MealFood {
  id            String   @id @default(uuid())
  mealId        String
  foodId        String
  quantityG     Float
  isCooked      Boolean  @default(false)  // weighed cooked or raw

  meal          Meal     @relation(fields: [mealId], references: [id])
  food          Food     @relation(fields: [foodId], references: [id])
}

model PlanSupplement {
  id              String  @id @default(uuid())
  nutritionPlanId String
  name            String  // "Creatine", "Whey", "Vitamin D"
  dosage          String  // "5g", "2000IU"
  timing          String? // "post-workout", "morning"
  notes           String?

  plan            NutritionPlan @relation(fields: [nutritionPlanId], references: [id])
}

model DailyNutritionLog {
  id              String    @id @default(uuid())
  userId          String
  date            DateTime  @db.Date
  waterMl         Int       @default(0)
  notes           String?

  user            User      @relation(fields: [userId], references: [id])
  mealLogs        MealLog[]

  @@unique([userId, date])
}

model MealLog {
  id                   String    @id @default(uuid())
  dailyNutritionLogId  String
  mealId               String
  completedAt          DateTime?
  isDone               Boolean   @default(false)

  dailyLog             DailyNutritionLog @relation(fields: [dailyNutritionLogId], references: [id])
  meal                 Meal              @relation(fields: [mealId], references: [id])
}

// ─────────────────────────────────────────────
// CONSULTANCY
// ─────────────────────────────────────────────

model Consultation {
  id          String    @id @default(uuid())
  trainerId   String
  athleteId   String
  isActive    Boolean   @default(true)
  startedAt   DateTime  @default(now())
  notes       String?   // private trainer notes

  trainer     User      @relation("TrainerConsultations", fields: [trainerId], references: [id])
  athlete     User      @relation("AthleteConsultations", fields: [athleteId], references: [id])

  forms       ConsultationForm[]
  prescribedPrograms  PrescribedProgram[]
  prescribedNutrition PrescribedNutrition[]

  @@unique([trainerId, athleteId])
}

model ConsultationForm {
  id              String   @id @default(uuid())
  consultationId  String
  title           String
  fields          Json     // array of { label, type, required, options? }
  createdAt       DateTime @default(now())

  consultation    Consultation  @relation(fields: [consultationId], references: [id])
  responses       FormResponse[]
}

model FormResponse {
  id        String   @id @default(uuid())
  formId    String
  answers   Json     // { fieldLabel: answer }
  createdAt DateTime @default(now())

  form      ConsultationForm @relation(fields: [formId], references: [id])
}

model PrescribedProgram {
  id              String   @id @default(uuid())
  consultationId  String
  programId       String
  prescribedAt    DateTime @default(now())

  consultation    Consultation @relation(fields: [consultationId], references: [id])
  program         Program      @relation(fields: [programId], references: [id])
}

model PrescribedNutrition {
  id              String   @id @default(uuid())
  consultationId  String
  nutritionPlanId String
  prescribedAt    DateTime @default(now())

  consultation    Consultation  @relation(fields: [consultationId], references: [id])
  nutritionPlan   NutritionPlan @relation(fields: [nutritionPlanId], references: [id])
}

// ─────────────────────────────────────────────
// SOCIAL
// ─────────────────────────────────────────────

model Post {
  id            String    @id @default(uuid())
  userId        String
  trainingLogId String?   @unique  // linked workout session
  content       String?
  imageUrls     String[]
  videoUrl      String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user          User         @relation(fields: [userId], references: [id])
  trainingLog   TrainingLog? @relation(fields: [trainingLogId], references: [id])
  likes         Like[]
  comments      Comment[]
}

model Like {
  userId    String
  postId    String
  createdAt DateTime @default(now())

  user      User @relation(fields: [userId], references: [id])
  post      Post @relation(fields: [postId], references: [id])

  @@id([userId, postId])
}

model Comment {
  id        String   @id @default(uuid())
  postId    String
  userId    String
  content   String
  createdAt DateTime @default(now())

  post      Post @relation(fields: [postId], references: [id])
  user      User @relation(fields: [userId], references: [id])
}

model Follow {
  followerId  String
  followingId String
  createdAt   DateTime @default(now())

  follower    User @relation("Follower",  fields: [followerId],  references: [id])
  following   User @relation("Following", fields: [followingId], references: [id])

  @@id([followerId, followingId])
}

model Notification {
  id        String   @id @default(uuid())
  userId    String
  type      String   // "like", "comment", "follow", "pr", "achievement", "mission"
  payload   Json
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  user      User @relation(fields: [userId], references: [id])
}

// ─────────────────────────────────────────────
// GAMIFICATION
// ─────────────────────────────────────────────

model GameProfile {
  id              String   @id @default(uuid())
  userId          String   @unique
  level           Int      @default(1)
  xp              Int      @default(0)

  // RPG Attributes (increase via real activity)
  strengthScore   Int      @default(0)   // PRs broken
  enduranceScore  Int      @default(0)   // weekly volume consistency
  disciplineScore Int      @default(0)   // nutrition adherence
  consistencyScore Int     @default(0)   // workout frequency streak
  knowledgeScore  Int      @default(0)   // advanced techniques used

  currentStreak   Int      @default(0)   // days in a row
  longestStreak   Int      @default(0)

  user            User     @relation(fields: [userId], references: [id])
}

model Achievement {
  id          String   @id @default(uuid())
  key         String   @unique  // e.g. "first_100kg_bench"
  name        String
  description String
  iconUrl     String?
  xpReward    Int      @default(0)
  category    String   // "strength", "consistency", "nutrition", "social"

  users       UserAchievement[]
}

model UserAchievement {
  userId        String
  achievementId String
  unlockedAt    DateTime @default(now())

  user          User        @relation(fields: [userId], references: [id])
  achievement   Achievement @relation(fields: [achievementId], references: [id])

  @@id([userId, achievementId])
}

model Mission {
  id          String   @id @default(uuid())
  key         String   @unique
  title       String
  description String
  type        String   // "daily" | "weekly" | "special"
  target      Int      // e.g. 4 (workouts)
  metric      String   // "workouts_completed" | "sets_logged" | etc.
  xpReward    Int
  expiresIn   Int?     // hours until expiry; null = permanent

  progress    MissionProgress[]
}

model MissionProgress {
  id          String    @id @default(uuid())
  userId      String
  missionId   String
  current     Int       @default(0)
  isCompleted Boolean   @default(false)
  completedAt DateTime?
  expiresAt   DateTime?

  user        User    @relation(fields: [userId], references: [id])
  mission     Mission @relation(fields: [missionId], references: [id])

  @@unique([userId, missionId])
}

model Challenge {
  id          String    @id @default(uuid())
  title       String
  description String
  type        String    // "load_battle" | "group_streak" | "volume_race"
  metric      String    // "max_weight_bench" | "total_volume" | etc.
  exerciseId  String?   // for load battles
  startDate   DateTime
  endDate     DateTime
  createdById String
  isPublic    Boolean   @default(false)
  groupId     String?

  participants ChallengeParticipant[]
}

model ChallengeParticipant {
  id          String   @id @default(uuid())
  challengeId String
  userId      String
  score       Float    @default(0)
  rank        Int?
  joinedAt    DateTime @default(now())

  challenge   Challenge @relation(fields: [challengeId], references: [id])
  user        User      @relation(fields: [userId], references: [id])

  @@unique([challengeId, userId])
}

// ─────────────────────────────────────────────
// DISCOVERY
// ─────────────────────────────────────────────

model Gym {
  id        String   @id @default(uuid())
  name      String
  address   String?
  city      String?
  lat       Float?
  lng       Float?

  members   UserGym[]
}

model UserGym {
  userId    String   @unique
  gymId     String
  joinedAt  DateTime @default(now())

  user      User @relation(fields: [userId], references: [id])
  gym       Gym  @relation(fields: [gymId], references: [id])
}
```

---

## Development Phases

Always check which phase we're currently in before building anything.

```
PHASE 0 — Foundation          ← project setup, schema, design system
PHASE 1 — Auth & Profile      ← signup, login (email + Google), onboarding, profile
PHASE 2 — Workouts Core       ← exercise bank, programs, workout execution, logs, PRs
PHASE 3 — Nutrition Core      ← food bank, nutrition plans, daily check, macros dashboard
PHASE 4 — Consultancy         ← trainer-athlete link, forms, prescriptions, trainer dashboard
PHASE 5 — Social              ← feed, follow, post workout, likes, comments, notifications
PHASE 6A — Gamification Base  ← badges, streaks, PR celebration, XP
PHASE 6B — Gamification RPG   ← skills, missions, challenges, leaderboard
PHASE 7 — Launch Polish       ← templates, onboarding tour, push notifications, app stores
```

**Current phase:** PHASE 0

---

## Onboarding Flow

Triggered once, right after signup. Fields:

**All users:**
- Full name
- Date of birth
- Biological sex (male / female / other)
- Weight (kg) + Height (cm)

**Athlete only (2 more):**
- Primary goal: Hypertrophy / Fat Loss / Health / Performance
- Days available per week: 1–2 / 3–4 / 5+

**Trainer only (2 more):**
- Short professional bio
- Accepting new clients? Yes / No

Keep it under 2 minutes. Any deeper info comes from the trainer's consultation form.

---

## Key Product Decisions

| Decision | Chosen |
|---|---|
| Macro view for athlete | Summary totals by default + expandable per-meal view |
| Warmup/Feeder sets | Logged but excluded from volume count |
| Advanced techniques | Per-set tags: Drop, Back-off, Rest-pause, Cluster, Muscle Round, MyoRep |
| Quick workout | Start without a program, add exercises live |
| PR celebration | Animation + banner when a new PR is detected on save |
| Post workout | Athlete can share session to social feed after finishing |
| Trainer form | Trainer creates custom field forms; athlete fills in app |
| Gym discovery | User registers their gym; app suggests nearby gym-mates |
| Payments/plans | Deferred — define after MVP |
| AI features | Deferred — after core is stable |

---

## Coding Conventions

- **Language:** TypeScript everywhere, strict mode
- **No `any`:** Use proper types or `unknown`
- **Zod schemas** in `packages/shared/` for all API request/response validation
- **API routes:** RESTful, versioned (`/api/v1/...`)
- **Error handling:** All API errors return `{ error: { code, message } }`
- **Auth:** Supabase JWT in `Authorization: Bearer <token>` header
- **File naming:** `kebab-case` for files, `PascalCase` for components, `camelCase` for functions
- **Commits:** conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`)
- **Env vars:** never hardcoded, always `.env` with `.env.example` committed

---

## Environment Variables (template)

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database
DATABASE_URL=

# Redis
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

# External APIs
EXERCISEDB_API_KEY=
OPEN_FOOD_FACTS_APP_ID=

# App
NODE_ENV=development
PORT=3333
JWT_SECRET=
```

---

## Do Not Do

- Do not add AI features before Phase 7 is complete
- Do not implement payments before the MVP is validated
- Do not over-engineer — build the simplest thing that works first
- Do not put business logic in the mobile app — it belongs in the API
- Do not skip TypeScript types for speed — it will cost more time later
- Do not create UI that overloads the user — minimalism is a core value

---

*Last updated: project kickoff — Phase 0*
