// IronSynk — Complete Exercise Seed v3
// Run with: npx tsx prisma/seeds/exercises-seed.ts
// 400+ classic exercises organized by muscle group
// All deadlift variations → HAMSTRINGS
// sourceId maps to ExerciseDB GIF naming convention

import 'dotenv/config'
import { PrismaClient, MuscleGroup } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

type ExerciseInput = {
  name: string
  muscleGroup: string
  equipment: string
  sourceId: string
  description?: string
}

const exercises: ExerciseInput[] = [

  // ─────────────────────────────────────────────
  // PEITO
  // ─────────────────────────────────────────────
  { name: 'Supino Reto com Barra',                   muscleGroup: 'CHEST', equipment: 'barbell',    sourceId: 'barbell-bench-press' },
  { name: 'Supino Reto com Halteres',                muscleGroup: 'CHEST', equipment: 'dumbbell',   sourceId: 'dumbbell-bench-press' },
  { name: 'Supino Reto na Máquina Articulada',       muscleGroup: 'CHEST', equipment: 'machine',    sourceId: 'machine-chest-press' },
  { name: 'Supino Reto no Smith',                    muscleGroup: 'CHEST', equipment: 'smith',      sourceId: 'smith-machine-bench-press' },
  { name: 'Supino Reto Neutro com Halteres',         muscleGroup: 'CHEST', equipment: 'dumbbell',   sourceId: 'neutral-grip-dumbbell-bench-press' },
  { name: 'Supino Inclinado com Barra',              muscleGroup: 'CHEST', equipment: 'barbell',    sourceId: 'incline-barbell-bench-press' },
  { name: 'Supino Inclinado com Halteres',           muscleGroup: 'CHEST', equipment: 'dumbbell',   sourceId: 'incline-dumbbell-bench-press' },
  { name: 'Supino Inclinado no Smith',               muscleGroup: 'CHEST', equipment: 'smith',      sourceId: 'incline-smith-machine-press' },
  { name: 'Supino Inclinado na Máquina',             muscleGroup: 'CHEST', equipment: 'machine',    sourceId: 'incline-machine-press' },
  { name: 'Supino Inclinado Neutro com Halteres',    muscleGroup: 'CHEST', equipment: 'dumbbell',   sourceId: 'incline-neutral-dumbbell-press' },
  { name: 'Supino Declinado com Barra',              muscleGroup: 'CHEST', equipment: 'barbell',    sourceId: 'decline-barbell-bench-press' },
  { name: 'Supino Declinado com Halteres',           muscleGroup: 'CHEST', equipment: 'dumbbell',   sourceId: 'decline-dumbbell-bench-press' },
  { name: 'Supino Declinado na Máquina',             muscleGroup: 'CHEST', equipment: 'machine',    sourceId: 'decline-machine-press' },
  { name: 'Supino com Cabo Cruzado',                 muscleGroup: 'CHEST', equipment: 'cable',      sourceId: 'cable-bench-press' },
  { name: 'Paralela para Peito',                     muscleGroup: 'CHEST', equipment: 'bodyweight', sourceId: 'chest-dips' },
  { name: 'Crucifixo com Halteres',                  muscleGroup: 'CHEST', equipment: 'dumbbell',   sourceId: 'dumbbell-fly' },
  { name: 'Crucifixo Inclinado com Halteres',        muscleGroup: 'CHEST', equipment: 'dumbbell',   sourceId: 'incline-dumbbell-fly' },
  { name: 'Crucifixo Declinado com Halteres',        muscleGroup: 'CHEST', equipment: 'dumbbell',   sourceId: 'decline-dumbbell-fly' },
  { name: 'Crossover Alto no Cabo',                  muscleGroup: 'CHEST', equipment: 'cable',      sourceId: 'cable-crossover-high' },
  { name: 'Crossover Baixo no Cabo',                 muscleGroup: 'CHEST', equipment: 'cable',      sourceId: 'cable-crossover-low' },
  { name: 'Crossover Médio no Cabo',                 muscleGroup: 'CHEST', equipment: 'cable',      sourceId: 'cable-crossover-mid' },
  { name: 'Crossover Alto Sentado',                  muscleGroup: 'CHEST', equipment: 'cable',      sourceId: 'seated-cable-fly-high' },
  { name: 'Crossover Baixo Sentado',                 muscleGroup: 'CHEST', equipment: 'cable',      sourceId: 'seated-cable-fly-low' },
  { name: 'Crucifixo no Cabo',                       muscleGroup: 'CHEST', equipment: 'cable',      sourceId: 'cable-fly' },
  { name: 'Voador (Peck Deck)',                      muscleGroup: 'CHEST', equipment: 'machine',    sourceId: 'pec-deck-fly' },
  { name: 'Pullover com Halter',                     muscleGroup: 'CHEST', equipment: 'dumbbell',   sourceId: 'dumbbell-pullover' },
  { name: 'Flexão de Braço',                         muscleGroup: 'CHEST', equipment: 'bodyweight', sourceId: 'push-up' },
  { name: 'Flexão Inclinada',                        muscleGroup: 'CHEST', equipment: 'bodyweight', sourceId: 'incline-push-up' },
  { name: 'Flexão Declinada',                        muscleGroup: 'CHEST', equipment: 'bodyweight', sourceId: 'decline-push-up' },
  { name: 'Flexão Diamante',                         muscleGroup: 'CHEST', equipment: 'bodyweight', sourceId: 'diamond-push-up' },
  { name: 'Flexão Arqueiro',                         muscleGroup: 'CHEST', equipment: 'bodyweight', sourceId: 'archer-push-up' },
  { name: 'Flexão com Palmas',                       muscleGroup: 'CHEST', equipment: 'bodyweight', sourceId: 'clap-push-up' },

  // ─────────────────────────────────────────────
  // COSTAS
  // ─────────────────────────────────────────────
  { name: 'Barra Fixa Pronada',                      muscleGroup: 'BACK', equipment: 'bodyweight', sourceId: 'pull-up' },
  { name: 'Barra Fixa Supinada (Chin-up)',            muscleGroup: 'BACK', equipment: 'bodyweight', sourceId: 'chin-up' },
  { name: 'Barra Fixa Neutra',                       muscleGroup: 'BACK', equipment: 'bodyweight', sourceId: 'neutral-grip-pull-up' },
  { name: 'Barra Fixa Pegada Larga',                 muscleGroup: 'BACK', equipment: 'bodyweight', sourceId: 'wide-grip-pull-up' },
  { name: 'Barra Fixa com Peso',                     muscleGroup: 'BACK', equipment: 'bodyweight', sourceId: 'weighted-pull-up' },
  { name: 'Barra Fixa no Graviton',                  muscleGroup: 'BACK', equipment: 'machine',    sourceId: 'assisted-pull-up' },
  { name: 'Puxada Alta Pronada',                     muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'lat-pulldown' },
  { name: 'Puxada Alta Supinada',                    muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'supinated-lat-pulldown' },
  { name: 'Puxada Alta Neutra Fechada',              muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'close-grip-lat-pulldown' },
  { name: 'Puxada Alta Neutra Aberta',               muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'wide-neutral-pulldown' },
  { name: 'Puxada Alta Larga',                       muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'wide-grip-lat-pulldown' },
  { name: 'Puxada Alta na Máquina',                  muscleGroup: 'BACK', equipment: 'machine',    sourceId: 'machine-lat-pulldown' },
  { name: 'Puxada Unilateral no Cabo',               muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'single-arm-lat-pulldown' },
  { name: 'Pulldown Reto no Cabo',                   muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'straight-arm-pulldown' },
  { name: 'Pulldown Reto Unilateral',                muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'single-arm-straight-pulldown' },
  { name: 'Pulldown com Corda',                      muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'rope-pulldown' },
  { name: 'Isolateral Pull',                         muscleGroup: 'BACK', equipment: 'machine',    sourceId: 'isolateral-pull-down' },
  { name: 'Isolateral Pull Unilateral',              muscleGroup: 'BACK', equipment: 'machine',    sourceId: 'unilateral-isolateral-pull' },
  { name: 'High Row na Máquina',                     muscleGroup: 'BACK', equipment: 'machine',    sourceId: 'machine-high-row' },
  { name: 'Remada Curvada com Barra Pronada',        muscleGroup: 'BACK', equipment: 'barbell',    sourceId: 'barbell-bent-over-row' },
  { name: 'Remada Curvada com Barra Supinada',       muscleGroup: 'BACK', equipment: 'barbell',    sourceId: 'supinated-barbell-row' },
  { name: 'Remada Curvada no Smith',                 muscleGroup: 'BACK', equipment: 'smith',      sourceId: 'smith-machine-row' },
  { name: 'Remada Inclinada com Peito Apoiado',      muscleGroup: 'BACK', equipment: 'dumbbell',   sourceId: 'chest-supported-row' },
  { name: 'Remada Inclinada Apoiada com Halteres',   muscleGroup: 'BACK', equipment: 'dumbbell',   sourceId: 'incline-bench-dumbbell-row' },
  { name: 'Remada Serrote (Unilateral)',             muscleGroup: 'BACK', equipment: 'dumbbell',   sourceId: 'dumbbell-one-arm-row' },
  { name: 'Remada Baixa no Cabo',                    muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'seated-cable-row' },
  { name: 'Remada Baixa Triângulo',                  muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'cable-row-triangle' },
  { name: 'Remada Baixa Pronada',                    muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'cable-row-pronated' },
  { name: 'Remada Baixa Unilateral',                 muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'single-arm-cable-row' },
  { name: 'Remada Baixa com Corda',                  muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'cable-row-rope' },
  { name: 'Remada Neutra na Máquina',                muscleGroup: 'BACK', equipment: 'machine',    sourceId: 'machine-neutral-row' },
  { name: 'Remada Pronada na Máquina Articulada',    muscleGroup: 'BACK', equipment: 'machine',    sourceId: 'machine-pronated-row' },
  { name: 'Remada Pronada na Máquina de Roldana',    muscleGroup: 'BACK', equipment: 'machine',    sourceId: 'cable-machine-row' },
  { name: 'Remada Isolateral na Máquina',            muscleGroup: 'BACK', equipment: 'machine',    sourceId: 'isolateral-machine-row' },
  { name: 'Remada Unilateral na Máquina',            muscleGroup: 'BACK', equipment: 'machine',    sourceId: 'single-arm-machine-row' },
  { name: 'Remada Cavalinho',                        muscleGroup: 'BACK', equipment: 'barbell',    sourceId: 'landmine-row' },
  { name: 'Remada Cavalinho Unilateral',             muscleGroup: 'BACK', equipment: 'barbell',    sourceId: 'single-arm-landmine-row' },
  { name: 'T-Bar Row',                               muscleGroup: 'BACK', equipment: 'barbell',    sourceId: 't-bar-row' },
  { name: 'Low Row na Máquina',                      muscleGroup: 'BACK', equipment: 'machine',    sourceId: 'machine-low-row' },
  { name: 'Pullover no Cabo',                        muscleGroup: 'BACK', equipment: 'cable',      sourceId: 'cable-pullover' },
  { name: 'Pullover na Máquina',                     muscleGroup: 'BACK', equipment: 'machine',    sourceId: 'machine-pullover' },
  { name: 'Kelso Shrugs',                            muscleGroup: 'BACK', equipment: 'barbell',    sourceId: 'kelso-shrug' },
  { name: 'Hiperextensão Lombar',                    muscleGroup: 'BACK', equipment: 'bodyweight', sourceId: 'back-extension' },
  { name: 'Hiperextensão com Carga',                 muscleGroup: 'BACK', equipment: 'other',      sourceId: 'weighted-back-extension' },
  { name: 'Superman',                                muscleGroup: 'BACK', equipment: 'bodyweight', sourceId: 'superman' },
  { name: 'Bird Dog',                                muscleGroup: 'BACK', equipment: 'bodyweight', sourceId: 'bird-dog' },

  // ─────────────────────────────────────────────
  // OMBROS (inclui trapézio)
  // ─────────────────────────────────────────────
  { name: 'Desenvolvimento com Barra',               muscleGroup: 'SHOULDERS', equipment: 'barbell',    sourceId: 'overhead-press' },
  { name: 'Desenvolvimento Militar em Pé',           muscleGroup: 'SHOULDERS', equipment: 'barbell',    sourceId: 'military-press' },
  { name: 'Desenvolvimento Atrás do Pescoço',        muscleGroup: 'SHOULDERS', equipment: 'barbell',    sourceId: 'behind-neck-press' },
  { name: 'Desenvolvimento com Halteres Sentado',    muscleGroup: 'SHOULDERS', equipment: 'dumbbell',   sourceId: 'seated-dumbbell-shoulder-press' },
  { name: 'Desenvolvimento com Halteres em Pé',      muscleGroup: 'SHOULDERS', equipment: 'dumbbell',   sourceId: 'standing-dumbbell-shoulder-press' },
  { name: 'Arnold Press',                            muscleGroup: 'SHOULDERS', equipment: 'dumbbell',   sourceId: 'arnold-press' },
  { name: 'Desenvolvimento no Smith',                muscleGroup: 'SHOULDERS', equipment: 'smith',      sourceId: 'smith-machine-overhead-press' },
  { name: 'Desenvolvimento na Máquina Articulada',   muscleGroup: 'SHOULDERS', equipment: 'machine',    sourceId: 'machine-shoulder-press' },
  { name: 'Desenvolvimento na Máquina de Roldana',   muscleGroup: 'SHOULDERS', equipment: 'machine',    sourceId: 'cable-machine-shoulder-press' },
  { name: 'Elevação Lateral com Halteres em Pé',     muscleGroup: 'SHOULDERS', equipment: 'dumbbell',   sourceId: 'lateral-raise' },
  { name: 'Elevação Lateral com Halteres Sentado',   muscleGroup: 'SHOULDERS', equipment: 'dumbbell',   sourceId: 'seated-lateral-raise' },
  { name: 'Elevação Lateral Apoiada no Banco',       muscleGroup: 'SHOULDERS', equipment: 'dumbbell',   sourceId: 'incline-lateral-raise' },
  { name: 'Elevação Lateral no Cabo',                muscleGroup: 'SHOULDERS', equipment: 'cable',      sourceId: 'cable-lateral-raise' },
  { name: 'Elevação Lateral Unilateral no Cabo',     muscleGroup: 'SHOULDERS', equipment: 'cable',      sourceId: 'single-arm-cable-lateral-raise' },
  { name: 'Elevação Lateral com Elástico',           muscleGroup: 'SHOULDERS', equipment: 'other',      sourceId: 'band-lateral-raise' },
  { name: 'Elevação Lateral na Máquina Sentado',     muscleGroup: 'SHOULDERS', equipment: 'machine',    sourceId: 'machine-lateral-raise-seated' },
  { name: 'Elevação Lateral na Máquina em Pé',       muscleGroup: 'SHOULDERS', equipment: 'machine',    sourceId: 'machine-lateral-raise-standing' },
  { name: 'Elevação Frontal com Halteres',           muscleGroup: 'SHOULDERS', equipment: 'dumbbell',   sourceId: 'dumbbell-front-raise' },
  { name: 'Elevação Frontal Sentado com Halteres',   muscleGroup: 'SHOULDERS', equipment: 'dumbbell',   sourceId: 'seated-front-raise' },
  { name: 'Elevação Frontal com Barra',              muscleGroup: 'SHOULDERS', equipment: 'barbell',    sourceId: 'barbell-front-raise' },
  { name: 'Elevação Frontal com Barra W',            muscleGroup: 'SHOULDERS', equipment: 'barbell',    sourceId: 'ez-bar-front-raise' },
  { name: 'Elevação Frontal no Cabo com Corda',      muscleGroup: 'SHOULDERS', equipment: 'cable',      sourceId: 'cable-front-raise-rope' },
  { name: 'Elevação Frontal com Elástico',           muscleGroup: 'SHOULDERS', equipment: 'other',      sourceId: 'band-front-raise' },
  { name: 'Posterior de Ombro no Crucifixo',         muscleGroup: 'SHOULDERS', equipment: 'dumbbell',   sourceId: 'reverse-fly' },
  { name: 'Posterior de Ombro com Halteres',         muscleGroup: 'SHOULDERS', equipment: 'dumbbell',   sourceId: 'bent-over-reverse-fly' },
  { name: 'Posterior de Ombro no Cabo',              muscleGroup: 'SHOULDERS', equipment: 'cable',      sourceId: 'cable-rear-delt-fly' },
  { name: 'Posterior de Ombro Unilateral no Cabo',   muscleGroup: 'SHOULDERS', equipment: 'cable',      sourceId: 'single-arm-cable-rear-delt' },
  { name: 'Posterior de Ombro na Máquina',           muscleGroup: 'SHOULDERS', equipment: 'machine',    sourceId: 'machine-rear-delt-fly' },
  { name: 'Face Pull',                               muscleGroup: 'SHOULDERS', equipment: 'cable',      sourceId: 'face-pull' },
  { name: 'Elevação Y no Cabo',                      muscleGroup: 'SHOULDERS', equipment: 'cable',      sourceId: 'cable-y-raise' },
  { name: 'Elevação Y com Halteres',                 muscleGroup: 'SHOULDERS', equipment: 'dumbbell',   sourceId: 'dumbbell-y-raise' },
  { name: 'Puxada Alta no Cabo (Ombros)',            muscleGroup: 'SHOULDERS', equipment: 'cable',      sourceId: 'cable-high-pull' },
  { name: 'Remada Alta com Barra',                   muscleGroup: 'SHOULDERS', equipment: 'barbell',    sourceId: 'barbell-upright-row' },
  { name: 'Remada Alta com Halteres',                muscleGroup: 'SHOULDERS', equipment: 'dumbbell',   sourceId: 'dumbbell-upright-row' },
  { name: 'Remada Alta com Corda no Cabo',           muscleGroup: 'SHOULDERS', equipment: 'cable',      sourceId: 'cable-upright-row-rope' },
  { name: 'Encolhimento com Barra',                  muscleGroup: 'SHOULDERS', equipment: 'barbell',    sourceId: 'barbell-shrug' },
  { name: 'Encolhimento com Halteres',               muscleGroup: 'SHOULDERS', equipment: 'dumbbell',   sourceId: 'dumbbell-shrug' },
  { name: 'Encolhimento no Cabo',                    muscleGroup: 'SHOULDERS', equipment: 'cable',      sourceId: 'cable-shrug' },
  { name: 'Encolhimento na Máquina',                 muscleGroup: 'SHOULDERS', equipment: 'machine',    sourceId: 'machine-shrug' },
  { name: 'Kelso Shrugs (Trapézio)',                muscleGroup: 'SHOULDERS', equipment: 'barbell',    sourceId: 'kelso-shrug-traps' },

  // ─────────────────────────────────────────────
  // BÍCEPS
  // ─────────────────────────────────────────────
  { name: 'Rosca Direta com Barra',                  muscleGroup: 'BICEPS', equipment: 'barbell',  sourceId: 'barbell-curl' },
  { name: 'Rosca Direta com Barra W',                muscleGroup: 'BICEPS', equipment: 'barbell',  sourceId: 'ez-bar-curl' },
  { name: 'Rosca Direta com Halteres',               muscleGroup: 'BICEPS', equipment: 'dumbbell', sourceId: 'dumbbell-curl' },
  { name: 'Rosca Alternada com Halteres',            muscleGroup: 'BICEPS', equipment: 'dumbbell', sourceId: 'alternating-dumbbell-curl' },
  { name: 'Rosca Martelo com Halteres',              muscleGroup: 'BICEPS', equipment: 'dumbbell', sourceId: 'hammer-curl' },
  { name: 'Rosca Martelo Alternada',                 muscleGroup: 'BICEPS', equipment: 'dumbbell', sourceId: 'alternating-hammer-curl' },
  { name: 'Rosca Martelo com Corda no Cabo',         muscleGroup: 'BICEPS', equipment: 'cable',    sourceId: 'cable-hammer-curl-rope' },
  { name: 'Rosca Concentrada com Halteres',          muscleGroup: 'BICEPS', equipment: 'dumbbell', sourceId: 'concentration-curl' },
  { name: 'Rosca Scott com Barra',                   muscleGroup: 'BICEPS', equipment: 'barbell',  sourceId: 'preacher-curl' },
  { name: 'Rosca Scott com Barra W',                 muscleGroup: 'BICEPS', equipment: 'barbell',  sourceId: 'ez-bar-preacher-curl' },
  { name: 'Rosca Scott com Halteres',                muscleGroup: 'BICEPS', equipment: 'dumbbell', sourceId: 'dumbbell-preacher-curl' },
  { name: 'Rosca Scott Unilateral com Halteres',     muscleGroup: 'BICEPS', equipment: 'dumbbell', sourceId: 'single-arm-preacher-curl' },
  { name: 'Rosca Scott na Máquina',                  muscleGroup: 'BICEPS', equipment: 'machine',  sourceId: 'machine-preacher-curl' },
  { name: 'Rosca na Máquina',                        muscleGroup: 'BICEPS', equipment: 'machine',  sourceId: 'machine-bicep-curl' },
  { name: 'Rosca na Polia com Barra',                muscleGroup: 'BICEPS', equipment: 'cable',    sourceId: 'cable-curl-bar' },
  { name: 'Rosca na Polia Invertida',                muscleGroup: 'BICEPS', equipment: 'cable',    sourceId: 'cable-curl-reverse' },
  { name: 'Rosca na Polia Alta',                     muscleGroup: 'BICEPS', equipment: 'cable',    sourceId: 'cable-curl-high' },
  { name: 'Rosca Unilateral no Cabo',                muscleGroup: 'BICEPS', equipment: 'cable',    sourceId: 'single-arm-cable-curl' },
  { name: 'Rosca Bayesian',                          muscleGroup: 'BICEPS', equipment: 'cable',    sourceId: 'bayesian-curl' },
  { name: 'Rosca 21',                                muscleGroup: 'BICEPS', equipment: 'barbell',  sourceId: '21s-curl' },
  { name: 'Rosca 45° com Halteres',                  muscleGroup: 'BICEPS', equipment: 'dumbbell', sourceId: 'incline-dumbbell-curl' },
  { name: 'Rosca Spider com Barra',                  muscleGroup: 'BICEPS', equipment: 'barbell',  sourceId: 'spider-curl' },
  { name: 'Rosca Spider com Halteres',               muscleGroup: 'BICEPS', equipment: 'dumbbell', sourceId: 'spider-curl-dumbbell' },
  { name: 'Rosca Inversa com Barra',                 muscleGroup: 'BICEPS', equipment: 'barbell',  sourceId: 'reverse-curl' },
  { name: 'Rosca Inversa com Barra W',               muscleGroup: 'BICEPS', equipment: 'barbell',  sourceId: 'ez-bar-reverse-curl' },
  { name: 'Rosca Inversa com Cabo',                  muscleGroup: 'BICEPS', equipment: 'cable',    sourceId: 'cable-reverse-curl' },
  { name: 'Rosca Inversa com Halteres',              muscleGroup: 'BICEPS', equipment: 'dumbbell', sourceId: 'dumbbell-reverse-curl' },
  { name: 'Rosca Zottman',                           muscleGroup: 'BICEPS', equipment: 'dumbbell', sourceId: 'zottman-curl' },
  { name: 'Rosca com Elástico',                      muscleGroup: 'BICEPS', equipment: 'other',    sourceId: 'band-curl' },

  // ─────────────────────────────────────────────
  // TRÍCEPS
  // ─────────────────────────────────────────────
  { name: 'Tríceps na Paralela',                     muscleGroup: 'TRICEPS', equipment: 'bodyweight', sourceId: 'dips' },
  { name: 'Tríceps na Paralela no Graviton',         muscleGroup: 'TRICEPS', equipment: 'machine',    sourceId: 'assisted-dips' },
  { name: 'Bench Dip',                               muscleGroup: 'TRICEPS', equipment: 'bodyweight', sourceId: 'bench-dips' },
  { name: 'JM Press (Supino Pegada Junta)',          muscleGroup: 'TRICEPS', equipment: 'barbell',    sourceId: 'jm-press' },
  { name: 'Tríceps Testa com Barra',                 muscleGroup: 'TRICEPS', equipment: 'barbell',    sourceId: 'skull-crusher' },
  { name: 'Tríceps Testa com Barra W',               muscleGroup: 'TRICEPS', equipment: 'barbell',    sourceId: 'ez-bar-skull-crusher' },
  { name: 'Tríceps Testa com Halteres',              muscleGroup: 'TRICEPS', equipment: 'dumbbell',   sourceId: 'dumbbell-skull-crusher' },
  { name: 'Tríceps Francês com Barra',               muscleGroup: 'TRICEPS', equipment: 'barbell',    sourceId: 'overhead-triceps-extension-bar' },
  { name: 'Tríceps Francês com Barra W',             muscleGroup: 'TRICEPS', equipment: 'barbell',    sourceId: 'ez-bar-overhead-extension' },
  { name: 'Tríceps Francês com Halteres',            muscleGroup: 'TRICEPS', equipment: 'dumbbell',   sourceId: 'overhead-triceps-extension' },
  { name: 'Tríceps Francês Unilateral com Haltere',  muscleGroup: 'TRICEPS', equipment: 'dumbbell',   sourceId: 'single-arm-overhead-extension' },
  { name: 'Tríceps Francês no Cabo com Corda',       muscleGroup: 'TRICEPS', equipment: 'cable',      sourceId: 'cable-overhead-triceps-rope' },
  { name: 'Tríceps Francês Unilateral no Cabo',      muscleGroup: 'TRICEPS', equipment: 'cable',      sourceId: 'single-arm-cable-overhead-triceps' },
  { name: 'Tríceps Pulley com Corda',                muscleGroup: 'TRICEPS', equipment: 'cable',      sourceId: 'triceps-pushdown-rope' },
  { name: 'Tríceps Pulley com Barra',                muscleGroup: 'TRICEPS', equipment: 'cable',      sourceId: 'triceps-pushdown-bar' },
  { name: 'Tríceps Pulley com Barra W',              muscleGroup: 'TRICEPS', equipment: 'cable',      sourceId: 'triceps-pushdown-ez-bar' },
  { name: 'Tríceps Pulley Invertido',                muscleGroup: 'TRICEPS', equipment: 'cable',      sourceId: 'reverse-grip-pushdown' },
  { name: 'Tríceps Cruzado no Cabo',                 muscleGroup: 'TRICEPS', equipment: 'cable',      sourceId: 'cable-crossover-triceps' },
  { name: 'Tríceps Coice com Haltere',               muscleGroup: 'TRICEPS', equipment: 'dumbbell',   sourceId: 'triceps-kickback' },
  { name: 'Tríceps Coice no Cabo',                   muscleGroup: 'TRICEPS', equipment: 'cable',      sourceId: 'cable-triceps-kickback' },
  { name: 'Extensão de Tríceps na Máquina',          muscleGroup: 'TRICEPS', equipment: 'machine',    sourceId: 'machine-triceps-extension' },
  { name: 'Press de Tríceps Sentado na Máquina',     muscleGroup: 'TRICEPS', equipment: 'machine',    sourceId: 'machine-triceps-press' },
  { name: 'Tríceps Carter',                          muscleGroup: 'TRICEPS', equipment: 'barbell',    sourceId: 'triceps-carter' },
  { name: 'Extensão Unilateral de Tríceps no Cabo',  muscleGroup: 'TRICEPS', equipment: 'cable',      sourceId: 'single-arm-cable-triceps-extension' },
  { name: 'Supino Fechado com Barra',                muscleGroup: 'TRICEPS', equipment: 'barbell',    sourceId: 'close-grip-bench-press' },

  // ─────────────────────────────────────────────
  // ANTEBRAÇOS
  // ─────────────────────────────────────────────
  { name: 'Flexão de Punho com Barra',               muscleGroup: 'FOREARMS', equipment: 'barbell',  sourceId: 'wrist-curl-barbell' },
  { name: 'Flexão de Punho com Halteres',            muscleGroup: 'FOREARMS', equipment: 'dumbbell', sourceId: 'wrist-curl-dumbbell' },
  { name: 'Flexão de Punho no Cabo',                 muscleGroup: 'FOREARMS', equipment: 'cable',    sourceId: 'wrist-curl-cable' },
  { name: 'Extensão de Punho com Barra',             muscleGroup: 'FOREARMS', equipment: 'barbell',  sourceId: 'reverse-wrist-curl' },
  { name: 'Extensão de Punho com Halteres',          muscleGroup: 'FOREARMS', equipment: 'dumbbell', sourceId: 'reverse-wrist-curl-dumbbell' },
  { name: 'Extensão de Punho no Cabo',               muscleGroup: 'FOREARMS', equipment: 'cable',    sourceId: 'cable-wrist-extension' },
  { name: 'Rosca de Punho Supinada',                 muscleGroup: 'FOREARMS', equipment: 'barbell',  sourceId: 'wrist-curl' },
  { name: 'Rolo de Antebraço',                       muscleGroup: 'FOREARMS', equipment: 'other',    sourceId: 'wrist-roller' },
  { name: 'Farmer Walk',                             muscleGroup: 'FOREARMS', equipment: 'dumbbell', sourceId: 'farmer-walk' },
  { name: 'Farmer Walk com Barra',                   muscleGroup: 'FOREARMS', equipment: 'barbell',  sourceId: 'barbell-farmer-walk' },
  { name: 'Rosca Zottman (Antebraço)',               muscleGroup: 'FOREARMS', equipment: 'dumbbell', sourceId: 'zottman-curl-forearm' },
  { name: 'Prancha de Dedos',                        muscleGroup: 'FOREARMS', equipment: 'bodyweight',sourceId: 'finger-plank' },

  // ─────────────────────────────────────────────
  // QUADRÍCEPS
  // ─────────────────────────────────────────────
  { name: 'Agachamento Livre',                       muscleGroup: 'QUADS', equipment: 'barbell',    sourceId: 'barbell-squat' },
  { name: 'Agachamento Profundo',                    muscleGroup: 'QUADS', equipment: 'barbell',    sourceId: 'deep-squat' },
  { name: 'Agachamento com Salto',                   muscleGroup: 'QUADS', equipment: 'bodyweight', sourceId: 'jump-squat' },
  { name: 'Agachamento no Smith',                    muscleGroup: 'QUADS', equipment: 'smith',      sourceId: 'smith-machine-squat' },
  { name: 'Agachamento na Máquina',                  muscleGroup: 'QUADS', equipment: 'machine',    sourceId: 'machine-squat' },
  { name: 'Agachamento Frontal com Barra',           muscleGroup: 'QUADS', equipment: 'barbell',    sourceId: 'front-squat' },
  { name: 'Agachamento Búlgaro com Halteres',        muscleGroup: 'QUADS', equipment: 'dumbbell',   sourceId: 'bulgarian-split-squat' },
  { name: 'Agachamento Búlgaro com Barra',           muscleGroup: 'QUADS', equipment: 'barbell',    sourceId: 'barbell-bulgarian-split-squat' },
  { name: 'Agachamento Goblet',                      muscleGroup: 'QUADS', equipment: 'dumbbell',   sourceId: 'goblet-squat' },
  { name: 'Agachamento Zercher',                     muscleGroup: 'QUADS', equipment: 'barbell',    sourceId: 'zercher-squat' },
  { name: 'Agachamento Pistol',                      muscleGroup: 'QUADS', equipment: 'bodyweight', sourceId: 'pistol-squat' },
  { name: 'Agachamento com Banco',                   muscleGroup: 'QUADS', equipment: 'barbell',    sourceId: 'box-squat' },
  { name: 'Agachamento Pêndulo',                     muscleGroup: 'QUADS', equipment: 'machine',    sourceId: 'pendulum-squat' },
  { name: 'Sissysquat',                              muscleGroup: 'QUADS', equipment: 'bodyweight', sourceId: 'sissy-squat' },
  { name: 'Hack Squat na Máquina',                   muscleGroup: 'QUADS', equipment: 'machine',    sourceId: 'hack-squat' },
  { name: 'Hack Squat com Barra',                    muscleGroup: 'QUADS', equipment: 'barbell',    sourceId: 'barbell-hack-squat' },
  { name: 'Belt Squat',                              muscleGroup: 'QUADS', equipment: 'machine',    sourceId: 'belt-squat' },
  { name: 'Leg Press 45°',                           muscleGroup: 'QUADS', equipment: 'machine',    sourceId: 'leg-press' },
  { name: 'Leg Press 45° Unilateral',                muscleGroup: 'QUADS', equipment: 'machine',    sourceId: 'single-leg-press' },
  { name: 'Leg Press Articulado',                    muscleGroup: 'QUADS', equipment: 'machine',    sourceId: 'horizontal-leg-press' },
  { name: 'Leg Press Horizontal',                    muscleGroup: 'QUADS', equipment: 'machine',    sourceId: 'leg-press-horizontal' },
  { name: 'Leg Press Horizontal Unilateral',         muscleGroup: 'QUADS', equipment: 'machine',    sourceId: 'single-leg-horizontal-press' },
  { name: 'Cadeira Extensora',                       muscleGroup: 'QUADS', equipment: 'machine',    sourceId: 'leg-extension' },
  { name: 'Cadeira Extensora Unilateral',            muscleGroup: 'QUADS', equipment: 'machine',    sourceId: 'single-leg-extension' },
  { name: 'Afundo com Barra',                        muscleGroup: 'QUADS', equipment: 'barbell',    sourceId: 'barbell-lunge' },
  { name: 'Afundo com Halteres',                     muscleGroup: 'QUADS', equipment: 'dumbbell',   sourceId: 'dumbbell-lunge' },
  { name: 'Afundo Inverso com Halteres',             muscleGroup: 'QUADS', equipment: 'dumbbell',   sourceId: 'reverse-lunge' },
  { name: 'Afundo Inverso com Barra',                muscleGroup: 'QUADS', equipment: 'barbell',    sourceId: 'barbell-reverse-lunge' },
  { name: 'Afundo Lateral com Halteres',             muscleGroup: 'QUADS', equipment: 'dumbbell',   sourceId: 'lateral-lunge' },
  { name: 'Passadas com Halteres',                   muscleGroup: 'QUADS', equipment: 'dumbbell',   sourceId: 'walking-lunge' },
  { name: 'Passadas com Barra',                      muscleGroup: 'QUADS', equipment: 'barbell',    sourceId: 'barbell-walking-lunge' },
  { name: 'Curtsy Lunge',                            muscleGroup: 'QUADS', equipment: 'dumbbell',   sourceId: 'curtsy-lunge' },
  { name: 'Step Up com Halteres',                    muscleGroup: 'QUADS', equipment: 'dumbbell',   sourceId: 'step-up' },
  { name: 'Step Up com Barra',                       muscleGroup: 'QUADS', equipment: 'barbell',    sourceId: 'barbell-step-up' },
  { name: 'Salto no Banco',                          muscleGroup: 'QUADS', equipment: 'bodyweight', sourceId: 'box-jump' },
  { name: 'Wall Sit',                                muscleGroup: 'QUADS', equipment: 'bodyweight', sourceId: 'wall-sit' },

  // ─────────────────────────────────────────────
  // POSTERIORES — inclui todos os levantamentos terra
  // ─────────────────────────────────────────────
  { name: 'Levantamento Terra Convencional',         muscleGroup: 'HAMSTRINGS', equipment: 'barbell',    sourceId: 'conventional-deadlift' },
  { name: 'Levantamento Terra Sumô',                 muscleGroup: 'HAMSTRINGS', equipment: 'barbell',    sourceId: 'sumo-deadlift' },
  { name: 'Levantamento Terra Romeno (RDL)',         muscleGroup: 'HAMSTRINGS', equipment: 'barbell',    sourceId: 'romanian-deadlift' },
  { name: 'RDL com Halteres',                        muscleGroup: 'HAMSTRINGS', equipment: 'dumbbell',   sourceId: 'dumbbell-rdl' },
  { name: 'RDL Unilateral com Halteres',             muscleGroup: 'HAMSTRINGS', equipment: 'dumbbell',   sourceId: 'single-leg-rdl' },
  { name: 'RDL Unilateral no Cabo',                  muscleGroup: 'HAMSTRINGS', equipment: 'cable',      sourceId: 'single-leg-rdl-cable' },
  { name: 'Stiff com Barra',                         muscleGroup: 'HAMSTRINGS', equipment: 'barbell',    sourceId: 'stiff-leg-deadlift' },
  { name: 'Stiff com Halteres',                      muscleGroup: 'HAMSTRINGS', equipment: 'dumbbell',   sourceId: 'dumbbell-stiff-leg-deadlift' },
  { name: 'Levantamento Terra com Halteres',         muscleGroup: 'HAMSTRINGS', equipment: 'dumbbell',   sourceId: 'dumbbell-deadlift' },
  { name: 'Levantamento Terra Sumô com Haltere',     muscleGroup: 'HAMSTRINGS', equipment: 'dumbbell',   sourceId: 'dumbbell-sumo-deadlift' },
  { name: 'Levantamento Terra Trap Bar',             muscleGroup: 'HAMSTRINGS', equipment: 'barbell',    sourceId: 'trap-bar-deadlift' },
  { name: 'Levantamento Terra Deficitário',          muscleGroup: 'HAMSTRINGS', equipment: 'barbell',    sourceId: 'deficit-deadlift' },
  { name: 'Levantamento Terra com Pausa',            muscleGroup: 'HAMSTRINGS', equipment: 'barbell',    sourceId: 'pause-deadlift' },
  { name: 'Mesa Flexora',                            muscleGroup: 'HAMSTRINGS', equipment: 'machine',    sourceId: 'lying-leg-curl' },
  { name: 'Cadeira Flexora',                         muscleGroup: 'HAMSTRINGS', equipment: 'machine',    sourceId: 'seated-leg-curl' },
  { name: 'Cadeira Flexora Unilateral',              muscleGroup: 'HAMSTRINGS', equipment: 'machine',    sourceId: 'single-leg-curl' },
  { name: 'Flexora Vertical com Anilha',             muscleGroup: 'HAMSTRINGS', equipment: 'other',      sourceId: 'nordic-hamstring-curl-plate' },
  { name: 'Flexora Vertical com Roldana',            muscleGroup: 'HAMSTRINGS', equipment: 'cable',      sourceId: 'cable-leg-curl-standing' },
  { name: 'Leg Curl no Cabo',                        muscleGroup: 'HAMSTRINGS', equipment: 'cable',      sourceId: 'cable-leg-curl' },
  { name: 'Flexão Nórdica',                          muscleGroup: 'HAMSTRINGS', equipment: 'bodyweight', sourceId: 'nordic-curl' },
  { name: 'Glute Ham Raise',                         muscleGroup: 'HAMSTRINGS', equipment: 'machine',    sourceId: 'glute-ham-raise' },
  { name: 'Good Morning com Barra',                  muscleGroup: 'HAMSTRINGS', equipment: 'barbell',    sourceId: 'good-morning' },
  { name: 'Good Morning na Máquina',                 muscleGroup: 'HAMSTRINGS', equipment: 'machine',    sourceId: 'machine-good-morning' },

  // ─────────────────────────────────────────────
  // GLÚTEOS
  // ─────────────────────────────────────────────
  { name: 'Hip Thrust com Barra',                    muscleGroup: 'GLUTES', equipment: 'barbell',    sourceId: 'barbell-hip-thrust' },
  { name: 'Hip Thrust na Máquina',                   muscleGroup: 'GLUTES', equipment: 'machine',    sourceId: 'machine-hip-thrust' },
  { name: 'Hip Thrust com Haltere',                  muscleGroup: 'GLUTES', equipment: 'dumbbell',   sourceId: 'dumbbell-hip-thrust' },
  { name: 'Hip Thrust Unilateral',                   muscleGroup: 'GLUTES', equipment: 'barbell',    sourceId: 'single-leg-hip-thrust' },
  { name: 'Ponte de Glúteo',                         muscleGroup: 'GLUTES', equipment: 'bodyweight', sourceId: 'glute-bridge' },
  { name: 'Ponte de Glúteo com Barra',               muscleGroup: 'GLUTES', equipment: 'barbell',    sourceId: 'barbell-glute-bridge' },
  { name: 'Ponte de Glúteo Unilateral',              muscleGroup: 'GLUTES', equipment: 'bodyweight', sourceId: 'single-leg-glute-bridge' },
  { name: 'Glúteo no Cabo (Kickback)',               muscleGroup: 'GLUTES', equipment: 'cable',      sourceId: 'cable-kickback' },
  { name: 'Donkey Kickback',                         muscleGroup: 'GLUTES', equipment: 'bodyweight', sourceId: 'donkey-kickback' },
  { name: 'Coice de Glúteo na Máquina',              muscleGroup: 'GLUTES', equipment: 'machine',    sourceId: 'machine-glute-kickback' },
  { name: 'Agachamento Sumô com Halter',             muscleGroup: 'GLUTES', equipment: 'dumbbell',   sourceId: 'sumo-squat-dumbbell' },
  { name: 'Agachamento Sumô com Barra',              muscleGroup: 'GLUTES', equipment: 'barbell',    sourceId: 'sumo-squat-barbell' },
  { name: 'Frog Pump',                               muscleGroup: 'GLUTES', equipment: 'bodyweight', sourceId: 'frog-pump' },
  { name: 'Hip Extension na Máquina',                muscleGroup: 'GLUTES', equipment: 'machine',    sourceId: 'machine-hip-extension' },
  { name: 'Abdução de Quadril na Máquina',           muscleGroup: 'GLUTES', equipment: 'machine',    sourceId: 'hip-abduction-machine' },
  { name: 'Adução de Quadril na Máquina',            muscleGroup: 'GLUTES', equipment: 'machine',    sourceId: 'hip-adduction-machine' },
  { name: 'Abdução no Cabo',                         muscleGroup: 'GLUTES', equipment: 'cable',      sourceId: 'cable-hip-abduction' },
  { name: 'Adução no Cabo',                          muscleGroup: 'GLUTES', equipment: 'cable',      sourceId: 'cable-hip-adduction' },
  { name: 'Monster Walk com Elástico',               muscleGroup: 'GLUTES', equipment: 'other',      sourceId: 'band-monster-walk' },
  { name: 'Clamshell com Elástico',                  muscleGroup: 'GLUTES', equipment: 'other',      sourceId: 'clamshell' },
  { name: 'Abdução Deitado com Elástico',            muscleGroup: 'GLUTES', equipment: 'other',      sourceId: 'lying-hip-abduction-band' },
  { name: 'Fire Hydrant',                            muscleGroup: 'GLUTES', equipment: 'bodyweight', sourceId: 'fire-hydrant' },
  { name: 'Kickback com Elástico',                   muscleGroup: 'GLUTES', equipment: 'other',      sourceId: 'band-kickback' },

  // ─────────────────────────────────────────────
  // PANTURRILHAS
  // ─────────────────────────────────────────────
  { name: 'Panturrilha em Pé na Máquina',            muscleGroup: 'CALVES', equipment: 'machine',    sourceId: 'standing-calf-raise' },
  { name: 'Panturrilha Sentada na Máquina',          muscleGroup: 'CALVES', equipment: 'machine',    sourceId: 'seated-calf-raise' },
  { name: 'Panturrilha no Leg Press',                muscleGroup: 'CALVES', equipment: 'machine',    sourceId: 'leg-press-calf-raise' },
  { name: 'Panturrilha com Barra',                   muscleGroup: 'CALVES', equipment: 'barbell',    sourceId: 'barbell-calf-raise' },
  { name: 'Panturrilha com Halteres',                muscleGroup: 'CALVES', equipment: 'dumbbell',   sourceId: 'dumbbell-calf-raise' },
  { name: 'Panturrilha Unilateral',                  muscleGroup: 'CALVES', equipment: 'bodyweight', sourceId: 'single-leg-calf-raise' },
  { name: 'Panturrilha no Degrau',                   muscleGroup: 'CALVES', equipment: 'bodyweight', sourceId: 'calf-raise-step' },
  { name: 'Panturrilha no Degrau Unilateral',        muscleGroup: 'CALVES', equipment: 'bodyweight', sourceId: 'single-leg-calf-raise-step' },
  { name: 'Panturrilha no Smith',                    muscleGroup: 'CALVES', equipment: 'smith',      sourceId: 'smith-machine-calf-raise' },
  { name: 'Panturrilha Burro (Donkey Calf Raise)',   muscleGroup: 'CALVES', equipment: 'machine',    sourceId: 'donkey-calf-raise' },
  { name: 'Tibial Anterior no Cabo',                 muscleGroup: 'CALVES', equipment: 'cable',      sourceId: 'tibialis-raise' },
  { name: 'Panturrilha Explosiva (Jump)',            muscleGroup: 'CALVES', equipment: 'bodyweight', sourceId: 'calf-jump' },

  // ─────────────────────────────────────────────
  // ABDÔMEN
  // ─────────────────────────────────────────────
  { name: 'Abdominal Supra',                         muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'crunch' },
  { name: 'Abdominal Infra',                         muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'reverse-crunch' },
  { name: 'Abdominal Tesoura',                       muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'scissor-kick' },
  { name: 'Roda Abdominal (Ab Wheel)',               muscleGroup: 'ABS', equipment: 'other',      sourceId: 'ab-wheel-rollout' },
  { name: 'Abdominal na Máquina',                    muscleGroup: 'ABS', equipment: 'machine',    sourceId: 'machine-crunch' },
  { name: 'Abdominal na Corda (Polia)',              muscleGroup: 'ABS', equipment: 'cable',      sourceId: 'cable-crunch-rope' },
  { name: 'Abdominal no Cabo',                       muscleGroup: 'ABS', equipment: 'cable',      sourceId: 'cable-crunch' },
  { name: 'Prancha',                                 muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'plank' },
  { name: 'Prancha Lateral',                         muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'side-plank' },
  { name: 'Prancha com Toque no Ombro',              muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'plank-shoulder-tap' },
  { name: 'Prancha com Elevação de Perna',           muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'plank-leg-raise' },
  { name: 'Elevação de Pernas Suspenso',             muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'hanging-leg-raise' },
  { name: 'Elevação de Pernas no Solo',              muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'lying-leg-raise' },
  { name: 'Elevação de Joelhos Suspenso',            muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'hanging-knee-raise' },
  { name: 'Russian Twist',                           muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'russian-twist' },
  { name: 'Russian Twist com Peso',                  muscleGroup: 'ABS', equipment: 'other',      sourceId: 'weighted-russian-twist' },
  { name: 'Bicicleta Abdominal',                     muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'bicycle-crunch' },
  { name: 'Dragon Flag',                             muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'dragon-flag' },
  { name: 'Dead Bug',                                muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'dead-bug' },
  { name: 'Hollow Body Hold',                        muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'hollow-body-hold' },
  { name: 'Oblíquo no Cabo',                         muscleGroup: 'ABS', equipment: 'cable',      sourceId: 'cable-oblique-crunch' },
  { name: 'Abdominal Oblíquo',                       muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'oblique-crunch' },
  { name: 'Mountain Climber',                        muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'mountain-climber' },
  { name: 'Sit Up',                                  muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'sit-up' },
  { name: 'Toes to Bar',                             muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'toes-to-bar' },
  { name: 'L-Sit',                                   muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'l-sit' },
  { name: 'Pallof Press',                            muscleGroup: 'ABS', equipment: 'cable',      sourceId: 'pallof-press' },
  { name: 'Pallof Press com Rotação',                muscleGroup: 'ABS', equipment: 'cable',      sourceId: 'pallof-press-rotation' },
  { name: 'Woodchop Alto no Cabo',                   muscleGroup: 'ABS', equipment: 'cable',      sourceId: 'cable-woodchop-high' },
  { name: 'Woodchop Baixo no Cabo',                  muscleGroup: 'ABS', equipment: 'cable',      sourceId: 'cable-woodchop-low' },
  { name: 'Crunch com Bola Suíça',                   muscleGroup: 'ABS', equipment: 'other',      sourceId: 'swiss-ball-crunch' },
  { name: 'Pike na Bola Suíça',                      muscleGroup: 'ABS', equipment: 'other',      sourceId: 'swiss-ball-pike' },
  { name: 'Abdominal V',                             muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'v-up' },
  { name: 'Windshield Wiper',                        muscleGroup: 'ABS', equipment: 'bodyweight', sourceId: 'windshield-wiper' },

  // ─────────────────────────────────────────────
  // CORPO INTEIRO / COMPOSTOS
  // ─────────────────────────────────────────────
  { name: 'Clean and Press',                         muscleGroup: 'FULL_BODY', equipment: 'barbell',    sourceId: 'clean-and-press' },
  { name: 'Power Clean',                             muscleGroup: 'FULL_BODY', equipment: 'barbell',    sourceId: 'power-clean' },
  { name: 'Hang Clean',                              muscleGroup: 'FULL_BODY', equipment: 'barbell',    sourceId: 'hang-clean' },
  { name: 'Snatch com Barra',                        muscleGroup: 'FULL_BODY', equipment: 'barbell',    sourceId: 'barbell-snatch' },
  { name: 'Snatch com Haltere',                      muscleGroup: 'FULL_BODY', equipment: 'dumbbell',   sourceId: 'dumbbell-snatch' },
  { name: 'Thruster com Halteres',                   muscleGroup: 'FULL_BODY', equipment: 'dumbbell',   sourceId: 'dumbbell-thruster' },
  { name: 'Thruster com Barra',                      muscleGroup: 'FULL_BODY', equipment: 'barbell',    sourceId: 'barbell-thruster' },
  { name: 'Swing com Kettlebell',                    muscleGroup: 'FULL_BODY', equipment: 'kettlebell', sourceId: 'kettlebell-swing' },
  { name: 'Turkish Get Up',                          muscleGroup: 'FULL_BODY', equipment: 'kettlebell', sourceId: 'turkish-get-up' },
  { name: 'Burpee',                                  muscleGroup: 'FULL_BODY', equipment: 'bodyweight', sourceId: 'burpee' },
  { name: 'Man Maker',                               muscleGroup: 'FULL_BODY', equipment: 'dumbbell',   sourceId: 'man-maker' },
  { name: 'Bear Complex',                            muscleGroup: 'FULL_BODY', equipment: 'barbell',    sourceId: 'bear-complex' },
  { name: 'Devil Press',                             muscleGroup: 'FULL_BODY', equipment: 'dumbbell',   sourceId: 'devil-press' },
  { name: 'Clean com Halteres',                      muscleGroup: 'FULL_BODY', equipment: 'dumbbell',   sourceId: 'dumbbell-clean' },

]

async function main() {
  console.log('🌱 IronSynk — Seeding exercises v3...\n')

  const counts: Record<string, number> = {}
  let created = 0
  let skipped = 0

  for (const ex of exercises) {
    const existing = await prisma.exercise.findFirst({
      where: { sourceId: ex.sourceId }
    })

    if (existing) {
      skipped++
      continue
    }

    await prisma.exercise.create({
      data: {
        id:          crypto.randomUUID(),
        name:        ex.name,
        muscleGroup: ex.muscleGroup as MuscleGroup,
        equipment:   ex.equipment,
        description: ex.description ?? null,
        gifUrl:      null,
        videoUrl:    null,
        isCustom:    false,
        createdById: null,
        sourceId:    ex.sourceId,
      }
    })

    counts[ex.muscleGroup] = (counts[ex.muscleGroup] ?? 0) + 1
    process.stdout.write(`  ✅ ${ex.name}\n`)
    created++
  }

  console.log('\n─────────────────────────────────────')
  console.log(`✅ ${created} criados  |  ⏭  ${skipped} já existiam`)
  console.log('\n📊 Por grupamento:')
  for (const [group, count] of Object.entries(counts).sort()) {
    console.log(`   ${group.padEnd(16)} ${count} exercícios`)
  }
  console.log('\n📌 Próximo passo:')
  console.log('   Execute o script de GIFs para baixar do ExerciseDB')
  console.log('   e subir em Supabase Storage > exercises/{sourceId}.gif\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())