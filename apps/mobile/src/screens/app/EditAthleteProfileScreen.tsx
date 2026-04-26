import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'

type Props = NativeStackScreenProps<AppStackParamList, 'EditAthleteProfile'>

const GOAL_OPTIONS = [
  { key: 'HYPERTROPHY', label: 'Hipertrofia' },
  { key: 'STRENGTH', label: 'Força' },
  { key: 'FAT_LOSS', label: 'Perda de gordura' },
  { key: 'ENDURANCE', label: 'Resistência' },
  { key: 'HEALTH', label: 'Saúde' },
  { key: 'PERFORMANCE', label: 'Performance' },
]

const EXPERIENCE_OPTIONS = [
  { key: 'beginner', label: 'Iniciante' },
  { key: 'intermediate', label: 'Intermediário' },
  { key: 'advanced', label: 'Avançado' },
]

const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7]

export function EditAthleteProfileScreen({ navigation }: Props) {
  const { user, setUser } = useAuthStore()
  const profile = user?.profile

  const [name, setName] = useState(profile?.name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [weightKg, setWeightKg] = useState(profile?.weightKg?.toString() ?? '')
  const [heightCm, setHeightCm] = useState(profile?.heightCm?.toString() ?? '')
  const [goal, setGoal] = useState<string | null>(profile?.goal ?? null)
  const [experience, setExperience] = useState<string | null>(profile?.experience ?? null)
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(profile?.daysPerWeek ?? null)
  const [gymName, setGymName] = useState(profile?.gymName ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Erro', 'Nome é obrigatório.')
      return
    }
    const parsedWeight = weightKg.trim() ? parseFloat(weightKg.replace(',', '.')) : undefined
    const parsedHeight = heightCm.trim() ? parseFloat(heightCm.replace(',', '.')) : undefined
    if (parsedWeight !== undefined && (isNaN(parsedWeight) || parsedWeight <= 0)) {
      Alert.alert('Erro', 'Peso inválido.')
      return
    }
    if (parsedHeight !== undefined && (isNaN(parsedHeight) || parsedHeight <= 0)) {
      Alert.alert('Erro', 'Altura inválida.')
      return
    }
    setLoading(true)
    try {
      await api.profile.update({
        name: name.trim(),
        bio: bio.trim() || undefined,
        weightKg: parsedWeight,
        heightCm: parsedHeight,
        goal: goal ?? undefined,
        experience: experience ?? undefined,
        daysPerWeek: daysPerWeek ?? undefined,
        gymName: gymName.trim() || undefined,
      })
      const { data: { user: updated } } = await api.auth.me()
      setUser(updated)
      navigation.goBack()
    } catch (err) {
      Alert.alert('Erro', getFriendlyErrorMessage(err, 'Não foi possível salvar.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Text style={s.headerBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Editar Perfil</Text>
          <TouchableOpacity
            style={[s.saveBtn, loading && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.saveBtnText}>Salvar</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.form}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.label}>Nome *</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Seu nome"
            placeholderTextColor="#4A4A5A"
            returnKeyType="next"
          />

          <Text style={s.label}>Bio</Text>
          <TextInput
            style={[s.input, s.inputMultiline]}
            value={bio}
            onChangeText={setBio}
            placeholder="Fale um pouco sobre você..."
            placeholderTextColor="#4A4A5A"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Peso (kg)</Text>
              <TextInput
                style={s.input}
                value={weightKg}
                onChangeText={setWeightKg}
                placeholder="ex: 75"
                placeholderTextColor="#4A4A5A"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Altura (cm)</Text>
              <TextInput
                style={s.input}
                value={heightCm}
                onChangeText={setHeightCm}
                placeholder="ex: 175"
                placeholderTextColor="#4A4A5A"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={s.label}>Objetivo</Text>
          <View style={s.chipsWrap}>
            {GOAL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[s.chip, goal === opt.key && s.chipActive]}
                onPress={() => setGoal(goal === opt.key ? null : opt.key)}
              >
                <Text style={[s.chipText, goal === opt.key && s.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Experiência</Text>
          <View style={s.chipsWrap}>
            {EXPERIENCE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[s.chip, experience === opt.key && s.chipActive]}
                onPress={() => setExperience(experience === opt.key ? null : opt.key)}
              >
                <Text style={[s.chipText, experience === opt.key && s.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Dias por semana</Text>
          <View style={s.chipsWrap}>
            {DAYS_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[s.chip, s.chipSquare, daysPerWeek === d && s.chipActive]}
                onPress={() => setDaysPerWeek(daysPerWeek === d ? null : d)}
              >
                <Text style={[s.chipText, daysPerWeek === d && s.chipTextActive]}>{d}x</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Academia</Text>
          <TextInput
            style={s.input}
            value={gymName}
            onChangeText={setGymName}
            placeholder="Nome da sua academia"
            placeholderTextColor="#4A4A5A"
            returnKeyType="done"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#2A2A35',
  },
  headerBtn: {
    width: 40, height: 40, backgroundColor: '#1E1E24',
    borderRadius: 12, borderWidth: 1, borderColor: '#2A2A35',
    justifyContent: 'center', alignItems: 'center',
  },
  headerBtnText: { color: '#4FC3F7', fontSize: 22, fontWeight: '700', lineHeight: 24 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#F0F0F5', fontSize: 17, fontWeight: '700' },
  saveBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#2979FF', borderRadius: 10,
    minWidth: 64, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  form: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },

  label: { color: '#8A8A9A', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8, marginTop: 20 },
  input: {
    backgroundColor: '#1E1E24', borderRadius: 12,
    borderWidth: 1, borderColor: '#2A2A35',
    color: '#F0F0F5', fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  inputMultiline: { minHeight: 88, paddingTop: 13 },
  row: { flexDirection: 'row' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#2A2A35',
  },
  chipSquare: { paddingHorizontal: 12 },
  chipActive: { backgroundColor: 'rgba(41,121,255,0.15)', borderColor: '#2979FF' },
  chipText: { color: '#8A8A9A', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#4FC3F7', fontWeight: '600' },
})
