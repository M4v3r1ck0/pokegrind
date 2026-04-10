<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminAuthStore } from '@/stores/auth'

const auth = useAdminAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    router.push('/dashboard')
  } catch (e: any) {
    error.value = e.response?.data?.message ?? e.message ?? 'Erreur de connexion'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <VaCard class="w-full max-w-md">
      <VaCardTitle class="text-center text-2xl font-bold">
        PokeGrind Admin
      </VaCardTitle>
      <VaCardContent>
        <form @submit.prevent="submit" class="space-y-4">
          <VaInput
            v-model="email"
            label="Email"
            type="email"
            placeholder="admin@pokegrind.fr"
            required
          />
          <VaInput
            v-model="password"
            label="Mot de passe"
            type="password"
            required
          />
          <VaAlert v-if="error" color="danger" class="mb-2">
            {{ error }}
          </VaAlert>
          <VaButton
            type="submit"
            color="primary"
            block
            :loading="loading"
          >
            Connexion
          </VaButton>
        </form>
      </VaCardContent>
    </VaCard>
  </div>
</template>
