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
  Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'
import { ProfileAvatarUploadSection } from './ProfileAvatarUploadSection'

type Props = NativeStackScreenProps<AppStackParamList, 'EditTrainerProfile'>

const SPECIALTY_SUGGESTIONS = [
  'Musculação', 'Emagrecimento', 'Hipertrofia', 'Funcional',
  'CrossFit', 'Mobilidade', 'Reabilitação', 'Idosos',
  'Atletas', 'Nutrição Esportiva',
]

const SEX_OPTIONS = [
  { key: 'male' as const, label: 'Masculino' },
  { key: 'female' as const, label: 'Feminino' },
  { key: 'other' as const, label: 'Outro' },
]

function isoToDisplay(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}

function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8)
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) out += '/'
    out += digits[i]
  }
  return out
}

function displayToIso(str: string): string | undefined {
  const parts = str.split('/')
  if (parts.length !== 3 || parts[2]!.length !== 4) return undefined
  const iso = `${parts[2]}-${parts[1]}-${parts[0]}`
  return isNaN(new Date(iso).getTime()) ? undefined : iso
}

export function EditTrainerProfileScreen({ navigation }: Props) {
  const { user, setUser } = useAuthStore()
  const profile = user?.profile
  const trainerProfile = user?.trainerProfile

  const [name, setName] = useState(profile?.name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [birthDate, setBirthDate] = useState(isoToDisplay(profile?.birthDate))
  const [sex, setSex] = useState<'male' | 'female' | 'other' | null>(profile?.sex ?? null)
  const [weightKg, setWeightKg] = useState(profile?.weightKg?.toString() ?? '')
  const [heightCm, setHeightCm] = useState(profile?.heightCm?.toString() ?? '')
  const [trainerBio, setTrainerBio] = useState(trainerProfile?.bio ?? '')
  const [cref, setCref] = useState(trainerProfile?.cref ?? '')
  const [specialties, setSpecialties] = useState<string[]>(trainerProfile?.specialties ?? [])
  const [specialtyInput, setSpecialtyInput] = useState('')
  const [acceptingClients, setAcceptingClients] = useState(trainerProfile?.acceptingClients ?? true)
  const [loading, setLoading] = useState(false)

  function addSpecialty(value: string) {
    const trimmed = value.trim()
    if (!trimmed || specialties.includes(trimmed)) return
    setSpecialties((prev) => [...prev, trimmed])
    setSpecialtyInput('')
  }

  function removeSpecialty(sp: string) {
    setSpecialties((prev) => prev.filter((s) => s !== sp))
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Erro', 'Nome é obrigatório.')
      return
    }
    const parsedBirthDate = birthDate.trim() ? displayToIso(birthDate.trim()) : undefined
    if (birthDate.trim() && !parsedBirthDate) {
      Alert.alert('Erro', 'Data de nascimento inválida. Use DD/MM/AAAA.')
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
        birthDate: parsedBirthDate,
        sex: sex ?? undefined,
        weightKg: parsedWeight,
        heightCm: parsedHeight,
        trainerBio: trainerBio.trim() || undefined,
        cref: cref.trim() || undefined,
        specialties,
        acceptingClients,
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
          <ProfileAvatarUploadSection nameForInitials={name.trim() || profile?.name || ' '} />

          {/* Personal info */}
          <Text style={s.sectionHeader}>DADOS PESSOAIS</Text>

          <Text style={s.label}>Nome *</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Seu nome"
            placeholderTextColor="#4A4A5A"
            returnKeyType="next"
          />

          <Text style={s.label}>Data de nascimento</Text>
          <TextInput
            style={s.input}
            value={birthDate}
            onChangeText={(t) => setBirthDate(maskDate(t))}
            placeholder="DD/MM/AAAA"
            placeholderTextColor="#4A4A5A"
            keyboardType="numeric"
            maxLength={10}
            returnKeyType="next"
          />

          <Text style={s.label}>Sexo</Text>
          <View style={s.chipsWrap}>
            {SEX_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[s.chip, sex === opt.key && s.chipActive]}
                onPress={() => setSex(sex === opt.key ? null : opt.key)}
              >
                <Text style={[s.chipText, sex === opt.key && s.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

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

          <Text style={s.label}>Bio pessoal</Text>
          <TextInput
            style={[s.input, s.inputMultiline]}
            value={bio}
            onChangeText={setBio}
            placeholder="Uma linha sobre você..."
            placeholderTextColor="#4A4A5A"
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            maxLength={160}
          />
          <Text style={s.charCount}>{bio.length}/160</Text>

          {/* Professional info */}
          <Text style={[s.sectionHeader, { marginTop: 28 }]}>PERFIL PROFISSIONAL</Text>

          <Text style={s.label}>Bio profissional</Text>
          <TextInput
            style={[s.input, s.inputMultiline]}
            value={trainerBio}
            onChangeText={setTrainerBio}
            placeholder="Descreva sua metodologia, experiência e diferenciais..."
            placeholderTextColor="#4A4A5A"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={300}
          />
          <Text style={s.charCount}>{trainerBio.length}/300</Text>

          <Text style={s.label}>CREF</Text>
          <TextInput
            style={s.input}
            value={cref}
            onChangeText={setCref}
            placeholder="ex: 123456-G/SP"
            placeholderTextColor="#4A4A5A"
            autoCapitalize="characters"
            returnKeyType="next"
          />

          <Text style={s.label}>Aceitando novos alunos</Text>
          <View style={s.switchRow}>
            <Text style={s.switchLabel}>
              {acceptingClients ? 'Sim, estou aceitando' : 'Não, estou com agenda cheia'}
            </Text>
            <Switch
              value={acceptingClients}
              onValueChange={setAcceptingClients}
              trackColor={{ false: '#2A2A35', true: 'rgba(41,121,255,0.5)' }}
              thumbColor={acceptingClients ? '#2979FF' : '#4A4A5A'}
            />
          </View>

          <Text style={s.label}>Especialidades</Text>
          {specialties.length > 0 && (
            <View style={s.chipsWrap}>
              {specialties.map((sp) => (
                <TouchableOpacity key={sp} style={s.chipActive} onPress={() => removeSpecialty(sp)}>
                  <Text style={s.chipActiveText}>{sp}</Text>
                  <Ionicons name="close" size={13} color="#4FC3F7" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={s.inputRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={specialtyInput}
              onChangeText={setSpecialtyInput}
              placeholder="Adicionar especialidade..."
              placeholderTextColor="#4A4A5A"
              returnKeyType="done"
              onSubmitEditing={() => addSpecialty(specialtyInput)}
            />
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => addSpecialty(specialtyInput)}
              disabled={!specialtyInput.trim()}
            >
              <Text style={s.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.chipsWrap, { marginTop: 10 }]}>
            {SPECIALTY_SUGGESTIONS.filter((sg) => !specialties.includes(sg)).map((sp) => (
              <TouchableOpacity key={sp} style={s.chip} onPress={() => addSpecialty(sp)}>
                <Text style={s.chipText}>+ {sp}</Text>
              </TouchableOpacity>
            ))}
          </View>
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

  sectionHeader: {
    color: '#8A8A9A', fontSize: 10, fontWeight: '600',
    letterSpacing: 1.2, marginBottom: 4,
  },
  label: { color: '#8A8A9A', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8, marginTop: 20 },
  input: {
    backgroundColor: '#1E1E24', borderRadius: 12,
    borderWidth: 1, borderColor: '#2A2A35',
    color: '#F0F0F5', fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  inputMultiline: { minHeight: 88, paddingTop: 13 },
  charCount: { color: '#4A4A5A', fontSize: 11, textAlign: 'right', marginTop: 4 },
  row: { flexDirection: 'row' },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1E1E24', borderRadius: 12,
    borderWidth: 1, borderColor: '#2A2A35',
    paddingHorizontal: 14, paddingVertical: 13,
  },
  switchLabel: { color: '#F0F0F5', fontSize: 14, flex: 1 },

  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  addBtn: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: '#2979FF', justifyContent: 'center', alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 24, fontWeight: '300', lineHeight: 28 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#2A2A35',
  },
  chipText: { color: '#8A8A9A', fontSize: 12, fontWeight: '500' },
  chipTextActive: { color: '#4FC3F7', fontWeight: '600' },
  chipActive: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(41,121,255,0.15)', borderWidth: 1, borderColor: '#2979FF',
  },
  chipActiveText: { color: '#4FC3F7', fontSize: 12, fontWeight: '600' },
})
