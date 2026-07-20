import React, { useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { DailyMeal } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { MacroSummary } from '../../components/MacroSummary'
import { MACRO_COLORS, fmt } from '../../lib/nutrition'
import { showToast } from '../../components/Toast'

type Nav = NativeStackNavigationProp<AppStackParamList>

export function NutritionTodayScreen() {
  const navigation = useNavigation<Nav>()
  const qc = useQueryClient()

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

  const exec = data?.data
  const totals = exec?.totals

  function toggleMeal(meal: DailyMeal) {
    if (meal.isCompleted) uncomplete.mutate(meal.mealId)
    else complete.mutate(meal.mealId)
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{exec?.plan?.name ?? 'Hoje'}</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
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
          <View style={s.center}>
            <Ionicons name="nutrition-outline" size={44} color="#2A2A35" />
            <Text style={s.dim}>Nenhum plano ativo.</Text>
          </View>
        ) : (
          <>
            {totals && (
              <>
                <View style={s.adherenceCard}>
                  <View style={s.adherenceTrack}>
                    <View style={[s.adherenceFill, { width: `${totals.adherencePercent}%` }]} />
                  </View>
                  <Text style={s.adherenceLabel}>{totals.completedMeals}/{totals.totalMeals} refeições · {totals.adherencePercent}% concluído</Text>
                </View>

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
              </>
            )}

            <Text style={s.sectionLabel}>REFEIÇÕES DE HOJE</Text>

            {exec.meals.length === 0 ? (
              <View style={s.noMeals}>
                <Text style={s.dim}>Este plano ainda não tem refeições.</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 10, gap: 8 },
  backBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  headerTitle: { flex: 1, color: '#F0F0F5', fontSize: 20, fontWeight: '500' },

  scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 48 },
  center: { paddingVertical: 80, alignItems: 'center', gap: 12 },
  dim: { color: '#8A8A9A', fontSize: 14, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(41,121,255,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)' },
  retryText: { color: '#4FC3F7', fontSize: 13, fontWeight: '500' },

  adherenceCard: {},
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
