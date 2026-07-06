import React, { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { DailyMeal } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import type { AthleteTabParamList } from '../../navigation/AthleteTabNavigator'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { MacroSummary } from '../../components/MacroSummary'
import { MACRO_COLORS, fmt } from '../../lib/nutrition'
import { showToast } from '../../components/Toast'
import { PlanModal } from '../nutrition/PlanModal'
import type { PlanFormData } from '../nutrition/PlanModal'

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<AthleteTabParamList, 'Nutrition'>,
  NativeStackNavigationProp<AppStackParamList>
>

export function NutritionScreen() {
  const navigation = useNavigation<Nav>()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['nutrition-today'],
    queryFn: () => api.nutrition.today(),
    staleTime: 15_000,
  })

  useFocusEffect(useCallback(() => { refetch() }, [refetch]))

  const complete = useMutation({
    mutationFn: (mealId: string) => api.nutrition.completeMeal(mealId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutrition-today'] }),
    onError: () => showToast('Falha ao marcar refeição', 'error'),
  })
  const uncomplete = useMutation({
    mutationFn: (mealId: string) => api.nutrition.uncompleteMeal(mealId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutrition-today'] }),
    onError: () => showToast('Falha ao desmarcar refeição', 'error'),
  })

  const createPlan = useMutation({
    mutationFn: (body: PlanFormData) => api.nutrition.createPlan({
      name: body.name,
      ...(body.goal ? { goal: body.goal } : {}),
      ...(body.targetCalories != null ? { targetCalories: body.targetCalories } : {}),
      ...(body.targetProteinG != null ? { targetProteinG: body.targetProteinG } : {}),
      ...(body.targetCarbsG != null ? { targetCarbsG: body.targetCarbsG } : {}),
      ...(body.targetFatG != null ? { targetFatG: body.targetFatG } : {}),
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['nutrition-today'] })
      qc.invalidateQueries({ queryKey: ['nutrition-plans'] })
      navigation.navigate('NutritionPlanBuilder', { planId: res.data.plan.id })
    },
    onError: () => showToast('Falha ao criar plano', 'error'),
  })

  const exec = data?.data
  const totals = exec?.totals

  function toggleMeal(meal: DailyMeal) {
    if (meal.isCompleted) uncomplete.mutate(meal.mealId)
    else complete.mutate(meal.mealId)
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Dieta</Text>
        <TouchableOpacity onPress={() => navigation.navigate('NutritionPlans')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="albums-outline" size={22} color="#F0F0F5" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollPad}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={refetch} tintColor="#4FC3F7" />}
      >
        {isLoading ? (
          <View style={s.center}><ActivityIndicator color="#4FC3F7" /></View>
        ) : isError ? (
          <View style={s.center}>
            <Text style={s.dim}>Não foi possível carregar sua dieta.</Text>
            <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}><Text style={s.retryText}>Tentar novamente</Text></TouchableOpacity>
          </View>
        ) : !exec?.plan ? (
          // Empty state — no active plan
          <View style={s.empty}>
            <View style={s.emptyIcon}><Ionicons name="nutrition-outline" size={30} color="#4FC3F7" /></View>
            <Text style={s.emptyTitle}>Sem plano ativo</Text>
            <Text style={s.emptySub}>Crie um plano alimentar e acompanhe sua dieta todos os dias.</Text>
            <TouchableOpacity onPress={() => setCreateOpen(true)} activeOpacity={0.85} style={s.emptyBtnWrap}>
              <LinearGradient colors={['#2979FF', '#1565C0']} style={s.emptyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={s.emptyBtnText}>Criar plano</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('NutritionPlans')}>
              <Text style={s.linkText}>Ver meus planos</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('NutritionPlanBuilder', { planId: exec.plan!.id })}>
              <View style={s.planBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={s.planBannerName} numberOfLines={1}>{exec.plan.name}</Text>
                  <Text style={s.planBannerMeta}>
                    {totals?.completedMeals}/{totals?.totalMeals} refeições · {totals?.adherencePercent}% aderência
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#8A8A9A" />
              </View>
            </TouchableOpacity>

            {/* Adherence ring-ish bar */}
            <View style={s.adherenceCard}>
              <View style={s.adherenceTrack}>
                <View style={[s.adherenceFill, { width: `${totals?.adherencePercent ?? 0}%` }]} />
              </View>
              <Text style={s.adherenceLabel}>{totals?.adherencePercent ?? 0}% do dia concluído</Text>
            </View>

            {totals && (
              <View style={{ marginTop: 12 }}>
                <MacroSummary
                  consumedCalories={totals.consumedCalories}
                  targetCalories={totals.targetCalories}
                  consumedProteinG={totals.consumedProteinG}
                  targetProteinG={totals.targetProteinG}
                  consumedCarbsG={totals.consumedCarbsG}
                  targetCarbsG={totals.targetCarbsG}
                  consumedFatG={totals.consumedFatG}
                  targetFatG={totals.targetFatG}
                />
              </View>
            )}

            <Text style={s.sectionLabel}>REFEIÇÕES DE HOJE</Text>

            {exec.meals.length === 0 ? (
              <View style={s.noMeals}>
                <Text style={s.dim}>Este plano ainda não tem refeições.</Text>
                <TouchableOpacity onPress={() => navigation.navigate('NutritionPlanBuilder', { planId: exec.plan!.id })} style={s.retryBtn}>
                  <Text style={s.retryText}>Montar plano</Text>
                </TouchableOpacity>
              </View>
            ) : (
              exec.meals.map((meal) => (
                <MealExecCard
                  key={meal.mealId}
                  meal={meal}
                  busy={(complete.isPending && complete.variables === meal.mealId) || (uncomplete.isPending && uncomplete.variables === meal.mealId)}
                  onToggle={() => toggleMeal(meal)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      <PlanModal visible={createOpen} onClose={() => setCreateOpen(false)} onSave={async (d) => { await createPlan.mutateAsync(d) }} />
    </SafeAreaView>
  )
}

function MealExecCard({ meal, busy, onToggle }: { meal: DailyMeal; busy: boolean; onToggle: () => void }) {
  const done = meal.isCompleted
  const m = meal.plannedMacros
  return (
    <View style={[s.mealCard, done && s.mealCardDone]}>
      <View style={s.mealTop}>
        <TouchableOpacity onPress={onToggle} disabled={busy} activeOpacity={0.7} style={s.checkHit}>
          {busy ? (
            <ActivityIndicator size="small" color="#00E676" />
          ) : done ? (
            <View style={s.checkDone}><Ionicons name="checkmark" size={16} color="#141418" /></View>
          ) : (
            <View style={s.checkEmpty} />
          )}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.mealName, done && s.mealNameDone]} numberOfLines={1}>
            {meal.targetTimeHour != null ? `${String(meal.targetTimeHour).padStart(2, '0')}:00  ` : ''}{meal.name}
          </Text>
          <Text style={s.mealMacro}>
            {fmt(m.calories)} kcal · <Text style={{ color: MACRO_COLORS.protein }}>P {fmt(m.proteinG)}</Text> · <Text style={{ color: MACRO_COLORS.carbs }}>C {fmt(m.carbsG)}</Text> · <Text style={{ color: MACRO_COLORS.fat }}>G {fmt(m.fatG)}</Text>
          </Text>
        </View>
      </View>

      {meal.foods.length > 0 && (
        <View style={s.foodList}>
          {meal.foods.map((mf) => (
            <View key={mf.id} style={s.foodLine}>
              <Text style={[s.foodName, done && s.dimDone]} numberOfLines={1}>{mf.food.name}</Text>
              <Text style={[s.foodQty, done && s.dimDone]}>{fmt(mf.quantityG)}g</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  headerTitle: { color: '#F0F0F5', fontSize: 26, fontWeight: '500' },
  scrollPad: { paddingHorizontal: 16, paddingBottom: 48 },
  center: { paddingVertical: 80, alignItems: 'center', gap: 12 },
  dim: { color: '#8A8A9A', fontSize: 14, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(41,121,255,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)' },
  retryText: { color: '#4FC3F7', fontSize: 13, fontWeight: '500' },

  empty: { alignItems: 'center', paddingVertical: 56, gap: 8, paddingHorizontal: 20 },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(79,195,247,0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { color: '#F0F0F5', fontSize: 17, fontWeight: '600' },
  emptySub: { color: '#8A8A9A', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  emptyBtnWrap: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  emptyBtn: { paddingVertical: 13, paddingHorizontal: 32 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  linkText: { color: '#8A8A9A', fontSize: 14, marginTop: 14, textDecorationLine: 'underline' },

  planBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1E1E24', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A35', padding: 16,
  },
  planBannerName: { color: '#F0F0F5', fontSize: 16, fontWeight: '600' },
  planBannerMeta: { color: '#8A8A9A', fontSize: 12, marginTop: 4 },

  adherenceCard: { marginTop: 12 },
  adherenceTrack: { height: 8, borderRadius: 4, backgroundColor: '#1E1E24', overflow: 'hidden', borderWidth: 1, borderColor: '#2A2A35' },
  adherenceFill: { height: '100%', backgroundColor: '#00E676', borderRadius: 4 },
  adherenceLabel: { color: '#8A8A9A', fontSize: 11, marginTop: 6, textAlign: 'right' },

  sectionLabel: { color: '#8A8A9A', fontSize: 11, fontWeight: '500', letterSpacing: 1.2, marginTop: 24, marginBottom: 12 },

  noMeals: { alignItems: 'center', gap: 12, paddingVertical: 24 },

  mealCard: { backgroundColor: '#1E1E24', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A35', padding: 14, marginBottom: 10 },
  mealCardDone: { borderColor: 'rgba(0,230,118,0.4)', backgroundColor: 'rgba(0,230,118,0.05)' },
  mealTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkHit: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  checkEmpty: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#3A3A45' },
  checkDone: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#00E676', alignItems: 'center', justifyContent: 'center' },
  mealName: { color: '#F0F0F5', fontSize: 16, fontWeight: '600' },
  mealNameDone: { color: '#8A8A9A' },
  mealMacro: { color: '#8A8A9A', fontSize: 12, marginTop: 3 },

  foodList: { marginTop: 12, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: '#2A2A35', gap: 6 },
  foodLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foodName: { color: '#B8B8C4', fontSize: 13, flex: 1, marginRight: 8 },
  foodQty: { color: '#8A8A9A', fontSize: 12 },
  dimDone: { color: '#6A6A7A' },
})
