import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { MACRO_COLORS, fmt, clampPct } from '../lib/nutrition'

type Row = { label: string; color: string; consumed: number; target: number | null; unit: string }

type Props = {
  consumedCalories: number
  targetCalories: number | null
  consumedProteinG: number
  targetProteinG: number | null
  consumedCarbsG: number
  targetCarbsG: number | null
  consumedFatG: number
  targetFatG: number | null
  // Daily-execution mode: adds "how much is left" under every bar so the card
  // answers "what do I still have to eat?" without any mental math.
  showRemaining?: boolean
}

// Remaining amount toward a target. Null target = nothing to count down to.
function remaining(consumed: number, target: number | null): number | null {
  if (target === null || target <= 0) return null
  return Math.max(0, Math.round((target - consumed) * 10) / 10)
}

// Daily macro progress: calories headline + protein/carbs/fat bars.
// consumed vs target, target-agnostic (bars hide the ratio when no target set).
export function MacroSummary(p: Props) {
  const rows: Row[] = [
    { label: 'Proteína', color: MACRO_COLORS.protein, consumed: p.consumedProteinG, target: p.targetProteinG, unit: 'g' },
    { label: 'Carbo', color: MACRO_COLORS.carbs, consumed: p.consumedCarbsG, target: p.targetCarbsG, unit: 'g' },
    { label: 'Gordura', color: MACRO_COLORS.fat, consumed: p.consumedFatG, target: p.targetFatG, unit: 'g' },
  ]

  const calPct = clampPct(p.consumedCalories, p.targetCalories)
  const calLeft = remaining(p.consumedCalories, p.targetCalories)
  const calDone = calLeft === 0

  return (
    <View style={s.card}>
      <View style={s.calRow}>
        <View>
          <Text style={s.calLabel}>CALORIAS</Text>
          <View style={s.calValueRow}>
            <Text style={s.calValue}>{fmt(p.consumedCalories)}</Text>
            <Text style={s.calTarget}>
              {p.targetCalories !== null ? ` / ${fmt(p.targetCalories)} kcal` : ' kcal'}
            </Text>
          </View>
        </View>
        {p.targetCalories !== null && (
          <View style={[s.pctBadge, calDone && s.pctBadgeDone]}>
            <Text style={[s.pctText, { color: calDone ? '#00E676' : MACRO_COLORS.calories }]}>{calPct}%</Text>
          </View>
        )}
      </View>

      {p.targetCalories !== null && (
        <View style={s.calBarTrack}>
          <View style={[s.calBarFill, { width: `${calPct}%` }, calDone && s.barFillDone]} />
        </View>
      )}

      {p.showRemaining === true && calLeft !== null && (
        <Text style={[s.remaining, s.remainingCal, calDone && s.remainingDone]}>
          {calDone ? 'Meta de calorias atingida' : `Faltam ${fmt(calLeft)} kcal`}
        </Text>
      )}

      <View style={s.macroRow}>
        {rows.map((r) => {
          const pct = clampPct(r.consumed, r.target)
          const left = remaining(r.consumed, r.target)
          return (
            <View key={r.label} style={s.macroCol}>
              <Text style={s.macroLabel}>{r.label}</Text>
              <Text style={s.macroValue}>
                {fmt(r.consumed)}
                <Text style={s.macroTarget}>{r.target !== null ? `/${fmt(r.target)}${r.unit}` : r.unit}</Text>
              </Text>
              <View style={s.macroTrack}>
                <View style={[s.macroFill, { width: `${r.target !== null ? pct : 0}%`, backgroundColor: r.color }]} />
              </View>
              {p.showRemaining === true && left !== null && (
                <Text style={[s.remaining, left === 0 && s.remainingDone]}>
                  {left === 0 ? 'completo' : `faltam ${fmt(left)}${r.unit}`}
                </Text>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A35',
    padding: 16,
  },
  calRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calLabel: { color: '#8A8A9A', fontSize: 11, fontWeight: '500', letterSpacing: 1.2 },
  calValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  calValue: { color: '#F0F0F5', fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  calTarget: { color: '#8A8A9A', fontSize: 14, fontWeight: '400', fontVariant: ['tabular-nums'] },
  pctBadge: {
    backgroundColor: 'rgba(79,195,247,0.1)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pctBadgeDone: { backgroundColor: 'rgba(0,230,118,0.12)' },
  pctText: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },

  calBarTrack: { height: 6, borderRadius: 3, backgroundColor: '#141418', marginTop: 12, overflow: 'hidden' },
  calBarFill: { height: 6, borderRadius: 3, backgroundColor: MACRO_COLORS.calories },
  barFillDone: { backgroundColor: '#00E676' },

  remaining: { color: '#8A8A9A', fontSize: 11, marginTop: 6, fontVariant: ['tabular-nums'] },
  remainingCal: { fontSize: 12 },
  remainingDone: { color: '#00E676' },

  macroRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  macroCol: { flex: 1 },
  macroLabel: { color: '#8A8A9A', fontSize: 11, fontWeight: '500' },
  macroValue: { color: '#F0F0F5', fontSize: 14, fontWeight: '600', marginTop: 3, fontVariant: ['tabular-nums'] },
  macroTarget: { color: '#8A8A9A', fontSize: 11, fontWeight: '400' },
  macroTrack: { height: 4, borderRadius: 2, backgroundColor: '#141418', marginTop: 6, overflow: 'hidden' },
  macroFill: { height: 4, borderRadius: 2 },
})
