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

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login, setIsOnboarded } = useAuthStore()

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.')
      return
    }
    setLoading(true)
    try {
      const { user, session } = await api.auth.login({ email: email.trim(), password })
      login(user, session)
      setIsOnboarded(user.profile != null)
      if (user.profile == null) {
        navigation.replace('Onboarding')
      }
    } catch (err) {
      Alert.alert('Login failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    try {
      const { url } = await api.auth.google()
      const { Linking } = await import('react-native')
      await Linking.openURL(url)
    } catch (err) {
      Alert.alert('Error', 'Could not start Google sign-in')
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
        <View className="flex-1 px-6 pt-20 pb-10">
          {/* Logo */}
          <View className="items-center mb-12">
            <Text className="text-white font-bold" style={{ fontSize: 32, letterSpacing: 3 }}>
              IRON<Text className="text-cyan">SYNK</Text>
            </Text>
            <Text className="text-text-secondary mt-1 text-sm">Train. Track. Evolve.</Text>
          </View>

          {/* Form */}
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
              <View className="relative">
                <TextInput
                  className="bg-surface border border-border rounded-2xl px-4 py-3.5 text-text-primary text-base pr-12"
                  placeholder="••••••••"
                  placeholderTextColor="#4A4A5A"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <TouchableOpacity
                  className="absolute right-4 top-3.5"
                  onPress={() => setShowPassword((v) => !v)}
                >
                  <Text className="text-text-secondary text-sm">{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Sign in button */}
          <TouchableOpacity className="mt-8" onPress={handleLogin} disabled={loading}>
            <LinearGradient
              colors={['#4FC3F7', '#2979FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Sign In</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-border" />
            <Text className="text-text-disabled mx-4 text-xs">OR</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          {/* Google button */}
          <TouchableOpacity
            className="border border-border rounded-2xl py-3.5 items-center"
            onPress={handleGoogle}
          >
            <Text className="text-text-primary font-medium text-base">Continue with Google</Text>
          </TouchableOpacity>

          {/* Register link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-text-secondary text-sm">Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text className="text-cyan text-sm font-medium">Create one</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
