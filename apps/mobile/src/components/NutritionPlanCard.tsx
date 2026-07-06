import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DragSortableList, DragRenderParams } from './DragSortableList'
import { api } from '../lib/api'
import type { NutritionPlanListItem, PlanMeal, DietGoal } from '../lib/api'
import { ActionSheet, type SheetAction } from '../screens/workout/ActionSheet'
import { ConfirmModal } from './ConfirmModal'
import { showToast } from './Toast'
import { MACRO_COLORS, fmt, sumMacros } from '../lib/nutrition'

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
  onMealDragStart?: () => void
  onMealDragEnd?: () => void
}

export function NutritionPlanCard({
  plan, onEditPlan, onAddMeal, onEditMeal, onOpenMeal, onDrag, isDragging, onMealDragStart, onMealDragEnd,
}: Props) {
  const qc = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [contentH, setContentH] = useState(0)
  const [localMeals, setLocalMeals] = useState<PlanMeal[]>([])
  const [sheet, setSheet] = useState<{ visible: boolean; title: string; actions: SheetAction[] }>({
    visible: false, title: '', actions: [],
  })
  const [confirm, setConfirm] = useState<{
    visible: boolean; title: string; message: string; confirmText: string; onConfirm: () => void
  }>({ visible: false, title: '', message: '', confirmText: '', onConfirm: () => {} })

  const progress = useRef(new Animated.Value(0)).current
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

  const meals = planData?.data.plan.meals ?? []
  useEffect(() => { setLocalMeals(meals) }, [planData])

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
  const reorderMeals = useMutation({
    mutationFn: (ids: string[]) => api.nutrition.reorderMeals(plan.id, ids),
    onSuccess: () => invalidate(),
    onError: () => showToast('Erro ao reordenar', 'error'),
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

  function renderMealItem({ item: meal, drag, isActive }: DragRenderParams<PlanMeal>) {
    return (
      <View style={[s.mealRow, isActive && s.mealRowActive]}>
        <TouchableOpacity
          style={s.mealInfo}
          onPress={() => onOpenMeal(meal, plan.id)}
          onLongPress={drag}
          delayLongPress={250}
          activeOpacity={0.7}
        >
          <Text style={s.mealName} numberOfLines={1}>
            {meal.targetTimeHour != null ? `${String(meal.targetTimeHour).padStart(2, '0')}:00  ` : ''}{meal.name}
          </Text>
          <Text style={s.mealMeta}>
            {meal.foods.length} {meal.foods.length === 1 ? 'alimento' : 'alimentos'} · {fmt(meal.plannedMacros.calories)} kcal
          </Text>
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
              {plan.isActive && <View style={s.activeBadge}><Text style={s.activeText}>ATIVO</Text></View>}
            </View>
            <View style={s.pillsRow}>
              {plan.goal && <View style={s.pill}><Text style={s.pillText}>{GOAL_LABELS[plan.goal]}</Text></View>}
              {plan.targetCalories != null && <Text style={s.kcalHint}>{fmt(plan.targetCalories)} kcal</Text>}
            </View>
          </View>
        </View>
        <View style={s.rowRight}>
          <Text style={s.countText}>{plan.mealsCount} ref.</Text>
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
                  <View style={s.macroLine}>
                    <Text style={s.macroLineText}>Total do plano</Text>
                    <Text style={s.macroLineVals}>
                      {fmt(planMacros.calories)} kcal · <Text style={{ color: MACRO_COLORS.protein }}>P {fmt(planMacros.proteinG)}</Text> · <Text style={{ color: MACRO_COLORS.carbs }}>C {fmt(planMacros.carbsG)}</Text> · <Text style={{ color: MACRO_COLORS.fat }}>G {fmt(planMacros.fatG)}</Text>
                    </Text>
                  </View>
                )}
                <DragSortableList
                  data={localMeals}
                  keyExtractor={m => m.id}
                  renderItem={renderMealItem}
                  onReorder={(data) => { setLocalMeals(data); reorderMeals.mutate(data.map(m => m.id)) }}
                  onDragStart={onMealDragStart}
                  onDragEnd={onMealDragEnd}
                  itemHeight={64}
                  itemGap={8}
                />
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
  nameBlock: { flex: 1, minWidth: 0, gap: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { color: '#F0F0F5', fontSize: 17, fontWeight: '500', flexShrink: 1 },
  activeBadge: { backgroundColor: 'rgba(0,230,118,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  activeText: { color: '#00E676', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    backgroundColor: 'rgba(41,121,255,0.06)', borderWidth: 1, borderColor: 'rgba(41,121,255,0.15)',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
  },
  pillText: { color: 'rgba(79,195,247,0.7)', fontSize: 10 },
  kcalHint: { color: '#8A8A9A', fontSize: 11 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  countText: { color: '#8A8A9A', fontSize: 13 },

  measureWrap: { position: 'absolute', left: 0, right: 0, top: 0 },
  mealsWrap: { paddingVertical: 10 },
  loadingRow: { height: 68, justifyContent: 'center', alignItems: 'center' },

  macroLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2, paddingBottom: 10 },
  macroLineText: { color: '#8A8A9A', fontSize: 11, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase' },
  macroLineVals: { color: '#B8B8C4', fontSize: 12 },

  mealRow: {
    flexDirection: 'row', alignItems: 'center', height: 64,
    backgroundColor: '#1A1A22', borderRadius: 12, borderWidth: 1, borderColor: '#252530',
    marginBottom: 8, overflow: 'hidden',
  },
  mealRowActive: {
    backgroundColor: '#1E2030', borderColor: '#2979FF44',
    shadowColor: '#2979FF', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  mealInfo: { flex: 1, minWidth: 0, paddingLeft: 14, paddingVertical: 10 },
  mealName: { color: '#F0F0F5', fontSize: 16, fontWeight: '500' },
  mealMeta: { color: '#8A8A9A', fontSize: 13, marginTop: 3 },
  menuBtn: { paddingRight: 14, paddingLeft: 8 },

  addRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 50, marginBottom: 16,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#2A2A35', borderRadius: 12,
  },
  addText: { color: '#4FC3F7', fontSize: 14 },
})
