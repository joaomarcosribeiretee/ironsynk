import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthNavigator'
import { api } from '../../lib/api'
import { ApiError } from '../../lib/api'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'
import { useAuthStore } from '../../store/authStore'

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>

type Step1Data = {
  name: string
  birthDate: string
  sex: 'male' | 'female' | 'other' | null
  weightKg: string
  heightCm: string
}

type Step2AthleteData = {
  goal: string | null
  daysPerWeek: number | null
}

type Step2TrainerData = {
  bio: string
  acceptingClients: boolean | null
}

const GOALS = [
  { key: 'HYPERTROPHY', label: 'Hipertrofia', emoji: '💪' },
  { key: 'FAT_LOSS', label: 'Perda de gordura', emoji: '🔥' },
  { key: 'STRENGTH', label: 'Forca', emoji: '🏋️' },
  { key: 'HEALTH', label: 'Saude', emoji: '❤️' },
  { key: 'PERFORMANCE', label: 'Performance', emoji: '⚡' },
]

const DAYS_OPTIONS = [
  { value: 2, label: '1-2 dias' },
  { value: 3, label: '3-4 dias' },
  { value: 5, label: '5+ dias' },
]

const SEX_OPTIONS: { value: 'male' | 'female' | 'other'; label: string }[] = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Feminino' },
  { value: 'other', label: 'Outro' },
]

const INPUT_HEIGHT = 52

export function OnboardingScreen({ navigation }: Props) {
  const { user, setIsOnboarded, setUser } = useAuthStore()
  const isTrainer = user?.role === 'TRAINER'

  const [step, setStep] = useState(1)
  const totalSteps = 2
  const [loading, setLoading] = useState(false)

  const [step1, setStep1] = useState<Step1Data>({
    name: '',
    birthDate: '',
    sex: null,
    weightKg: '',
    heightCm: '',
  })

  const [step2Athlete, setStep2Athlete] = useState<Step2AthleteData>({
    goal: null,
    daysPerWeek: null,
  })

  const [step2Trainer, setStep2Trainer] = useState<Step2TrainerData>({
    bio: '',
    acceptingClients: null,
  })
  const [hasTriedStep1Next, setHasTriedStep1Next] = useState(false)
  const [hasTriedStep2Finish, setHasTriedStep2Finish] = useState(false)
  const isBirthDateValid = /^\d{2}\/\d{2}\/\d{4}$/.test(step1.birthDate)
  const weightValue = Number(step1.weightKg.replace(',', '.'))
  const heightValue = Number(step1.heightCm.replace(',', '.'))
  const isWeightValid = !isTrainer ? step1.weightKg.trim().length > 0 && Number.isFinite(weightValue) && weightValue > 0 : true
  const isHeightValid = !isTrainer ? step1.heightCm.trim().length > 0 && Number.isFinite(heightValue) && heightValue > 0 : true
  const canProceedStep1 =
    step1.name.trim().length >= 2 &&
    isBirthDateValid &&
    step1.sex != null &&
    isWeightValid &&
    isHeightValid
  const canFinish =
    !loading &&
    (isTrainer
      ? step2Trainer.bio.trim().length >= 10 && step2Trainer.acceptingClients != null
      : step2Athlete.goal != null && step2Athlete.daysPerWeek != null)

  function validateStep1(): boolean {
    if (step1.name.trim().length < 2) {
      Alert.alert('Campo obrigatorio', 'Nome deve ter ao menos 2 caracteres.')
      return false
    }
    if (!isBirthDateValid) {
      Alert.alert('Data invalida', 'Preencha sua data de nascimento no formato DD/MM/AAAA.')
      return false
    }
    if (step1.sex == null) {
      Alert.alert('Campo obrigatorio', 'Selecione o sexo biologico.')
      return false
    }
    if (!isTrainer && !isWeightValid) {
      Alert.alert('Campo obrigatorio', 'Informe um peso valido em KG.')
      return false
    }
    if (!isTrainer && !isHeightValid) {
      Alert.alert('Campo obrigatorio', 'Informe uma altura valida em CM.')
      return false
    }
    return true
  }

  function handleNext() {
    setHasTriedStep1Next(true)
    if (step === 1 && !validateStep1()) return
    setStep((s) => s + 1)
  }

  function parseBirthDate(value: string): string | undefined {
    if (!value) return undefined
    const [day, month, year] = value.split('/')
    if (!day || !month || !year) return undefined
    return `${year}-${month}-${day}`
  }

  function formatBirthDateInput(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    if (digits.length <= 2) return digits
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
  }

  async function handleFinish() {
    setHasTriedStep2Finish(true)
    if (!canFinish) return

    setLoading(true)
    try {
      const profilePayload = {
        isOnboarding: true,
        name: step1.name.trim(),
        birthDate: parseBirthDate(step1.birthDate),
        sex: step1.sex ?? undefined,
        weightKg: !isTrainer ? weightValue : undefined,
        heightCm: !isTrainer ? heightValue : undefined,
        ...(isTrainer
          ? { trainerBio: step2Trainer.bio, acceptingClients: step2Trainer.acceptingClients ?? undefined }
          : {
              goal: step2Athlete.goal ?? undefined,
              daysPerWeek: step2Athlete.daysPerWeek ?? undefined,
            }),
      }

      await api.profile.update(profilePayload)

      // Refresh user data
      const { data: { user: updatedUser } } = await api.auth.me()
      setUser(updatedUser)
      setIsOnboarded(true)
    } catch (err) {
      if (err instanceof ApiError && err.details && err.details.length > 0) {
        Alert.alert('Erro', err.details.join('\n'))
        return
      }
      Alert.alert('Erro', getFriendlyErrorMessage(err, 'Falha ao salvar perfil'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}    
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 pt-8 pb-8">
          {/* Progress bar */}
          <View className="mb-8">
            <View className="flex-row justify-between mb-2">
              <Text className="text-text-secondary text-xs">Etapa {step} de {totalSteps}</Text>
              <Text className="text-text-secondary text-xs">{Math.round((step / totalSteps) * 100)}%</Text>
            </View>
            <View className="h-1 bg-surface rounded-full">
              <View
                className="h-1 bg-blue rounded-full"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </View>
          </View>

          {/* Step 1 — Basic info */}
          {step === 1 && (
            <View className="gap-y-5">
              <View>
                <Text className="text-text-primary text-2xl font-bold">Fale sobre voce</Text>
                <Text className="text-text-secondary mt-1">Isso ajuda a personalizar sua experiencia</Text>
              </View>

              <View>
                <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">NOME COMPLETO *</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                  style={styles.centeredInputText}
                  placeholder="Seu nome"
                  placeholderTextColor="#4A4A5A"
                  value={step1.name}
                  onChangeText={(v) => setStep1((s) => ({ ...s, name: v }))}
                  autoCapitalize="words"
                  multiline={false}
                  numberOfLines={1}
                  textAlignVertical="center"
                />
                </View>
                {hasTriedStep1Next && step1.name.trim().length < 2 && (
                  <Text style={styles.fieldHintError}>Nome deve ter ao menos 2 caracteres.</Text>
                )}
              </View>

              <View>
                <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">DATA DE NASCIMENTO *</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                  style={styles.centeredInputText}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#4A4A5A"
                  value={step1.birthDate}
                  onChangeText={(v) => setStep1((s) => ({ ...s, birthDate: formatBirthDateInput(v) }))}
                  keyboardType="numeric"
                  maxLength={10}
                  multiline={false}
                  numberOfLines={1}
                  textAlignVertical="center"
                />
                </View>
                {hasTriedStep1Next && !isBirthDateValid && (
                  <Text style={styles.fieldHintError}>Use o formato DD/MM/AAAA.</Text>
                )}
              </View>

              <View>
                <Text className="text-text-secondary text-xs font-medium mb-2 ml-1">SEXO BIOLOGICO *</Text>
                <View className="flex-row gap-x-2">
                  {SEX_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      className={`flex-1 rounded-2xl py-3 items-center border ${
                        step1.sex === opt.value ? 'border-blue bg-blue/10' : 'border-border bg-surface'
                      }`}
                      onPress={() => setStep1((s) => ({ ...s, sex: opt.value }))}
                    >
                      <Text className={`text-sm font-medium ${step1.sex === opt.value ? 'text-cyan' : 'text-text-secondary'}`}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {hasTriedStep1Next && step1.sex == null && (
                  <Text style={styles.fieldHintError}>Selecione uma opcao.</Text>
                )}
              </View>

              {!isTrainer && (
                <View className="flex-row gap-x-4">
                  <View className="flex-1">
                    <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">PESO (KG) *</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.centeredInputText}
                        placeholder="70"
                        placeholderTextColor="#4A4A5A"
                        value={step1.weightKg}
                        onChangeText={(v) => setStep1((s) => ({ ...s, weightKg: v }))}
                        keyboardType="decimal-pad"
                        multiline={false}
                        numberOfLines={1}
                        textAlignVertical="center"
                      />
                    </View>
                    {hasTriedStep1Next && !isWeightValid && (
                      <Text style={styles.fieldHintError}>Informe um peso valido.</Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">ALTURA (CM) *</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.centeredInputText}
                        placeholder="175"
                        placeholderTextColor="#4A4A5A"
                        value={step1.heightCm}
                        onChangeText={(v) => setStep1((s) => ({ ...s, heightCm: v }))}
                        keyboardType="decimal-pad"
                        multiline={false}
                        numberOfLines={1}
                        textAlignVertical="center"
                      />
                    </View>
                    {hasTriedStep1Next && !isHeightValid && (
                      <Text style={styles.fieldHintError}>Informe uma altura valida.</Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Step 2 — Athlete */}
          {step === 2 && !isTrainer && (
            <View className="gap-y-5">
              <View>
                <Text className="text-text-primary text-2xl font-bold">Seus objetivos</Text>
                <Text className="text-text-secondary mt-1">Vamos personalizar sua experiencia com base nisso</Text>
              </View>

              <View>
                <Text className="text-text-secondary text-xs font-medium mb-3 ml-1">OBJETIVO PRINCIPAL *</Text>
                <View className="gap-y-2">
                  {GOALS.map((g) => (
                    <TouchableOpacity
                      key={g.key}
                      className={`flex-row items-center rounded-2xl px-4 py-3.5 border ${
                        step2Athlete.goal === g.key ? 'border-blue bg-blue/10' : 'border-border bg-surface'
                      }`}
                      onPress={() => setStep2Athlete((s) => ({ ...s, goal: g.key }))}
                    >
                      <Text className="text-xl mr-3">{g.emoji}</Text>
                      <Text className={`text-base font-medium ${step2Athlete.goal === g.key ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {g.label}
                      </Text>
                      {step2Athlete.goal === g.key && (
                        <Text className="ml-auto text-cyan text-lg">✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                {hasTriedStep2Finish && step2Athlete.goal == null && (
                  <Text style={styles.fieldHintError}>Selecione um objetivo.</Text>
                )}
              </View>

              <View>
                <Text className="text-text-secondary text-xs font-medium mb-3 ml-1">DIAS DISPONIVEIS POR SEMANA *</Text>
                <View className="flex-row gap-x-2">
                  {DAYS_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      className={`flex-1 rounded-2xl py-3.5 items-center border ${
                        step2Athlete.daysPerWeek === opt.value ? 'border-blue bg-blue/10' : 'border-border bg-surface'
                      }`}
                      onPress={() => setStep2Athlete((s) => ({ ...s, daysPerWeek: opt.value }))}
                    >
                      <Text className={`text-xs font-medium text-center ${step2Athlete.daysPerWeek === opt.value ? 'text-cyan' : 'text-text-secondary'}`}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {hasTriedStep2Finish && step2Athlete.daysPerWeek == null && (
                  <Text style={styles.fieldHintError}>Selecione os dias por semana.</Text>
                )}
              </View>
            </View>
          )}

          {/* Step 2 — Trainer */}
          {step === 2 && isTrainer && (
            <View className="gap-y-5">
              <View>
                <Text className="text-text-primary text-2xl font-bold">Seu perfil profissional</Text>
                <Text className="text-text-secondary mt-1">Os atletas verao isso na sua pagina</Text>
              </View>

              <View>
                <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">BIO PROFISSIONAL *</Text>
                <TextInput
                  className="bg-surface border border-border rounded-2xl px-4 py-3 text-text-primary text-base"
                  placeholder="Conte aos atletas sobre sua experiencia e especialidades..."
                  placeholderTextColor="#4A4A5A"
                  value={step2Trainer.bio}
                  onChangeText={(v) => setStep2Trainer((s) => ({ ...s, bio: v }))}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  style={{ minHeight: 120 }}
                />
                {hasTriedStep2Finish && step2Trainer.bio.trim().length < 10 && (
                  <Text style={styles.fieldHintError}>Bio deve ter ao menos 10 caracteres.</Text>
                )}
              </View>

              <View>
                <Text className="text-text-secondary text-xs font-medium mb-3 ml-1">ACEITANDO NOVOS ALUNOS? *</Text>
                <View className="flex-row gap-x-3">
                  {[true, false].map((val) => (
                    <TouchableOpacity
                      key={String(val)}
                      className={`flex-1 rounded-2xl py-3.5 items-center border ${
                        step2Trainer.acceptingClients === val ? 'border-blue bg-blue/10' : 'border-border bg-surface'
                      }`}
                      onPress={() => setStep2Trainer((s) => ({ ...s, acceptingClients: val }))}
                    >
                      <Text className={`text-base font-medium ${step2Trainer.acceptingClients === val ? 'text-cyan' : 'text-text-secondary'}`}>
                        {val ? 'Sim' : 'Nao'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {hasTriedStep2Finish && step2Trainer.acceptingClients == null && (
                  <Text style={styles.fieldHintError}>Selecione Sim ou Nao.</Text>
                )}
              </View>
            </View>
          )}

          {/* Navigation buttons */}
          <View className="mt-auto pt-8">
            {step < totalSteps ? (
              <TouchableOpacity onPress={handleNext} disabled={!canProceedStep1}>
                <LinearGradient
                  colors={canProceedStep1 ? ['#4FC3F7', '#2979FF'] : ['#2A2A35', '#2A2A35']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 16, paddingVertical: 14, alignItems: 'center', opacity: canProceedStep1 ? 1 : 0.65 }}
                >
                  <Text className="text-white font-bold text-base">Continuar</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleFinish} disabled={!canFinish}>
                <LinearGradient
                  colors={canFinish ? ['#4FC3F7', '#2979FF'] : ['#2A2A35', '#2A2A35']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 16, paddingVertical: 14, alignItems: 'center', opacity: canFinish ? 1 : 0.65 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-base">Concluir 🚀</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {step > 1 && (
              <TouchableOpacity className="items-center mt-4" onPress={() => setStep((s) => s - 1)}>
                <Text className="text-text-secondary text-sm">← Voltar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  inputContainer: {
    height: INPUT_HEIGHT,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  centeredInputText: {
    flex: 1,
    height: '100%',
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
    color: '#F0F0F5',
    fontSize: 16,
    lineHeight: 20,
    transform: [{ translateY: -1 }],
  },
  fieldHintError: {
    color: '#FF5252',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 2,
  },
})
