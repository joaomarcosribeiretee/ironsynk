import React, { useEffect, useState } from 'react'
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { FoodSearchResult, ServingUnit } from '../../lib/api'
import {
  MACRO_COLORS, fmt, macrosForQuantity, baseUnitOf, hasServing, servingOptionLabel,
} from '../../lib/nutrition'
import { showToast } from '../../components/Toast'

export type PortionPayload = {
  quantityG: number
  servingUnit: ServingUnit
  servingQuantity: number
}

type Props = {
  visible: boolean
  mealName: string
  onClose: () => void
  onAdd: (foodId: string, portion: PortionPayload) => Promise<void>
}

type Mode = 'search' | 'quantity' | 'custom'

function useDebounced(value: string, delay = 350): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function FoodSearchModal({ visible, mealName, onClose, onAdd }: Props) {
  const [mode, setMode] = useState<Mode>('search')
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query.trim())
  const [selected, setSelected] = useState<FoodSearchResult | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [unit, setUnit] = useState<ServingUnit>('g')
  const [adding, setAdding] = useState(false)

  // Custom food form
  const [cName, setCName] = useState('')
  const [cCal, setCCal] = useState('')
  const [cProtein, setCProtein] = useState('')
  const [cCarbs, setCCarbs] = useState('')
  const [cFat, setCFat] = useState('')
  const [cFiber, setCFiber] = useState('')

  useEffect(() => {
    if (visible) {
      setMode('search'); setQuery(''); setSelected(null); setQuantity('100'); setUnit('g'); setAdding(false)
      setCName(''); setCCal(''); setCProtein(''); setCCarbs(''); setCFat(''); setCFiber('')
    }
  }, [visible])

  const search = useQuery({
    queryKey: ['food-search', debounced],
    queryFn: () => api.nutrition.searchFoods(debounced),
    enabled: visible && debounced.length >= 2,
    staleTime: 60_000,
  })
  const results = search.data?.data.results ?? []

  const createFood = useMutation({
    mutationFn: (body: Parameters<typeof api.nutrition.createFood>[0]) => api.nutrition.createFood(body),
  })

  function pickFood(food: FoodSearchResult) {
    setSelected(food)
    // Weight/volume is the safe default: it needs nothing from the source.
    setUnit(baseUnitOf(food))
    setQuantity('100')
    setMode('quantity')
  }

  // Switching unit re-anchors the amount, since "100 servings" is never what
  // the user meant by "100 g".
  function pickUnit(next: ServingUnit) {
    if (next === unit) return
    setUnit(next)
    setQuantity(next === 'serving' ? '1' : '100')
  }

  async function handleConfirmAdd() {
    if (!selected || adding) return
    if (count <= 0) {
      showToast('Informe uma quantidade válida', 'warning')
      return
    }
    setAdding(true)
    try {
      // Open Food Facts hits aren't persisted yet — cache to get a local id.
      let foodId = selected.id
      if (selected.source === 'off') {
        if (!selected.sourceId) throw new Error('missing sourceId')
        const cached = await api.nutrition.cacheOffFood(selected.sourceId)
        foodId = cached.data.food.id
      }
      await onAdd(foodId, { quantityG, servingUnit: unit, servingQuantity: count })
      onClose()
    } catch {
      showToast('Falha ao adicionar alimento', 'error')
      setAdding(false)
    }
  }

  async function handleCreateCustom() {
    const cal = parseFloat(cCal.replace(',', '.'))
    const p = parseFloat(cProtein.replace(',', '.'))
    const c = parseFloat(cCarbs.replace(',', '.'))
    const f = parseFloat(cFat.replace(',', '.'))
    const fib = cFiber.trim() ? parseFloat(cFiber.replace(',', '.')) : undefined
    if (!cName.trim() || ![cal, p, c, f].every((n) => Number.isFinite(n) && n >= 0)) {
      showToast('Preencha nome e macros (por 100g)', 'warning')
      return
    }
    try {
      const res = await createFood.mutateAsync({
        name: cName.trim(),
        calories: cal, proteinG: p, carbsG: c, fatG: f,
        ...(fib !== undefined && Number.isFinite(fib) ? { fiberG: fib } : {}),
      })
      setSelected(res.data.food)
      setUnit(baseUnitOf(res.data.food))
      setQuantity('100')
      setMode('quantity')
    } catch {
      showToast('Falha ao criar alimento', 'error')
    }
  }

  // Typed amount → grams → macros. Servings multiply the size the source
  // published for this food; nothing else is ever converted.
  const count = Math.max(parseFloat(quantity.replace(',', '.')) || 0, 0)
  const quantityG = unit === 'serving' ? Math.round(count * (selected?.servingSizeG ?? 0) * 100) / 100 : count
  const preview = selected ? macrosForQuantity(selected, quantityG) : null
  const step = unit === 'serving' ? 1 : 10

  function nudge(delta: number) {
    const next = Math.round((count + delta) * 100) / 100
    setQuantity(String(next > 0 ? next : step))
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent presentationStyle="fullScreen">
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => (mode === 'search' ? onClose() : setMode('search'))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={mode === 'search' ? 'close' : 'chevron-back'} size={24} color="#F0F0F5" />
          </TouchableOpacity>
          {/* The selected food is the subject of the quantity step, so the
              header only carries the meal it is going into. */}
          <Text style={s.headerTitle} numberOfLines={1}>
            {mode === 'custom' ? 'Novo alimento' : mealName}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {mode === 'search' && (
            <>
              <View style={s.searchWrap}>
                <Ionicons name="search" size={18} color="#8A8A9A" />
                <TextInput
                  style={s.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar alimento..."
                  placeholderTextColor="#4A4A5A"
                  autoFocus
                  returnKeyType="search"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color="#4A4A5A" />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.listPad}>
                {debounced.length < 2 ? (
                  <View style={s.hintWrap}>
                    <Ionicons name="restaurant-outline" size={26} color="#4A4A5A" />
                    <Text style={s.hint}>Digite ao menos 2 letras para buscar</Text>
                  </View>
                ) : search.isLoading ? (
                  <View style={s.center}><ActivityIndicator color="#4FC3F7" /></View>
                ) : search.isError ? (
                  <View style={s.hintWrap}>
                    <Text style={s.hint}>Erro na busca</Text>
                    <TouchableOpacity onPress={() => search.refetch()} style={s.retryBtn}>
                      <Text style={s.retryText}>Tentar novamente</Text>
                    </TouchableOpacity>
                  </View>
                ) : results.length === 0 ? (
                  <View style={s.hintWrap}>
                    <Text style={s.hint}>Nenhum alimento encontrado</Text>
                    <TouchableOpacity onPress={() => { setCName(query); setMode('custom') }} style={s.retryBtn}>
                      <Text style={s.retryText}>Criar alimento manual</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  results.map((food) => (
                    <TouchableOpacity key={food.id} style={s.foodRow} onPress={() => pickFood(food)} activeOpacity={0.6}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.foodName} numberOfLines={1}>{food.name}</Text>
                        {food.brand ? <Text style={s.foodBrand} numberOfLines={1}>{food.brand}</Text> : null}
                      </View>
                      <View style={s.kcalCol}>
                        <Text style={s.foodKcal}>{fmt(food.calories)} kcal</Text>
                        <Text style={s.kcalRef}>por 100 g</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
                {debounced.length >= 2 && results.length > 0 && (
                  <TouchableOpacity onPress={() => { setCName(query); setMode('custom') }} style={s.customLink}>
                    <Ionicons name="add" size={16} color="#4FC3F7" />
                    <Text style={s.customLinkText}>Criar alimento manual</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </>
          )}

          {mode === 'quantity' && selected && (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.qtyPad}>
              <Text style={s.qtyFoodName}>{selected.name}</Text>
              {selected.brand ? <Text style={s.qtyBrand} numberOfLines={1}>{selected.brand}</Text> : null}
              <Text style={s.qtyRef}>{fmt(selected.calories)} kcal por 100 {baseUnitOf(selected)}</Text>

              <Text style={s.label}>Quantidade</Text>
              <View style={s.stepperRow}>
                <TouchableOpacity style={s.stepBtn} onPress={() => nudge(-step)} activeOpacity={0.7}>
                  <Ionicons name="remove" size={20} color="#8A8A9A" />
                </TouchableOpacity>
                <TextInput
                  style={s.stepInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  placeholder={unit === 'serving' ? '1' : '100'}
                  placeholderTextColor="#4A4A5A"
                  selectTextOnFocus
                  autoFocus
                />
                <TouchableOpacity style={s.stepBtn} onPress={() => nudge(step)} activeOpacity={0.7}>
                  <Ionicons name="add" size={20} color="#8A8A9A" />
                </TouchableOpacity>
              </View>

              {/* Unit choice exists only when the source published a serving. */}
              {hasServing(selected) && (
                <View style={s.unitRow}>
                  <UnitChip
                    label={baseUnitOf(selected)}
                    active={unit !== 'serving'}
                    onPress={() => pickUnit(baseUnitOf(selected))}
                  />
                  <UnitChip
                    label={servingOptionLabel(selected)}
                    active={unit === 'serving'}
                    onPress={() => pickUnit('serving')}
                  />
                </View>
              )}
              {unit === 'serving' && (
                <Text style={s.equivalent}>≈ {fmt(quantityG)} {baseUnitOf(selected)}</Text>
              )}

              {preview && (
                <View style={s.nutriCard}>
                  <View style={s.calBlock}>
                    <Text style={s.calValue}>{fmt(preview.calories)}</Text>
                    <Text style={s.calUnit}>kcal</Text>
                  </View>
                  <View style={s.divider} />
                  <MacroRow label="Proteína" value={`${Math.round(preview.proteinG)}g`} color={MACRO_COLORS.protein} />
                  <MacroRow label="Carboidratos" value={`${Math.round(preview.carbsG)}g`} color={MACRO_COLORS.carbs} />
                  <MacroRow label="Gorduras" value={`${Math.round(preview.fatG)}g`} color={MACRO_COLORS.fat} />
                </View>
              )}

              <TouchableOpacity style={s.primaryWrap} onPress={handleConfirmAdd} activeOpacity={0.85} disabled={adding}>
                <LinearGradient colors={['#2979FF', '#1565C0']} style={s.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {adding ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Adicionar à refeição</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          )}

          {mode === 'custom' && (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.qtyPad}>
              <Text style={s.per100}>Informe os valores por 100g.</Text>
              <Text style={s.label}>Nome</Text>
              <TextInput style={s.qtyInput} value={cName} onChangeText={setCName} placeholder="Ex: Frango grelhado" placeholderTextColor="#4A4A5A" />
              <Text style={s.label}>Calorias (kcal)</Text>
              <TextInput style={s.qtyInput} value={cCal} onChangeText={setCCal} keyboardType="numeric" placeholder="0" placeholderTextColor="#4A4A5A" />
              <View style={s.macroInputsRow}>
                <View style={s.macroInputCol}>
                  <Text style={s.label}>Proteína</Text>
                  <TextInput style={s.qtyInput} value={cProtein} onChangeText={setCProtein} keyboardType="numeric" placeholder="0" placeholderTextColor="#4A4A5A" />
                </View>
                <View style={s.macroInputCol}>
                  <Text style={s.label}>Carbo</Text>
                  <TextInput style={s.qtyInput} value={cCarbs} onChangeText={setCCarbs} keyboardType="numeric" placeholder="0" placeholderTextColor="#4A4A5A" />
                </View>
              </View>
              <View style={s.macroInputsRow}>
                <View style={s.macroInputCol}>
                  <Text style={s.label}>Gordura</Text>
                  <TextInput style={s.qtyInput} value={cFat} onChangeText={setCFat} keyboardType="numeric" placeholder="0" placeholderTextColor="#4A4A5A" />
                </View>
                <View style={s.macroInputCol}>
                  <Text style={s.label}>Fibra (opcional)</Text>
                  <TextInput style={s.qtyInput} value={cFiber} onChangeText={setCFiber} keyboardType="numeric" placeholder="—" placeholderTextColor="#4A4A5A" />
                </View>
              </View>

              <TouchableOpacity style={s.primaryWrap} onPress={handleCreateCustom} activeOpacity={0.85} disabled={createFood.isPending}>
                <LinearGradient colors={['#2979FF', '#1565C0']} style={s.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {createFood.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Criar e continuar</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

function UnitChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

// Nutritional detail lives here — this is the only step of the flow that shows
// the full macro breakdown.
function MacroRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.macroRow}>
      <View style={s.macroLeft}>
        <View style={[s.dot, { backgroundColor: color }]} />
        <Text style={s.macroLabel}>{label}</Text>
      </View>
      <Text style={s.macroValue}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { color: '#F0F0F5', fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center', marginHorizontal: 8 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, paddingHorizontal: 14, height: 46,
    backgroundColor: '#1E1E24', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A35',
  },
  searchInput: { flex: 1, color: '#F0F0F5', fontSize: 15 },

  listPad: { padding: 16, paddingTop: 12 },
  center: { paddingVertical: 40, alignItems: 'center' },
  hintWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  hint: { color: '#8A8A9A', fontSize: 14 },
  retryBtn: {
    marginTop: 4, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(41,121,255,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)',
  },
  retryText: { color: '#4FC3F7', fontSize: 13, fontWeight: '500' },

  foodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A2A35',
  },
  foodName: { color: '#F0F0F5', fontSize: 15, fontWeight: '500' },
  foodBrand: { color: '#6A6A7A', fontSize: 12, marginTop: 2 },
  kcalCol: { alignItems: 'flex-end', flexShrink: 0 },
  foodKcal: { color: '#8A8A9A', fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
  kcalRef: { color: '#4A4A5A', fontSize: 10, marginTop: 2 },

  customLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 18 },
  customLinkText: { color: '#4FC3F7', fontSize: 14, fontWeight: '500' },

  qtyPad: { padding: 20 },
  qtyFoodName: { color: '#F0F0F5', fontSize: 20, fontWeight: '600' },
  qtyBrand: { color: '#8A8A9A', fontSize: 13, marginTop: 3 },
  qtyRef: { color: '#6A6A7A', fontSize: 12, marginTop: 6 },
  per100: { color: '#8A8A9A', fontSize: 12, marginTop: 10, lineHeight: 17 },

  label: { color: '#8A8A9A', fontSize: 12, fontWeight: '400', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 18 },
  qtyInput: {
    height: 48, backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 12, paddingHorizontal: 16, color: '#F0F0F5', fontSize: 16,
  },
  macroInputsRow: { flexDirection: 'row', gap: 12 },
  macroInputCol: { flex: 1 },

  stepperRow: {
    flexDirection: 'row', alignItems: 'center',
    height: 52, backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 14, overflow: 'hidden',
  },
  stepBtn: { width: 52, height: '100%', alignItems: 'center', justifyContent: 'center' },
  stepInput: {
    flex: 1, height: '100%', textAlign: 'center',
    color: '#F0F0F5', fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'],
  },

  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#2A2A35',
  },
  chipActive: { backgroundColor: 'rgba(41,121,255,0.12)', borderColor: 'rgba(41,121,255,0.3)' },
  chipText: { color: '#8A8A9A', fontSize: 13 },
  chipTextActive: { color: '#4FC3F7', fontWeight: '500' },
  equivalent: { color: '#6A6A7A', fontSize: 12, marginTop: 10, fontVariant: ['tabular-nums'] },

  nutriCard: {
    backgroundColor: '#1E1E24', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A35',
    padding: 18, marginTop: 20,
  },
  calBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  calValue: { color: '#F0F0F5', fontSize: 28, fontWeight: '600', fontVariant: ['tabular-nums'] },
  calUnit: { color: '#8A8A9A', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#2A2A35', marginVertical: 14 },
  macroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  macroLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  macroLabel: { color: '#8A8A9A', fontSize: 14 },
  macroValue: { color: '#F0F0F5', fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },

  primaryWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 28 },
  primaryBtn: { height: 50, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
