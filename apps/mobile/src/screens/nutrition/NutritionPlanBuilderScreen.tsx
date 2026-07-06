import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Pressable, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { MealFoodRecord, PlanMeal } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { MACRO_COLORS, fmt, sumMacros } from '../../lib/nutrition'
import { showToast } from '../../components/Toast'
import { FoodSearchModal } from './FoodSearchModal'
import { PlanModal } from './PlanModal'
import type { PlanFormData } from './PlanModal'
import { MealModal } from './MealModal'
import type { MealFormData } from './MealModal'
import { ConfirmModal } from '../../components/ConfirmModal'

const { width: SCREEN_W } = Dimensions.get('window')

type Nav = NativeStackNavigationProp<AppStackParamList>
type Rt = RouteProp<AppStackParamList, 'NutritionPlanBuilder'>

export function NutritionPlanBuilderScreen() {
  const navigation = useNavigation<Nav>()
  const { planId } = useRoute<Rt>().params
  const qc = useQueryClient()

  const [planModal, setPlanModal] = useState(false)
  const [mealModal, setMealModal] = useState<{ open: boolean; editing: PlanMeal | null }>({ open: false, editing: null })
  const [foodModal, setFoodModal] = useState<{ open: boolean; meal: PlanMeal | null }>({ open: false, meal: null })
  const [qtyEdit, setQtyEdit] = useState<MealFoodRecord | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ mealId: string; name: string } | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['nutrition-plan', planId],
    queryFn: () => api.nutrition.getPlan(planId),
  })
  const plan = data?.data.plan
  const meals = plan?.meals ?? []

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['nutrition-plan', planId] })
    qc.invalidateQueries({ queryKey: ['nutrition-plans'] })
    qc.invalidateQueries({ queryKey: ['nutrition-today'] })
  }

  const updatePlan = useMutation({
    mutationFn: (body: PlanFormData) => api.nutrition.updatePlan(planId, body),
    onSuccess: () => { invalidate(); showToast('Plano atualizado', 'success') },
    onError: () => showToast('Falha ao salvar plano', 'error'),
  })
  const createMeal = useMutation({
    mutationFn: (body: MealFormData) => api.nutrition.createMeal(planId, { name: body.name, ...(body.targetTimeHour != null ? { targetTimeHour: body.targetTimeHour } : {}) }),
    onSuccess: () => invalidate(),
    onError: () => showToast('Falha ao criar refeição', 'error'),
  })
  const updateMeal = useMutation({
    mutationFn: ({ id, body }: { id: string; body: MealFormData }) => api.nutrition.updateMeal(id, body),
    onSuccess: () => invalidate(),
    onError: () => showToast('Falha ao atualizar refeição', 'error'),
  })
  const deleteMeal = useMutation({
    mutationFn: (id: string) => api.nutrition.deleteMeal(id),
    onSuccess: () => { invalidate(); showToast('Refeição removida') },
    onError: () => showToast('Falha ao remover refeição', 'error'),
  })
  const reorderMeals = useMutation({
    mutationFn: (mealIds: string[]) => api.nutrition.reorderMeals(planId, mealIds),
    onSuccess: () => invalidate(),
    onError: () => showToast('Falha ao reordenar', 'error'),
  })
  const addFood = useMutation({
    mutationFn: ({ mealId, foodId, quantityG }: { mealId: string; foodId: string; quantityG: number }) =>
      api.nutrition.addMealFood(mealId, { foodId, quantityG }),
    onSuccess: () => invalidate(),
  })
  const updateFood = useMutation({
    mutationFn: ({ id, quantityG }: { id: string; quantityG: number }) => api.nutrition.updateMealFood(id, { quantityG }),
    onSuccess: () => invalidate(),
    onError: () => showToast('Falha ao atualizar', 'error'),
  })
  const removeFood = useMutation({
    mutationFn: (id: string) => api.nutrition.removeMealFood(id),
    onSuccess: () => invalidate(),
    onError: () => showToast('Falha ao remover', 'error'),
  })

  const planMacros = sumMacros(meals.map((m) => m.plannedMacros))

  async function handleSavePlan(form: PlanFormData) { await updatePlan.mutateAsync(form) }
  async function handleSaveMeal(form: MealFormData) {
    if (mealModal.editing) await updateMeal.mutateAsync({ id: mealModal.editing.id, body: form })
    else await createMeal.mutateAsync(form)
  }
  function moveMeal(index: number, dir: -1 | 1) {
    const next = index + dir
    if (next < 0 || next >= meals.length) return
    const ids = meals.map((m) => m.id)
    ;[ids[index], ids[next]] = [ids[next]!, ids[index]!]
    reorderMeals.mutate(ids)
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Header title="Plano" onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator color="#4FC3F7" /></View>
      </SafeAreaView>
    )
  }
  if (isError || !plan) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Header title="Plano" onBack={() => navigation.goBack()} />
        <View style={s.center}>
          <Text style={s.errText}>Não foi possível carregar o plano.</Text>
          <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}><Text style={s.retryText}>Tentar novamente</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Header
        title={plan.name}
        onBack={() => navigation.goBack()}
        right={<TouchableOpacity onPress={() => setPlanModal(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Ionicons name="create-outline" size={22} color="#F0F0F5" /></TouchableOpacity>}
      />

      <ScrollView contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}>
        {/* Full plan macros */}
        <View style={s.planCard}>
          <Text style={s.planCardLabel}>MACROS DO PLANO</Text>
          <View style={s.planMacroRow}>
            <MacroStat value={fmt(planMacros.calories)} unit="kcal" color="#F0F0F5" />
            <MacroStat value={fmt(planMacros.proteinG)} unit="Prot" color={MACRO_COLORS.protein} />
            <MacroStat value={fmt(planMacros.carbsG)} unit="Carb" color={MACRO_COLORS.carbs} />
            <MacroStat value={fmt(planMacros.fatG)} unit="Gord" color={MACRO_COLORS.fat} />
          </View>
          {(plan.targetCalories != null) && (
            <Text style={s.planTargetHint}>Meta: {fmt(plan.targetCalories)} kcal</Text>
          )}
        </View>

        <View style={s.sectionRow}>
          <Text style={s.sectionLabel}>REFEIÇÕES</Text>
          <TouchableOpacity onPress={() => setMealModal({ open: true, editing: null })} activeOpacity={0.7}>
            <View style={s.novoBtn}><Text style={s.novoBtnText}>Nova +</Text></View>
          </TouchableOpacity>
        </View>

        {meals.length === 0 ? (
          <View style={s.emptyMeals}>
            <Ionicons name="restaurant-outline" size={26} color="#4A4A5A" />
            <Text style={s.emptyMealsText}>Nenhuma refeição ainda</Text>
            <TouchableOpacity onPress={() => setMealModal({ open: true, editing: null })} style={s.retryBtn}>
              <Text style={s.retryText}>Adicionar refeição</Text>
            </TouchableOpacity>
          </View>
        ) : (
          meals.map((meal, index) => (
            <View key={meal.id} style={s.mealCard}>
              <View style={s.mealHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.mealName}>{meal.name}</Text>
                  <Text style={s.mealMeta}>
                    {meal.targetTimeHour != null ? `${String(meal.targetTimeHour).padStart(2, '0')}:00 · ` : ''}
                    {fmt(meal.plannedMacros.calories)} kcal · P {fmt(meal.plannedMacros.proteinG)} · C {fmt(meal.plannedMacros.carbsG)} · G {fmt(meal.plannedMacros.fatG)}
                  </Text>
                </View>
                <View style={s.mealActions}>
                  <TouchableOpacity disabled={index === 0} onPress={() => moveMeal(index, -1)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="chevron-up" size={18} color={index === 0 ? '#3A3A45' : '#8A8A9A'} />
                  </TouchableOpacity>
                  <TouchableOpacity disabled={index === meals.length - 1} onPress={() => moveMeal(index, 1)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="chevron-down" size={18} color={index === meals.length - 1 ? '#3A3A45' : '#8A8A9A'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setMealModal({ open: true, editing: meal })} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="create-outline" size={18} color="#8A8A9A" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setConfirmDelete({ mealId: meal.id, name: meal.name })} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="trash-outline" size={18} color="#FF5252" />
                  </TouchableOpacity>
                </View>
              </View>

              {meal.foods.map((mf) => (
                <TouchableOpacity key={mf.id} style={s.foodRow} activeOpacity={0.7} onPress={() => setQtyEdit(mf)}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.foodName} numberOfLines={1}>{mf.food.name}</Text>
                    <Text style={s.foodMeta}>{fmt(mf.quantityG)}g · {fmt(mf.macros.calories)} kcal</Text>
                  </View>
                  <View style={s.foodMacros}>
                    <Text style={[s.miniMacro, { color: MACRO_COLORS.protein }]}>P{fmt(mf.macros.proteinG)}</Text>
                    <Text style={[s.miniMacro, { color: MACRO_COLORS.carbs }]}>C{fmt(mf.macros.carbsG)}</Text>
                    <Text style={[s.miniMacro, { color: MACRO_COLORS.fat }]}>G{fmt(mf.macros.fatG)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeFood.mutate(mf.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={16} color="#4A4A5A" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={s.addFoodBtn} onPress={() => setFoodModal({ open: true, meal })} activeOpacity={0.7}>
                <Ionicons name="add" size={16} color="#4FC3F7" />
                <Text style={s.addFoodText}>Adicionar alimento</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <PlanModal visible={planModal} editing={plan} onClose={() => setPlanModal(false)} onSave={handleSavePlan} />
      <MealModal visible={mealModal.open} editing={mealModal.editing} onClose={() => setMealModal({ open: false, editing: null })} onSave={handleSaveMeal} />
      <FoodSearchModal
        visible={foodModal.open}
        mealName={foodModal.meal?.name ?? 'Refeição'}
        onClose={() => setFoodModal({ open: false, meal: null })}
        onAdd={async (foodId, quantityG) => {
          if (foodModal.meal) await addFood.mutateAsync({ mealId: foodModal.meal.id, foodId, quantityG })
        }}
      />
      <QuantityEditModal
        mealFood={qtyEdit}
        saving={updateFood.isPending}
        onClose={() => setQtyEdit(null)}
        onSave={async (id, quantityG) => { await updateFood.mutateAsync({ id, quantityG }); setQtyEdit(null) }}
      />
      <ConfirmModal
        visible={!!confirmDelete}
        title="Remover refeição"
        message={confirmDelete ? `"${confirmDelete.name}" e seus alimentos serão removidos.` : ''}
        confirmText="Remover"
        destructive
        onConfirm={() => { if (confirmDelete) deleteMeal.mutate(confirmDelete.mealId); setConfirmDelete(null) }}
        onCancel={() => setConfirmDelete(null)}
      />
    </SafeAreaView>
  )
}

function Header({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={24} color="#F0F0F5" />
      </TouchableOpacity>
      <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 24, alignItems: 'flex-end' }}>{right}</View>
    </View>
  )
}

function MacroStat({ value, unit, color }: { value: string; unit: string; color: string }) {
  return (
    <View style={s.macroStat}>
      <Text style={[s.macroStatVal, { color }]}>{value}</Text>
      <Text style={s.macroStatUnit}>{unit}</Text>
    </View>
  )
}

function QuantityEditModal({ mealFood, saving, onClose, onSave }: {
  mealFood: MealFoodRecord | null
  saving: boolean
  onClose: () => void
  onSave: (id: string, quantityG: number) => Promise<void>
}) {
  const [qty, setQty] = useState('')
  React.useEffect(() => { if (mealFood) setQty(String(mealFood.quantityG)) }, [mealFood])
  if (!mealFood) return null
  const parsed = parseFloat(qty.replace(',', '.'))
  const valid = Number.isFinite(parsed) && parsed > 0
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.qOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={s.qCard}>
            <Text style={s.qTitle} numberOfLines={1}>{mealFood.food.name}</Text>
            <Text style={s.label}>Quantidade (g)</Text>
            <TextInput style={s.qInput} value={qty} onChangeText={setQty} keyboardType="numeric" autoFocus placeholderTextColor="#4A4A5A" />
            <TouchableOpacity style={[s.qBtnWrap, !valid && { opacity: 0.4 }]} disabled={!valid || saving} onPress={() => valid && onSave(mealFood.id, parsed)} activeOpacity={0.85}>
              <LinearGradient colors={['#2979FF', '#1565C0']} style={s.qBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.qBtnText}>Salvar</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: '#F0F0F5', fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  errText: { color: '#8A8A9A', fontSize: 14 },
  retryBtn: { marginTop: 2, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(41,121,255,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)' },
  retryText: { color: '#4FC3F7', fontSize: 13, fontWeight: '500' },

  scrollPad: { padding: 16, paddingBottom: 48 },

  planCard: { backgroundColor: '#1E1E24', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A35', padding: 16 },
  planCardLabel: { color: '#8A8A9A', fontSize: 11, fontWeight: '500', letterSpacing: 1.2 },
  planMacroRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  planTargetHint: { color: '#8A8A9A', fontSize: 12, marginTop: 12 },
  macroStat: { alignItems: 'center', flex: 1 },
  macroStatVal: { fontSize: 20, fontWeight: '700' },
  macroStatUnit: { color: '#8A8A9A', fontSize: 11, marginTop: 3 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  sectionLabel: { color: '#8A8A9A', fontSize: 11, fontWeight: '500', letterSpacing: 1.2 },
  novoBtn: { backgroundColor: 'rgba(41,121,255,0.12)', borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  novoBtnText: { color: '#4FC3F7', fontSize: 13, fontWeight: '500' },

  emptyMeals: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  emptyMealsText: { color: '#8A8A9A', fontSize: 14 },

  mealCard: { backgroundColor: '#1E1E24', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A35', padding: 14, marginBottom: 12 },
  mealHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  mealName: { color: '#F0F0F5', fontSize: 16, fontWeight: '600' },
  mealMeta: { color: '#8A8A9A', fontSize: 12, marginTop: 3 },
  mealActions: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 8 },

  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: '#2A2A35' },
  foodName: { color: '#F0F0F5', fontSize: 14, fontWeight: '500' },
  foodMeta: { color: '#8A8A9A', fontSize: 12, marginTop: 2 },
  foodMacros: { flexDirection: 'row', gap: 8 },
  miniMacro: { fontSize: 11, fontWeight: '600' },

  addFoodBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 4, borderTopWidth: 0.5, borderTopColor: '#2A2A35' },
  addFoodText: { color: '#4FC3F7', fontSize: 13, fontWeight: '500' },

  qOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  qCard: { width: SCREEN_W - 72, backgroundColor: '#1E1E24', borderRadius: 20, borderWidth: 1, borderColor: '#2A2A35', padding: 20 },
  qTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '600' },
  label: { color: '#8A8A9A', fontSize: 12, fontWeight: '400', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  qInput: { height: 48, backgroundColor: '#141418', borderWidth: 1, borderColor: '#2A2A35', borderRadius: 12, paddingHorizontal: 16, color: '#F0F0F5', fontSize: 16 },
  qBtnWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 18 },
  qBtn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  qBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
})
