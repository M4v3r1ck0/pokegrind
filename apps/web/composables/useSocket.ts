/**
 * useSocket — Shared Socket.io client composable.
 * Returns a reactive ref to the global socket instance managed by the combat store.
 */
import { ref } from 'vue'
import type { Socket } from 'socket.io-client'

// Shared socket ref — can be set by any store that owns the connection
const _socket = ref<Socket | null>(null)

export function useSocket() {
  return {
    socket: _socket,
    setSocket(s: Socket | null) {
      _socket.value = s
    },
  }
}
