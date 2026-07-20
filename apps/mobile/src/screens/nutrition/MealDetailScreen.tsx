import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { MealFoodRecord } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { MACRO_COLORS, fmt } from '../../lib/nutrition'
import { showToast } from '../../components/Toast'
import { FoodSearchModal } from './FoodSearchModal'
import { QuantityEditModal } from './QuantityEditModal'

type Nav = NativeStackNavigationProp<AppStackParamList>
type Rt = RouteProp<AppStackParamList, 'MealDetail'>

export function MealDetailScreen() {
  const navigation = useNavigation<Nav>()
  const { mealId, planId, mealName } = useRoute<Rt>().params
  const qc = useQueryClient()

  const [foodModal, setFoodModal] = useState(false)
  const [qtyEdit, setQtyEdit] = useState<MealFoodRecord | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['nutrition-plan', planId],
    queryFn: () => api.nutrition.getPlan(planId),
    staleTime: 30_000,
  })
  const meal = data?.data.plan.meals.find(m => m.id === mealId) ?? null
  const foods = meal?.foods ?? []

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['nutrition-plan', planId] })
    qc.invalidateQueries({ queryKey: ['nutrition-plans'] })
    qc.invalidateQueries({ queryKey: ['nutrition-today'] })
  }

  const addFood = useMutation({
    mutationFn: ({ foodId, quantityG }: { foodId: string; quantityG: number }) => api.nutrition.addMealFood(mealId, { foodId, quantityG }),
    onSuccess: () => invalidate(),
  })
  const updateFood = useMutation({
    mutationFn: ({ id, quantityG }: { id: string; quantityG: number }) => api.nutrition.updateMealFood(id, { quantityG }),
    onSuccess: () => invalidate(),
    onError: () => showToast('Erro ao atualizar', 'error'),
  })
  const removeFood = useMutation({
    mutationFn: (id: string) => api.nutrition.removeMealFood(id),
    onSuccess: () => invalidate(),
    onError: () => showToast('Erro ao remover', 'error'),
  })

  const m = meal?.plannedMacros

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{meal?.name ?? mealName}</Text>
        <View style={s.backBtn} />
      </View>

      {/* Meal macro summary */}
      {m && (
        <View style={s.metaRow}>
          <Text style={s.metaText}>{foods.length} {foods.length === 1 ? 'alimento' : 'alimentos'}</Text>
          <View style={s.metaDot} />
          <Text style={s.metaText}>{fmt(m.calories)} kcal</Text>
          <View style={s.metaDot} />
          <Text style={[s.metaText, { color: MACRO_COLORS.protein }]}>P {fmt(m.proteinG)}</Text>
          <Text style={[s.metaText, { color: MACRO_COLORS.carbs }]}> · C {fmt(m.carbsG)}</Text>
          <Text style={[s.metaText, { color: MACRO_COLORS.fat }]}> · G {fmt(m.fatG)}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={s.center}><ActivityIndicator color="#4FC3F7" size="large" /></View>
      ) : isError ? (
        <View style={s.center}>
          <Text style={s.dim}>Erro ao carregar refeição.</Text>
          <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}><Text style={s.retryText}>Tentar novamente</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {foods.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="restaurant-outline" size={48} color="#2A2A35" />
              <Text style={s.emptyTitle}>Nenhum alimento</Text>
              <Text style={s.emptySub}>Adicione alimentos a esta refeição</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setFoodModal(true)} activeOpacity={0.7}>
                <Text style={s.emptyBtnText}>Adicionar alimento</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {foods.map((mf) => (
                <TouchableOpacity key={mf.id} style={s.foodCard} activeOpacity={0.7} onPress={() => setQtyEdit(mf)}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.foodName} numberOfLines={1}>{mf.food.name}</Text>
                    <Text style={s.foodMeta}>{fmt(mf.quantityG)}g · {fmt(mf.macros.calories)} kcal</Text>
                  </View>
                  <View style={s.foodMacros}>
                    <Text style={[s.miniMacro, { color: MACRO_COLORS.protein }]}>P{fmt(mf.macros.proteinG)}</Text>
                    <Text style={[s.miniMacro, { color: MACRO_COLORS.carbs }]}>C{fmt(mf.macros.carbsG)}</Text>
                    <Text style={[s.miniMacro, { color: MACRO_COLORS.fat }]}>G{fmt(mf.macros.fatG)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeFood.mutate(mf.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.trashBtn}>
                    <Ionicons name="close" size={18} color="#555560" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.addRow} onPress={() => setFoodModal(true)} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={16} color="#4FC3F7" />
                <Text style={s.addText}>Adicionar alimento</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      <FoodSearchModal
        visible={foodModal}
        mealName={meal?.name ?? mealName}
        onClose={() => setFoodModal(false)}
        onAdd={async (foodId, quantityG) => { await addFood.mutateAsync({ foodId, quantityG }) }}
      />
      <QuantityEditModal
        mealFood={qtyEdit}
        saving={updateFood.isPending}
        onClose={() => setQtyEdit(null)}
        onSave={async (id, quantityG) => { await updateFood.mutateAsync({ id, quantityG }); setQtyEdit(null) }}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 10, gap: 8 },
  backBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  headerTitle: { flex: 1, color: '#F0F0F5', fontSize: 20, fontWeight: '500' },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 12 },
  metaText: { color: '#8A8A9A', fontSize: 12 },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#3A3A45', marginHorizontal: 8 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  dim: { color: '#8A8A9A', fontSize: 14 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(41,121,255,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)' },
  retryText: { color: '#4FC3F7', fontSize: 13, fontWeight: '500' },

  scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 48 },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '500', marginTop: 8 },
  emptySub: { color: '#8A8A9A', fontSize: 14 },
  emptyBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: 'rgba(41,121,255,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)' },
  emptyBtnText: { color: '#4FC3F7', fontSize: 14, fontWeight: '500' },

  foodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1A1A22', borderRadius: 12, borderWidth: 1, borderColor: '#252530',
    paddingLeft: 14, paddingVertical: 12, marginBottom: 8,
  },
  foodName: { color: '#F0F0F5', fontSize: 15, fontWeight: '500' },
  foodMeta: { color: '#8A8A9A', fontSize: 12, marginTop: 3 },
  foodMacros: { flexDirection: 'row', gap: 8 },
  miniMacro: { fontSize: 11, fontWeight: '600' },
  trashBtn: { paddingRight: 12, paddingLeft: 4 },

  addRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 50, marginTop: 4,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#2A2A35', borderRadius: 12,
  },
  addText: { color: '#4FC3F7', fontSize: 14 },
})
