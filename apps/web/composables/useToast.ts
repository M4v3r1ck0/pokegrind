export type ToastType = 'success' | 'error' | 'info' | 'gem' | 'shiny' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  message: string
  detail?: string
  duration?: number
  icon?: string
}

const toasts = ref<Toast[]>([])

let _id = 0

function add(toast: Omit<Toast, 'id'>): string {
  const id = `toast-${++_id}-${Date.now()}`
  const duration = toast.duration ?? 4000
  toasts.value.push({ ...toast, id, duration })
  if (duration > 0) {
    setTimeout(() => remove(id), duration)
  }
  return id
}

function remove(id: string) {
  const idx = toasts.value.findIndex(t => t.id === id)
  if (idx !== -1) toasts.value.splice(idx, 1)
}

function success(message: string, detail?: string) {
  return add({ type: 'success', message, detail, icon: '✓' })
}

function error(message: string, detail?: string) {
  return add({ type: 'error', message, detail, icon: '✕', duration: 6000 })
}

function info(message: string, detail?: string) {
  return add({ type: 'info', message, detail, icon: 'ℹ' })
}

function warning(message: string, detail?: string) {
  return add({ type: 'warning', message, detail, icon: '⚠' })
}

function gem(amount: number, reason?: string) {
  return add({
    type: 'gem',
    message: `+${amount} 💎`,
    detail: reason,
    icon: '💎',
    duration: 3500,
  })
}

function shiny(pokemonName: string) {
  return add({
    type: 'shiny',
    message: `✨ Shiny ${pokemonName} !`,
    detail: 'Pokémon chromatique obtenu !',
    icon: '✨',
    duration: 8000,
  })
}

export function useToast() {
  return { toasts: readonly(toasts), add, remove, success, error, info, warning, gem, shiny }
}
