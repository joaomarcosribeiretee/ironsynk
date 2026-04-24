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
  StyleSheet,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthNavigator'
import { api } from '../../lib/api'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'
import { useAuthStore } from '../../store/authStore'

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Erro', 'Informe seu e-mail e senha.')
      return
    }
    setLoading(true)
    try {
      const { user, session, isOnboarded } = await api.auth.login({ email: email.trim(), password })
      login(user, session)
      if (!isOnboarded) {
        navigation.replace('Onboarding')
      }
    } catch (err) {
      Alert.alert('Falha no login', getFriendlyErrorMessage(err, 'Nao foi possivel entrar agora.'))
    } finally {
      setLoading(false)
    }
  }

  function handleGoogle() {
    Alert.alert('Em breve', 'Login com Google estara disponivel em breve.')
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
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 pt-8 pb-8 items-center justify-center">
          <View className="w-full max-w-[460px]">
          {/* Logo */}
          <View className="items-center mb-12">
            <Text className="text-white font-bold" style={{ fontSize: 32, letterSpacing: 3 }}>
              IRON<Text className="text-cyan">SYNK</Text>
            </Text>
            <Text className="text-text-secondary mt-1 text-sm">Treine. Registre. Evolua.</Text>
          </View>

          {/* Form */}
          <View className="gap-y-4">
            <View>
              <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">E-MAIL</Text>
              <View
                className="h-[52px] bg-surface border border-border rounded-2xl px-4"
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <TextInput
                className="text-text-primary text-base"
                  placeholder="nome@exemplo.com"
                placeholderTextColor="#4A4A5A"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                multiline={false}
                numberOfLines={1}
                textAlignVertical="center"
                style={styles.centeredInputText}
              />
              </View>
            </View>

            <View>
              <Text className="text-text-secondary text-xs font-medium mb-1.5 ml-1">SENHA</Text>
              <View
                className="h-[52px] bg-surface border border-border rounded-2xl px-4"
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <TextInput
                  className="text-text-primary text-base"
                  placeholder="••••••••"
                  placeholderTextColor="#4A4A5A"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  multiline={false}
                  numberOfLines={1}
                  textAlignVertical="center"
                  style={styles.centeredInputText}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#8A8A9A"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Sign in button */}
          <TouchableOpacity className="mt-8" onPress={handleLogin} disabled={!canSubmit}>
            <LinearGradient
              colors={canSubmit ? ['#4FC3F7', '#2979FF'] : ['#2A2A35', '#2A2A35']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 16, paddingVertical: 14, alignItems: 'center', opacity: canSubmit ? 1 : 0.65 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Entrar</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-border" />
            <Text className="text-text-disabled mx-4 text-xs">OU</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          {/* Google button */}
          <TouchableOpacity
            className="border border-border rounded-2xl py-3.5 items-center"
            onPress={handleGoogle}
          >
            <Text className="text-text-primary font-medium text-base">Continuar com Google</Text>
          </TouchableOpacity>

          {/* Register link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-text-secondary text-sm">Nao tem conta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text className="text-cyan text-sm font-medium">Criar conta</Text>
            </TouchableOpacity>
          </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  centeredInputText: {
    flex: 1,
    alignSelf: 'center',
    height: 24,
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
    lineHeight: 20,
    // iOS baseline tends to render slightly lower; this nudges it visually to center.
    transform: [{ translateY: -1 }],
  },
})
