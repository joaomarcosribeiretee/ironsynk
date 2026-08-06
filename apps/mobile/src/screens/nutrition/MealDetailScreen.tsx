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
import { MACRO_COLORS, fmt, servingLabel } from '../../lib/nutrition'
import { showToast } from '../../components/Toast'
import { ActionSheet } from '../workout/ActionSheet'
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
  const [sheetFood, setSheetFood] = useState<MealFoodRecord | null>(null)

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
  const target = sheetFood

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{meal?.name ?? mealName}</Text>
        <View style={s.backBtn} />
      </View>

      {/* Quiet nutritional summary: calories lead, macros stay secondary. Hidden
          while the meal is empty so the empty state owns the screen. */}
      {m && foods.length > 0 && (
        <View style={s.summary}>
          <View style={s.calBlock}>
            <Text style={s.calValue}>{fmt(m.calories)}</Text>
            <Text style={s.calUnit}>kcal no total</Text>
          </View>
          <View style={s.macroRow}>
            <Macro label="Proteína" grams={m.proteinG} color={MACRO_COLORS.protein} />
            <Macro label="Carboidratos" grams={m.carbsG} color={MACRO_COLORS.carbs} />
            <Macro label="Gorduras" grams={m.fatG} color={MACRO_COLORS.fat} />
          </View>
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
              <Ionicons name="restaurant-outline" size={28} color="#2A2A35" />
              <Text style={s.emptyText}>Nenhum alimento nesta refeição</Text>
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
                    <Text style={s.foodMeta}>{servingLabel(mf)} · {fmt(mf.macros.calories)} kcal</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSheetFood(mf)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={s.moreBtn}
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color="#555560" />
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
      <ActionSheet
        visible={target !== null}
        title={target?.food.name}
        onClose={() => setSheetFood(null)}
        actions={target ? [
          { label: 'Editar quantidade', onPress: () => setQtyEdit(target) },
          { label: 'Remover', destructive: true, onPress: () => removeFood.mutate(target.id) },
          { label: 'Cancelar', cancel: true, onPress: () => {} },
        ] : []}
      />
    </SafeAreaView>
  )
}

function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <View style={s.macroItem}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={s.macroText}>{label} {Math.round(grams)}g</Text>
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 10, gap: 8 },
  backBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  headerTitle: { flex: 1, color: '#F0F0F5', fontSize: 20, fontWeight: '500' },

  summary: {
    paddingHorizontal: 16, paddingBottom: 12, marginBottom: 8, gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A2A35',
  },
  calBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  calValue: { color: '#F0F0F5', fontSize: 22, fontWeight: '600', fontVariant: ['tabular-nums'] },
  calUnit: { color: '#8A8A9A', fontSize: 12 },
  macroRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  macroItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  macroText: { color: '#8A8A9A', fontSize: 12, fontVariant: ['tabular-nums'] },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  dim: { color: '#8A8A9A', fontSize: 14 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(41,121,255,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)' },
  retryText: { color: '#4FC3F7', fontSize: 13, fontWeight: '500' },

  scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 48 },

  emptyWrap: { alignItems: 'center', paddingTop: 36, gap: 10 },
  emptyText: { color: '#8A8A9A', fontSize: 14 },
  emptyBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 11, backgroundColor: 'rgba(41,121,255,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)' },
  emptyBtnText: { color: '#4FC3F7', fontSize: 14, fontWeight: '500' },

  foodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1A1A22', borderRadius: 12, borderWidth: 1, borderColor: '#252530',
    paddingLeft: 14, paddingVertical: 12, marginBottom: 8,
  },
  foodName: { color: '#F0F0F5', fontSize: 15, fontWeight: '500' },
  foodMeta: { color: '#8A8A9A', fontSize: 12, marginTop: 3, fontVariant: ['tabular-nums'] },
  moreBtn: { paddingRight: 12, paddingLeft: 4 },

  addRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 50, marginTop: 4,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#2A2A35', borderRadius: 12,
  },
  addText: { color: '#4FC3F7', fontSize: 14 },
})
