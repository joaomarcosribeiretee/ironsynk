import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
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
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthNavigator'
import { api } from '../../lib/api'
import { ApiError } from '../../lib/api'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'
import { useAuthStore } from '../../store/authStore'

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>
type Role = 'ATHLETE' | 'TRAINER'

const INPUT_HEIGHT = 52

export function RegisterScreen({ navigation }: Props) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [role, setRole] = useState<Role>('ATHLETE')
  const [loading, setLoading] = useState(false)
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false)
  const { login } = useAuthStore()
  const passwordChecks = [
    { label: 'Minimo de 8 caracteres', ok: password.length >= 8 },
    { label: '1 letra maiuscula', ok: /[A-Z]/.test(password) },
    { label: '1 letra minuscula', ok: /[a-z]/.test(password) },
    { label: '1 numero', ok: /[0-9]/.test(password) },
    { label: '1 simbolo', ok: /[^A-Za-z0-9]/.test(password) },
  ]
  const hasStrongPassword = passwordChecks.every((check) => check.ok)
  const isConfirmPasswordValid = confirmPassword.length > 0 && password === confirmPassword
  const isUsernameValid = username.trim().length >= 3
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const canSubmit =
    isUsernameValid &&
    isEmailValid &&
    hasStrongPassword &&
    isConfirmPasswordValid &&
    !loading

  async function handleRegister() {
    setHasTriedSubmit(true)
    if (!canSubmit) {
      return
    }

    setLoading(true)
    try {
      const { user, session } = await api.auth.register({
        username: username.trim(),
        email: email.trim(),
        password,
        role,
      })
      login(user, session)
      navigation.replace('Onboarding')
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Nao foi possivel concluir o cadastro.')
      if (err instanceof ApiError && err.details && err.details.length > 0) {
        Alert.alert('Erro no cadastro', err.details.join('\n'))
        return
      }
      Alert.alert('Erro no cadastro', message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#141418' }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            justifyContent: 'flex-start',
            paddingTop: Platform.OS === 'ios' ? 10 : 6,
            paddingBottom: 24,
            alignItems: 'center',
          }}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: 460, paddingHorizontal: 24 }}>

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 32 }}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: '#1E1E24',
                  borderWidth: 1,
                  borderColor: '#2A2A35',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 14,
                }}
              >
                <Text style={{ color: '#4FC3F7', fontSize: 22, lineHeight: 24, fontWeight: '700' }}>‹</Text>
              </TouchableOpacity>
              <View>
                <Text style={{ color: '#F0F0F5', fontSize: 24, fontWeight: '700' }}>Criar conta</Text>
                <Text style={{ color: '#8A8A9A', fontSize: 13, marginTop: 2 }}>Bem-vindo à comunidade IronSynk</Text>
              </View>
            </View>

            {/* Seletor de perfil */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: '#8A8A9A', fontSize: 11, fontWeight: '600', marginBottom: 10, marginLeft: 2, letterSpacing: 0.5 }}>
                EU SOU
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['ATHLETE', 'TRAINER'] as Role[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={{
                      flex: 1,
                      borderRadius: 14,
                      paddingVertical: 14,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: role === r ? '#2979FF' : '#2A2A35',
                      backgroundColor: role === r ? 'rgba(41,121,255,0.08)' : '#1E1E24',
                    }}
                    onPress={() => setRole(r)}
                  >
                    <Text style={{ fontSize: 20, marginBottom: 4 }}>
                      {r === 'ATHLETE' ? '🏋️' : '📋'}
                    </Text>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: role === r ? '#4FC3F7' : '#8A8A9A',
                    }}>
                      {r === 'ATHLETE' ? 'Atleta' : 'Personal'}
                    </Text>
                    <Text style={{
                      fontSize: 11,
                      marginTop: 2,
                      color: role === r ? '#F0F0F5' : '#4A4A5A',
                    }}>
                      {r === 'ATHLETE' ? 'Treinar e evoluir' : 'Gerenciar alunos'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Campos */}
            <View style={{ gap: 14 }}>
              <View>
                <Text style={{ color: '#8A8A9A', fontSize: 11, fontWeight: '600', marginBottom: 6, marginLeft: 2, letterSpacing: 0.5 }}>
                  NOME DE USUARIO
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                  style={{
                    ...styles.centeredInputText,
                  }}
                  placeholder="Ex: joaosilva"
                  placeholderTextColor="#4A4A5A"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  multiline={false}
                  numberOfLines={1}
                  textAlignVertical="center"
                  maxLength={30}
                />
                </View>
                {(hasTriedSubmit || username.length > 0) && !isUsernameValid && (
                  <Text style={styles.fieldHintError}>Use ao menos 3 caracteres.</Text>
                )}
              </View>

              <View>
                <Text style={{ color: '#8A8A9A', fontSize: 11, fontWeight: '600', marginBottom: 6, marginLeft: 2, letterSpacing: 0.5 }}>
                  E-MAIL
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                  style={{
                    ...styles.centeredInputText,
                  }}
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
                />
                </View>
                {(hasTriedSubmit || email.length > 0) && !isEmailValid && (
                  <Text style={styles.fieldHintError}>Informe um e-mail valido.</Text>
                )}
              </View>

              <View>
                <Text style={{ color: '#8A8A9A', fontSize: 11, fontWeight: '600', marginBottom: 6, marginLeft: 2, letterSpacing: 0.5 }}>
                  SENHA
                </Text>
                <View
                  style={styles.inputContainer}
                >
                  <TextInput
                    style={styles.centeredInputText}
                    placeholder="Crie uma senha forte"
                    placeholderTextColor="#4A4A5A"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    multiline={false}
                    numberOfLines={1}
                    textAlignVertical="center"
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

              <View style={{ backgroundColor: '#1B1B22', borderColor: '#2A2A35', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 6 }}>
                <Text style={{ color: '#8A8A9A', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>
                  REQUISITOS DA SENHA
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {passwordChecks.map((check) => (
                  <View
                    key={check.label}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      minWidth: '48%',
                    }}
                  >
                    <Text style={{ color: check.ok ? '#00E676' : '#8A8A9A', fontSize: 12 }}>
                      {check.ok ? '✓' : '•'}
                    </Text>
                    <Text style={{ color: check.ok ? '#F0F0F5' : '#8A8A9A', fontSize: 12 }}>
                      {check.label}
                    </Text>
                  </View>
                ))}
                </View>
              </View>

              <View>
                <Text style={{ color: '#8A8A9A', fontSize: 11, fontWeight: '600', marginBottom: 6, marginLeft: 2, letterSpacing: 0.5 }}>
                  CONFIRMAR SENHA
                </Text>
                <View
                  style={styles.inputContainer}
                >
                  <TextInput
                    style={styles.centeredInputText}
                    placeholder="Repita a senha"
                    placeholderTextColor="#4A4A5A"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoComplete="new-password"
                    multiline={false}
                    numberOfLines={1}
                    textAlignVertical="center"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword((v) => !v)}
                    style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#8A8A9A"
                    />
                  </TouchableOpacity>
                </View>
                {(hasTriedSubmit || confirmPassword.length > 0) && !isConfirmPasswordValid && (
                  <Text style={styles.fieldHintError}>A confirmacao precisa ser igual a senha.</Text>
                )}
              </View>
            </View>

            {/* Botão criar conta */}
            <TouchableOpacity style={{ marginTop: 28 }} onPress={handleRegister} disabled={!canSubmit}>
              <LinearGradient
                colors={canSubmit ? ['#4FC3F7', '#2979FF'] : ['#2A2A35', '#2A2A35']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center', opacity: canSubmit ? 1 : 0.65 }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Criar Conta</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Link login */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
              <Text style={{ color: '#8A8A9A', fontSize: 13 }}>Já tem conta? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={{ color: '#4FC3F7', fontSize: 13, fontWeight: '500' }}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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
    fontSize: 15,
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
