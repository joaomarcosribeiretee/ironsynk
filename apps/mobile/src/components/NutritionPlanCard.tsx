import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { NutritionPlanListItem, PlanMeal, DietGoal } from '../lib/api'
import { ActionSheet, type SheetAction } from '../screens/workout/ActionSheet'
import { ConfirmModal } from './ConfirmModal'
import { showToast } from './Toast'
import { fmt, sumMacros, sortMealsByTime } from '../lib/nutrition'

const GOAL_LABELS: Record<DietGoal, string> = {
  BULK: 'Bulk',
  CUT: 'Cutting',
  MAINTENANCE: 'Manutenção',
  RECOMP: 'Recomp',
  HEALTH: 'Saúde',
}

type Props = {
  plan: NutritionPlanListItem
  onEditPlan: (plan: NutritionPlanListItem) => void
  onAddMeal: (planId: string) => void
  onEditMeal: (meal: PlanMeal, planId: string) => void
  onOpenMeal: (meal: PlanMeal, planId: string) => void
  onDrag?: () => void
  isDragging?: boolean
}

export function NutritionPlanCard({
  plan, onEditPlan, onAddMeal, onEditMeal, onOpenMeal, onDrag, isDragging,
}: Props) {
  const qc = useQueryClient()
  // Meals are what the screen is for, so every plan opens expanded. Collapsing
  // stays a manual choice.
  const [isOpen, setIsOpen] = useState(true)
  const [contentH, setContentH] = useState(0)
  const [sheet, setSheet] = useState<{ visible: boolean; title: string; actions: SheetAction[] }>({
    visible: false, title: '', actions: [],
  })
  const [confirm, setConfirm] = useState<{
    visible: boolean; title: string; message: string; confirmText: string; onConfirm: () => void
  }>({ visible: false, title: '', message: '', confirmText: '', onConfirm: () => {} })

  const progress = useRef(new Animated.Value(1)).current
  const chevronRotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] })
  const containerHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [0, contentH] })
  const contentOpacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] })

  function toggle() {
    const toValue = isOpen ? 0 : 1
    Animated.spring(progress, {
      toValue, damping: 20, stiffness: 200, mass: 0.8, useNativeDriver: false,
    }).start()
    setIsOpen(v => !v)
  }

  const { data: planData, isLoading: loadingMeals } = useQuery({
    queryKey: ['nutrition-plan', plan.id],
    queryFn: () => api.nutrition.getPlan(plan.id),
    enabled: isOpen,
    staleTime: 30_000,
  })

  const meals = sortMealsByTime(planData?.data.plan.meals ?? [])

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['nutrition-plans'] })
    qc.invalidateQueries({ queryKey: ['nutrition-plan', plan.id] })
    qc.invalidateQueries({ queryKey: ['nutrition-today'] })
  }

  const deletePlan = useMutation({
    mutationFn: () => api.nutrition.deletePlan(plan.id),
    onSuccess: () => { invalidate(); showToast('Plano apagado') },
    onError: (err: any) => showToast(err?.code === 'PLAN_IN_USE' ? 'Plano prescrito não pode ser apagado' : 'Erro ao apagar plano', 'warning'),
  })
  const activatePlan = useMutation({
    mutationFn: () => api.nutrition.activatePlan(plan.id),
    onSuccess: () => { invalidate(); showToast('Plano ativado', 'success') },
    onError: () => showToast('Erro ao ativar plano', 'error'),
  })
  const deleteMeal = useMutation({
    mutationFn: (id: string) => api.nutrition.deleteMeal(id),
    onSuccess: () => { invalidate(); showToast('Refeição apagada') },
    onError: () => showToast('Erro ao apagar refeição', 'error'),
  })
  function showPlanMenu() {
    setSheet({
      visible: true,
      title: plan.name,
      actions: [
        { label: 'Editar plano', onPress: () => onEditPlan(plan) },
        ...(plan.isActive ? [] : [{ label: 'Ativar plano', onPress: () => activatePlan.mutate() }]),
        {
          label: 'Apagar plano', destructive: true,
          onPress: () => setConfirm({
            visible: true, title: 'Apagar plano',
            message: 'Tem certeza? Todas as refeições serão apagadas.',
            confirmText: 'Apagar', onConfirm: () => deletePlan.mutate(),
          }),
        },
        { label: 'Cancelar', cancel: true, onPress: () => {} },
      ],
    })
  }

  function showMealMenu(meal: PlanMeal) {
    setSheet({
      visible: true,
      title: meal.name,
      actions: [
        { label: 'Editar refeição', onPress: () => onEditMeal(meal, plan.id) },
        {
          label: 'Apagar refeição', destructive: true,
          onPress: () => setConfirm({
            visible: true, title: 'Apagar refeição',
            message: 'Tem certeza que deseja apagar esta refeição?',
            confirmText: 'Apagar', onConfirm: () => deleteMeal.mutate(meal.id),
          }),
        },
        { label: 'Cancelar', cancel: true, onPress: () => {} },
      ],
    })
  }

  // Name first, time as a quiet suffix, calories last. Nothing here is colored:
  // the card is identified by what the meal is called.
  function renderMealItem(meal: PlanMeal) {
    const timed = meal.targetTimeHour != null
    return (
      <View key={meal.id} style={s.mealRow}>
        <TouchableOpacity
          style={s.mealInfo}
          onPress={() => onOpenMeal(meal, plan.id)}
          activeOpacity={0.7}
        >
          <View style={s.mealHead}>
            <Text style={s.mealName} numberOfLines={1}>{meal.name}</Text>
            {timed && (
              <Text style={s.mealTime}>{String(meal.targetTimeHour).padStart(2, '0')}:00</Text>
            )}
          </View>
          <Text style={s.mealMeta} numberOfLines={1}>{fmt(meal.plannedMacros.calories)} kcal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => showMealMenu(meal)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={s.menuBtn}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#555560" />
        </TouchableOpacity>
      </View>
    )
  }

  const planMacros = sumMacros(meals.map(m => m.plannedMacros))
  const goalLabel = plan.goal ? GOAL_LABELS[plan.goal] : null
  // A plan literally named after its goal ("Cutting") makes the goal pill pure
  // repetition — drop it and let the name carry the information.
  const showGoalPill = goalLabel !== null && goalLabel.toLowerCase() !== plan.name.trim().toLowerCase()

  return (
    <View style={isDragging ? s.cardDragging : undefined}>
      {/* Plan row */}
      <TouchableOpacity style={s.row} onPress={toggle} onLongPress={onDrag} delayLongPress={300} activeOpacity={0.7}>
        <View style={s.rowLeft}>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }], flexShrink: 0 }}>
            <Ionicons name="chevron-forward-outline" size={16} color="#4FC3F7" />
          </Animated.View>
          <View style={s.nameBlock}>
            <View style={s.nameRow}>
              <Text style={s.planName} numberOfLines={1}>{plan.name}</Text>
              {plan.isActive && (
                <View style={s.activeBadge}>
                  <View style={s.activeDot} />
                  <Text style={s.activeText}>ATIVO</Text>
                </View>
              )}
            </View>
            <View style={s.pillsRow}>
              {showGoalPill && <View style={s.pill}><Text style={s.pillText}>{goalLabel}</Text></View>}
              {plan.targetCalories != null && <Text style={s.kcalHint}>{fmt(plan.targetCalories)} kcal</Text>}
            </View>
          </View>
        </View>
        <View style={s.rowRight}>
          <TouchableOpacity onPress={showPlanMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#8A8A9A" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Expandable content */}
      <Animated.View style={{ height: containerHeight, overflow: 'hidden' }}>
        <View style={s.measureWrap} onLayout={e => setContentH(e.nativeEvent.layout.height)}>
          <Animated.View style={[s.mealsWrap, { opacity: contentOpacity }]}>
            {loadingMeals ? (
              <View style={s.loadingRow}><ActivityIndicator size="small" color="#4FC3F7" /></View>
            ) : (
              <>
                {meals.length > 0 && (
                  <View style={s.totalBlock}>
                    {/* Calories lead; the macro line reads as their caption, in
                        one neutral tone so nothing competes with the number. */}
                    <View style={s.totalLine}>
                      <Text style={s.totalLabel}>Total do plano</Text>
                      <View style={s.totalRight}>
                        <Text style={s.totalValue}>{fmt(planMacros.calories)} kcal</Text>
                        <Text style={s.macroLine}>
                          {fmt(planMacros.proteinG)}P · {fmt(planMacros.carbsG)}C · {fmt(planMacros.fatG)}G
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                {meals.map(renderMealItem)}
                <TouchableOpacity style={s.addRow} onPress={() => onAddMeal(plan.id)} activeOpacity={0.7}>
                  <Ionicons name="add-circle-outline" size={16} color="#4FC3F7" />
                  <Text style={s.addText}>Adicionar refeição</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </View>
      </Animated.View>

      <ActionSheet
        visible={sheet.visible}
        title={sheet.title}
        actions={sheet.actions}
        onClose={() => setSheet(s => ({ ...s, visible: false }))}
      />
      <ConfirmModal
        visible={confirm.visible}
        title={confirm.title}
        message={confirm.message}
        confirmText={confirm.confirmText}
        destructive
        onConfirm={() => { setConfirm(c => ({ ...c, visible: false })); confirm.onConfirm() }}
        onCancel={() => setConfirm(c => ({ ...c, visible: false }))}
      />
    </View>
  )
}

const s = StyleSheet.create({
  cardDragging: { opacity: 0.9, backgroundColor: '#1E1E28', borderRadius: 12 },

  row: {
    flexDirection: 'row', alignItems: 'center', minHeight: 64,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 0.5, borderBottomColor: '#2A2A35',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12, minWidth: 0 },
  nameBlock: { flex: 1, minWidth: 0, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { color: '#F0F0F5', fontSize: 17, fontWeight: '500', flexShrink: 1 },
  // Status marker, not a highlight: a dot plus muted label instead of a chip.
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  activeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(0,230,118,0.75)' },
  activeText: { color: 'rgba(0,230,118,0.65)', fontSize: 9, fontWeight: '600', letterSpacing: 0.6 },
  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    backgroundColor: 'rgba(41,121,255,0.06)', borderWidth: 1, borderColor: 'rgba(41,121,255,0.15)',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
  },
  pillText: { color: 'rgba(79,195,247,0.7)', fontSize: 10 },
  kcalHint: { color: '#8A8A9A', fontSize: 11 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 },

  measureWrap: { position: 'absolute', left: 0, right: 0, top: 0 },
  mealsWrap: { paddingTop: 16, paddingBottom: 12 },
  loadingRow: { height: 74, justifyContent: 'center', alignItems: 'center' },

  totalBlock: { paddingHorizontal: 2, paddingBottom: 22 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  totalLabel: { color: '#8A8A9A', fontSize: 11, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 },
  totalRight: { alignItems: 'flex-end', gap: 4 },
  totalValue: { color: '#F0F0F5', fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  macroLine: { color: '#6A6A7A', fontSize: 11, letterSpacing: 0.2, fontVariant: ['tabular-nums'] },

  mealRow: {
    flexDirection: 'row', alignItems: 'center', height: 74,
    backgroundColor: '#1A1A22', borderRadius: 12, borderWidth: 1, borderColor: '#252530',
    marginBottom: 10, overflow: 'hidden',
  },
  mealInfo: { flex: 1, minWidth: 0, paddingLeft: 16, paddingVertical: 12, paddingRight: 10 },
  // Name on the left, time parked on the right edge: the column of times reads
  // as a schedule down the list instead of decorating each name.
  mealHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  mealName: { color: '#F0F0F5', fontSize: 16, fontWeight: '500', flex: 1 },
  mealTime: { color: '#8A8A9A', fontSize: 12, fontVariant: ['tabular-nums'], flexShrink: 0 },
  mealMeta: { color: '#6A6A7A', fontSize: 12, marginTop: 6, fontVariant: ['tabular-nums'] },
  menuBtn: { paddingRight: 14, paddingLeft: 8 },

  addRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 50, marginTop: 8, marginBottom: 18,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#2A2A35', borderRadius: 12,
  },
  addText: { color: '#4FC3F7', fontSize: 14 },
})
