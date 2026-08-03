import React, { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { NutritionPlanListItem, PlanMeal } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import type { AthleteTabParamList } from '../../navigation/AthleteTabNavigator'
import { NutritionPlanCard } from '../../components/NutritionPlanCard'
import { PlanModal } from '../nutrition/PlanModal'
import type { PlanFormData } from '../nutrition/PlanModal'
import { MealModal } from '../nutrition/MealModal'
import type { MealFormData } from '../nutrition/MealModal'
import { showToast } from '../../components/Toast'
import { ConfirmModal } from '../../components/ConfirmModal'
import { ActionSheet, type SheetAction } from '../workout/ActionSheet'

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<AthleteTabParamList, 'Nutrition'>,
  NativeStackNavigationProp<AppStackParamList>
>

export function NutritionScreen() {
  const navigation = useNavigation<Nav>()
  const qc = useQueryClient()

  const [planModal, setPlanModal] = useState<{ open: boolean; editing: NutritionPlanListItem | null }>({ open: false, editing: null })
  const [mealModal, setMealModal] = useState<{ open: boolean; planId: string | null; editing: PlanMeal | null }>({ open: false, planId: null, editing: null })
  const [noPlanDialog, setNoPlanDialog] = useState(false)
  const [activateSheet, setActivateSheet] = useState<{ visible: boolean; actions: SheetAction[] }>({ visible: false, actions: [] })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['nutrition-plans'],
    queryFn: () => api.nutrition.listPlans(),
    staleTime: 30_000,
  })
  const plans = data?.data.plans ?? []

  // Active-plan today summary powers the "follow today" CTA (analog of Treino Livre).
  const { data: todayData } = useQuery({
    queryKey: ['nutrition-today'],
    queryFn: () => api.nutrition.today(),
    staleTime: 15_000,
  })
  const today = todayData?.data

  useFocusEffect(useCallback(() => { refetch() }, [refetch]))

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['nutrition-plans'] })
    qc.invalidateQueries({ queryKey: ['nutrition-today'] })
  }

  const createPlan = useMutation({
    mutationFn: (body: PlanFormData) => api.nutrition.createPlan({
      name: body.name,
      ...(body.goal ? { goal: body.goal } : {}),
    }),
    onSuccess: () => invalidate(),
    onError: () => showToast('Falha ao criar plano', 'error'),
  })
  const updatePlan = useMutation({
    mutationFn: ({ id, body }: { id: string; body: PlanFormData }) => api.nutrition.updatePlan(id, body),
    onSuccess: () => { invalidate(); showToast('Plano atualizado') },
    onError: () => showToast('Falha ao salvar plano', 'error'),
  })
  const createMeal = useMutation({
    mutationFn: ({ planId, body }: { planId: string; body: MealFormData }) =>
      api.nutrition.createMeal(planId, { name: body.name, ...(body.targetTimeHour != null ? { targetTimeHour: body.targetTimeHour } : {}) }),
    onSuccess: (res, vars) => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['nutrition-plan', vars.planId] })
      navigation.navigate('MealDetail', { mealId: res.data.meal.id, planId: vars.planId, mealName: res.data.meal.name })
    },
    onError: () => showToast('Falha ao criar refeição', 'error'),
  })
  const updateMeal = useMutation({
    mutationFn: ({ id, planId, body }: { id: string; planId: string; body: MealFormData }) => api.nutrition.updateMeal(id, body),
    onSuccess: (_, vars) => { invalidate(); qc.invalidateQueries({ queryKey: ['nutrition-plan', vars.planId] }) },
    onError: () => showToast('Falha ao atualizar refeição', 'error'),
  })

  const activatePlan = useMutation({
    mutationFn: (id: string) => api.nutrition.activatePlan(id),
    onSuccess: () => { invalidate(); showToast('Plano ativado', 'success'); navigation.navigate('NutritionToday') },
    onError: () => showToast('Erro ao ativar plano', 'error'),
  })

  const openCreatePlan = useCallback(() => setPlanModal({ open: true, editing: null }), [])

  // "Acompanhar Hoje" is the module's primary action, so the card is always on
  // screen. Without an active plan the tap explains what is missing instead of
  // opening an empty day.
  function handleFollowToday() {
    if (today?.plan) { navigation.navigate('NutritionToday'); return }
    setNoPlanDialog(true)
  }

  function handleNoPlanConfirm() {
    setNoPlanDialog(false)
    if (plans.length === 0) { openCreatePlan(); return }
    setActivateSheet({
      visible: true,
      actions: [
        ...plans.map(p => ({ label: p.name, onPress: () => activatePlan.mutate(p.id) })),
        { label: 'Cancelar', cancel: true, onPress: () => {} },
      ],
    })
  }

  async function handleSavePlan(form: PlanFormData) {
    if (planModal.editing) await updatePlan.mutateAsync({ id: planModal.editing.id, body: form })
    else await createPlan.mutateAsync(form)
  }
  async function handleSaveMeal(form: MealFormData) {
    if (mealModal.editing && mealModal.planId) await updateMeal.mutateAsync({ id: mealModal.editing.id, planId: mealModal.planId, body: form })
    else if (mealModal.planId) await createMeal.mutateAsync({ planId: mealModal.planId, body: form })
  }

  const ListHeader = (
    <View>
      <TouchableOpacity onPress={handleFollowToday} activeOpacity={0.85}>
        <LinearGradient colors={['#2979FF', '#1A237E']} style={s.todayBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Ionicons name="today-outline" size={20} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={s.todayBtnText}>Acompanhar Hoje</Text>
            <Text style={s.todayBtnSub}>
              {today?.plan
                ? `${today.plan.name}${today.totals ? ` · ${today.totals.adherencePercent}% concluído` : ''}`
                : 'Nenhum plano ativo'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
        </LinearGradient>
      </TouchableOpacity>
      <View style={s.spacer} />
      <View style={s.sectionRow}>
        <Text style={s.sectionLabel}>PLANOS</Text>
        <TouchableOpacity onPress={openCreatePlan} activeOpacity={0.7}>
          <View style={s.novoBtn}><Text style={s.novoBtnText}>Novo +</Text></View>
        </TouchableOpacity>
      </View>
    </View>
  )

  const ListEmpty = isLoading ? (
    <View>
      {[0, 1, 2].map(i => (
        <View key={i} style={s.skeleton}>
          <View style={s.skeletonLeft}>
            <View style={s.skeletonChev} />
            <View style={{ gap: 6, flex: 1 }}>
              <View style={[s.skeletonLine, { width: '52%' }]} />
              <View style={[s.skeletonLine, { width: '28%', height: 10 }]} />
            </View>
          </View>
          <View style={[s.skeletonLine, { width: 52, height: 10 }]} />
        </View>
      ))}
    </View>
  ) : (
    <View style={s.emptyState}>
      <View style={s.emptyIconWrap}>
        <Ionicons name="nutrition-outline" size={28} color="#4FC3F7" />
      </View>
      <Text style={s.emptyTitle}>Nenhum plano</Text>
      <Text style={s.emptySub}>Crie seu primeiro plano alimentar</Text>
      <TouchableOpacity onPress={openCreatePlan} activeOpacity={0.85} style={s.emptyBtnWrap}>
        <LinearGradient colors={['#2979FF', '#1565C0']} style={s.emptyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={s.emptyBtnText}>Criar plano</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  )

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Dieta</Text>
        <TouchableOpacity onPress={openCreatePlan} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="add-outline" size={26} color="#F0F0F5" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {ListHeader}
        {isLoading || plans.length === 0 ? ListEmpty : (
          plans.map((plan) => (
            <NutritionPlanCard
              key={plan.id}
              plan={plan}
              onEditPlan={(p) => setPlanModal({ open: true, editing: p })}
              onAddMeal={(planId) => setMealModal({ open: true, planId, editing: null })}
              onEditMeal={(meal, planId) => setMealModal({ open: true, planId, editing: meal })}
              onOpenMeal={(meal, planId) => navigation.navigate('MealDetail', { mealId: meal.id, planId, mealName: meal.name })}
            />
          ))
        )}
      </ScrollView>

      <PlanModal
        visible={planModal.open}
        editing={planModal.editing}
        onClose={() => setPlanModal({ open: false, editing: null })}
        onSave={handleSavePlan}
      />
      <MealModal
        visible={mealModal.open}
        editing={mealModal.editing}
        onClose={() => setMealModal({ open: false, planId: null, editing: null })}
        onSave={handleSaveMeal}
      />
      <ConfirmModal
        visible={noPlanDialog}
        title="Nenhum plano ativo"
        message={plans.length === 0
          ? 'Crie um plano alimentar para acompanhar suas refeições de hoje.'
          : 'Ative um dos seus planos para acompanhar as refeições de hoje.'}
        confirmText={plans.length === 0 ? 'Criar plano' : 'Ativar plano'}
        onConfirm={handleNoPlanConfirm}
        onCancel={() => setNoPlanDialog(false)}
      />
      <ActionSheet
        visible={activateSheet.visible}
        title="Ativar plano"
        actions={activateSheet.actions}
        onClose={() => setActivateSheet({ visible: false, actions: [] })}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14,
  },
  headerTitle: { color: '#F0F0F5', fontSize: 26, fontWeight: '500' },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  todayBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  todayBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  todayBtnSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },

  spacer: { height: 24 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionLabel: { color: '#8A8A9A', fontSize: 11, fontWeight: '500', letterSpacing: 1.2 },
  novoBtn: {
    backgroundColor: 'rgba(41,121,255,0.12)', borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5,
  },
  novoBtnText: { color: '#4FC3F7', fontSize: 13, fontWeight: '500' },

  skeleton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 58, borderBottomWidth: 0.5, borderBottomColor: '#2A2A35',
  },
  skeletonLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  skeletonChev: { width: 16, height: 16, borderRadius: 4, backgroundColor: '#2A2A35' },
  skeletonLine: { height: 13, borderRadius: 6, backgroundColor: '#2A2A35' },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyIconWrap: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(79,195,247,0.08)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  emptyTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '500' },
  emptySub: { color: '#8A8A9A', fontSize: 14, marginBottom: 4 },
  emptyBtnWrap: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  emptyBtn: { paddingVertical: 12, paddingHorizontal: 28 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
})
