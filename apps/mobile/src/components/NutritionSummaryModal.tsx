import React, { useEffect, useRef } from 'react'
import {
  View, Text, Modal, StyleSheet, Animated, Pressable, TouchableOpacity,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { MacrosRecord } from '../lib/api'
import { MACRO_COLORS, fmt } from '../lib/nutrition'

const { width: SCREEN_W } = Dimensions.get('window')

type Props = {
  visible: boolean
  planName: string
  macros: MacrosRecord
  mealsCount: number
  foodsCount: number
  onClose: () => void
}

// Read-only breakdown of a plan: totals only, no action beyond closing it.
// Same centered card as PlanModal/MealModal so the module has one modal shape.
export function NutritionSummaryModal({ visible, planName, macros, mealsCount, foodsCount, onClose }: Props) {
  const scale = useRef(new Animated.Value(0.92)).current

  useEffect(() => {
    if (visible) {
      scale.setValue(0.92)
      Animated.spring(scale, {
        toValue: 1, damping: 20, stiffness: 200, mass: 0.8, useNativeDriver: true,
      }).start()
    }
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <Animated.View style={[s.card, { transform: [{ scale }] }]}>
            <View style={s.cardHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cardTitle}>Resumo nutricional</Text>
                <Text style={s.subtitle} numberOfLines={1}>{planName}</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#8A8A9A" />
              </TouchableOpacity>
            </View>

            <View style={s.calBlock}>
              <Text style={s.calValue}>{fmt(macros.calories)}</Text>
              <Text style={s.calUnit}>kcal planejadas</Text>
            </View>

            <View style={s.divider} />

            <Row label="Proteína" value={`${Math.round(macros.proteinG)}g`} color={MACRO_COLORS.protein} />
            <Row label="Carboidratos" value={`${Math.round(macros.carbsG)}g`} color={MACRO_COLORS.carbs} />
            <Row label="Gorduras" value={`${Math.round(macros.fatG)}g`} color={MACRO_COLORS.fat} />

            <View style={s.divider} />

            <Row label="Refeições" value={String(mealsCount)} />
            <Row label="Alimentos" value={String(foodsCount)} />
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.row}>
      <View style={s.rowLeft}>
        {color && <View style={[s.dot, { backgroundColor: color }]} />}
        <Text style={s.rowLabel}>{label}</Text>
      </View>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: SCREEN_W - 48,
    backgroundColor: '#1E1E24',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A35',
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  cardTitle: { color: '#F0F0F5', fontSize: 18, fontWeight: '500' },
  subtitle: { color: '#8A8A9A', fontSize: 13, marginTop: 3 },

  calBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  calValue: { color: '#F0F0F5', fontSize: 28, fontWeight: '600', fontVariant: ['tabular-nums'] },
  calUnit: { color: '#8A8A9A', fontSize: 13 },

  divider: { height: 1, backgroundColor: '#2A2A35', marginVertical: 14 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  rowLabel: { color: '#8A8A9A', fontSize: 14 },
  rowValue: { color: '#F0F0F5', fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
})
