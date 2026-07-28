import React, { useCallback, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Reanimated, { useSharedValue, useAnimatedStyle, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { api } from '../../lib/api'
import type { DailyExecution, DailyMeal } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { MacroSummary } from '../../components/MacroSummary'
import { fmt, sumMacros } from '../../lib/nutrition'
import { showToast } from '../../components/Toast'

type Nav = NativeStackNavigationProp<AppStackParamList>
type TodayResponse = { data: DailyExecution }

const TODAY_KEY = ['nutrition-today'] as const

// ── date label ────────────────────────────────
// The API returns a plain "YYYY-MM-DD"; format it without relying on Intl so
// the header reads the same on every device.
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function formatDateLabel(iso: string | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map((part) => Number(part))
  if (!y || !m || !d) return ''
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? ''
  return `${weekday}, ${d} de ${MONTHS[m - 1] ?? ''}`
}

// ── optimistic cache patch ────────────────────
// Toggling a meal changes both its own state and every derived daily number,
// so the whole payload is recomputed locally to keep the UI instant and the
// macro card consistent with the meal list while the request is in flight.
function patchToday(prev: TodayResponse, mealId: string, next: boolean): TodayResponse {
  const meals = prev.data.meals.map((meal) =>
    meal.mealId === mealId
      ? { ...meal, isCompleted: next, completedAt: next ? new Date().toISOString() : null }
      : meal,
  )
  const completed = meals.filter((meal) => meal.isCompleted)
  const consumed = sumMacros(completed.map((meal) => meal.plannedMacros))
  const totalMeals = meals.length

  return {
    ...prev,
    data: {
      ...prev.data,
      meals,
      totals: {
        ...prev.data.totals,
        consumedCalories: consumed.calories,
        consumedProteinG: consumed.proteinG,
        consumedCarbsG: consumed.carbsG,
        consumedFatG: consumed.fatG,
        completedMeals: completed.length,
        totalMeals,
        adherencePercent: totalMeals === 0 ? 0 : Math.round((completed.length / totalMeals) * 100),
      },
    },
  }
}

export function NutritionTodayScreen() {
  const navigation = useNavigation<Nav>()
  const qc = useQueryClient()

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: TODAY_KEY,
    queryFn: () => api.nutrition.today(),
    staleTime: 15_000,
  })

  useFocusEffect(useCallback(() => { refetch() }, [refetch]))

  // A single mutation for both directions: two independent mutations could
  // interleave their cache writes when a meal is toggled quickly.
  const toggle = useMutation<unknown, Error, { mealId: string; next: boolean }, { prev?: TodayResponse }>({
    mutationFn: ({ mealId, next }) =>
      next ? api.nutrition.completeMeal(mealId) : api.nutrition.uncompleteMeal(mealId),
    onMutate: async ({ mealId, next }) => {
      // Stop any in-flight refetch from overwriting the optimistic state.
      await qc.cancelQueries({ queryKey: TODAY_KEY })
      const prev = qc.getQueryData<TodayResponse>(TODAY_KEY)
      if (prev) qc.setQueryData<TodayResponse>(TODAY_KEY, patchToday(prev, mealId, next))
      return { prev }
    },
    onError: (_error, variables, context) => {
      if (context?.prev) qc.setQueryData<TodayResponse>(TODAY_KEY, context.prev)
      showToast(variables.next ? 'Falha ao marcar refeição' : 'Falha ao desmarcar refeição', 'error')
    },
    // Always reconcile with the server, success or failure.
    onSettled: () => qc.invalidateQueries({ queryKey: TODAY_KEY }),
  })

  const exec = data?.data
  const totals = exec?.totals
  const meals = exec?.meals ?? []
  const pendingMealId = toggle.isPending ? toggle.variables?.mealId : undefined
  // First meal still open — highlighted so the next action is always obvious.
  const nextMealId = meals.find((meal) => !meal.isCompleted)?.mealId

  function handleToggle(meal: DailyMeal) {
    // Ignore repeat taps on a meal that already has a request in flight.
    if (pendingMealId === meal.mealId) return
    toggle.mutate({ mealId: meal.mealId, next: !meal.isCompleted })
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerWrap}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerSideBtn}>
            <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
          </TouchableOpacity>
          <View style={s.headerTitleWrap}>
            <Text style={s.headerTitle} numberOfLines={1}>{exec?.plan?.name ?? 'Hoje'}</Text>
            {exec?.date ? <Text style={s.headerSub} numberOfLines={1}>{formatDateLabel(exec.date)}</Text> : null}
          </View>
          <View style={s.headerSideBtn} />
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${totals?.adherencePercent ?? 0}%` }]} />
        </View>
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
            <Ionicons name="cloud-offline-outline" size={44} color="#2A2A35" />
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
            {totals && <DayProgressCard completed={totals.completedMeals} total={totals.totalMeals} percent={totals.adherencePercent} />}

            {totals && (
              <View style={s.macroWrap}>
                <MacroSummary
                  consumedCalories={totals.consumedCalories}
                  targetCalories={totals.targetCalories}
                  consumedProteinG={totals.consumedProteinG}
                  targetProteinG={totals.targetProteinG}
                  consumedCarbsG={totals.consumedCarbsG}
                  targetCarbsG={totals.targetCarbsG}
                  consumedFatG={totals.consumedFatG}
                  targetFatG={totals.targetFatG}
                  showRemaining
                  subdueMacros
                  collapsibleMacros
                />
              </View>
            )}

            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel}>REFEIÇÕES DE HOJE</Text>
              {meals.length > 0 && totals && (
                <Text style={s.sectionCount}>{totals.completedMeals}/{totals.totalMeals}</Text>
              )}
            </View>

            {meals.length === 0 ? (
              <View style={s.noMeals}>
                <Ionicons name="restaurant-outline" size={32} color="#2A2A35" />
                <Text style={s.dim}>Este plano ainda não tem refeições.</Text>
              </View>
            ) : (
              meals.map((meal) => (
                <MealExecCard
                  key={meal.mealId}
                  meal={meal}
                  isNext={meal.mealId === nextMealId}
                  onToggle={() => handleToggle(meal)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── day progress ──────────────────────────────

function encouragement(completed: number, total: number): string {
  if (total === 0) return ''
  if (completed === 0) return 'Comece pela primeira refeição'
  if (completed === total) return 'Dia completo. Excelente trabalho!'
  const left = total - completed
  return left === 1 ? 'Falta 1 refeição para fechar o dia' : `Faltam ${left} refeições para fechar o dia`
}

// One segment per meal reads faster than a single bar: the athlete sees at a
// glance how many meals are done and how many are left.
function DayProgressCard({ completed, total, percent }: { completed: number; total: number; percent: number }) {
  const allDone = total > 0 && completed === total

  return (
    <View style={[s.dayCard, allDone && s.dayCardDone]}>
      <View style={s.dayTop}>
        <View style={s.dayTitleWrap}>
          <Text style={s.dayLabel}>PROGRESSO DO DIA</Text>
          <View style={s.dayValueRow}>
            <Text style={[s.dayValue, allDone && s.dayValueDone]}>{completed}</Text>
            <Text style={s.dayValueTarget}>/{total} refeições</Text>
          </View>
        </View>
        <View style={[s.dayBadge, allDone && s.dayBadgeDone]}>
          <Text style={[s.dayBadgeText, allDone && s.dayBadgeTextDone]}>{percent}%</Text>
        </View>
      </View>

      {total > 0 && total <= 10 ? (
        <View style={s.segmentRow}>
          {Array.from({ length: total }, (_, index) => (
            <View key={index} style={[s.segment, index < completed && s.segmentDone]} />
          ))}
        </View>
      ) : (
        <View style={s.dayTrack}>
          <View style={[s.dayFill, { width: `${percent}%` }]} />
        </View>
      )}

      {total > 0 && (
        <Text style={[s.dayHint, allDone && s.dayHintDone]}>{encouragement(completed, total)}</Text>
      )}
    </View>
  )
}

// ── meal card ─────────────────────────────────

// Same completion feel as workout sets: spring + haptic, no spinner. The
// optimistic cache write makes the state flip instant, so a loading state
// would only add latency to a tap that has already visually succeeded.
function MealCheck({ checked, onPress }: { checked: boolean; onPress: () => void }) {
  const scale = useSharedValue(1)
  const boxStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  function handlePress() {
    Haptics.impactAsync(checked ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium)
    scale.value = withSequence(
      withTiming(0.9, { duration: 60 }),
      withSpring(1, { duration: 240, dampingRatio: checked ? 0.7 : 0.55 }),
    )
    onPress()
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Reanimated.View style={[s.check, checked ? s.checkDone : s.checkEmpty, boxStyle]}>
        <Ionicons name="checkmark" size={17} color={checked ? '#141418' : '#4A4A5A'} />
      </Reanimated.View>
    </TouchableOpacity>
  )
}

// Collapsed, a card carries only what the athlete needs to act: state, time,
// name and calories. Foods and the macro breakdown live one tap away so the
// list stays scannable no matter how many meals the plan has.
function MealExecCard({ meal, isNext, onToggle }: { meal: DailyMeal; isNext: boolean; onToggle: () => void }) {
  const done = meal.isCompleted
  const macros = meal.plannedMacros
  const foods = meal.foods
  const time = meal.targetTimeHour !== null ? `${String(meal.targetTimeHour).padStart(2, '0')}:00` : null

  // The meal that is up next opens by itself — that is the one being eaten.
  const [open, setOpen] = useState(isNext && !done)
  const [contentH, setContentH] = useState(0)
  const progress = useRef(new Animated.Value(isNext && !done ? 1 : 0)).current

  const bodyHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [0, contentH] })
  const bodyOpacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] })
  const chevronRotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })

  function toggleOpen() {
    Animated.spring(progress, {
      toValue: open ? 0 : 1, damping: 20, stiffness: 200, mass: 0.8, useNativeDriver: false,
    }).start()
    setOpen((value) => !value)
  }

  return (
    <View style={[s.mealCard, done && s.mealCardDone, !done && isNext && s.mealCardNext]}>
      <View style={s.mealTop}>
        <MealCheck checked={done} onPress={onToggle} />
        {/* Tapping the meal itself still completes it — a checklist wants a
            big, forgiving target. Details are on the chevron. */}
        <TouchableOpacity style={s.mealInfo} onPress={onToggle} activeOpacity={0.7}>
          <View style={s.mealMetaRow}>
            {time !== null && (
              <Text style={[s.mealTime, done && s.mealTimeDone]}>{time}</Text>
            )}
            {!done && isNext && <Text style={s.statusNext}>PRÓXIMA</Text>}
          </View>
          <Text style={[s.mealName, done && s.mealNameDone]} numberOfLines={1}>{meal.name}</Text>
          <Text style={[s.mealKcal, done && s.mealKcalDone]}>{fmt(macros.calories)} kcal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.expandBtn}
          onPress={toggleOpen}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <Ionicons name="chevron-down" size={16} color="#555560" />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ height: bodyHeight, overflow: 'hidden' }}>
        <View style={s.mealMeasure} onLayout={(e) => setContentH(e.nativeEvent.layout.height)}>
          <Animated.View style={[s.mealBody, { opacity: bodyOpacity }]}>
            {foods.length === 0 ? (
              <Text style={s.foodEmpty}>Nenhum alimento nesta refeição</Text>
            ) : (
              foods.map((mealFood) => (
                <View key={mealFood.id} style={s.foodLine}>
                  <Text style={s.foodName} numberOfLines={1}>{mealFood.food.name}</Text>
                  <Text style={s.foodQty}>{fmt(mealFood.quantityG)}g</Text>
                </View>
              ))
            )}

            {/* Macros read as one quiet line here, never as competing chips. */}
            <View style={s.mealFooter}>
              <Text style={s.mealFooterLabel}>
                {foods.length} {foods.length === 1 ? 'alimento' : 'alimentos'}
              </Text>
              <Text style={s.mealFooterMacros}>
                P {fmt(macros.proteinG)}g · C {fmt(macros.carbsG)}g · G {fmt(macros.fatG)}g
              </Text>
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },

  headerWrap: { borderBottomWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10, gap: 8 },
  headerSideBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { color: '#F0F0F5', fontSize: 19, fontWeight: '600' },
  headerSub: { color: '#8A8A9A', fontSize: 12, marginTop: 1 },
  progressTrack: { height: 2, backgroundColor: '#2A2A35' },
  progressFill: { height: 2, backgroundColor: '#00E676' },

  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 56 },
  center: { paddingVertical: 80, alignItems: 'center', gap: 12 },
  dim: { color: '#8A8A9A', fontSize: 14, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(41,121,255,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)' },
  retryText: { color: '#4FC3F7', fontSize: 13, fontWeight: '500' },

  // Day progress
  dayCard: { backgroundColor: '#1E1E24', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A35', padding: 16 },
  dayCardDone: { borderColor: 'rgba(0,230,118,0.35)' },
  dayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayTitleWrap: { flex: 1 },
  dayLabel: { color: '#8A8A9A', fontSize: 11, fontWeight: '500', letterSpacing: 1.2 },
  dayValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  dayValue: { color: '#F0F0F5', fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dayValueDone: { color: '#00E676' },
  dayValueTarget: { color: '#8A8A9A', fontSize: 14, fontWeight: '400', marginLeft: 2, fontVariant: ['tabular-nums'] },
  dayBadge: { backgroundColor: 'rgba(79,195,247,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  dayBadgeDone: { backgroundColor: 'rgba(0,230,118,0.12)' },
  dayBadgeText: { color: '#4FC3F7', fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dayBadgeTextDone: { color: '#00E676' },

  segmentRow: { flexDirection: 'row', gap: 4, marginTop: 14 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#141418' },
  segmentDone: { backgroundColor: '#00E676' },
  dayTrack: { height: 6, borderRadius: 3, backgroundColor: '#141418', marginTop: 14, overflow: 'hidden' },
  dayFill: { height: 6, borderRadius: 3, backgroundColor: '#00E676' },
  dayHint: { color: '#8A8A9A', fontSize: 12, marginTop: 10 },
  dayHintDone: { color: '#00E676' },

  macroWrap: { marginTop: 12 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 },
  sectionLabel: { color: '#8A8A9A', fontSize: 11, fontWeight: '500', letterSpacing: 1.2 },
  sectionCount: { color: '#8A8A9A', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  noMeals: { alignItems: 'center', gap: 10, paddingVertical: 32 },

  // Meal card — the primary object on this screen.
  mealCard: { backgroundColor: '#1E1E24', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A35', padding: 16, marginBottom: 10 },
  // Completion reads from the check and a quiet border, never a painted card.
  mealCardDone: { borderColor: 'rgba(0,230,118,0.22)' },
  mealCardNext: { borderColor: 'rgba(79,195,247,0.22)' },
  mealTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  mealInfo: { flex: 1 },
  expandBtn: { paddingLeft: 8, paddingTop: 8 },
  check: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, marginTop: 2 },
  checkEmpty: { backgroundColor: 'transparent', borderColor: '#3A3A45' },
  checkDone: { backgroundColor: '#00E676', borderColor: '#00E676' },

  mealMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 14 },
  mealTime: { color: '#8A8A9A', fontSize: 11, fontWeight: '600', letterSpacing: 0.4, fontVariant: ['tabular-nums'] },
  mealTimeDone: { color: '#6A6A7A' },
  statusNext: { color: 'rgba(79,195,247,0.75)', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
  mealName: { color: '#F0F0F5', fontSize: 16, fontWeight: '600', marginTop: 2 },
  mealNameDone: { color: '#8A8A9A' },
  mealKcal: { color: '#B8B8C4', fontSize: 13, marginTop: 4, fontVariant: ['tabular-nums'] },
  mealKcalDone: { color: '#6A6A7A' },

  mealMeasure: { position: 'absolute', left: 0, right: 0, top: 0 },
  mealBody: { paddingTop: 14, gap: 8 },

  foodLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foodName: { color: '#8A8A9A', fontSize: 13, flex: 1, marginRight: 8 },
  foodQty: { color: '#6A6A7A', fontSize: 12, fontVariant: ['tabular-nums'] },
  foodEmpty: { color: '#4A4A5A', fontSize: 12, fontStyle: 'italic' },

  mealFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 4, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A2A35',
  },
  mealFooterLabel: { color: '#6A6A7A', fontSize: 11 },
  mealFooterMacros: { color: '#8A8A9A', fontSize: 11, fontVariant: ['tabular-nums'] },
})
