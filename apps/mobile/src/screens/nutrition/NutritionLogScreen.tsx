import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { LoggedMealRecord, LoggedMealFoodRecord } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { MacroSummary } from '../../components/MacroSummary'
import { ConfirmModal } from '../../components/ConfirmModal'
import { showToast } from '../../components/Toast'
import { ActionSheet } from '../workout/ActionSheet'
import type { SheetAction } from '../workout/ActionSheet'
import {
  fmt, fmtClock, servingLabel, localDateString, shiftDate, formatDateLabel,
} from '../../lib/nutrition'
import { MealModal } from './MealModal'
import type { MealFormData } from './MealModal'
import { FoodSearchModal } from './FoodSearchModal'
import type { PortionPayload } from './FoodSearchModal'
import { QuantityEditModal } from './QuantityEditModal'

type Nav = NativeStackNavigationProp<AppStackParamList>
type ScreenRoute = RouteProp<AppStackParamList, 'NutritionLog'>

type Sheet =
  | { kind: 'meal'; meal: LoggedMealRecord }
  | { kind: 'food'; food: LoggedMealFoodRecord }
type PendingRemoval = Sheet

const logKey = (date: string) => ['nutrition-log', date] as const

// Free logging: what was actually eaten on a day, no plan required. Every
// number on screen comes from the API; this screen only edits and displays.
export function NutritionLogScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<ScreenRoute>()
  const qc = useQueryClient()

  const today = localDateString()
  const [date, setDate] = useState(route.params?.date ?? today)
  const isToday = date >= today

  const [mealModal, setMealModal] = useState<{ open: boolean; editing: LoggedMealRecord | null }>({ open: false, editing: null })
  const [foodTarget, setFoodTarget] = useState<LoggedMealRecord | null>(null)
  const [qtyEdit, setQtyEdit] = useState<LoggedMealFoodRecord | null>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [removal, setRemoval] = useState<PendingRemoval | null>(null)

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: logKey(date),
    queryFn: () => api.nutrition.log.day(date),
    staleTime: 30_000,
  })
  const log = data?.data
  const meals = log?.meals ?? []
  const totals = log?.totals

  const invalidate = () => qc.invalidateQueries({ queryKey: logKey(date) })

  const createMeal = useMutation({
    mutationFn: (body: MealFormData) =>
      api.nutrition.log.createMeal({ date, name: body.name, ...(body.timeMinutes != null ? { timeMinutes: body.timeMinutes } : {}) }),
    // A new meal is only useful once it has food, so go straight to the search.
    onSuccess: (res) => { invalidate(); setFoodTarget(res.data.meal) },
    onError: () => showToast('Falha ao criar refeição', 'error'),
  })
  const updateMeal = useMutation({
    mutationFn: ({ id, body }: { id: string; body: MealFormData }) =>
      api.nutrition.log.updateMeal(id, { name: body.name, timeMinutes: body.timeMinutes }),
    onSuccess: () => invalidate(),
    onError: () => showToast('Falha ao atualizar refeição', 'error'),
  })
  const deleteMeal = useMutation({
    mutationFn: (id: string) => api.nutrition.log.deleteMeal(id),
    onSuccess: () => invalidate(),
    onError: () => showToast('Erro ao remover refeição', 'error'),
  })
  const addFood = useMutation({
    mutationFn: ({ mealId, foodId, portion }: { mealId: string; foodId: string; portion: PortionPayload }) =>
      api.nutrition.log.addFood(mealId, { foodId, ...portion }),
    onSuccess: () => invalidate(),
  })
  const updateFood = useMutation({
    mutationFn: ({ id, portion }: { id: string; portion: PortionPayload }) => api.nutrition.log.updateFood(id, portion),
    onSuccess: () => invalidate(),
    onError: () => showToast('Erro ao atualizar', 'error'),
  })
  const removeFood = useMutation({
    mutationFn: (id: string) => api.nutrition.log.removeFood(id),
    onSuccess: () => invalidate(),
    onError: () => showToast('Erro ao remover', 'error'),
  })

  async function handleSaveMeal(form: MealFormData) {
    if (mealModal.editing) await updateMeal.mutateAsync({ id: mealModal.editing.id, body: form })
    else await createMeal.mutateAsync(form)
  }

  function confirmRemoval() {
    if (removal?.kind === 'meal') deleteMeal.mutate(removal.meal.id)
    if (removal?.kind === 'food') removeFood.mutate(removal.food.id)
    setRemoval(null)
  }

  const sheetActions: SheetAction[] = sheet?.kind === 'meal'
    ? [
      { label: 'Editar refeição', onPress: () => setMealModal({ open: true, editing: sheet.meal }) },
      { label: 'Remover refeição', destructive: true, onPress: () => setRemoval(sheet) },
      { label: 'Cancelar', cancel: true, onPress: () => {} },
    ]
    : sheet?.kind === 'food'
      ? [
        { label: 'Editar quantidade', onPress: () => setQtyEdit(sheet.food) },
        { label: 'Remover', destructive: true, onPress: () => setRemoval(sheet) },
        { label: 'Cancelar', cancel: true, onPress: () => {} },
      ]
      : []

  const dayTitle = date === today ? 'Hoje' : date === shiftDate(today, -1) ? 'Ontem' : formatDateLabel(date)

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerSideBtn}>
          <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>Registro Livre</Text>
        <View style={s.headerSideBtn} />
      </View>

      {/* Day switcher: back-filling a past day is the same flow as today.
          The future is closed — nothing has been eaten there yet. */}
      <View style={s.dayBar}>
        <TouchableOpacity onPress={() => setDate(shiftDate(date, -1))} style={s.dayArrow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={18} color="#8A8A9A" />
        </TouchableOpacity>
        <View style={s.dayLabelWrap}>
          <Text style={s.dayTitle} numberOfLines={1}>{dayTitle}</Text>
          {dayTitle !== formatDateLabel(date) && <Text style={s.daySub} numberOfLines={1}>{formatDateLabel(date)}</Text>}
        </View>
        <TouchableOpacity
          onPress={() => setDate(shiftDate(date, 1))}
          disabled={isToday}
          style={[s.dayArrow, isToday && { opacity: 0.25 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-forward" size={18} color="#8A8A9A" />
        </TouchableOpacity>
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
            <Text style={s.dim}>Não foi possível carregar o registro.</Text>
            <TouchableOpacity onPress={() => refetch()} style={s.softBtn}><Text style={s.softBtnText}>Tentar novamente</Text></TouchableOpacity>
          </View>
        ) : meals.length === 0 ? (
          <View style={s.center}>
            <Ionicons name="restaurant-outline" size={40} color="#2A2A35" />
            <Text style={s.dim}>Nada registrado {date === today ? 'hoje' : 'neste dia'}.</Text>
            <TouchableOpacity onPress={() => setMealModal({ open: true, editing: null })} style={s.softBtn} activeOpacity={0.7}>
              <Text style={s.softBtnText}>Registrar refeição</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {totals && (
              <View style={s.macroWrap}>
                {/* No plan behind this day, so there is nothing to count down
                    to: the card only reports what was eaten. */}
                <MacroSummary
                  consumedCalories={totals.calories}
                  targetCalories={null}
                  consumedProteinG={totals.proteinG}
                  targetProteinG={null}
                  consumedCarbsG={totals.carbsG}
                  targetCarbsG={null}
                  consumedFatG={totals.fatG}
                  targetFatG={null}
                  subdueMacros
                />
              </View>
            )}

            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel}>REFEIÇÕES</Text>
              <TouchableOpacity onPress={() => setMealModal({ open: true, editing: null })} activeOpacity={0.7}>
                <View style={s.novoBtn}><Text style={s.novoBtnText}>Nova +</Text></View>
              </TouchableOpacity>
            </View>

            {meals.map((meal) => (
              <LoggedMealCard
                key={meal.id}
                meal={meal}
                onMore={() => setSheet({ kind: 'meal', meal })}
                onAddFood={() => setFoodTarget(meal)}
                onEditFood={(food) => setQtyEdit(food)}
                onMoreFood={(food) => setSheet({ kind: 'food', food })}
              />
            ))}
          </>
        )}
      </ScrollView>

      <MealModal
        visible={mealModal.open}
        timeStep="minute"
        editing={mealModal.editing && { name: mealModal.editing.name, timeMinutes: mealModal.editing.timeMinutes }}
        onClose={() => setMealModal({ open: false, editing: null })}
        onSave={handleSaveMeal}
      />
      <FoodSearchModal
        visible={foodTarget !== null}
        mealName={foodTarget?.name ?? ''}
        onClose={() => setFoodTarget(null)}
        onAdd={async (foodId, portion) => {
          if (foodTarget) await addFood.mutateAsync({ mealId: foodTarget.id, foodId, portion })
        }}
      />
      <QuantityEditModal
        mealFood={qtyEdit}
        saving={updateFood.isPending}
        onClose={() => setQtyEdit(null)}
        onSave={async (id, portion) => { await updateFood.mutateAsync({ id, portion }); setQtyEdit(null) }}
      />
      <ActionSheet
        visible={sheet !== null}
        title={sheet?.kind === 'meal' ? sheet.meal.name : sheet?.food.food.name}
        onClose={() => setSheet(null)}
        actions={sheetActions}
      />
      <ConfirmModal
        visible={removal !== null}
        title={removal?.kind === 'meal' ? 'Remover refeição' : 'Remover alimento'}
        message={removal?.kind === 'meal'
          ? `Remover ${removal.meal.name} e todos os seus alimentos?`
          : `Remover ${removal?.food.food.name ?? ''} desta refeição?`}
        confirmText="Remover"
        destructive
        onConfirm={confirmRemoval}
        onCancel={() => setRemoval(null)}
      />
    </SafeAreaView>
  )
}

// ── meal card ─────────────────────────────────

type CardProps = {
  meal: LoggedMealRecord
  onMore: () => void
  onAddFood: () => void
  onEditFood: (food: LoggedMealFoodRecord) => void
  onMoreFood: (food: LoggedMealFoodRecord) => void
}

function LoggedMealCard({ meal, onMore, onAddFood, onEditFood, onMoreFood }: CardProps) {
  return (
    <View style={s.mealCard}>
      <View style={s.mealHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.mealName} numberOfLines={1}>{meal.name}</Text>
          <Text style={s.mealMeta}>
            {meal.timeMinutes !== null ? `${fmtClock(meal.timeMinutes)} · ` : ''}{fmt(meal.macros.calories)} kcal
          </Text>
        </View>
        <TouchableOpacity onPress={onMore} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={s.moreBtn}>
          <Ionicons name="ellipsis-horizontal" size={16} color="#555560" />
        </TouchableOpacity>
      </View>

      {meal.foods.map((lf) => (
        <TouchableOpacity key={lf.id} style={s.foodRow} activeOpacity={0.7} onPress={() => onEditFood(lf)}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.foodName} numberOfLines={1}>{lf.food.name}</Text>
            <Text style={s.foodMeta}>{servingLabel(lf)} · {fmt(lf.macros.calories)} kcal</Text>
          </View>
          <TouchableOpacity onPress={() => onMoreFood(lf)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={s.moreBtn}>
            <Ionicons name="ellipsis-horizontal" size={14} color="#555560" />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={s.addRow} onPress={onAddFood} activeOpacity={0.7}>
        <Ionicons name="add-circle-outline" size={15} color="#4FC3F7" />
        <Text style={s.addText}>Adicionar alimento</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 6, gap: 8 },
  headerSideBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, color: '#F0F0F5', fontSize: 17, fontWeight: '500', textAlign: 'center' },

  dayBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginBottom: 12, paddingVertical: 8, paddingHorizontal: 6,
    backgroundColor: '#1E1E24', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A35',
  },
  dayArrow: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  dayLabelWrap: { flex: 1, alignItems: 'center' },
  dayTitle: { color: '#F0F0F5', fontSize: 15, fontWeight: '500' },
  daySub: { color: '#8A8A9A', fontSize: 12, marginTop: 1 },

  scroll: { paddingHorizontal: 16, paddingBottom: 48, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 64 },
  dim: { color: '#8A8A9A', fontSize: 14, textAlign: 'center' },
  softBtn: {
    marginTop: 4, paddingHorizontal: 20, paddingVertical: 11, backgroundColor: 'rgba(41,121,255,0.12)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)',
  },
  softBtnText: { color: '#4FC3F7', fontSize: 14, fontWeight: '500' },

  macroWrap: { marginBottom: 20 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { color: '#8A8A9A', fontSize: 12, letterSpacing: 0.8 },
  novoBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(41,121,255,0.12)' },
  novoBtnText: { color: '#4FC3F7', fontSize: 13, fontWeight: '500' },

  mealCard: {
    backgroundColor: '#1E1E24', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A35',
    padding: 14, marginBottom: 12, gap: 8,
  },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealName: { color: '#F0F0F5', fontSize: 16, fontWeight: '500' },
  mealMeta: { color: '#8A8A9A', fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  moreBtn: { paddingLeft: 4 },

  foodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A2A35',
  },
  foodName: { color: '#F0F0F5', fontSize: 14 },
  foodMeta: { color: '#8A8A9A', fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },

  addRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 40, borderWidth: 1, borderStyle: 'dashed', borderColor: '#2A2A35', borderRadius: 10,
  },
  addText: { color: '#4FC3F7', fontSize: 13 },
})
