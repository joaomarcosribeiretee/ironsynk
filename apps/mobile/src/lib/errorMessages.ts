import { ApiError } from './api'

export function getFriendlyErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CREDENTIALS') return 'E-mail ou senha invalidos.'
    if (error.code === 'USER_NOT_FOUND') return 'Usuario nao encontrado.'
    if (error.code === 'UNAUTHORIZED') return 'Sessao expirada. Faca login novamente.'
    if (error.code === 'VALIDATION_ERROR') return error.message || 'Dados invalidos.'
    if (error.code === 'AUTH_ERROR') return error.message || 'Falha na autenticacao.'
    if (error.code === 'PROFILE_PRIVATE') return 'Este perfil e privado.'
    if (error.code === 'CANNOT_FOLLOW_SELF') return 'Voce nao pode seguir a si mesmo.'
    if (error.code === 'NOT_FOUND') return 'Conteudo nao encontrado.'
    if (error.code === 'FORBIDDEN') return 'Voce nao tem permissao para isso.'
    return error.message || fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}
