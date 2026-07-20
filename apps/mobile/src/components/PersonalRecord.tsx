import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated'
import type { PRType, ExerciseReference } from '../lib/api'

// Premium gold palette for PR feedback — distinct from the green completion state
// and the cyan/blue brand, reserved exclusively for personal records.
const GOLD = '#FFC14A'
const GOLD_DEEP = '#FFB300'

const PR_TYPE_LABELS: Record<PRType, string> = {
  MAX_WEIGHT: 'Maior carga',
  MAX_VOLUME: 'Maior volume',
  BEST_1RM: 'Melhor 1RM estimado',
  BEST_WEIGHT_FOR_REPS: 'Melhor carga nas reps',
}

const PR_TYPE_ORDER: PRType[] = ['MAX_WEIGHT', 'BEST_1RM', 'MAX_VOLUME', 'BEST_WEIGHT_FOR_REPS']

function sortTypes(types: PRType[]): PRType[] {
  return [...types].sort((a, b) => PR_TYPE_ORDER.indexOf(a) - PR_TYPE_ORDER.indexOf(b))
}

function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

// ─── PR trophy badge ────────────────────────────────────────────────────────────
// Small gold trophy that springs in when a set is confirmed as a PR. Tapping it
// opens a compact modal listing every PR type the set beat. One clean indicator
// regardless of how many record types were broken.

export function PRBadge({ prTypes }: { prTypes?: PRType[] }) {
  const [open, setOpen] = useState(false)
  const scale = useSharedValue(0)
  const opacity = useSharedValue(0)

  useEffect(() => {
    // subtle dopamine pop — spring scale + fade, ~300ms, no childish bounce
    scale.value = withSpring(1, { damping: 12, stiffness: 180, mass: 0.6 })
    opacity.value = withTiming(1, { duration: 200 })
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  const types = sortTypes(prTypes ?? [])

  return (
    <>
      <Reanimated.View style={animStyle}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <LinearGradient
            colors={[GOLD, GOLD_DEEP]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.badge}
          >
            <Ionicons name="trophy" size={10} color="#1A1208" />
            <Text style={st.badgeText}>PR</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Reanimated.View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={st.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={st.modal}>
            <View style={st.modalIconWrap}>
              <LinearGradient colors={[GOLD, GOLD_DEEP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.modalIcon}>
                <Ionicons name="trophy" size={26} color="#1A1208" />
              </LinearGradient>
            </View>
            <Text style={st.modalTitle}>
              {types.length > 1 ? 'Novos recordes pessoais' : 'Novo recorde pessoal'}
            </Text>
            <Text style={st.modalSub}>Esta série superou seu histórico anterior.</Text>
            <View style={st.typeList}>
              {types.length > 0 ? (
                types.map((t) => (
                  <View key={t} style={st.typeRow}>
                    <Ionicons name="trophy-outline" size={13} color={GOLD} />
                    <Text style={st.typeText}>{PR_TYPE_LABELS[t]}</Text>
                  </View>
                ))
              ) : (
                <View style={st.typeRow}>
                  <Ionicons name="trophy-outline" size={13} color={GOLD} />
                  <Text style={st.typeText}>Recorde pessoal registrado</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={st.closeBtn} onPress={() => setOpen(false)} activeOpacity={0.85}>
              <Text style={st.closeText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

// ─── Progressive overload hint ───────────────────────────────────────────────────
// Subtle reference line shown under an exercise header: what to beat this session.
// Uses only backend historical data. Shows nothing loud when there is no history.

export function ProgressOverloadHint({ reference }: { reference?: ExerciseReference }) {
  if (!reference) return null

  if (!reference.hasHistory) {
    return (
      <View style={st.hintRow}>
        <Ionicons name="sparkles-outline" size={11} color="#555560" />
        <Text style={st.hintNeutral}>Primeira sessão registrada</Text>
      </View>
    )
  }

  const last = reference.lastSet
  const best = reference.bestSet

  return (
    <View style={st.hintRow}>
      <Ionicons name="trending-up" size={11} color={GOLD} />
      <View style={st.hintChips}>
        {last && (
          <Text style={st.hintText}>
            <Text style={st.hintLabel}>Última: </Text>
            {fmt(last.weightKg)}kg × {last.reps}
          </Text>
        )}
        {best && (
          <Text style={st.hintText}>
            <Text style={st.hintLabel}>Recorde: </Text>
            {fmt(best.weightKg)}kg × {best.reps}
          </Text>
        )}
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: { color: '#1A1208', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modal: { backgroundColor: '#1E1E24', borderRadius: 20, width: '100%', padding: 24, gap: 8, alignItems: 'center' },
  modalIconWrap: { marginBottom: 4 },
  modalIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { color: '#F0F0F5', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  modalSub: { color: '#8A8A9A', fontSize: 13, textAlign: 'center', marginBottom: 6 },
  typeList: { alignSelf: 'stretch', gap: 8, marginBottom: 6 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,193,74,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,193,74,0.18)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  typeText: { color: '#F0F0F5', fontSize: 13, fontWeight: '500' },
  closeBtn: { alignSelf: 'stretch', height: 46, borderRadius: 14, backgroundColor: '#2A2A35', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  closeText: { color: '#F0F0F5', fontSize: 14, fontWeight: '600' },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  hintChips: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap', flex: 1 },
  hintText: { color: '#9A9AA8', fontSize: 11 },
  hintLabel: { color: '#555560', fontSize: 11 },
  hintNeutral: { color: '#555560', fontSize: 11, fontStyle: 'italic' },
})
