import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { ExerciseCardShell, cardMetaStyles } from './ExerciseCardShell'
import { SetBadge, getTechStyle } from './SetBadge'
import { FieldUnit } from './FieldUnit'
import type { PlannedSetRecord, PlannedSetTechnique, TrainingExerciseRecord } from '../lib/api'

const EQUIP_PT: Record<string, string> = {
  barbell: 'Barra', dumbbell: 'Haltere', cable: 'Cabo', machine: 'Máquina',
  bodyweight: 'Peso Corporal', 'body weight': 'Peso Corporal',
  smith: 'Smith', kettlebell: 'Kettlebell', band: 'Elástico', other: 'Outro',
}
const txEquip = (eq: string | null | undefined) => eq ? (EQUIP_PT[eq.toLowerCase()] ?? eq) : '—'

// ─── Technique summary helper ─────────────────────────────────────────────────

function buildViewTechSummary(technique: PlannedSetTechnique, c: Record<string, unknown> | null): string | null {
  if (!c) return null
  switch (technique) {
    case 'REST_PAUSE': {
      const pts = (c['failurePoints'] as number) ?? 3
      const rest = (c['restBetweenSeconds'] as number) ?? 20
      return `${pts} pontos de falha · ${rest}s descanso`
    }
    case 'CLUSTER_SET': {
      const blks = (c['blocks'] as number) ?? 4
      const rpp = c['repsPerBlock'] as number | undefined
      const rest = (c['restBetweenSeconds'] as number) ?? 15
      return `${blks} blocos${rpp ? ` × ${rpp} reps` : ''} · ${rest}s`
    }
    case 'MUSCLE_ROUND': {
      const blks = (c['blocks'] as number) ?? 6
      const rest = (c['restBetweenSeconds'] as number) ?? 35
      const dropKg = c['dropWeightKg'] as number | null | undefined
      return `${blks} blocos · ${rest}s${dropKg != null ? ` · ↓ ${dropKg} kg` : ''}`
    }
    case 'DROP_SET': {
      const dw = c['dropWeights'] as (number | null)[] | undefined
      const drops = (c['drops'] as number) ?? 2
      if (dw && dw.some(w => w != null)) {
        return dw.map(w => (w != null ? `${w} kg` : '—')).join(' → ')
      }
      return `${drops + 1} drops`
    }
    case 'MYOREP': {
      const aReps = (c['activationReps'] as number) ?? 5
      const aRest = (c['activationRestSeconds'] as number) ?? 40
      const rpp = (c['repsPerBlock'] as number) ?? 2
      return `Ativ. ${aReps} reps · ${aRest}s · ${rpp}/bloco`
    }
    default: return null
  }
}

// ─── Read-only set row ────────────────────────────────────────────────────────

function ReadonlySetRow({ set, index }: { set: PlannedSetRecord; index: number }) {
  const ts = getTechStyle(set.setType, set.technique)
  const hasLeftBorder = set.setType === 'WARMUP' || set.setType === 'FEEDER' || set.technique !== 'NONE'
  const c = set.techniqueConfig as Record<string, unknown> | null
  const isAdvanced = set.technique === 'REST_PAUSE' || set.technique === 'CLUSTER_SET' ||
    set.technique === 'MUSCLE_ROUND' || set.technique === 'DROP_SET' || set.technique === 'MYOREP'
  const summaryText = isAdvanced ? buildViewTechSummary(set.technique, c) : null

  const hideReps = set.technique === 'CLUSTER_SET' || set.technique === 'MUSCLE_ROUND' || set.technique === 'REST_PAUSE' || set.technique === 'DROP_SET' || set.technique === 'MYOREP'
  // DROP_SET weights live in the per-drop headers; MYOREP weight shown in main row like CLUSTER_SET
  const hideWeight = set.technique === 'DROP_SET'

  // sub-row counts / config values
  const rpBlocks = set.technique === 'REST_PAUSE' ? Math.max(1, Number(c?.['failurePoints'] ?? 3)) : 0
  const rpRest = set.technique === 'REST_PAUSE' ? Number(c?.['restBetweenSeconds'] ?? 20) : 0
  const csBlocks = set.technique === 'CLUSTER_SET' ? Math.max(2, Number(c?.['blocks'] ?? 4)) : 0
  const csRest   = set.technique === 'CLUSTER_SET' ? Number(c?.['restBetweenSeconds'] ?? 15) : 0
  const mrBlocks = set.technique === 'MUSCLE_ROUND' ? Math.max(4, Number(c?.['blocks'] ?? 6)) : 0
  const mrRest   = set.technique === 'MUSCLE_ROUND' ? Number(c?.['restBetweenSeconds'] ?? 35) : 0
  const mrDropKg = set.technique === 'MUSCLE_ROUND' ? (c?.['dropWeightKg'] as number | null | undefined) ?? null : null
  const dsDrops  = set.technique === 'DROP_SET'     ? Math.max(1, Number(c?.['drops'] ?? 2)) : 0
  const dsWeights = dsDrops > 0 ? (c?.['dropWeights'] as (number | null)[] | undefined) ?? null : null
  const isMYO = set.technique === 'MYOREP'
  const myoActivationReps = isMYO ? Number(c?.['activationReps'] ?? 5) : 0
  const myoActivationRest = isMYO ? Number(c?.['activationRestSeconds'] ?? 40) : 0
  const myoRepsPerBlock   = isMYO ? Number(c?.['repsPerBlock'] ?? 2) : 0
  const myoRestBetween    = isMYO ? Number(c?.['restBetweenSeconds'] ?? 20) : 0

  return (
    <View style={[rv.wrap, hasLeftBorder && { borderLeftWidth: 2, borderLeftColor: ts.borderColor }]}>
      {/* Main row */}
      <View style={rv.main}>
        <SetBadge setType={set.setType} technique={set.technique} index={index} />
        {!hideReps && <Text style={rv.dash}>—</Text>}
        {!hideReps && <FieldUnit unit="reps" style={rv.repsText} />}
        {!hideReps && !hideWeight && <Text style={rv.timesText}>×</Text>}
        {!hideWeight && <Text style={rv.dash}>—</Text>}
        {!hideWeight && <Text style={rv.kgText}>kg</Text>}
        {hideReps && hideWeight && <View style={{ flex: 1 }} />}
      </View>

      {(set.setType === 'WARMUP' || set.setType === 'FEEDER') && (
        <Text style={rv.volumeHint}>Não conta no volume</Text>
      )}

      {summaryText != null && (
        <View style={rv.techSummaryRow}>
          <View style={[rv.techSummaryAccent, { backgroundColor: ts.borderColor }]} />
          <Text style={[rv.techSummaryText, { color: ts.badgeText }]} numberOfLines={1}>{summaryText}</Text>
        </View>
      )}

      {/* REST_PAUSE sub-rows: Série Principal + failure blocks */}
      {rpBlocks > 0 && (
        <View style={rv.subWrap}>
          {Array.from({ length: rpBlocks + 1 }).map((_, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <View style={rv.restSep}>
                  <View style={rv.restSepLine} />
                  <Text style={rv.restSepText}>{rpRest}s</Text>
                  <View style={rv.restSepLine} />
                </View>
              )}
              <View style={rv.subRow}>
                <Text style={rv.subLabel}>{i === 0 ? 'Série Principal' : `Falha ${i}`}</Text>
                <View style={rv.subValue}>
                  <Text style={rv.subDash}>—</Text>
                  <FieldUnit unit="reps" style={rv.subUnit} />
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>
      )}

      {/* CLUSTER_SET sub-rows: blocks with rest separators */}
      {csBlocks > 0 && (
        <View style={rv.subWrap}>
          {Array.from({ length: csBlocks }).map((_, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <View style={rv.restSep}>
                  <View style={rv.restSepLine} />
                  <Text style={rv.restSepText}>{csRest}s</Text>
                  <View style={rv.restSepLine} />
                </View>
              )}
              <View style={rv.subRow}>
                <Text style={rv.subLabel}>Bloco {i + 1}</Text>
                <View style={rv.subValue}>
                  <Text style={rv.subDash}>—</Text>
                  <FieldUnit unit="reps" style={rv.subUnit} />
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>
      )}

      {/* MUSCLE_ROUND sub-rows: drop weight indicator + blocks */}
      {mrBlocks > 0 && (
        <View style={rv.subWrap}>
          <View style={[rv.subRow, rv.mrDropRow]}>
            <Text style={[rv.subLabel, rv.mrDropLabel]}>↓ Queda</Text>
            <Text style={[rv.subDash, rv.mrDropDash]}>
              {mrDropKg != null ? `${mrDropKg} kg` : '—'}
            </Text>
          </View>
          {Array.from({ length: mrBlocks }).map((_, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <View style={rv.restSep}>
                  <View style={rv.restSepLine} />
                  <Text style={rv.restSepText}>{mrRest}s</Text>
                  <View style={rv.restSepLine} />
                </View>
              )}
              <View style={rv.subRow}>
                <Text style={rv.subLabel}>Bloco {i + 1}</Text>
                <View style={rv.subValue}>
                  <Text style={rv.subDash}>—</Text>
                  <FieldUnit unit="reps" style={rv.subUnit} />
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>
      )}

      {/* MYOREP sub-rows — activation + mini-block summary */}
      {isMYO && (
        <View style={rv.subWrap}>
          <View style={[rv.subRow, rv.myoActivationRow]}>
            <Text style={[rv.subLabel, rv.myoLabel]}>→ Ativação</Text>
            <Text style={[rv.subDash, rv.myoValue]}>{myoActivationReps} reps</Text>
          </View>
          <View style={rv.restSep}>
            <View style={[rv.restSepLine, { backgroundColor: 'rgba(244,114,182,0.2)' }]} />
            <Text style={[rv.restSepText, { color: '#F472B6' }]}>{myoActivationRest}s</Text>
            <View style={[rv.restSepLine, { backgroundColor: 'rgba(244,114,182,0.2)' }]} />
          </View>
          <View style={[rv.subRow, rv.myoMiniRow]}>
            <Text style={[rv.subLabel, rv.myoLabel]}>→ Mini-blocos</Text>
            <Text style={[rv.subDash, rv.myoValue]}>{myoRepsPerBlock} reps cada</Text>
          </View>
          <View style={rv.restSep}>
            <View style={[rv.restSepLine, { backgroundColor: 'rgba(244,114,182,0.2)' }]} />
            <Text style={[rv.restSepText, { color: '#F472B6' }]}>{myoRestBetween}s</Text>
            <View style={[rv.restSepLine, { backgroundColor: 'rgba(244,114,182,0.2)' }]} />
          </View>
          <View style={rv.subRow}>
            <Text style={[rv.subLabel, { fontStyle: 'italic', color: '#4A4A5A' }]}>Qtd. definida na execução</Text>
          </View>
        </View>
      )}

      {/* DROP_SET sub-rows — weight + reps share one row, like the other techniques */}
      {dsDrops > 0 && (
        <View style={rv.subWrap}>
          {Array.from({ length: dsDrops + 1 }).map((_, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <View style={rv.dropSep}>
                  <View style={[rv.restSepLine, { backgroundColor: 'rgba(239,68,68,0.2)' }]} />
                  <Text style={rv.dropSepText}>↓ drop</Text>
                  <View style={[rv.restSepLine, { backgroundColor: 'rgba(239,68,68,0.2)' }]} />
                </View>
              )}
              <View style={[rv.subRow, rv.dropBlock]}>
                <View style={rv.dropLeft}>
                  <Text style={rv.dropArrow}>→</Text>
                  <Text style={rv.subLabel}>{i === 0 ? 'Série Principal' : `Drop ${i}`}</Text>
                </View>
                <View style={rv.dropVals}>
                  <View style={rv.subValue}>
                    <Text style={rv.subDash}>{dsWeights?.[i] != null ? String(dsWeights[i]) : '—'}</Text>
                    <FieldUnit unit="kg" style={rv.subUnit} />
                  </View>
                  <View style={rv.subValue}>
                    <Text style={rv.subDash}>—</Text>
                    <FieldUnit unit="reps" style={rv.subUnit} />
                  </View>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  )
}

// ─── Read-only exercise card ──────────────────────────────────────────────────

export function ReadonlyExerciseCard({ te }: { te: TrainingExerciseRecord }) {
  const sets = te.sets
  const validSets = sets.filter((set: PlannedSetRecord) => set.setType === 'WORKING').length

  return (
    <ExerciseCardShell
      gifUrl={te.exercise.gifUrl ?? null}
      name={te.exercise.name}
      meta={
        te.exercise.equipment ? (
          <View style={cardMetaStyles.pill}>
            <Text style={cardMetaStyles.pillText}>{txEquip(te.exercise.equipment)}</Text>
          </View>
        ) : null
      }
      shadowStyle={{ marginBottom: 12 }}
    >
      <View style={cb.cardBody}>
        {sets.length > 0 ? (
          sets.map((set: PlannedSetRecord, i: number) => (
            <ReadonlySetRow key={set.id} set={set} index={i} />
          ))
        ) : (
          Array.from({ length: te.targetSets }).map((_, i) => (
            <View key={i} style={rv.wrap}>
              <View style={rv.main}>
                <SetBadge setType="WORKING" technique="NONE" index={i} />
                <Text style={rv.dash}>—</Text>
                <FieldUnit unit="reps" style={rv.repsText} />
                <Text style={rv.timesText}>×</Text>
                <Text style={rv.dash}>—</Text>
                <Text style={rv.kgText}>kg</Text>
              </View>
            </View>
          ))
        )}

        {!!te.notes && (
          <View style={cb.noteRow}>
            <Text style={cb.noteText}>{te.notes}</Text>
          </View>
        )}

        <Text style={cb.cardFooter}>
          {sets.length > 0 ? sets.length : te.targetSets} {((sets.length || te.targetSets) === 1) ? 'série' : 'séries'}
          {sets.length > 0 ? ` · ${validSets} válidas` : ''}
        </Text>
      </View>
    </ExerciseCardShell>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cb = StyleSheet.create({
  cardBody: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 10 },
  cardFooter: { color: '#8A8A9A', fontSize: 12, marginTop: 10 },
  noteRow: {
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: 'rgba(79,195,247,0.06)', borderRadius: 8,
    borderLeftWidth: 2, borderLeftColor: 'rgba(79,195,247,0.4)',
  },
  noteText: { color: '#8A8A9A', fontSize: 12, fontStyle: 'italic', lineHeight: 17 },
})

const rv = StyleSheet.create({
  wrap: {
    borderRadius: 10, marginBottom: 6, overflow: 'hidden',
    paddingVertical: 8, paddingHorizontal: 10,
  },
  main: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dash: {
    flex: 1, height: 40,
    backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 10, textAlign: 'center', textAlignVertical: 'center',
    color: '#444455', fontSize: 16, fontWeight: '500',
  },
  timesText: { width: 14, textAlign: 'center', color: '#2A2A35', fontSize: 13 },
  kgText: { width: 18, color: '#555560', fontSize: 11 },
  repsText: { color: '#555560', fontSize: 11 },
  volumeHint: { color: '#8A8A9A', fontSize: 10, marginTop: 3, marginLeft: 42 },

  techSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 3,
    paddingBottom: 4,
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
    opacity: 0.75,
  },

  subWrap: { marginTop: 6, marginLeft: 42, gap: 4 },
  subRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  subLabel: { color: '#8A8A9A', fontSize: 12 },
  subValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subDash: { color: '#444455', fontSize: 13 },
  subUnit: { color: '#555560', fontSize: 11 },
  restSep: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  restSepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  restSepText: { color: '#4A4A5A', fontSize: 10, marginHorizontal: 8 },
  mrDropRow: { backgroundColor: 'rgba(123,97,255,0.1)', marginBottom: 2 },
  mrDropLabel: { color: '#A78BFA' },
  mrDropDash: { color: '#A78BFA', fontWeight: '600' },

  // MYOREP
  myoActivationRow: { backgroundColor: 'rgba(244,114,182,0.12)' },
  myoMiniRow: { backgroundColor: 'rgba(244,114,182,0.06)' },
  myoLabel: { color: '#F472B6' },
  myoValue: { color: '#F472B6', fontWeight: '500' },

  // DROP_SET — single row per drop, weight beside reps
  dropSep: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  dropSepText: { color: '#EF4444', fontSize: 10, marginHorizontal: 8, opacity: 0.7 },
  dropLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dropVals: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dropBlock: { backgroundColor: 'rgba(239,68,68,0.08)' },
  dropArrow: { color: 'rgba(239,68,68,0.45)', fontSize: 10, marginRight: 2 },
})
