import React, { useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { PlanMeal, MealFoodRecord } from '../lib/api'
import { MACRO_COLORS, fmt } from '../lib/nutrition'

type Props = {
  meal: PlanMeal
  index: number
}

// Read-only meal card — nutrition analog of ReadonlyExerciseCard.
// Expanding is the only interaction: nothing here mutates the plan.
export function ReadonlyMealCard({ meal, index }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [contentH, setContentH] = useState(0)

  const progress = useRef(new Animated.Value(0)).current
  const chevronRotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] })
  const containerHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [0, contentH] })
  const contentOpacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] })

  function toggle() {
    Animated.spring(progress, {
      toValue: isOpen ? 0 : 1, damping: 20, stiffness: 200, mass: 0.8, useNativeDriver: false,
    }).start()
    setIsOpen(v => !v)
  }

  const m = meal.plannedMacros
  const foods = meal.foods
  const timeLabel = meal.targetTimeHour != null ? `${String(meal.targetTimeHour).padStart(2, '0')}:00` : null

  return (
    <View style={s.shadow}>
      <View style={s.card}>
        <TouchableOpacity style={s.header} onPress={toggle} activeOpacity={0.7}>
          <View style={s.orderBox}>
            <Text style={s.orderText}>{index + 1}</Text>
          </View>

          <View style={s.info}>
            <View style={s.nameRow}>
              <Text style={s.mealName} numberOfLines={1}>{meal.name}</Text>
              {timeLabel && <Text style={s.timeText}>{timeLabel}</Text>}
            </View>
            {/* Collapsed state carries calories only — the macro breakdown
                lives in the expanded body. */}
            <Text style={s.kcalLine} numberOfLines={1}>{fmt(m.calories)} kcal</Text>
          </View>

          <Animated.View style={{ transform: [{ rotate: chevronRotate }], flexShrink: 0 }}>
            <Ionicons name="chevron-forward" size={16} color="#4FC3F7" />
          </Animated.View>
        </TouchableOpacity>

        <Animated.View style={{ height: containerHeight, overflow: 'hidden' }}>
          <View style={s.measureWrap} onLayout={e => setContentH(e.nativeEvent.layout.height)}>
            <Animated.View style={[s.body, { opacity: contentOpacity }]}>
              {foods.length === 0 ? (
                <Text style={s.emptyText}>Nenhum alimento nesta refeição</Text>
              ) : (
                foods.map((mf: MealFoodRecord) => (
                  <View key={mf.id} style={s.foodRow}>
                    <View style={s.foodInfo}>
                      <Text style={s.foodName} numberOfLines={1}>{mf.food.name}</Text>
                      {!!mf.food.brand && <Text style={s.foodBrand} numberOfLines={1}>{mf.food.brand}</Text>}
                    </View>
                    <View style={s.foodRight}>
                      <Text style={s.foodQty}>{fmt(mf.quantityG)}g</Text>
                      <Text style={s.foodKcal}>{fmt(mf.macros.calories)} kcal</Text>
                    </View>
                  </View>
                ))
              )}

              <View style={s.footerRow}>
                <Text style={s.footerLabel}>
                  {foods.length} {foods.length === 1 ? 'alimento' : 'alimentos'}
                </Text>
                <Text style={s.footerVals}>
                  <Text style={{ color: MACRO_COLORS.protein }}>P {fmt(m.proteinG)}g</Text>
                  {' · '}<Text style={{ color: MACRO_COLORS.carbs }}>C {fmt(m.carbsG)}g</Text>
                  {' · '}<Text style={{ color: MACRO_COLORS.fat }}>G {fmt(m.fatG)}g</Text>
                </Text>
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  shadow: {
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 3, borderRadius: 16, marginBottom: 12,
  },
  card: {
    backgroundColor: '#1E1E24', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#2A2A35',
  },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: '#23232D',
  },
  orderBox: {
    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
    backgroundColor: 'rgba(79,195,247,0.08)', borderWidth: 1, borderColor: 'rgba(79,195,247,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  orderText: { color: '#4FC3F7', fontSize: 14, fontWeight: '600' },
  info: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealName: { color: '#F0F0F5', fontSize: 14, fontWeight: '600', lineHeight: 18, flexShrink: 1 },
  timeText: { color: '#6A6A7A', fontSize: 10, flexShrink: 0, fontVariant: ['tabular-nums'] },
  kcalLine: { color: '#8A8A9A', fontSize: 12, fontVariant: ['tabular-nums'] },

  measureWrap: { position: 'absolute', left: 0, right: 0, top: 0 },
  body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },

  emptyText: { color: '#4A4A5A', fontSize: 12, fontStyle: 'italic', paddingVertical: 6 },

  foodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1A1A22', borderRadius: 10, borderWidth: 1, borderColor: '#252530',
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6,
  },
  foodInfo: { flex: 1, minWidth: 0 },
  foodName: { color: '#F0F0F5', fontSize: 14, fontWeight: '500' },
  foodBrand: { color: '#8A8A9A', fontSize: 11, marginTop: 2 },
  foodRight: { alignItems: 'flex-end', flexShrink: 0 },
  foodQty: { color: '#F0F0F5', fontSize: 13, fontWeight: '600' },
  foodKcal: { color: '#8A8A9A', fontSize: 11, marginTop: 2 },

  footerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#252530',
  },
  footerLabel: { color: '#8A8A9A', fontSize: 12 },
  footerVals: { color: '#B8B8C4', fontSize: 12 },
})
