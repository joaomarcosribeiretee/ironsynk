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

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>
type Role = 'ATHLETE' | 'TRAINER'

export function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<Role>('ATHLETE')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()

  async function handleRegister() {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields.')
      return
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.')
      return
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const { user, session } = await api.auth.register({ email: email.trim(), password, role })
      login(user, session)
      navigation.replace('Onboarding')
    } catch (err) {
      Alert.alert('Registration failed', err instanceof Error ? err.message : 'Unknown error')
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
        <View className="flex-1 px-6 pt-16 pb-10">
          {/* Header */}
          <View className="mb-8">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mb-6">
              <Text className="text-cyan text-sm">← Back</Text>
            </TouchableOpacity>
            <Text className="text-text-primary text-3xl font-bold">Create account</Text>
            <Text className="text-text-secondary mt-1">Join the IronSynk community</Text>
          </View>

          {/* Role selector */}
          <View className="mb-6">
            <Text className="text-text-secondary text-xs font-medium mb-3 ml-1">I AM A</Text>
            <View className="flex-row gap-x-3">
              {(['ATHLETE', 'TRAINER'] as Role[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  className={`flex-1 rounded-2xl py-4 items-center border ${
                    role === r ? 'border-blue bg-blue/10' : 'border-border bg-surface'
                  }`}
                  onPress={() => setRole(r)}
                >
                  <Text className={`text-base font-semibold ${role === r ? 'text-cyan' : 'text-text-secondary'}`}>
                    {r === 'ATHLETE' ? '🏋️ Athlete' : '📋 Trainer'}
                  </Text>
                  <Text className={`text-xs mt-1 ${role === r ? 'text-text-primary' : 'text-text-disabled'}`}>
                    {r === 'ATHLETE' ? 'Track my training' : 'Coach clients'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Form fields */}
          <View className="gap-y-4">
            <View>
              <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">EMAIL</Text>
              <TextInput
                className="bg-surface border border-border rounded-2xl px-4 py-3.5 text-text-primary text-base"
                placeholder="you@example.com"
                placeholderTextColor="#4A4A5A"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View>
              <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">PASSWORD</Text>
              <TextInput
                className="bg-surface border border-border rounded-2xl px-4 py-3.5 text-text-primary text-base"
                placeholder="At least 8 characters"
                placeholderTextColor="#4A4A5A"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
              />
            </View>

            <View>
              <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">CONFIRM PASSWORD</Text>
              <TextInput
                className="bg-surface border border-border rounded-2xl px-4 py-3.5 text-text-primary text-base"
                placeholder="Repeat your password"
                placeholderTextColor="#4A4A5A"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
              />
            </View>
          </View>

          {/* Create account button */}
          <TouchableOpacity className="mt-8" onPress={handleRegister} disabled={loading}>
            <LinearGradient
              colors={['#4FC3F7', '#2979FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Create Account</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Login link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-text-secondary text-sm">Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text className="text-cyan text-sm font-medium">Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
