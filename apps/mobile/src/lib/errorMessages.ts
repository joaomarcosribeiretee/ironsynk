import { ApiError } from './api'

export function getFriendlyErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CREDENTIALS') return 'E-mail ou senha invalidos.'
    if (error.code === 'USER_NOT_FOUND') return 'Usuario nao encontrado.'
    if (error.code === 'UNAUTHORIZED') return 'Sessao expirada. Faca login novamente.'
    if (error.code === 'VALIDATION_ERROR') return error.message || 'Dados invalidos.'
    if (error.code === 'AUTH_ERROR') return error.message || 'Falha na autenticacao.'
    return error.message || fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}
