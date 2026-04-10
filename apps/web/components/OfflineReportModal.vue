<template>
  <!-- Modal rapport offline — bloquante (pas de croix) -->
  <Teleport to="body">
    <div v-if="offlineStore.show_modal && offlineStore.pending_report" class="modal-overlay">
      <div class="modal-box">
        <!-- En-tête -->
        <div class="modal-header">
          <span class="modal-icon">⚔️</span>
          <div>
            <h2 class="modal-title">Rapport d'absence</h2>
            <p class="modal-subtitle">
              {{ report.absence_formatted }} — {{ report.floor_name_fr }}
            </p>
          </div>
        </div>

        <!-- Corps -->
        <div class="modal-body">
          <div class="stat-row">
            <span class="stat-label">💰 Or gagné</span>
            <span class="stat-value text-yellow-400">+{{ report.gold_earned.toLocaleString('fr-FR') }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">⭐ XP gagnée</span>
            <span class="stat-value text-blue-400">+{{ report.xp_earned.toLocaleString('fr-FR') }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">⚔️ Ennemis vaincus</span>
            <span class="stat-value text-red-400">{{ report.kills.toLocaleString('fr-FR') }}</span>
          </div>
          <div v-if="report.hatches > 0" class="stat-row">
            <span class="stat-label">🥚 Éclosions</span>
            <span class="stat-value text-green-400">{{ report.hatches }}</span>
          </div>

          <!-- Drops -->
          <div v-if="report.drops && report.drops.length > 0" class="drops-section">
            <p class="drops-title">Drops obtenus :</p>
            <ul class="drops-list">
              <li v-for="drop in report.drops" :key="drop.item_name_fr" class="drop-item">
                • {{ drop.item_name_fr }} ×{{ drop.quantity }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Pied -->
        <div class="modal-footer">
          <button :disabled="collecting" class="collect-btn" @click="collect">
            <span v-if="collecting">Récupération...</span>
            <span v-else>Récupérer les gains</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useOfflineStore } from '~/stores/offline'

const offlineStore = useOfflineStore()
const collecting = ref(false)

const report = computed(() => offlineStore.pending_report!)

async function collect() {
  collecting.value = true
  try {
    await offlineStore.collectReport()
  } finally {
    collecting.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.modal-box {
  background: #1a1f2e;
  border: 1px solid #2d3748;
  border-radius: 12px;
  width: 100%;
  max-width: 460px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px 16px;
  background: #16213e;
  border-bottom: 1px solid #2d3748;
}

.modal-icon {
  font-size: 28px;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0;
}

.modal-subtitle {
  font-size: 13px;
  color: #718096;
  margin: 2px 0 0;
}

.modal-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #0f172a;
  border-radius: 8px;
}

.stat-label {
  color: #a0aec0;
  font-size: 14px;
}

.stat-value {
  font-weight: 700;
  font-size: 16px;
}

.drops-section {
  margin-top: 4px;
  padding: 12px;
  background: #0f172a;
  border-radius: 8px;
}

.drops-title {
  color: #a0aec0;
  font-size: 13px;
  margin: 0 0 8px;
}

.drops-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drop-item {
  color: #e2e8f0;
  font-size: 13px;
}

.modal-footer {
  padding: 16px 24px 20px;
  border-top: 1px solid #2d3748;
  display: flex;
  justify-content: center;
}

.collect-btn {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 32px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  width: 100%;
}

.collect-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.collect-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
