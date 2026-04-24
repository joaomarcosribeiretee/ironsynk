import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'

type Props = NativeStackScreenProps<AppStackParamList, 'Profile'>

const GOAL_LABELS: Record<string, string> = {
  HYPERTROPHY: 'Hipertrofia',
  STRENGTH: 'Forca',
  FAT_LOSS: 'Perda de gordura',
  ENDURANCE: 'Resistencia',
  HEALTH: 'Saude',
  PERFORMANCE: 'Performance',
}

export function ProfileScreen({ navigation }: Props) {
  const { user, setUser, logout } = useAuthStore()
  const profile = user?.profile
  const isTrainer = user?.role === 'TRAINER'

  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editName, setEditName] = useState(profile?.name ?? '')
  const [editBio, setEditBio] = useState(profile?.bio ?? '')
  const [editWeight, setEditWeight] = useState(profile?.weightKg?.toString() ?? '')
  const [editHeight, setEditHeight] = useState(profile?.heightCm?.toString() ?? '')

  function getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? '')
      .join('')
  }

  async function handleSave() {
    if (!editName.trim()) {
      Alert.alert('Erro', 'Nome nao pode estar em branco.')
      return
    }
    setLoading(true)
    try {
      const weightKg = editWeight ? Number(editWeight.replace(',', '.')) : undefined
      const heightCm = editHeight ? Number(editHeight.replace(',', '.')) : undefined
      await api.profile.update({
        name: editName.trim(),
        bio: editBio.trim() || undefined,
        weightKg: weightKg && Number.isFinite(weightKg) ? weightKg : undefined,
        heightCm: heightCm && Number.isFinite(heightCm) ? heightCm : undefined,
      })
      const { user: updated } = await api.auth.me()
      setUser(updated)
      setEditing(false)
    } catch (err) {
      Alert.alert('Erro', getFriendlyErrorMessage(err, 'Nao foi possivel salvar o perfil.'))
    } finally {
      setLoading(false)
    }
  }

  function handleCancelEdit() {
    setEditName(profile?.name ?? '')
    setEditBio(profile?.bio ?? '')
    setEditWeight(profile?.weightKg?.toString() ?? '')
    setEditHeight(profile?.heightCm?.toString() ?? '')
    setEditing(false)
  }

  function handleLogout() {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          logout()
        },
      },
    ])
  }

  const displayName = profile?.name || 'Sem nome'
  const initials = getInitials(displayName)

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Meu Perfil</Text>
            {!editing ? (
              <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Editar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleCancelEdit} style={styles.editBtn}>
                <Text style={[styles.editBtnText, { color: '#8A8A9A' }]}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Avatar + name */}
          <View style={styles.avatarSection}>
            <LinearGradient
              colors={['#4FC3F7', '#2979FF']}
              style={styles.avatarCircle}
            >
              <Text style={styles.avatarInitials}>{initials}</Text>
            </LinearGradient>

            {editing ? (
              <View style={styles.inputWrap}>
                <Text style={styles.fieldLabel}>NOME</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.inputText}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Seu nome"
                    placeholderTextColor="#4A4A5A"
                    autoCapitalize="words"
                  />
                </View>
              </View>
            ) : (
              <Text style={styles.displayName}>{displayName}</Text>
            )}

            <View style={[styles.roleBadge, isTrainer ? styles.roleBadgeTrainer : styles.roleBadgeAthlete]}>
              <Text style={styles.roleBadgeText}>{isTrainer ? 'Personal' : 'Atleta'}</Text>
            </View>
          </View>

          {/* Bio */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Bio</Text>
            {editing ? (
              <TextInput
                style={[styles.inputText, styles.bioInput]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Escreva algo sobre voce..."
                placeholderTextColor="#4A4A5A"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.bioText}>
                {profile?.bio || 'Nenhuma bio adicionada ainda.'}
              </Text>
            )}
          </View>

          {/* Stats — athletes only */}
          {!isTrainer && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Estatisticas</Text>
              {editing ? (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>PESO (KG)</Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.inputText}
                        value={editWeight}
                        onChangeText={setEditWeight}
                        placeholder="70"
                        placeholderTextColor="#4A4A5A"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>ALTURA (CM)</Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.inputText}
                        value={editHeight}
                        onChangeText={setEditHeight}
                        placeholder="175"
                        placeholderTextColor="#4A4A5A"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {profile?.weightKg ? `${profile.weightKg} kg` : '—'}
                    </Text>
                    <Text style={styles.statLabel}>Peso</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {profile?.heightCm ? `${profile.heightCm} cm` : '—'}
                    </Text>
                    <Text style={styles.statLabel}>Altura</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {profile?.goal ? GOAL_LABELS[profile.goal] ?? profile.goal : '—'}
                    </Text>
                    <Text style={styles.statLabel}>Objetivo</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Save button (edit mode) */}
          {editing && (
            <TouchableOpacity
              style={{ marginHorizontal: 16, marginTop: 8 }}
              onPress={handleSave}
              disabled={loading}
            >
              <LinearGradient
                colors={['#4FC3F7', '#2979FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Salvar alteracoes</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Logout */}
          {!editing && (
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>Sair da conta</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#141418',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#1E1E24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    color: '#4FC3F7',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#F0F0F5',
    fontSize: 17,
    fontWeight: '700',
  },
  editBtn: {
    width: 70,
    alignItems: 'flex-end',
  },
  editBtnText: {
    color: '#4FC3F7',
    fontSize: 15,
    fontWeight: '600',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  displayName: {
    color: '#F0F0F5',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 4,
  },
  roleBadgeAthlete: {
    backgroundColor: 'rgba(79,195,247,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.4)',
  },
  roleBadgeTrainer: {
    backgroundColor: 'rgba(41,121,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(41,121,255,0.4)',
  },
  roleBadgeText: {
    color: '#4FC3F7',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A35',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  sectionTitle: {
    color: '#8A8A9A',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  bioText: {
    color: '#F0F0F5',
    fontSize: 14,
    lineHeight: 20,
  },
  bioInput: {
    minHeight: 90,
    textAlignVertical: 'top',
    paddingTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#F0F0F5',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    color: '#8A8A9A',
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#2A2A35',
  },
  inputWrap: {
    width: '100%',
    marginBottom: 8,
  },
  fieldLabel: {
    color: '#8A8A9A',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 2,
  },
  inputBox: {
    height: 48,
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputText: {
    color: '#F0F0F5',
    fontSize: 15,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#1E1E24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A35',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FF5252',
    fontSize: 15,
    fontWeight: '600',
  },
})
