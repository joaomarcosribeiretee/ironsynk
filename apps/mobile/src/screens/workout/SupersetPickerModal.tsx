import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { TrainingExerciseRecord } from '../../lib/api'

interface SupersetPickerModalProps {
  visible: boolean
  type: 'BISET' | 'SUPERSET'
  sourceTeId: string
  exercises: TrainingExerciseRecord[]
  onConfirm: (targetTeIds: string[]) => void
  onClose: () => void
}

export function SupersetPickerModal({
  visible,
  type,
  sourceTeId,
  exercises,
  onConfirm,
  onClose,
}: SupersetPickerModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!visible) return
    setSelectedIds(new Set())
  }, [visible])

  const label = type === 'BISET' ? 'Biset' : 'Superset'
  const isMulti = type === 'SUPERSET'
  const candidates = exercises.filter(te => te.id !== sourceTeId && !te.supersetGroupId)

  function toggle(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handlePick(id: string) {
    if (!isMulti) {
      onConfirm([id])
    }
  }

  function handleConfirmMulti() {
    if (selectedIds.size === 0) return
    onConfirm([...selectedIds])
  }

  const sourceExercise = exercises.find(te => te.id === sourceTeId)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.titleRow}>
            <View>
              <Text style={s.title}>Criar {label}</Text>
              {sourceExercise && (
                <Text style={s.subtitle} numberOfLines={1}>
                  {isMulti ? 'Selecione os exercícios' : 'Parear com'}: {sourceExercise.exercise.name}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color="#4A4A5A" />
            </TouchableOpacity>
          </View>

          {isMulti && (
            <View style={s.infoBar}>
              <Ionicons name="information-circle-outline" size={14} color="#4A4A5A" />
              <Text style={s.infoText}>
                Selecione os exercícios que farão parte do superset
              </Text>
            </View>
          )}

          {candidates.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="barbell-outline" size={36} color="#2A2A35" />
              <Text style={s.emptyText}>
                Nenhum exercício disponível.{'\n'}
                Adicione mais exercícios ao treino.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {candidates.map(te => {
                const selected = selectedIds.has(te.id)
                return (
                  <TouchableOpacity
                    key={te.id}
                    style={[s.row, selected && s.rowSelected]}
                    onPress={() => isMulti ? toggle(te.id) : handlePick(te.id)}
                    activeOpacity={0.7}
                  >
                    <View style={s.rowLeft}>
                      <Text style={[s.rowName, selected && s.rowNameSelected]} numberOfLines={1}>
                        {te.exercise.name}
                      </Text>
                      {te.exercise.equipment ? (
                        <Text style={s.rowEquip}>{te.exercise.equipment}</Text>
                      ) : null}
                    </View>
                    {isMulti ? (
                      <View style={[s.checkbox, selected && s.checkboxSelected]}>
                        {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color="#3A3A4A" />
                    )}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}

          {isMulti && (
            <TouchableOpacity
              style={[s.confirmBtn, selectedIds.size === 0 && s.confirmBtnDisabled]}
              onPress={handleConfirmMulti}
              disabled={selectedIds.size === 0}
              activeOpacity={0.85}
            >
              <Text style={s.confirmText}>
                {selectedIds.size === 0 ? 'Selecione exercícios' : `Criar Superset (${selectedIds.size + 1})`}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: '#1E1E24',
    borderRadius: 20,
    width: '100%',
    maxHeight: '85%',
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: {
    color: '#F0F0F5',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    color: '#555560',
    fontSize: 12,
    maxWidth: 240,
  },

  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  infoText: { color: '#555560', fontSize: 12, flex: 1 },

  empty: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#555560',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A20',
  },
  rowSelected: {
    backgroundColor: 'rgba(79,195,247,0.06)',
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  rowLeft: { flex: 1 },
  rowName: { color: '#F0F0F5', fontSize: 15 },
  rowNameSelected: { color: '#4FC3F7' },
  rowEquip: { color: '#555560', fontSize: 12, marginTop: 2 },

  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: '#3A3A4A',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: '#4FC3F7',
    borderColor: '#4FC3F7',
  },

  confirmBtn: {
    height: 50, borderRadius: 12,
    backgroundColor: '#2979FF',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 14,
  },
  confirmBtnDisabled: { backgroundColor: '#1A2A4A' },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  cancelBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252530',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: { color: '#555560', fontSize: 14 },
})
