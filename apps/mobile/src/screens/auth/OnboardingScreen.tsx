import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthNavigator'
import { api } from '../../lib/api'
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
  acceptingClients: boolean
}

const GOALS = [
  { key: 'HYPERTROPHY', label: 'Hypertrophy', emoji: '💪' },
  { key: 'FAT_LOSS', label: 'Fat Loss', emoji: '🔥' },
  { key: 'STRENGTH', label: 'Strength', emoji: '🏋️' },
  { key: 'HEALTH', label: 'Health', emoji: '❤️' },
  { key: 'PERFORMANCE', label: 'Performance', emoji: '⚡' },
]

const DAYS_OPTIONS = [
  { value: 2, label: '1–2 days' },
  { value: 3, label: '3–4 days' },
  { value: 5, label: '5+ days' },
]

const SEX_OPTIONS: { value: 'male' | 'female' | 'other'; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

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
    acceptingClients: true,
  })

  function validateStep1(): boolean {
    if (!step1.name.trim()) {
      Alert.alert('Missing field', 'Please enter your name.')
      return false
    }
    if (step1.birthDate && !/^\d{2}\/\d{2}\/\d{4}$/.test(step1.birthDate)) {
      Alert.alert('Invalid date', 'Use format DD/MM/YYYY.')
      return false
    }
    return true
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return
    setStep((s) => s + 1)
  }

  function parseBirthDate(value: string): string | undefined {
    if (!value) return undefined
    const [day, month, year] = value.split('/')
    if (!day || !month || !year) return undefined
    return `${year}-${month}-${day}`
  }

  async function handleFinish() {
    if (isTrainer && !step2Trainer.bio.trim()) {
      Alert.alert('Missing field', 'Please enter your professional bio.')
      return
    }

    setLoading(true)
    try {
      const profilePayload = {
        name: step1.name.trim(),
        birthDate: parseBirthDate(step1.birthDate),
        sex: step1.sex ?? undefined,
        weightKg: step1.weightKg ? parseFloat(step1.weightKg) : undefined,
        heightCm: step1.heightCm ? parseFloat(step1.heightCm) : undefined,
        ...(isTrainer
          ? { bio: step2Trainer.bio, acceptingClients: step2Trainer.acceptingClients }
          : {
              goal: step2Athlete.goal ?? undefined,
              daysPerWeek: step2Athlete.daysPerWeek ?? undefined,
            }),
      }

      await api.profile.update(profilePayload)

      // Refresh user data
      const { user: updatedUser } = await api.auth.me()
      setUser(updatedUser)
      setIsOnboarded(true)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 pt-14 pb-10">
          {/* Progress bar */}
          <View className="mb-8">
            <View className="flex-row justify-between mb-2">
              <Text className="text-text-secondary text-xs">Step {step} of {totalSteps}</Text>
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
                <Text className="text-text-primary text-2xl font-bold">Tell us about yourself</Text>
                <Text className="text-text-secondary mt-1">This helps personalize your experience</Text>
              </View>

              <View>
                <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">FULL NAME *</Text>
                <TextInput
                  className="bg-surface border border-border rounded-2xl px-4 py-3.5 text-text-primary text-base"
                  placeholder="Your name"
                  placeholderTextColor="#4A4A5A"
                  value={step1.name}
                  onChangeText={(v) => setStep1((s) => ({ ...s, name: v }))}
                  autoCapitalize="words"
                />
              </View>

              <View>
                <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">DATE OF BIRTH</Text>
                <TextInput
                  className="bg-surface border border-border rounded-2xl px-4 py-3.5 text-text-primary text-base"
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#4A4A5A"
                  value={step1.birthDate}
                  onChangeText={(v) => setStep1((s) => ({ ...s, birthDate: v }))}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              <View>
                <Text className="text-text-secondary text-xs font-medium mb-2 ml-1">BIOLOGICAL SEX</Text>
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
              </View>

              <View className="flex-row gap-x-4">
                <View className="flex-1">
                  <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">WEIGHT (KG)</Text>
                  <TextInput
                    className="bg-surface border border-border rounded-2xl px-4 py-3.5 text-text-primary text-base"
                    placeholder="70"
                    placeholderTextColor="#4A4A5A"
                    value={step1.weightKg}
                    onChangeText={(v) => setStep1((s) => ({ ...s, weightKg: v }))}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">HEIGHT (CM)</Text>
                  <TextInput
                    className="bg-surface border border-border rounded-2xl px-4 py-3.5 text-text-primary text-base"
                    placeholder="175"
                    placeholderTextColor="#4A4A5A"
                    value={step1.heightCm}
                    onChangeText={(v) => setStep1((s) => ({ ...s, heightCm: v }))}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Step 2 — Athlete */}
          {step === 2 && !isTrainer && (
            <View className="gap-y-5">
              <View>
                <Text className="text-text-primary text-2xl font-bold">Your training goals</Text>
                <Text className="text-text-secondary mt-1">We'll tailor your experience around these</Text>
              </View>

              <View>
                <Text className="text-text-secondary text-xs font-medium mb-3 ml-1">PRIMARY GOAL</Text>
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
              </View>

              <View>
                <Text className="text-text-secondary text-xs font-medium mb-3 ml-1">DAYS AVAILABLE PER WEEK</Text>
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
              </View>
            </View>
          )}

          {/* Step 2 — Trainer */}
          {step === 2 && isTrainer && (
            <View className="gap-y-5">
              <View>
                <Text className="text-text-primary text-2xl font-bold">Your professional profile</Text>
                <Text className="text-text-secondary mt-1">Athletes will see this on your page</Text>
              </View>

              <View>
                <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">PROFESSIONAL BIO *</Text>
                <TextInput
                  className="bg-surface border border-border rounded-2xl px-4 py-3 text-text-primary text-base"
                  placeholder="Tell athletes about your experience, specialties, and coaching philosophy..."
                  placeholderTextColor="#4A4A5A"
                  value={step2Trainer.bio}
                  onChangeText={(v) => setStep2Trainer((s) => ({ ...s, bio: v }))}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  style={{ minHeight: 120 }}
                />
              </View>

              <View>
                <Text className="text-text-secondary text-xs font-medium mb-3 ml-1">ACCEPTING NEW CLIENTS?</Text>
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
                        {val ? 'Yes' : 'No'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Navigation buttons */}
          <View className="mt-auto pt-8">
            {step < totalSteps ? (
              <TouchableOpacity onPress={handleNext}>
                <LinearGradient
                  colors={['#4FC3F7', '#2979FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text className="text-white font-bold text-base">Continue</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleFinish} disabled={loading}>
                <LinearGradient
                  colors={['#4FC3F7', '#2979FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-base">Let's go 🚀</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {step > 1 && (
              <TouchableOpacity className="items-center mt-4" onPress={() => setStep((s) => s - 1)}>
                <Text className="text-text-secondary text-sm">← Back</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
