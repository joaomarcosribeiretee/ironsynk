import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Switch, Alert, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'

export function SettingsScreen() {
  const navigation = useNavigation()
  const { user, setUser, logout } = useAuthStore()
  const isPrivate = user?.profile?.isPrivate ?? false
  const [privacyLoading, setPrivacyLoading] = useState(false)

  async function handlePrivacyToggle() {
    setPrivacyLoading(true)
    try {
      await api.profile.update({ isPrivate: !isPrivate })
      const { data: { user: u } } = await api.auth.me()
      setUser(u)
    } catch (err) {
      Alert.alert('Erro', getFriendlyErrorMessage(err, 'Não foi possível atualizar.'))
    } finally {
      setPrivacyLoading(false)
    }
  }

  function handleLogout() {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => logout() },
    ])
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Configurações</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>CONTA</Text>
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.rowLabel}>Perfil Privado</Text>
            <Switch
              value={isPrivate}
              onValueChange={handlePrivacyToggle}
              disabled={privacyLoading}
              trackColor={{ false: '#2A2A35', true: 'rgba(41,121,255,0.5)' }}
              thumbColor={isPrivate ? '#2979FF' : '#4A4A5A'}
            />
          </View>
        </View>
      </View>

      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#F0F0F5', fontSize: 17, fontWeight: '600' },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { color: '#8A8A9A', fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 10 },
  card: { backgroundColor: '#1E1E24', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A35' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  rowLabel: { color: '#F0F0F5', fontSize: 14 },
  logoutBtn: { marginTop: 32, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#FF5252', fontSize: 15, fontWeight: '600' },
})
