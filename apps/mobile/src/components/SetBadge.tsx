import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { SetType, PlannedSetTechnique } from '../lib/api'

export type BadgeTechStyle = {
  borderColor: string
  badgeBg: string
  badgeText: string
  badge: string
  bgColor: string
}

export const TECH_STYLE: Record<string, BadgeTechStyle> = {
  WARMUP:       { borderColor: '#FFB300', badgeBg: '#2A2200', badgeText: '#FFB300', badge: 'W',  bgColor: '#1A1500' },
  FEEDER:       { borderColor: '#4FC3F7', badgeBg: '#002233', badgeText: '#4FC3F7', badge: 'F',  bgColor: '#001A1A' },
  REST_PAUSE:   { borderColor: '#2979FF', badgeBg: '#001A3A', badgeText: '#4FC3F7', badge: 'RP', bgColor: '#001428' },
  MUSCLE_ROUND: { borderColor: '#7B61FF', badgeBg: '#1A1030', badgeText: '#A78BFA', badge: 'MR', bgColor: '#0D0A1E' },
  CLUSTER_SET:  { borderColor: '#00E676', badgeBg: '#002210', badgeText: '#00E676', badge: 'CS', bgColor: '#001A0A' },
  BACK_OFF:     { borderColor: '#F97316', badgeBg: '#2A1400', badgeText: '#F97316', badge: 'BO', bgColor: '#1A0C00' },
  DROP_SET:     { borderColor: '#EF4444', badgeBg: '#2A0A0A', badgeText: '#EF4444', badge: 'DS', bgColor: '#1A0505' },
  MYOREP:       { borderColor: '#F472B6', badgeBg: '#2A0A1E', badgeText: '#F472B6', badge: 'MY', bgColor: '#1C0A15' },
}

export const DEFAULT_TECH_STYLE: BadgeTechStyle = {
  borderColor: '#2A2A35',
  badgeBg: '#2A2A35',
  badgeText: '#8A8A9A',
  badge: '',
  bgColor: '#141418',
}

export function getTechStyle(setType: SetType, technique: PlannedSetTechnique): BadgeTechStyle {
  if (setType === 'WARMUP') return TECH_STYLE['WARMUP']!
  if (setType === 'FEEDER') return TECH_STYLE['FEEDER']!
  if (technique !== 'NONE') return TECH_STYLE[technique] ?? DEFAULT_TECH_STYLE
  return DEFAULT_TECH_STYLE
}

export function getBadgeLabel(setType: SetType, technique: PlannedSetTechnique, index: number): string {
  if (setType === 'WARMUP') return 'W'
  if (setType === 'FEEDER') return 'F'
  if (technique !== 'NONE') return TECH_STYLE[technique]?.badge ?? String(index + 1)
  return String(index + 1)
}

type SetBadgeProps = {
  setType: SetType
  technique: PlannedSetTechnique
  index: number
  onPress?: () => void
}

export function SetBadge({ setType, technique, index, onPress }: SetBadgeProps) {
  const ts = getTechStyle(setType, technique)
  const label = getBadgeLabel(setType, technique, index)

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[bs.badge, { backgroundColor: ts.badgeBg, borderColor: ts.borderColor }]}
      >
        <Text style={[bs.text, { color: ts.badgeText }]}>{label}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={[bs.badge, { backgroundColor: ts.badgeBg, borderColor: ts.borderColor }]}>
      <Text style={[bs.text, { color: ts.badgeText }]}>{label}</Text>
    </View>
  )
}

const bs = StyleSheet.create({
  badge: {
    width: 34,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
  },
})
