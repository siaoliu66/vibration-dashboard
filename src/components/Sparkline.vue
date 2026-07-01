<template>
  <svg :width="width" :height="height" style="flex:1; min-width:0;">
    <polyline
      :points="points"
      fill="none"
      :stroke="color"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
      opacity="0.85"
    />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  values: Array,
  color: { type: String, default: '#378ADD' },
  width: { type: Number, default: 80 },
  height: { type: Number, default: 28 }
})

const points = computed(() => {
  const v = props.values
  if (!v || v.length < 2) return ''
  const min = Math.min(...v)
  const max = Math.max(...v)
  const range = max - min || 0.001
  const pad = 2
  return v.map((val, i) => {
    const x = (i / (v.length - 1)) * (props.width - 2) + 1
    const y = props.height - pad - ((val - min) / range) * (props.height - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})
</script>
