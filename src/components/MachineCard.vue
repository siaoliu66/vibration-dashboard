<template>
  <div class="card" :class="machine.status" @click="$emit('select', machine)">
    <div class="card-header">
      <span class="type-icon">{{ typeIcon(machine.type) }}</span>
      <div class="card-title">
        <div class="name">{{ machine.name }}</div>
        <div class="location">{{ machine.location }}</div>
      </div>
      <span class="badge" :style="{ background: statusColor(machine.status) + '22', color: statusColor(machine.status), borderColor: statusColor(machine.status) + '55' }">
        <span class="dot" :style="{ background: statusColor(machine.status) }"></span>
        {{ statusLabel(machine.status) }}
      </span>
    </div>

    <div class="metrics">
      <div class="metric">
        <div class="metric-label">RMS</div>
        <div class="metric-value">{{ latest.vibration.rms_g.toFixed(3) }}<span class="unit">g</span></div>
      </div>
      <div class="metric">
        <div class="metric-label">峰值因子</div>
        <div class="metric-value" :class="{ warn: latest.vibration.crest_factor > 4 }">
          {{ latest.vibration.crest_factor.toFixed(1) }}
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">溫度</div>
        <div class="metric-value" :class="{ warn: latest.temperature_c > 65 }">
          {{ latest.temperature_c.toFixed(1) }}<span class="unit">°C</span>
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">主頻</div>
        <div class="metric-value">{{ latest.vibration.dominant_freq_hz }}<span class="unit">Hz</span></div>
      </div>
    </div>

    <div class="sparkline-row">
      <span class="axis-label">X</span>
      <Sparkline :values="xValues" :color="'#378ADD'" />
      <span class="axis-label">Y</span>
      <Sparkline :values="yValues" :color="'#1D9E75'" />
      <span class="axis-label">Z</span>
      <Sparkline :values="zValues" :color="'#EF9F27'" />
    </div>

    <div class="card-footer">
      <span class="ts">{{ machine.machine_id }} · {{ machine.sensor.model }}</span>
      <span class="ts">{{ latest.timestamp.replace('T', ' ') }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Sparkline from './Sparkline.vue'
import { useMachines } from '../composables/useMachines'

const { latestReading, statusColor, statusLabel, typeIcon } = useMachines()

const props = defineProps({ machine: Object })
defineEmits(['select'])

const latest = computed(() => latestReading(props.machine))
// 卡片上永遠顯示最近 10 筆，資料再多也不影響卡片效能
const last10  = computed(() => props.machine.data.slice(-10))
const xValues = computed(() => last10.value.map(d => d.vibration.x_axis_g))
const yValues = computed(() => last10.value.map(d => d.vibration.y_axis_g))
const zValues = computed(() => last10.value.map(d => d.vibration.z_axis_g))
</script>

<style scoped>
.card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  cursor: pointer;
  transition: border-color .2s, transform .15s;
}
.card:hover { border-color: rgba(255,255,255,0.2); transform: translateY(-2px); }
.card.warning { border-left: 3px solid #EF9F27; }
.card.fault   { border-left: 3px solid #E24B4A; }

.card-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
.type-icon { font-size: 22px; line-height: 1; margin-top: 2px; }
.card-title { flex: 1; }
.name { font-weight: 600; font-size: 15px; }
.location { font-size: 12px; color: var(--text2); margin-top: 2px; }

.badge {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 500;
  padding: 3px 10px; border-radius: 20px; border: 1px solid;
  white-space: nowrap;
}
.dot { width: 6px; height: 6px; border-radius: 50%; }

.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
.metric { background: var(--bg3); border-radius: 6px; padding: 8px 10px; }
.metric-label { font-size: 11px; color: var(--text2); margin-bottom: 4px; }
.metric-value { font-size: 17px; font-weight: 600; }
.metric-value .unit { font-size: 11px; color: var(--text2); margin-left: 2px; font-weight: 400; }
.metric-value.warn { color: #EF9F27; }

.sparkline-row { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.axis-label { font-size: 11px; color: var(--text2); width: 10px; }

.card-footer { display: flex; justify-content: space-between; }
.ts { font-size: 11px; color: var(--text2); }
</style>
