import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Modal, Pressable, Animated,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { ExerciseCardShell, cardMetaStyles, cardBodyStyles, CARD_IMG_SIZE } from '../../components/ExerciseCardShell'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as SecureStore from 'expo-secure-store'
import { useSessionStore } from '../../store/sessionStore'
import { ExercisePickerModal } from './ExercisePickerModal'
import { TechniquePickerSheet, TechniqueSelection } from './TechniquePickerSheet'
import { showToast } from '../../components/Toast'
import * as Haptics from 'expo-haptics'
import { api } from '../../lib/api'
import type {
  ExecutionExerciseRecord, ExecutionSetLogRecord,
  PlannedSetTechnique, SetType, TechniqueConfig, ExerciseReference,
} from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { SetBadge, getTechStyle } from '../../components/SetBadge'
import { CompleteSetButton } from '../../components/CompleteSetButton'
import { CompletedAccentOverlay, useCompletedFade } from '../../components/SetCompletion'
import { PRBadge, ProgressOverloadHint } from '../../components/PersonalRecord'
import { WorkoutInput } from '../../components/WorkoutInput'
import { validateSimpleSet, validateTechniqueSet } from '../../lib/setValidation'

const REST_TIMER_TIP_KEY = 'rest_timer_tip_seen_v1'

// ─── Types ────────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<AppStackParamList>
type RouteProps = RouteProp<AppStackParamList, 'WorkoutExecution'>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatVolume(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return v % 1 === 0 ? String(v) : v.toFixed(1)
}

// ─── Technique summary helper ─────────────────────────────────────────────────

function buildTechSummary(technique: PlannedSetTechnique, cfg: Record<string, unknown> | null): string | null {
  if (!cfg) return null
  switch (technique) {
    case 'REST_PAUSE': {
      const pts = (cfg['failurePoints'] as number) ?? 3
      const rest = (cfg['restBetweenSeconds'] as number) ?? 20
      return `${pts} pontos de falha · ${rest}s descanso`
    }
    case 'CLUSTER_SET': {
      const blks = (cfg['blocks'] as number) ?? 4
      const rpp = cfg['repsPerBlock'] as number | undefined
      const rest = (cfg['restBetweenSeconds'] as number) ?? 15
      return `${blks} blocos${rpp ? ` × ${rpp} reps` : ''} · ${rest}s`
    }
    case 'MUSCLE_ROUND': {
      const blks = (cfg['blocks'] as number) ?? 6
      const rest = (cfg['restBetweenSeconds'] as number) ?? 35
      return `${blks} blocos · ${rest}s descanso`
    }
    case 'DROP_SET': {
      const dw = cfg['dropWeights'] as (number | null)[] | undefined
      const drops = (cfg['drops'] as number) ?? 2
      if (dw && dw.some(w => w != null)) {
        return dw.map(w => (w != null ? `${w} kg` : '—')).join(' → ')
      }
      return `${drops + 1} drops`
    }
    case 'MYOREP': {
      const aReps = (cfg['activationReps'] as number) ?? 15
      const aRest = (cfg['activationRestSeconds'] as number) ?? 20
      const rpp = (cfg['repsPerBlock'] as number) ?? 5
      return `Ativ. ${aReps} reps · ${aRest}s · ${rpp}/bloco`
    }
    default: return null
  }
}

// ─── Simple set row ───────────────────────────────────────────────────────────

type SetRowProps = {
  set: ExecutionSetLogRecord
  index: number
  restSeconds: number | null
  onChecked: (setId: string, reps: number | null, weight: number | null, cfg: TechniqueConfig | null) => void
  onRestEnd: () => void
  onRemove: () => void
  onTechniqueTap: () => void
}

function SimpleSetRow({ set, index, onChecked, onRemove, onTechniqueTap }: SetRowProps) {
  const [reps, setReps] = useState(set.repsCompleted != null && set.repsCompleted > 0 ? String(set.repsCompleted) : '')
  const [weight, setWeight] = useState(set.weightKg != null && set.weightKg > 0 ? String(set.weightKg) : '')
  const ts = getTechStyle(set.setType, set.technique)
  const isNonVolume = set.setType === 'WARMUP' || set.setType === 'FEEDER'
  const hasAccent = isNonVolume || set.technique === 'BACK_OFF'
  // Completed rows settle into a slightly dimmed, resolved state
  const rowFade = useCompletedFade(set.isChecked)

  function handleCheck(): false | void {
    const result = validateSimpleSet(reps, weight)
    if (!result.ok) { showToast(result.message, 'warning'); return false }
    onChecked(set.id, parseInt(reps, 10), parseFloat(weight), null)
  }

  return (
    <Animated.View style={[
      ex.setRowOuter,
      { opacity: rowFade },
      hasAccent && { borderLeftWidth: 2, borderLeftColor: ts.borderColor, paddingLeft: 6, marginLeft: 2 },
    ]}>
      {/* Accented rows already carry a colored left bar (warmup/feeder/back-off) —
          use the bar-less subtle completion so the two never compete. Clean
          WORKING sets get the full success bar. */}
      <CompletedAccentOverlay active={set.isChecked} radius={10} subtle={hasAccent} />
      {/* PR ribbon — gold trophy shown only when the backend confirmed this set
          beat historical data. Tap the trophy for the broken record types. */}
      {set.isChecked && set.isPersonalRecord && (
        <View style={[ex.prRow, !hasAccent && { paddingLeft: 14 }]}>
          <PRBadge prTypes={set.prTypes} />
          <Text style={ex.prRowText}>Recorde pessoal</Text>
        </View>
      )}
      {/* Pure WORKING rows: extra left padding so the success bar and the set
          badge don't feel glued together. */}
      <View style={[ex.setRow, !hasAccent && { paddingLeft: 14 }]}>
        <SetBadge setType={set.setType} technique={set.technique} index={index} onPress={onTechniqueTap} />

        <View style={ex.inputsGroup}>
          <WorkoutInput
            flex={1}
            value={reps}
            onChangeText={setReps}
            placeholder="—"
            keyboardType="number-pad"
            completed={set.isChecked}
            leadingIcon="repeat-outline"
            unit="reps"
          />
          <WorkoutInput
            flex={1}
            value={weight}
            onChangeText={setWeight}
            placeholder="—"
            keyboardType="decimal-pad"
            completed={set.isChecked}
            leadingIcon="barbell-outline"
            unit="kg"
          />
        </View>

        <CompleteSetButton checked={set.isChecked} onPress={handleCheck} />

        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 4, right: 8 }} style={ex.removeSetBtn}>
          <Ionicons name="close" size={13} color="#2E2E3E" />
        </TouchableOpacity>
      </View>
      {isNonVolume && <Text style={ex.nonVolNote}>Não conta para o volume</Text>}
    </Animated.View>
  )
}

// ─── Technique set row ────────────────────────────────────────────────────────
// Only for techniques with block expansion: REST_PAUSE, CLUSTER_SET, MUSCLE_ROUND, DROP_SET.
// Visual style matches WorkoutDetailScreen expansion components.

type TechSetRowProps = {
  set: ExecutionSetLogRecord
  index: number
  onChecked: (setId: string, reps: number | null, weight: number | null, cfg: TechniqueConfig | null) => void
  onRemove: () => void
  onTechniqueTap: () => void
}

type BlockData = { reps: string; weight: string; failed?: boolean }

function TechSetRow({ set, index, onChecked, onRemove, onTechniqueTap }: TechSetRowProps) {
  const ts = getTechStyle(set.setType, set.technique)
  const cfg = set.techniqueConfig as Record<string, unknown> | null

  const initBlocks = useCallback((): BlockData[] => {
    if (!cfg) return [{ reps: '', weight: '' }]
    if (set.technique === 'REST_PAUSE') {
      const pts = cfg['execPoints'] as { reps: null | number; weightKg: null | number }[] | undefined
      // +1 because index 0 is the main set; 1..failurePoints are failure blocks
      const count = ((cfg['failurePoints'] as number) ?? 3) + 1
      // weight is shared via mainWeight — blocks only track reps
      return (pts ?? Array.from({ length: count }, () => ({ reps: null, weightKg: null }))).map(p => ({
        reps: p.reps != null ? String(p.reps) : '',
        weight: '',
      }))
    }
    if (set.technique === 'CLUSTER_SET') {
      const blks = cfg['execBlocks'] as { reps: null | number; weightKg: null | number }[] | undefined
      const count = (cfg['blocks'] as number) ?? 4
      // weight is shared via mainWeight — blocks only track reps
      return (blks ?? Array.from({ length: count }, () => ({ reps: null, weightKg: null }))).map(b => ({
        reps: b.reps != null ? String(b.reps) : '',
        weight: '',
      }))
    }
    if (set.technique === 'MUSCLE_ROUND') {
      const blks = cfg['execBlocks'] as { reps: null | number; failed?: boolean }[] | undefined
      const count = (cfg['blocks'] as number) ?? 6
      // weight is now shared (mainWeight / dropWeight) — blocks only track reps and failure flag
      return (blks ?? Array.from({ length: count }, () => ({ reps: null, failed: false }))).map(b => ({
        reps: b.reps != null ? String(b.reps) : '',
        weight: '',
        failed: b.failed,
      }))
    }
    if (set.technique === 'DROP_SET') {
      const drops = (cfg['drops'] as number) ?? 2
      const execDrops = cfg['execDrops'] as { weightKg: null | number; reps: null | number }[] | undefined
      // total = main + drops; weights come from prior execution input (execDrops)
      const totalBlocks = Array.isArray(execDrops) ? execDrops.length : drops + 1
      return Array.from({ length: totalBlocks }, (_, i) => {
        const execDrop = execDrops?.[i]
        return {
          reps: execDrop?.reps != null ? String(execDrop.reps) : '',
          weight: execDrop?.weightKg != null ? String(execDrop.weightKg) : '',
        }
      })
    }
    if (set.technique === 'MYOREP') {
      const execActivation = cfg['execActivationReps'] as number | null | undefined
      const execMinis = cfg['execMiniBlocks'] as { reps: null | number; failed?: boolean }[] | undefined
      return [
        // index 0 = activation set
        { reps: execActivation != null ? String(execActivation) : '', weight: '' },
        // index 1..N = completed mini-blocks (only existing ones — user adds more via button)
        ...(execMinis ?? []).map(m => ({
          reps: m.reps != null ? String(m.reps) : '',
          weight: '',
          failed: m.failed,
        })),
      ]
    }
    return [{ reps: '', weight: '' }]
  }, [])

  const [blocks, setBlocks] = useState<BlockData[]>(initBlocks)
  const restSec = cfg ? ((cfg['restBetweenSeconds'] as number) ?? 0) : 0

  // Shared weight for REST_PAUSE / CLUSTER_SET; main weight for MUSCLE_ROUND
  const [mainWeight, setMainWeight] = useState<string>(() => {
    if (!cfg) return ''
    if (set.technique === 'CLUSTER_SET') {
      const blks = cfg['execBlocks'] as { weightKg: null | number }[] | undefined
      const w = blks?.[0]?.weightKg
      return w != null ? String(w) : ''
    }
    if (set.technique === 'REST_PAUSE') {
      const pts = cfg['execPoints'] as { weightKg: null | number }[] | undefined
      const w = pts?.[0]?.weightKg
      return w != null ? String(w) : ''
    }
    if (set.technique === 'MUSCLE_ROUND') {
      // prefer saved execConfig value, fall back to set's weightKg (seeded from targetWeight)
      const w = cfg['mainWeightKg'] as number | null | undefined
      if (w != null) return String(w)
      return set.weightKg != null && set.weightKg > 0 ? String(set.weightKg) : ''
    }
    if (set.technique === 'MYOREP') {
      const w = (cfg['mainWeightKg'] as number | null | undefined) ?? (cfg['weightKg'] as number | null | undefined)
      if (w != null) return String(w)
      return set.weightKg != null && set.weightKg > 0 ? String(set.weightKg) : ''
    }
    return ''
  })

  // Drop weight for MUSCLE_ROUND (applied from the failure block onward)
  const [dropWeight, setDropWeight] = useState<string>(() => {
    if (set.technique !== 'MUSCLE_ROUND' || !cfg) return ''
    const w = cfg['dropWeightKg'] as number | null | undefined
    return w != null ? String(w) : ''
  })

  const isMYO = set.technique === 'MYOREP'
  const anyMYOFailed = isMYO && blocks.slice(1).some(b => !!b.failed)
  const myoActivationRest = isMYO && cfg ? ((cfg['activationRestSeconds'] as number) ?? 20) : 0

  function addMiniBlock() {
    setBlocks(prev => [...prev, { reps: '', weight: '', failed: false }])
  }

  function updateBlock(i: number, field: 'reps' | 'weight', val: string) {
    setBlocks(prev => prev.map((b, bi) => bi !== i ? b : { ...b, [field]: val }))
  }
  function toggleFailed(i: number) {
    if (set.technique === 'MUSCLE_ROUND') {
      // Only one failure point allowed; toggle off if clicking the same block
      setBlocks(prev => prev.map((b, bi) => ({ ...b, failed: bi === i ? !b.failed : false })))
    } else {
      setBlocks(prev => prev.map((b, bi) => bi !== i ? b : { ...b, failed: !b.failed }))
    }
  }

  function buildCfg(bks: BlockData[]): TechniqueConfig | null {
    if (!cfg) return null
    if (set.technique === 'REST_PAUSE')
      return { ...cfg, execPoints: bks.map(b => ({ reps: parseInt(b.reps, 10) || null, weightKg: parseFloat(mainWeight) || null })) } as TechniqueConfig
    if (set.technique === 'CLUSTER_SET')
      return { ...cfg, execBlocks: bks.map(b => ({ reps: parseInt(b.reps, 10) || null, weightKg: parseFloat(mainWeight) || null })) } as TechniqueConfig
    if (set.technique === 'MUSCLE_ROUND') {
      const failedAt = bks.findIndex(b => !!b.failed)
      return {
        ...cfg,
        execBlocks: bks.map(b => ({ reps: parseInt(b.reps, 10) || null, failed: !!b.failed })),
        mainWeightKg: parseFloat(mainWeight) || null,
        dropWeightKg: parseFloat(dropWeight) || null,
        failedAtBlock: failedAt >= 0 ? failedAt : null,
      } as TechniqueConfig
    }
    if (set.technique === 'DROP_SET') {
      // Weights are entered here during execution and saved to the session.
      return {
        ...cfg,
        execDrops: bks.map(b => ({
          weightKg: parseFloat(b.weight) || null,
          reps: parseInt(b.reps, 10) || null,
        })),
      } as TechniqueConfig
    }
    if (set.technique === 'MYOREP') {
      return {
        ...cfg,
        execActivationReps: parseInt(bks[0]?.reps ?? '', 10) || null,
        execMiniBlocks: bks.slice(1).map(b => ({
          reps: parseInt(b.reps, 10) || null,
          failed: !!b.failed,
        })),
        mainWeightKg: parseFloat(mainWeight) || null,
      } as TechniqueConfig
    }
    return null
  }

  function handleDone(): false | void {
    const result = validateTechniqueSet({
      technique: set.technique,
      blocks,
      mainWeight,
      dropWeight,
      blockLabel,
    })
    if (!result.ok) { showToast(result.message, 'warning'); return false }
    const totalReps = blocks.reduce((sum, b) => sum + (parseInt(b.reps, 10) || 0), 0)
    let maxWeight: number
    if (set.technique === 'CLUSTER_SET' || set.technique === 'REST_PAUSE' || set.technique === 'MUSCLE_ROUND' || isMYO) {
      maxWeight = parseFloat(mainWeight) || 0
    } else if (set.technique === 'DROP_SET') {
      maxWeight = blocks.reduce((mx, b) => Math.max(mx, parseFloat(b.weight) || 0), 0)
    } else {
      maxWeight = blocks.reduce((mx, b) => Math.max(mx, parseFloat(b.weight) || 0), 0)
    }
    onChecked(set.id, totalReps || null, maxWeight || null, buildCfg(blocks))
  }

  const showMainWeight = set.technique === 'CLUSTER_SET' || set.technique === 'REST_PAUSE' || isMYO
  const isMuscleRound = set.technique === 'MUSCLE_ROUND'
  const failedAtBlock = isMuscleRound ? blocks.findIndex(b => !!b.failed) : -1
  const summaryText = buildTechSummary(set.technique, cfg)

  // Completed technique sets settle into a slightly dimmed, resolved state
  const rowFade = useCompletedFade(set.isChecked)

  const blockLabel = (i: number) => {
    if (set.technique === 'REST_PAUSE') return i === 0 ? 'Série Principal' : `Falha ${i}`
    if (set.technique === 'DROP_SET') return i === 0 ? 'Série Principal' : `Drop ${i}`
    if (set.technique === 'MYOREP') return i === 0 ? 'Ativação' : `Mini ${i}`
    return `Bloco ${i + 1}`
  }

  return (
    <Animated.View style={[
      ex.techSetWrap,
      { borderLeftColor: ts.borderColor, opacity: rowFade },
    ]}>
      {/* Advanced technique rows own a colored left border as their identity.
          Use the bar-less subtle completion so the green state never overlaps or
          competes with that technique color. */}
      <CompletedAccentOverlay active={set.isChecked} radius={10} subtle />
      {/* Header row — badge, set number, weight (RP/CS/MYO), done, remove */}
      <View style={ex.setRow}>
        <SetBadge setType={set.setType} technique={set.technique} index={index} onPress={onTechniqueTap} />
        <Text style={ex.techSetNum}>Série {index + 1}</Text>
        <View style={{ flex: 1 }} />
        {showMainWeight && (
          <WorkoutInput
            width={96}
            value={mainWeight}
            onChangeText={setMainWeight}
            placeholder="—"
            keyboardType="decimal-pad"
            completed={set.isChecked}
            unit="kg"
          />
        )}
        <CompleteSetButton checked={set.isChecked} onPress={handleDone} />
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 4, right: 6 }} style={ex.removeSetBtn}>
          <Ionicons name="close" size={13} color="#3A3A4A" />
        </TouchableOpacity>
      </View>

      {/* Technique summary */}
      {summaryText != null && (
        <View style={ex.techSummaryRow}>
          <View style={[ex.techSummaryAccent, { backgroundColor: ts.borderColor }]} />
          <Text style={[ex.techSummaryText, { color: ts.badgeText }]} numberOfLines={1}>{summaryText}</Text>
        </View>
      )}

      {/* MUSCLE_ROUND: two-weight row — principal + queda */}
      {isMuscleRound && (
        <View style={ex.mrWeightsRow}>
          <View style={ex.mrWeightCol}>
            <Text style={ex.mrWeightLabel}>PRINCIPAL</Text>
            <WorkoutInput
              flex={1}
              value={mainWeight}
              onChangeText={setMainWeight}
              placeholder="—"
              keyboardType="decimal-pad"
              completed={set.isChecked}
              unit="kg"
            />
          </View>
          <View style={ex.mrWeightCol}>
            <Text style={[ex.mrWeightLabel, { color: '#A78BFA' }]}>↓ DROP</Text>
            <WorkoutInput
              flex={1}
              value={dropWeight}
              onChangeText={setDropWeight}
              placeholder="—"
              keyboardType="decimal-pad"
              completed={set.isChecked}
              unit="kg"
            />
          </View>
        </View>
      )}

      {/* Technique blocks */}
      <View style={ex.techBlocks}>
        {blocks.map((block, bi) => {
          const isFailureBlock = isMuscleRound && block.failed
          const isDropBlock = isMuscleRound && failedAtBlock >= 0 && bi > failedAtBlock
          const isDS = set.technique === 'DROP_SET'
          return (
            <View key={bi}>
              {/* Drop set: connector between drops */}
              {bi > 0 && isDS && (
                <View style={ex.dropConnector}>
                  <View style={ex.dropConnectorLine} />
                  <Text style={ex.dropConnectorLabel}>↓ drop</Text>
                  <View style={ex.dropConnectorLine} />
                </View>
              )}
              {/* Other techniques: rest separator */}
              {bi > 0 && !isDS && !isMYO && restSec > 0 && (
                <View style={ex.blockSep}>
                  <View style={ex.blockSepLine} />
                  <Text style={ex.blockSepLabel}>{restSec}s</Text>
                  <View style={ex.blockSepLine} />
                </View>
              )}
              {bi > 0 && !isDS && !isMYO && restSec === 0 && (
                <View style={ex.blockSepThin} />
              )}
              {/* MYOREP: activation rest before mini 1, block rest between minis */}
              {bi > 0 && isMYO && (
                <View style={ex.blockSep}>
                  <View style={[ex.blockSepLine, { backgroundColor: 'rgba(244,114,182,0.25)' }]} />
                  <Text style={[ex.blockSepLabel, { color: '#F472B6' }]}>
                    {bi === 1 ? `${myoActivationRest}s` : `${restSec}s`}
                  </Text>
                  <View style={[ex.blockSepLine, { backgroundColor: 'rgba(244,114,182,0.25)' }]} />
                </View>
              )}
              <View style={[
                ex.blockRow,
                isFailureBlock && ex.blockRowFailed,
                isDropBlock && ex.blockRowDrop,
                isDS && ex.blockRowDS,
                isMYO && bi === 0 && ex.blockRowMYOActivation,
                isMYO && bi > 0 && ex.blockRowMYOMini,
                isMYO && bi > 0 && block.failed && ex.blockRowFailed,
              ]}>
                {isDropBlock && <Text style={ex.mrDropIndicator}>↓</Text>}
                {isDS && <Text style={ex.dsBlockArrow}>→</Text>}
                <Text style={[
                  ex.blockLabel,
                  isDropBlock && ex.blockLabelDrop,
                  isMYO && bi === 0 && ex.blockLabelMYO,
                ]}>{blockLabel(bi)}</Text>
                {isDS && (
                  <WorkoutInput
                    width={80}
                    value={block.weight}
                    onChangeText={v => updateBlock(bi, 'weight', v)}
                    placeholder="—"
                    keyboardType="decimal-pad"
                    completed={set.isChecked}
                    unit="kg"
                  />
                )}
                <WorkoutInput
                  width={isDS ? 80 : 92}
                  value={block.reps}
                  onChangeText={v => updateBlock(bi, 'reps', v)}
                  placeholder={
                    (set.technique === 'CLUSTER_SET' && cfg?.['repsPerBlock']) ? String(cfg['repsPerBlock']) :
                    (isMYO && bi === 0 && cfg?.['activationReps']) ? String(cfg['activationReps']) :
                    (isMYO && bi > 0 && cfg?.['repsPerBlock']) ? String(cfg['repsPerBlock']) :
                    '—'
                  }
                  keyboardType="number-pad"
                  completed={set.isChecked}
                  unit="reps"
                />
                {isMuscleRound && (
                  <TouchableOpacity
                    style={[ex.failDot, isFailureBlock && ex.failDotActive]}
                    onPress={() => toggleFailed(bi)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    {isFailureBlock && <Ionicons name="close" size={10} color="#fff" />}
                  </TouchableOpacity>
                )}
                {/* MYOREP mini-block failure marker */}
                {isMYO && bi > 0 && (
                  <TouchableOpacity
                    style={[ex.failDot, ex.failDotMYO, block.failed && ex.failDotMYOActive]}
                    onPress={() => toggleFailed(bi)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    {block.failed && <Ionicons name="close" size={10} color="#fff" />}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )
        })}
        {isMuscleRound && (
          <Text style={ex.mrHint}>
            {failedAtBlock >= 0
              ? `Falha no bloco ${failedAtBlock + 1} — blocos restantes com peso de queda`
              : 'Marque o bloco onde ocorreu a falha'}
          </Text>
        )}
        {isMYO && !set.isChecked && !anyMYOFailed && (
          <TouchableOpacity style={ex.myoAddBtn} onPress={addMiniBlock} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={14} color="#F472B6" />
            <Text style={ex.myoAddText}>Mini-bloco</Text>
          </TouchableOpacity>
        )}
        {isMYO && anyMYOFailed && (
          <Text style={ex.myoFailHint}>Falha marcada — confirme a série</Text>
        )}
      </View>
    </Animated.View>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

type ExerciseCardProps = {
  exercise: ExecutionExerciseRecord
  reference?: ExerciseReference
  onSetChecked: (execExId: string, setId: string, reps: number | null, weight: number | null, cfg: TechniqueConfig | null) => void
  onAddSet: (execExId: string) => void
  onRemoveSet: (execExId: string, setId: string) => void
  onRemoveExercise: (execExId: string) => void
  onUpdateNotes: (execExId: string, notes: string) => void
  onTechniqueTap: (execExId: string, setId: string) => void
}

// A set with no technique is a normal set. Treat null/undefined/'' as 'NONE' so a
// missing technique is never mistaken for an advanced technique or an invalid set.
function normTechnique(t: PlannedSetTechnique | null | undefined): PlannedSetTechnique {
  return t ?? 'NONE'
}

// Techniques that need block-level expansion (mirrors WorkoutDetailScreen)
function needsBlockExpansion(t: PlannedSetTechnique | null | undefined) {
  const tech = normTechnique(t)
  return tech === 'REST_PAUSE' || tech === 'CLUSTER_SET' || tech === 'MUSCLE_ROUND' || tech === 'DROP_SET' || tech === 'MYOREP'
}

function ExerciseCard({ exercise, reference, onSetChecked, onAddSet, onRemoveSet, onRemoveExercise, onUpdateNotes, onTechniqueTap }: ExerciseCardProps) {
  const [notes, setNotes] = useState(exercise.exerciseNotes ?? '')
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleNotesChange(val: string) {
    setNotes(val)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => onUpdateNotes(exercise.id, val), 300)
  }

  return (
    <ExerciseCardShell
      gifUrl={exercise.exercise.gifUrl ?? null}
      name={exercise.exercise.name}
      meta={
        <View style={cardMetaStyles.row}>
          <Text style={cardMetaStyles.text}>{exercise.exercise.muscleGroup.toLowerCase()}</Text>
          <Text style={cardMetaStyles.dot}>·</Text>
          <Text style={cardMetaStyles.text}>{exercise.sets.length} {exercise.sets.length === 1 ? 'série' : 'séries'}</Text>
        </View>
      }
      rightSlot={
        <TouchableOpacity
          onPress={() => onRemoveExercise(exercise.id)}
          style={ex.removeExBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={15} color="#3A3A4A" />
        </TouchableOpacity>
      }
    >
      <View style={cardBodyStyles.observationWrap}>
        <TextInput
          style={cardBodyStyles.observationInput}
          value={notes}
          onChangeText={handleNotesChange}
          placeholder="Adicionar observação..."
          placeholderTextColor="#8A8A9A"
          selectionColor="#4FC3F7"
          multiline
        />
      </View>

      {reference && (
        <View style={ex.hintWrap}>
          <ProgressOverloadHint reference={reference} />
        </View>
      )}

      <View style={ex.setsWrap}>
        {exercise.sets.map((set, idx) => (
          <React.Fragment key={set.id}>
            {idx > 0 && <View style={ex.setSeparator} />}
            {needsBlockExpansion(set.technique) ? (
              <TechSetRow
                // Remount in place when the user switches between two advanced
                // techniques (e.g. DROP_SET → REST_PAUSE) so TechSetRow drops the
                // previous technique's stale block state. The key MUST stay unique
                // per set — keying on `set.technique` alone let two sets sharing a
                // technique (or a set toggled back to a repeated value) collide,
                // which made React drop the row and the set disappeared. Prefixing
                // the stable set id keeps the remount while guaranteeing uniqueness.
                key={`${set.id}:${set.technique}`}
                set={set}
                index={idx}
                onChecked={(id, reps, weight, cfg) => onSetChecked(exercise.id, id, reps, weight, cfg)}
                onRemove={() => onRemoveSet(exercise.id, set.id)}
                onTechniqueTap={() => onTechniqueTap(exercise.id, set.id)}
              />
            ) : (
              <SimpleSetRow
                // Stable explicit key so the row slot stays consistently keyed
                // across every setType/technique transition. Without it, this
                // branch was unkeyed while the TechSetRow branch is keyed by
                // `${id}:${technique}`; returning a set to WORKING reconciled the
                // slot by index against the prior explicit key and dropped the
                // working row. The `:simple` suffix keeps it distinct from the
                // technique keys so advanced→WORKING still cleanly swaps.
                key={`${set.id}:simple`}
                set={set}
                index={idx}
                restSeconds={null}
                onChecked={(id, reps, weight, cfg) => onSetChecked(exercise.id, id, reps, weight, cfg)}
                onRestEnd={() => {}}
                onRemove={() => onRemoveSet(exercise.id, set.id)}
                onTechniqueTap={() => onTechniqueTap(exercise.id, set.id)}
              />
            )}
          </React.Fragment>
        ))}

        <TouchableOpacity style={cardBodyStyles.addSetBtn} onPress={() => onAddSet(exercise.id)} activeOpacity={0.75}>
          <Ionicons name="add-circle-outline" size={14} color="#8A8A9A" />
          <Text style={cardBodyStyles.addSetText}>Adicionar série</Text>
        </TouchableOpacity>
      </View>
    </ExerciseCardShell>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function WorkoutExecutionScreen() {
  const navigation = useNavigation<NavProp>()
  const route = useRoute<RouteProps>()
  const { workoutId, resumeSessionId } = route.params

  const insets = useSafeAreaInsets()
  const store = useSessionStore()
  const [isLoading, setIsLoading] = useState(true)
  const [cancelModal, setCancelModal] = useState(false)
  const [finishModal, setFinishModal] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [techniquePicker, setTechniquePicker] = useState<{
    visible: boolean; execExId: string | null; setId: string | null
  }>({ visible: false, execExId: null, setId: null })
  const [references, setReferences] = useState<Record<string, ExerciseReference>>({})
  const [barRestRemaining, setBarRestRemaining] = useState(0)
  const [restPickerVisible, setRestPickerVisible] = useState(false)
  const [restTimerTipVisible, setRestTimerTipVisible] = useState(false)
  const [customRestInput, setCustomRestInput] = useState('')
  const barRestRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tipSeenRef = useRef(false)

  const session = store.session
  const sessionId = store.sessionId

  const currentExecSet = (() => {
    if (!techniquePicker.execExId || !techniquePicker.setId) return null
    const ex = session?.exercises.find(e => e.id === techniquePicker.execExId)
    return ex?.sets.find(s => s.id === techniquePicker.setId) ?? null
  })()

  useEffect(() => {
    SecureStore.getItemAsync(REST_TIMER_TIP_KEY).then(val => {
      tipSeenRef.current = val === 'true'
    })
    return () => { if (barRestRef.current) clearInterval(barRestRef.current) }
  }, [])

  function dismissRestTimerTip(dontShowAgain: boolean) {
    if (dontShowAgain) {
      tipSeenRef.current = true
      SecureStore.setItemAsync(REST_TIMER_TIP_KEY, 'true')
    }
    setRestTimerTipVisible(false)
  }

  function startBarRest(seconds: number) {
    if (barRestRef.current) clearInterval(barRestRef.current)
    setBarRestRemaining(seconds)
    barRestRef.current = setInterval(() => {
      setBarRestRemaining(prev => {
        if (prev <= 1) {
          clearInterval(barRestRef.current!)
          barRestRef.current = null
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function cancelBarRest() {
    if (barRestRef.current) { clearInterval(barRestRef.current); barRestRef.current = null }
    setBarRestRemaining(0)
  }

  useEffect(() => {
    async function init() {
      try {
        if (store.isActive && store.session) {
          const sessionMatchesRoute = resumeSessionId
            ? store.session.id === resumeSessionId
            : workoutId
              ? store.session.workoutId === workoutId
              : store.session.isFreeWorkout
          if (sessionMatchesRoute) {
            setIsLoading(false)
            store.startTimer()
            return
          }
          // Active session is for a different workout — discard and start fresh
          store.clearSession()
        }
        // Returning from the post screen ("Back to workout"): rehydrate the
        // existing TrainingLog as the editable session — never start a new one.
        if (resumeSessionId) {
          const res = await api.sessions.get(resumeSessionId)
          store.setSession(res.data.session)
          store.startTimer()
          return
        }
        const res = await api.sessions.start(workoutId ? { workoutId } : {})
        store.setSession(res.data.session)
        store.startTimer()
      } catch {
        showToast('Erro ao iniciar treino')
        navigation.goBack()
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  // Progressive-overload references — previous performance per exercise, computed
  // by the backend against sessions finished before this one started. Loaded once
  // the session id is known so the hints reflect history, never current sets.
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    api.sessions.references(sessionId)
      .then(res => { if (!cancelled) setReferences(res.data.references) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [sessionId])

  async function handleSetChecked(execExId: string, setId: string, reps: number | null, weight: number | null, cfg: TechniqueConfig | null) {
    if (!sessionId) return
    const set = session?.exercises.find(e => e.id === execExId)?.sets.find(s => s.id === setId)
    if (!set) return
    const wasChecked = set.isChecked
    store.updateSet(execExId, setId, { isChecked: !wasChecked, repsCompleted: reps, weightKg: weight })
    try {
      const res = await api.sessions.updateSet(sessionId, setId, {
        isChecked: !wasChecked, repsCompleted: reps, weightKg: weight, techniqueConfig: cfg,
      })
      // The backend is the sole authority on PRs (historical comparison only).
      // Mirror its verdict locally; never infer a PR from current-session state.
      store.updateSet(execExId, setId, {
        isPersonalRecord: res.data.isPR,
        prTypes: res.data.isPR ? res.data.prTypes : undefined,
      })
      if (!wasChecked && res.data.isPR) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } catch {
      store.updateSet(execExId, setId, { isChecked: wasChecked })
      showToast('Erro ao salvar série')
    }
  }

  async function handleSetTechniqueChange(execExId: string, setId: string, sel: TechniqueSelection) {
    if (!sessionId) return
    // Snapshot the exact prior state so a failed save can be restored precisely.
    // The set is always updated IN PLACE — never added or removed — so a WORKING
    // set reset to technique NONE stays in the list like any other set.
    const prev = session?.exercises.find(e => e.id === execExId)?.sets.find(s => s.id === setId)
    if (!prev) return
    const prevState: Pick<ExecutionSetLogRecord, 'setType' | 'technique' | 'techniqueConfig'> = {
      setType: prev.setType,
      technique: prev.technique,
      techniqueConfig: prev.techniqueConfig,
    }
    store.updateSet(execExId, setId, {
      setType: sel.setType,
      technique: sel.technique,
      techniqueConfig: sel.config,
    })
    try {
      await api.sessions.updateSet(sessionId, setId, {
        setType: sel.setType,
        technique: sel.technique,
        techniqueConfig: sel.config,
      })
    } catch {
      // Restore the precise previous state instead of force-resetting to
      // WORKING/NONE, which could corrupt a warmup/feeder set or leave a stale
      // techniqueConfig behind.
      store.updateSet(execExId, setId, prevState)
      showToast('Erro ao atualizar técnica')
    }
  }

  async function handleAddSet(execExId: string) {
    if (!sessionId) return
    try {
      const res = await api.sessions.addSet(sessionId, execExId)
      store.addSet(execExId, res.data.set)
    } catch {
      showToast('Erro ao adicionar série')
    }
  }

  async function handleRemoveSet(execExId: string, setId: string) {
    if (!sessionId) return
    store.removeSet(execExId, setId)
    try {
      await api.sessions.removeSet(sessionId, setId)
    } catch {
      showToast('Erro ao remover série')
    }
  }

  async function handleAddExercise(exerciseId: string) {
    if (!sessionId) return
    try {
      const res = await api.sessions.addExercise(sessionId, { exerciseId, setCount: 0 })
      store.addExercise(res.data.exercise)
    } catch {
      showToast('Erro ao adicionar exercício')
    }
  }

  async function handleRemoveExercise(execExId: string) {
    if (!sessionId) return
    store.removeExercise(execExId)
    try {
      await api.sessions.removeExercise(sessionId, execExId)
    } catch {
      showToast('Erro ao remover exercício')
    }
  }

  async function handleUpdateNotes(execExId: string, notes: string) {
    if (!sessionId) return
    store.updateExerciseNotes(execExId, notes || null)
    try {
      await api.sessions.updateExerciseNotes(sessionId, execExId, notes)
    } catch {}
  }

  async function handleCancel() {
    if (!sessionId) { store.clearSession(); navigation.goBack(); return }
    try {
      await api.sessions.cancel(sessionId)
    } catch {}
    store.clearSession()
    navigation.goBack()
  }

  async function handleFinish(applyChanges: boolean) {
    if (!sessionId) return
    setFinishModal(false)
    try {
      const res = await api.sessions.finish(sessionId, applyChanges)
      store.stopTimer()
      const finishedSession = res.data.session
      store.clearSession()
      navigation.replace('WorkoutPost', {
        sessionId: finishedSession.id,
        workoutName: finishedSession.workoutName ?? 'Treino Livre',
        durationMin: finishedSession.durationMin ?? 0,
        totalSets: finishedSession.totalSets ?? 0,
        totalValidSets: finishedSession.totalValidSets ?? 0,
        totalVolume: finishedSession.totalVolume ?? 0,
        exercises: finishedSession.exercises,
      })
    } catch {
      showToast('Erro ao finalizar treino')
    }
  }

  function onFinalizarPress() {
    if (session?.hasChanges && session?.workoutId) {
      setFinishModal(true)
    } else {
      handleFinish(false)
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color="#4FC3F7" size="large" />
          <Text style={s.loadingText}>Iniciando treino...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const exercises = session?.exercises ?? []

  const analyticsData = (() => {
    let totalVolume = 0
    let validSetsCount = 0
    const perExercise = exercises.map(ex => {
      let exVolume = 0
      let exValidSets = 0
      for (const set of ex.sets) {
        if (set.isChecked) {
          exVolume += (set.repsCompleted ?? 0) * (set.weightKg ?? 0)
          if (set.setType === 'WORKING') exValidSets++
        }
      }
      totalVolume += exVolume
      validSetsCount += exValidSets
      return { id: ex.id, name: ex.exercise.name, muscleGroup: ex.exercise.muscleGroup, volume: exVolume, validSets: exValidSets }
    }).filter(e => e.volume > 0 || e.validSets > 0)
    return { totalVolume, validSetsCount, perExercise }
  })()

  const totalSets = exercises.reduce((acc, e) => acc + e.sets.length, 0)
  const checkedSets = exercises.reduce((acc, e) => acc + e.sets.filter(s => s.isChecked).length, 0)
  const progress = totalSets > 0 ? checkedSets / totalSets : 0

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerWrap}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setCancelModal(true)} style={s.headerSideBtn}>
            <Ionicons name="close" size={22} color="#8A8A9A" />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>
            {session?.workoutName ?? 'Treino Livre'}
          </Text>
          <TouchableOpacity onPress={() => setAnalyticsOpen(true)} style={s.headerSideBtn}>
            <Ionicons name="stats-chart-outline" size={20} color="#8A8A9A" />
          </TouchableOpacity>
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
        scrollEventThrottle={16}
      >
        {exercises.length === 0 && (
          <View style={s.emptyWrap}>
            <Ionicons name="barbell-outline" size={48} color="#2A2A35" />
            <Text style={s.emptyText}>Adicione um exercício para começar</Text>
          </View>
        )}

        {exercises.map(exercise => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            reference={references[exercise.exerciseId]}
            onSetChecked={handleSetChecked}
            onAddSet={handleAddSet}
            onRemoveSet={handleRemoveSet}
            onRemoveExercise={handleRemoveExercise}
            onUpdateNotes={handleUpdateNotes}
            onTechniqueTap={(execExId, setId) => setTechniquePicker({ visible: true, execExId, setId })}
          />
        ))}

        <TouchableOpacity style={s.addExBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.7}>
          <Ionicons name="add" size={18} color="#8A8A9A" />
          <Text style={s.addExText}>Adicionar exercício</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom control bar */}
      <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={s.barSection}
          onPress={barRestRemaining > 0 ? cancelBarRest : () => {
            if (!tipSeenRef.current) {
              setRestTimerTipVisible(true)
            } else {
              setRestPickerVisible(true)
            }
          }}
          activeOpacity={0.7}
        >
          {barRestRemaining > 0 ? (
            <>
              <Text style={s.barRestCountdown}>
                {String(Math.floor(barRestRemaining / 60)).padStart(2, '0')}:{String(barRestRemaining % 60).padStart(2, '0')}
              </Text>
              <Text style={s.barSubLabel}>pular</Text>
            </>
          ) : (
            <>
              <Ionicons name="timer-outline" size={22} color="#555560" />
              <Text style={s.barSubLabel}>Descanso</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={s.barDivider} />

        <TouchableOpacity
          style={[s.barSection, { flex: 1.3 }]}
          onPress={() => store.isPaused ? store.resumeTimer() : store.pauseTimer()}
          activeOpacity={0.7}
        >
          <Text style={[s.barTimerText, store.isPaused && { color: '#555560' }]}>
            {formatElapsed(store.elapsedSeconds)}
          </Text>
          <View style={s.barTimerRow}>
            <Ionicons name={store.isPaused ? 'play-outline' : 'pause-outline'} size={11} color="#555560" />
            <Text style={s.barSubLabel}>{store.isPaused ? 'retomar' : 'pausar'}</Text>
          </View>
        </TouchableOpacity>

        <View style={s.barDivider} />

        <TouchableOpacity onPress={onFinalizarPress} activeOpacity={0.85} style={s.barFinishBtn}>
          <LinearGradient
            colors={['#2979FF', '#1565C0']}
            style={s.barFinishGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
            <Text style={s.barFinishText}>Finalizar</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <Modal visible={analyticsOpen} transparent animationType="fade" onRequestClose={() => setAnalyticsOpen(false)}>
        <View style={s.analyticsOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAnalyticsOpen(false)} />
          <View style={s.analyticsModal}>
            <View style={s.analyticsHeader}>
              <Text style={s.analyticsTitle}>Análise da sessão</Text>
              <TouchableOpacity onPress={() => setAnalyticsOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color="#555560" />
              </TouchableOpacity>
            </View>

            <View style={s.analyticsSummary}>
              <View style={s.analyticsCard}>
                <Text style={s.analyticsCardNum}>{formatVolume(analyticsData.totalVolume)}</Text>
                <Text style={s.analyticsCardUnit}>kg volume total</Text>
              </View>
              <View style={s.analyticsDivider} />
              <View style={s.analyticsCard}>
                <Text style={s.analyticsCardNum}>{analyticsData.validSetsCount}</Text>
                <Text style={s.analyticsCardUnit}>séries válidas</Text>
              </View>
            </View>

            {analyticsData.perExercise.length > 0 ? (
              <ScrollView style={s.analyticsScroll} showsVerticalScrollIndicator={false}>
                {analyticsData.perExercise.map((e, i) => (
                  <View key={e.id} style={[s.analyticsRow, i === analyticsData.perExercise.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.analyticsExName} numberOfLines={1}>{e.name}</Text>
                      <Text style={s.analyticsExMuscle}>{e.muscleGroup.toLowerCase()}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      {e.volume > 0 && <Text style={s.analyticsExVol}>{formatVolume(e.volume)} kg</Text>}
                      {e.validSets > 0 && (
                        <Text style={s.analyticsExSets}>{e.validSets} {e.validSets === 1 ? 'série' : 'séries'}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={s.analyticsEmpty}>
                <Text style={s.analyticsEmptyText}>Complete séries para ver análise</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={cancelModal} transparent animationType="fade" onRequestClose={() => setCancelModal(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCancelModal(false)} />
          <View style={s.modal}>
            <Text style={s.modalTitle}>Cancelar treino?</Text>
            <Text style={s.modalBody}>Todo o progresso desta sessão será perdido.</Text>
            <TouchableOpacity style={s.modalBtnPrimary} onPress={() => setCancelModal(false)}>
              <Text style={s.modalBtnPrimaryText}>Continuar treinando</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalBtnDanger} onPress={handleCancel}>
              <Text style={s.modalBtnDangerText}>Cancelar treino</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={finishModal} transparent animationType="fade" onRequestClose={() => setFinishModal(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFinishModal(false)} />
          <View style={s.modal}>
            <Text style={s.modalTitle}>Alterações no treino</Text>
            <Text style={s.modalBody}>Você adicionou ou removeu exercícios. Deseja salvar as alterações no programa?</Text>
            <TouchableOpacity style={s.modalBtnPrimary} onPress={() => handleFinish(true)}>
              <Text style={s.modalBtnPrimaryText}>Salvar alterações</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtnPrimary, { backgroundColor: '#2A2A35' }]} onPress={() => handleFinish(false)}>
              <Text style={[s.modalBtnPrimaryText, { color: '#8A8A9A' }]}>Manter original</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={restPickerVisible} transparent animationType="fade" onRequestClose={() => setRestPickerVisible(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRestPickerVisible(false)} />
          <View style={s.modal}>
            <Text style={s.modalTitle}>Tempo de descanso</Text>
            <Text style={s.modalBody}>Defina a duração do seu descanso</Text>
            <View style={s.restInputRow}>
              <TextInput
                style={s.restInput}
                value={customRestInput}
                onChangeText={setCustomRestInput}
                keyboardType="number-pad"
                placeholder="90"
                placeholderTextColor="#3A3A4A"
                selectionColor="#4FC3F7"
                autoFocus
              />
              <Text style={s.restInputUnit}>seg</Text>
            </View>
            <TouchableOpacity
              style={s.modalBtnPrimary}
              onPress={() => {
                const sec = parseInt(customRestInput, 10)
                if (sec > 0) { startBarRest(sec); setRestPickerVisible(false); setCustomRestInput('') }
              }}
            >
              <Text style={s.modalBtnPrimaryText}>Iniciar descanso</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalBtnDanger} onPress={() => setRestPickerVisible(false)}>
              <Text style={s.modalBtnDangerText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={restTimerTipVisible} transparent animationType="fade" onRequestClose={() => dismissRestTimerTip(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => dismissRestTimerTip(false)} />
          <View style={s.modal}>
            <View style={s.restTipIconRow}>
              <Ionicons name="timer-outline" size={32} color="#4FC3F7" />
            </View>
            <Text style={s.modalTitle}>Temporizador de descanso</Text>
            <Text style={s.modalBody}>O timer de descanso é opcional e você controla quando ativá-lo. Após completar uma série, toque em Descanso para iniciar a contagem. Defina a duração que quiser.</Text>
            <TouchableOpacity style={s.modalBtnPrimary} onPress={() => dismissRestTimerTip(false)}>
              <Text style={s.modalBtnPrimaryText}>Entendido</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modalBtnDanger, { backgroundColor: 'transparent' }]}
              onPress={() => dismissRestTimerTip(true)}
            >
              <Text style={[s.modalBtnDangerText, { color: '#555560' }]}>Não mostrar novamente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ExercisePickerModal
        visible={pickerOpen}
        existingExerciseIds={exercises.map(e => e.exerciseId)}
        onSelect={e => handleAddExercise(e.id)}
        onClose={() => setPickerOpen(false)}
      />

      <TechniquePickerSheet
        visible={techniquePicker.visible}
        currentSetType={currentExecSet?.setType ?? 'WORKING'}
        currentTechnique={currentExecSet?.technique ?? 'NONE'}
        currentConfig={currentExecSet?.techniqueConfig ?? null}
        onConfirm={sel => {
          if (techniquePicker.execExId && techniquePicker.setId)
            handleSetTechniqueChange(techniquePicker.execExId, techniquePicker.setId, sel)
        }}
        onClose={() => setTechniquePicker({ visible: false, execExId: null, setId: null })}
      />
    </SafeAreaView>
  )
}

// ─── Screen styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#8A8A9A', fontSize: 14 },

  headerWrap: { borderBottomWidth: 1, borderBottomColor: '#1E1E24' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  headerSideBtn: { width: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, color: '#F0F0F5', fontSize: 17, fontWeight: '500', textAlign: 'center' },
  progressTrack: { height: 2, backgroundColor: '#2A2A35' },
  progressFill: { height: 2, backgroundColor: '#4FC3F7' },

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E1E24',
    backgroundColor: '#141418',
    gap: 6,
  },
  barSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  barDivider: { width: 1, height: 34, backgroundColor: '#252530' },
  barRestCountdown: { color: '#4FC3F7', fontSize: 22, fontFamily: 'monospace', fontWeight: '600' },
  barTimerText: { color: '#F0F0F5', fontSize: 22, fontFamily: 'monospace', fontWeight: '600' },
  barTimerRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  barSubLabel: { color: '#555560', fontSize: 10 },
  barFinishBtn: { flex: 1.4, borderRadius: 12, overflow: 'hidden' },
  barFinishGrad: { height: 54, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 },
  barFinishText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  scroll: { paddingBottom: 16, paddingTop: 8, gap: 8, paddingHorizontal: 12 },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#555560', fontSize: 14, textAlign: 'center' },

  addExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 2, paddingVertical: 14,
    borderWidth: 1, borderColor: '#252530', borderStyle: 'dashed', borderRadius: 14,
  },
  addExText: { color: '#8A8A9A', fontSize: 14, fontWeight: '500' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modal: { backgroundColor: '#1E1E24', borderRadius: 20, width: '100%', padding: 24, gap: 10 },
  modalTitle: { color: '#F0F0F5', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  modalBody: { color: '#8A8A9A', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  modalBtnPrimary: { height: 48, borderRadius: 14, backgroundColor: '#2979FF', justifyContent: 'center', alignItems: 'center' },
  modalBtnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  // Secondary/destructive/cancel action — neutral gray, sits below the blue primary
  modalBtnDanger: { height: 48, borderRadius: 14, backgroundColor: '#2A2A35', justifyContent: 'center', alignItems: 'center' },
  modalBtnDangerText: { color: '#8A8A9A', fontSize: 15, fontWeight: '600' },

  restInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginVertical: 4 },
  restInput: {
    width: 100,
    height: 52,
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#252530',
    borderRadius: 12,
    color: '#F0F0F5',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  restInputUnit: { color: '#8A8A9A', fontSize: 15 },
  restTipIconRow: { alignItems: 'center', marginBottom: 4 },

  analyticsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', paddingHorizontal: 20 },
  analyticsModal: {
    backgroundColor: '#1A1A22',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#252530',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    maxHeight: '78%',
  },
  analyticsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  analyticsTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '600' },
  analyticsSummary: {
    flexDirection: 'row',
    backgroundColor: '#141418',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#252530',
  },
  analyticsCard: { flex: 1, alignItems: 'center', gap: 4 },
  analyticsCardNum: { color: '#4FC3F7', fontSize: 30, fontWeight: '700', fontFamily: 'monospace' },
  analyticsCardUnit: { color: '#8A8A9A', fontSize: 11 },
  analyticsDivider: { width: 1, backgroundColor: '#252530', marginHorizontal: 8 },
  analyticsScroll: { maxHeight: 300 },
  analyticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E28',
    gap: 12,
  },
  analyticsExName: { color: '#F0F0F5', fontSize: 14, fontWeight: '500' },
  analyticsExMuscle: { color: '#555560', fontSize: 11, textTransform: 'capitalize', marginTop: 2 },
  analyticsExVol: { color: '#4FC3F7', fontSize: 14, fontWeight: '600' },
  analyticsExSets: { color: '#8A8A9A', fontSize: 11 },
  analyticsEmpty: { paddingVertical: 40, alignItems: 'center' },
  analyticsEmptyText: { color: '#555560', fontSize: 14 },
})

// ─── Exercise card styles ──────────────────────────────────────────────────────

const ex = StyleSheet.create({
  removeExBtn: {
    width: 30,
    height: CARD_IMG_SIZE + 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  setsWrap: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 12,
  },

  // Progressive-overload hint row — subtle, under the observation, above sets
  hintWrap: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 4,
  },

  // PR ribbon — gold trophy + label above a record-breaking set's inputs
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  prRowText: { color: '#FFC14A', fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },

  setRowOuter: {
    borderRadius: 10,
    overflow: 'hidden',
    paddingTop: 10,
    paddingBottom: 6,
  },

  // Thin separator rendered between consecutive set rows
  setSeparator: {
    height: 1,
    backgroundColor: '#1E1E2C',
    marginHorizontal: 4,
    marginVertical: 3,
  },

  // Input row
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    gap: 8,
    paddingHorizontal: 6,
  },
  // Inputs group — fills space between badge and action buttons
  inputsGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  nonVolLabel: { color: '#3A3A4A', fontSize: 9, flexShrink: 0 },
  nonVolNote: { color: '#3A3A4A', fontSize: 9, marginLeft: 46, marginTop: 0, marginBottom: 2 },
  removeSetBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  dropConnector: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  dropConnectorLine: { flex: 1, height: 1, backgroundColor: 'rgba(239,68,68,0.3)' },
  dropConnectorLabel: { color: '#EF4444', fontSize: 10, marginHorizontal: 6 },

  // MYOREP — activation + mini-block styles
  blockRowMYOActivation: { borderLeftColor: 'rgba(244,114,182,0.45)' },
  blockRowMYOMini: { borderLeftColor: 'rgba(244,114,182,0.22)' },
  blockLabelMYO: { color: '#F472B6' },
  failDotMYO: {
    borderColor: 'rgba(244,114,182,0.4)',
  },
  failDotMYOActive: { backgroundColor: '#F472B6', borderColor: '#F472B6' },
  myoAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 6, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(244,114,182,0.3)', borderStyle: 'dashed', borderRadius: 8,
  },
  myoAddText: { color: '#F472B6', fontSize: 12, fontWeight: '500' },
  myoFailHint: { color: '#F472B6', fontSize: 10, marginTop: 6, textAlign: 'center', opacity: 0.7 },

  // DROP_SET — weight + reps share the standard block row layout
  blockRowDS: { borderLeftColor: 'rgba(239,68,68,0.4)' },
  dsBlockArrow: { color: 'rgba(239,68,68,0.45)', fontSize: 10, marginRight: 2 },

  // Technique set
  techSetWrap: {
    borderLeftWidth: 2,
    marginLeft: 2,
    paddingLeft: 6,
    paddingTop: 10,
    paddingBottom: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },
  techSetNum: {
    color: '#555560',
    fontSize: 12,
  },

  // Block expansion — indented to align with content after badge (paddingLeft:6 + paddingHorizontal:6 + badge:34 + gap:8 = 54; marginLeft from techSetWrap content = 44 aligns just past badge edge)
  techBlocks: {
    marginTop: 6,
    marginLeft: 44,
    marginBottom: 6,
  },
  blockSep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  blockSepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  blockSepLabel: { color: '#555560', fontSize: 10, marginHorizontal: 6 },
  blockSepThin: { height: 3 },
  blockRow: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blockLabel: { color: '#555560', fontSize: 11, flex: 1 },
  // Block state — subtle left-rail indicator only, never a strong fill
  blockRowFailed: { borderLeftColor: 'rgba(255,82,82,0.5)' },
  blockRowDrop: { borderLeftColor: 'rgba(123,97,255,0.45)' },
  blockLabelDrop: { color: '#A78BFA' },
  mrDropIndicator: { color: '#7B61FF', fontSize: 10, marginRight: -2 },

  // Muscle round fail indicator
  failDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#333344',
    justifyContent: 'center',
    alignItems: 'center',
  },
  failDotActive: { backgroundColor: '#FF5252', borderColor: '#FF5252' },
  mrHint: { color: '#555560', fontSize: 10, marginTop: 6, textAlign: 'center' },

  // MUSCLE_ROUND two-weight row (principal + queda) — same indent as techBlocks
  mrWeightsRow: {
    flexDirection: 'row',
    marginLeft: 44,
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  mrWeightCol: { flex: 1, gap: 4 },
  mrWeightLabel: {
    color: '#8A8A9A',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Technique summary row — below header, above blocks
  techSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  techSummaryAccent: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.8,
    flexShrink: 0,
  },
  techSummaryText: {
    fontSize: 11,
    letterSpacing: 0.2,
    flex: 1,
    opacity: 0.8,
  },
})
