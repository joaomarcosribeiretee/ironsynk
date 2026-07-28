import React from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { DietGoal } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { MacroSummary } from '../../components/MacroSummary'
import { ReadonlyMealCard } from '../../components/ReadonlyMealCard'
import { fmt, sumMacros } from '../../lib/nutrition'

type Nav = NativeStackNavigationProp<AppStackParamList>
type Rt = RouteProp<AppStackParamList, 'NutritionPlanView'>

const GOAL_LABELS: Record<DietGoal, string> = {
  BULK: 'Bulk',
  CUT: 'Cutting',
  MAINTENANCE: 'Manutenção',
  RECOMP: 'Recomp',
  HEALTH: 'Saúde',
}

// Read-only nutrition plan view — the nutrition analog of WorkoutViewScreen.
// Browsing only: no editing, no meal check-off, no reordering.
export function NutritionPlanViewScreen() {
  const navigation = useNavigation<Nav>()
  const { planId, planName } = useRoute<Rt>().params

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['nutrition-plan', planId],
    queryFn: () => api.nutrition.getPlan(planId),
    staleTime: 30_000,
  })

  const plan = data?.data.plan
  const meals = plan?.meals ?? []
  const planMacros = sumMacros(meals.map(m => m.plannedMacros))
  const foodsCount = meals.reduce((acc, m) => acc + m.foods.length, 0)
  const goalLabel = plan?.goal ? GOAL_LABELS[plan.goal] : null
  // The goal pill is pure repetition when the plan is named after its goal.
  const planTitle = plan?.name ?? planName ?? ''
  const showGoalPill = goalLabel !== null && goalLabel.toLowerCase() !== planTitle.trim().toLowerCase()

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{planTitle}</Text>
        <View style={s.backBtn} />
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color="#4FC3F7" size="large" />
        </View>
      ) : isError ? (
        <View style={s.center}>
          <Text style={s.dim}>Não foi possível carregar o plano.</Text>
          <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}>
            <Text style={s.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Goal / status pills */}
          {(showGoalPill || plan?.isActive) && (
            <View style={s.pillsRow}>
              {showGoalPill && <View style={s.pill}><Text style={s.pillText}>{goalLabel}</Text></View>}
              {plan?.isActive && (
                <View style={s.activeBadge}>
                  <View style={s.activeDot} />
                  <Text style={s.activeText}>ATIVO</Text>
                </View>
              )}
            </View>
          )}

          {/* Notes */}
          {plan?.notes ? (
            <>
              <Text style={s.description} numberOfLines={3}>{plan.notes}</Text>
              <View style={s.divider} />
            </>
          ) : null}

          {/* Overall nutrition summary */}
          <MacroSummary
            consumedCalories={planMacros.calories}
            targetCalories={plan?.targetCalories ?? null}
            consumedProteinG={planMacros.proteinG}
            targetProteinG={plan?.targetProteinG ?? null}
            consumedCarbsG={planMacros.carbsG}
            targetCarbsG={plan?.targetCarbsG ?? null}
            consumedFatG={planMacros.fatG}
            targetFatG={plan?.targetFatG ?? null}
            subdueMacros
          />

          {/* Plan counts — one quiet line instead of competing stat cards. */}
          <Text style={s.statsLine}>
            {meals.length} {meals.length === 1 ? 'refeição' : 'refeições'}
            {'  ·  '}{foodsCount} {foodsCount === 1 ? 'alimento' : 'alimentos'}
            {plan?.targetWaterMl != null ? `  ·  ${fmt(plan.targetWaterMl / 1000)}L de água` : ''}
          </Text>

          {/* Meals */}
          {meals.length > 0 ? (
            <>
              <Text style={s.sectionLabel}>REFEIÇÕES</Text>
              {meals.map((meal, i) => (
                <ReadonlyMealCard key={meal.id} meal={meal} index={i} />
              ))}
            </>
          ) : (
            <View style={s.emptyWrap}>
              <Ionicons name="restaurant-outline" size={48} color="#2A2A35" />
              <Text style={s.emptyTitle}>Nenhuma refeição</Text>
              <Text style={s.emptySub}>Este plano ainda não tem refeições</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 10, gap: 8,
  },
  backBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  headerTitle: { flex: 1, color: '#F0F0F5', fontSize: 20, fontWeight: '500' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  dim: { color: '#8A8A9A', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(41,121,255,0.12)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)',
  },
  retryText: { color: '#4FC3F7', fontSize: 13, fontWeight: '500' },

  scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 48 },

  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  pill: {
    backgroundColor: 'rgba(41,121,255,0.06)', borderWidth: 1, borderColor: 'rgba(41,121,255,0.15)',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  pillText: { color: 'rgba(79,195,247,0.8)', fontSize: 11 },
  // Status marker, not a highlight: dot plus muted label, no chip.
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(0,230,118,0.75)' },
  activeText: { color: 'rgba(0,230,118,0.65)', fontSize: 9, fontWeight: '600', letterSpacing: 0.6 },

  description: { color: '#8A8A9A', fontSize: 14, fontStyle: 'italic', lineHeight: 20, paddingBottom: 14 },
  divider: { height: 1, backgroundColor: '#2A2A35', marginBottom: 16 },

  statsLine: { color: '#8A8A9A', fontSize: 12, marginTop: 12, marginBottom: 24, fontVariant: ['tabular-nums'] },

  sectionLabel: {
    color: '#8A8A9A', fontSize: 11, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 10,
  },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '500', marginTop: 8 },
  emptySub: { color: '#8A8A9A', fontSize: 14 },
})
