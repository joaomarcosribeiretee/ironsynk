import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../../lib/api'
import type { NutritionPlanListItem } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { fmt } from '../../lib/nutrition'
import { showToast } from '../../components/Toast'
import { PlanModal } from './PlanModal'
import type { PlanFormData } from './PlanModal'
import { ConfirmModal } from '../../components/ConfirmModal'

type Nav = NativeStackNavigationProp<AppStackParamList>

export function NutritionPlansScreen() {
  const navigation = useNavigation<Nav>()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<NutritionPlanListItem | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['nutrition-plans'],
    queryFn: () => api.nutrition.listPlans(),
  })
  const plans = data?.data.plans ?? []

  useFocusEffect(React.useCallback(() => { refetch() }, [refetch]))

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['nutrition-plans'] })
    qc.invalidateQueries({ queryKey: ['nutrition-today'] })
  }

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
      invalidate()
      navigation.navigate('NutritionPlanBuilder', { planId: res.data.plan.id })
    },
    onError: () => showToast('Falha ao criar plano', 'error'),
  })

  const activate = useMutation({
    mutationFn: (id: string) => api.nutrition.activatePlan(id),
    onSuccess: () => { invalidate(); showToast('Plano ativado', 'success') },
    onError: () => showToast('Falha ao ativar plano', 'error'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.nutrition.deletePlan(id),
    onSuccess: () => { invalidate(); showToast('Plano excluído') },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'PLAN_IN_USE') {
        showToast('Plano prescrito a um aluno não pode ser excluído', 'warning')
      } else {
        showToast('Falha ao excluir plano', 'error')
      }
    },
  })

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Meus planos</Text>
        <TouchableOpacity onPress={() => setCreateOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="add-outline" size={26} color="#F0F0F5" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={s.center}><ActivityIndicator color="#4FC3F7" /></View>
        ) : isError ? (
          <View style={s.center}>
            <Text style={s.dim}>Erro ao carregar planos.</Text>
            <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}><Text style={s.retryText}>Tentar novamente</Text></TouchableOpacity>
          </View>
        ) : plans.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}><Ionicons name="clipboard-outline" size={28} color="#4FC3F7" /></View>
            <Text style={s.emptyTitle}>Nenhum plano</Text>
            <Text style={s.emptySub}>Crie seu primeiro plano alimentar</Text>
            <TouchableOpacity onPress={() => setCreateOpen(true)} activeOpacity={0.85} style={s.emptyBtnWrap}>
              <LinearGradient colors={['#2979FF', '#1565C0']} style={s.emptyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={s.emptyBtnText}>Criar plano</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          plans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[s.planRow, plan.isActive && s.planRowActive]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('NutritionPlanBuilder', { planId: plan.id })}
            >
              <View style={{ flex: 1 }}>
                <View style={s.planTitleRow}>
                  <Text style={s.planName} numberOfLines={1}>{plan.name}</Text>
                  {plan.isActive && <View style={s.activeBadge}><Text style={s.activeText}>ATIVO</Text></View>}
                </View>
                <Text style={s.planMeta}>
                  {plan.mealsCount} refeiç{plan.mealsCount === 1 ? 'ão' : 'ões'}
                  {plan.targetCalories != null ? ` · ${fmt(plan.targetCalories)} kcal` : ''}
                </Text>
              </View>
              <View style={s.planActions}>
                {!plan.isActive && (
                  <TouchableOpacity onPress={() => activate.mutate(plan.id)} style={s.activateBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={s.activateText}>Ativar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setConfirmDelete(plan)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={18} color="#FF5252" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <PlanModal visible={createOpen} onClose={() => setCreateOpen(false)} onSave={async (d) => { await createPlan.mutateAsync(d) }} />
      <ConfirmModal
        visible={!!confirmDelete}
        title="Excluir plano"
        message={confirmDelete ? `"${confirmDelete.name}" e suas refeições serão excluídos.` : ''}
        confirmText="Excluir"
        destructive
        onConfirm={() => { if (confirmDelete) remove.mutate(confirmDelete.id); setConfirmDelete(null) }}
        onCancel={() => setConfirmDelete(null)}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: '#F0F0F5', fontSize: 18, fontWeight: '600' },
  scrollPad: { padding: 16, paddingBottom: 40 },
  center: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  dim: { color: '#8A8A9A', fontSize: 14 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(41,121,255,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)' },
  retryText: { color: '#4FC3F7', fontSize: 13, fontWeight: '500' },

  empty: { alignItems: 'center', paddingVertical: 56, gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(79,195,247,0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '500' },
  emptySub: { color: '#8A8A9A', fontSize: 14, marginBottom: 4 },
  emptyBtnWrap: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  emptyBtn: { paddingVertical: 12, paddingHorizontal: 28 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },

  planRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1E1E24', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A35',
    padding: 16, marginBottom: 10,
  },
  planRowActive: { borderColor: 'rgba(0,230,118,0.4)' },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { color: '#F0F0F5', fontSize: 16, fontWeight: '600', flexShrink: 1 },
  activeBadge: { backgroundColor: 'rgba(0,230,118,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  activeText: { color: '#00E676', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  planMeta: { color: '#8A8A9A', fontSize: 12, marginTop: 4 },
  planActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  activateBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(41,121,255,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)' },
  activateText: { color: '#4FC3F7', fontSize: 12, fontWeight: '600' },
})
