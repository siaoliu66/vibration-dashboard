<template>
  <div class="detail">
    <!-- Header -->
    <div class="detail-header">
      <button class="back-btn" @click="$emit('close')">‹ 返回總覽</button>
      <div class="header-main">
        <span class="type-icon">{{ typeIcon(machine.type) }}</span>
        <div>
          <div class="name">{{ machine.name }}</div>
          <div class="sub">{{ machine.location }} · {{ machine.machine_id }} · {{ machine.rpm }} RPM · {{ machine.sensor.model }}</div>
        </div>
        <span class="badge" :style="{ background: statusColor(machine.status)+'22', color: statusColor(machine.status), borderColor: statusColor(machine.status)+'55' }">
          <span class="dot" :style="{ background: statusColor(machine.status) }"></span>
          {{ statusLabel(machine.status) }}
        </span>
      </div>
    </div>

    <div class="detail-body">
      <!-- Stat cards（根據選取範圍最後一筆）-->
      <div class="stats-row">
        <div class="stat" v-for="s in stats" :key="s.label">
          <div class="stat-label">{{ s.label }}</div>
          <div class="stat-value" :class="{ warn: s.warn }">
            {{ s.value }}<span class="unit">{{ s.unit }}</span>
          </div>
        </div>
      </div>

      <!-- ── 時間範圍控制列 ── -->
      <div class="range-bar">
        <div class="range-left">
          <span class="range-label">顯示範圍</span>
          <!-- 快捷按鈕 -->
          <div class="preset-btns">
            <button
              v-for="p in presets"
              :key="p.value"
              :class="['preset-btn', { active: activePreset === p.value && !isDragging }]"
              @click="applyPreset(p.value)"
            >{{ p.label }}</button>
          </div>
        </div>
        <div class="range-right">
          <span class="range-info">
            {{ fmtTs(rangeStart) }} ～ {{ fmtTs(rangeEnd) }}
            <span class="range-count">（{{ visibleData.length }} 筆）</span>
          </span>
        </div>
      </div>

      <!-- ── 縮略圖 + 拖移選取器 ── -->
      <div class="overview-wrap">
        <div class="overview-label">全部資料（拖移選取範圍）</div>
        <div
          class="overview-track"
          ref="trackEl"
          @mousedown="onTrackMouseDown"
          @touchstart.prevent="onTrackTouchStart"
        >
          <!-- 縮略折線（全部資料） -->
          <svg class="overview-svg" :viewBox="`0 0 ${OW} ${OH}`" preserveAspectRatio="none">
            <polyline :points="overviewPoints" fill="none" stroke="#378ADD" stroke-width="1.2" opacity="0.5"/>
          </svg>

          <!-- 遮罩（選取範圍外變暗） -->
          <div class="mask left"  :style="{ width: maskLeft  + '%' }"></div>
          <div class="mask right" :style="{ width: maskRight + '%' }"></div>

          <!-- 選取範圍高亮 -->
          <div class="selection"
            :style="{ left: selLeft+'%', width: selWidth+'%' }"
            @mousedown.stop="onSelMouseDown"
            @touchstart.prevent.stop="onSelTouchStart"
          ></div>

          <!-- 左手柄 -->
          <div class="handle left-handle"
            :style="{ left: selLeft+'%' }"
            @mousedown.stop="onHandleMouseDown('left', $event)"
            @touchstart.prevent.stop="onHandleTouchStart('left', $event)"
          ><span></span></div>

          <!-- 右手柄 -->
          <div class="handle right-handle"
            :style="{ left: (selLeft + selWidth)+'%' }"
            @mousedown.stop="onHandleMouseDown('right', $event)"
            @touchstart.prevent.stop="onHandleTouchStart('right', $event)"
          ><span></span></div>

          <!-- 時間刻度 -->
          <div class="tick-row">
            <span
              v-for="(t, i) in tickLabels"
              :key="i"
              class="tick"
              :style="{ left: (i / (tickLabels.length-1) * 100)+'%' }"
            >{{ t }}</span>
          </div>
        </div>
      </div>

      <!-- ── 主圖表（只顯示選取範圍）── -->
      <div class="charts">
        <div class="chart-box wide">
          <div class="chart-title">三軸振動趨勢（g）<span class="chart-range">{{ rangeLabel }}</span></div>
          <div style="position:relative;height:200px"><canvas ref="vibCanvas"></canvas></div>
        </div>
        <div class="chart-box">
          <div class="chart-title">溫度趨勢（°C）</div>
          <div style="position:relative;height:200px"><canvas ref="tempCanvas"></canvas></div>
        </div>
        <div class="chart-box">
          <div class="chart-title">峰值因子趨勢</div>
          <div style="position:relative;height:200px"><canvas ref="cfCanvas"></canvas></div>
        </div>
      </div>

      <!-- ── 原始資料表（跟著範圍走）── -->
      <div class="data-table">
        <div class="table-title">
          原始數據（{{ visibleData.length }} / {{ machine.data.length }} 筆，每 5 分鐘一次）
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>時間</th><th>X (g)</th><th>Y (g)</th><th>Z (g)</th>
                <th>RMS (g)</th><th>Peak (g)</th><th>CF</th>
                <th>主頻 (Hz)</th><th>溫度 (°C)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(d, i) in visibleData" :key="i">
                <td class="mono">{{ d.timestamp.replace('T',' ') }}</td>
                <td>{{ d.vibration.x_axis_g.toFixed(4) }}</td>
                <td>{{ d.vibration.y_axis_g.toFixed(4) }}</td>
                <td>{{ d.vibration.z_axis_g.toFixed(4) }}</td>
                <td>{{ d.vibration.rms_g.toFixed(4) }}</td>
                <td>{{ d.vibration.peak_g.toFixed(4) }}</td>
                <td :class="{ warn: d.vibration.crest_factor > 4 }">{{ d.vibration.crest_factor.toFixed(2) }}</td>
                <td>{{ d.vibration.dominant_freq_hz }}</td>
                <td :class="{ warn: d.temperature_c > 65 }">{{ d.temperature_c.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  Chart, LineController, LineElement, PointElement,
  LinearScale, CategoryScale, Legend, Tooltip, Filler
} from 'chart.js'
import { useMachines } from '../composables/useMachines'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip, Filler)

const { statusColor, statusLabel, typeIcon } = useMachines()
const props = defineProps({ machine: Object, inline: Boolean })
defineEmits(['close'])

// ── Canvas refs ──────────────────────────────────────────
const vibCanvas  = ref(null)
const tempCanvas = ref(null)
const cfCanvas   = ref(null)
const trackEl    = ref(null)
let charts = []

// ── Overview 縮略圖尺寸 ──────────────────────────────────
const OW = 1000
const OH = 48

// ── 選取範圍（0–1 的比例值）──────────────────────────────
const selStartRatio = ref(0)
const selEndRatio   = ref(1)
const isDragging    = ref(false)
const activePreset  = ref('all')

// ── 快捷按鈕 ────────────────────────────────────────────
const presets = [
  { label: '最近 3 天',  value: 6   },   // 6 筆 × 12h = 3 天
  { label: '最近 7 天',  value: 14  },   // 14 筆 × 12h = 7 天
  { label: '最近 10 天', value: 20  },   // 20 筆 × 12h = 10 天
  { label: '全部',       value: 'all' },
]

function applyPreset(val) {
  activePreset.value = val
  const n = props.machine.data.length
  if (val === 'all') {
    selStartRatio.value = 0
    selEndRatio.value   = 1
  } else {
    const count = Math.min(val, n)
    selStartRatio.value = (n - count) / n
    selEndRatio.value   = 1
  }
}

// ── 換算成實際資料範圍 ───────────────────────────────────
const visibleData = computed(() => {
  const d = props.machine.data
  const n = d.length
  const s = Math.round(selStartRatio.value * n)
  const e = Math.max(s + 1, Math.round(selEndRatio.value * n))
  return d.slice(s, e)
})

const rangeStart = computed(() => visibleData.value[0]?.timestamp ?? '')
const rangeEnd   = computed(() => visibleData.value[visibleData.value.length - 1]?.timestamp ?? '')
// "2026-06-19T08:00:00" → "06/19 08:00"
function fmtTs(ts) {
  if (!ts) return ""
  return ts.slice(5,7) + "/" + ts.slice(8,10) + " " + ts.slice(11,16)
}

const rangeLabel = computed(() => `${fmtTs(rangeStart.value)} ～ ${fmtTs(rangeEnd.value)}`)

// ── 縮略圖選取區位置 ────────────────────────────────────
const selLeft  = computed(() => selStartRatio.value * 100)
const selWidth = computed(() => (selEndRatio.value - selStartRatio.value) * 100)
const maskLeft  = computed(() => selLeft.value)
const maskRight = computed(() => 100 - selLeft.value - selWidth.value)

// ── 縮略圖折線（X 軸 RMS，全部資料）─────────────────────
const overviewPoints = computed(() => {
  const d = props.machine.data
  if (!d.length) return ''
  const vals = d.map(r => r.vibration.rms_g)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 0.001
  return d.map((_, i) => {
    const x = (i / (d.length - 1)) * OW
    const y = OH - 4 - ((vals[i] - min) / range) * (OH - 8)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})

// ── 時間刻度（最多 6 個）───────────────────────────────
const tickLabels = computed(() => {
  const d = props.machine.data
  if (!d.length) return []
  const step = Math.max(1, Math.floor(d.length / 5))
  const ticks = []
  for (let i = 0; i < d.length; i += step) ticks.push(fmtTs(d[i].timestamp))
  if (ticks[ticks.length - 1] !== fmtTs(d[d.length - 1].timestamp))
    ticks.push(fmtTs(d[d.length - 1].timestamp))
  return ticks
})

// ── Stats（根據 visibleData 最後一筆）────────────────────
const stats = computed(() => {
  const l = visibleData.value[visibleData.value.length - 1]
  if (!l) return []
  return [
    { label: 'X 軸',    value: l.vibration.x_axis_g.toFixed(4),       unit: 'g',  warn: false },
    { label: 'Y 軸',    value: l.vibration.y_axis_g.toFixed(4),       unit: 'g',  warn: false },
    { label: 'Z 軸',    value: l.vibration.z_axis_g.toFixed(4),       unit: 'g',  warn: false },
    { label: 'RMS',     value: l.vibration.rms_g.toFixed(4),          unit: 'g',  warn: false },
    { label: 'Peak',    value: l.vibration.peak_g.toFixed(4),         unit: 'g',  warn: false },
    { label: '峰值因子', value: l.vibration.crest_factor.toFixed(2),  unit: '',   warn: l.vibration.crest_factor > 4 },
    { label: '主頻',    value: l.vibration.dominant_freq_hz,          unit: 'Hz', warn: false },
    { label: '溫度',    value: l.temperature_c.toFixed(1),            unit: '°C', warn: l.temperature_c > 65 },
  ]
})

// ── 拖移邏輯 ────────────────────────────────────────────
let dragMode   = null   // 'left' | 'right' | 'sel'
let dragStartX = 0
let dragStartL = 0
let dragStartR = 0

function getRatio(clientX) {
  const rect = trackEl.value.getBoundingClientRect()
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
}

function onMove(clientX) {
  const r = getRatio(clientX)
  const MIN_SEL = 1 / props.machine.data.length   // 最少選 1 筆

  if (dragMode === 'left') {
    selStartRatio.value = Math.min(r, selEndRatio.value - MIN_SEL)
  } else if (dragMode === 'right') {
    selEndRatio.value = Math.max(r, selStartRatio.value + MIN_SEL)
  } else if (dragMode === 'sel') {
    const delta = r - getRatio(dragStartX)
    const w = dragStartR - dragStartL
    let ns = dragStartL + delta
    let ne = dragStartR + delta
    if (ns < 0) { ns = 0; ne = w }
    if (ne > 1) { ne = 1; ns = 1 - w }
    selStartRatio.value = ns
    selEndRatio.value   = ne
  }
  isDragging.value = true
  activePreset.value = null
}

function startDrag(mode, clientX) {
  dragMode   = mode
  dragStartX = clientX
  dragStartL = selStartRatio.value
  dragStartR = selEndRatio.value
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup',   onMouseUp)
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend',  onTouchEnd)
}

function stopDrag() {
  dragMode = null
  isDragging.value = false
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup',   onMouseUp)
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend',  onTouchEnd)
}

const onMouseMove = e => onMove(e.clientX)
const onMouseUp   = ()  => stopDrag()
const onTouchMove = e => { e.preventDefault(); onMove(e.touches[0].clientX) }
const onTouchEnd  = ()  => stopDrag()

// 點擊 track 空白區域 → 直接跳移選取區
function onTrackMouseDown(e) {
  if (e.target !== trackEl.value && !e.target.classList.contains('overview-svg') &&
      !e.target.classList.contains('mask') && !e.target.classList.contains('tick-row') &&
      !e.target.classList.contains('tick')) return
  const r = getRatio(e.clientX)
  const half = (selEndRatio.value - selStartRatio.value) / 2
  selStartRatio.value = Math.max(0, r - half)
  selEndRatio.value   = Math.min(1, r + half)
  activePreset.value  = null
  isDragging.value    = false
}
function onTrackTouchStart(e) { onTrackMouseDown({ clientX: e.touches[0].clientX, target: e.target }) }

function onHandleMouseDown(side, e) { startDrag(side, e.clientX) }
function onHandleTouchStart(side, e) { startDrag(side, e.touches[0].clientX) }
function onSelMouseDown(e) { startDrag('sel', e.clientX) }
function onSelTouchStart(e) { startDrag('sel', e.touches[0].clientX) }

// ── Chart.js ────────────────────────────────────────────
const chartOpts = (yLabel) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 200 },
  plugins: {
    legend: { labels: { color: '#8b90a7', font: { size: 12 }, boxWidth: 12, padding: 16 } },
    tooltip: { mode: 'index', intersect: false }
  },
  scales: {
    x: { ticks: { color: '#8b90a7', font: { size: 11 }, maxRotation: 0 },
         grid: { color: 'rgba(255,255,255,0.05)' } },
    y: { ticks: { color: '#8b90a7', font: { size: 11 } },
         grid: { color: 'rgba(255,255,255,0.05)' },
         title: { display: !!yLabel, text: yLabel, color: '#8b90a7', font: { size: 11 } } }
  }
})

function buildCharts() {
  charts.forEach(c => c.destroy())
  charts = []
  const d = visibleData.value
  const lb = d.map(r => fmtTs(r.timestamp))

  charts.push(new Chart(vibCanvas.value, {
    type: 'line', data: { labels: lb, datasets: [
      { label: 'X軸', data: d.map(r => r.vibration.x_axis_g), borderColor: '#378ADD', backgroundColor: '#378ADD11', tension: 0.3, pointRadius: d.length > 60 ? 0 : 3 },
      { label: 'Y軸', data: d.map(r => r.vibration.y_axis_g), borderColor: '#1D9E75', backgroundColor: '#1D9E7511', tension: 0.3, pointRadius: d.length > 60 ? 0 : 3 },
      { label: 'Z軸', data: d.map(r => r.vibration.z_axis_g), borderColor: '#EF9F27', backgroundColor: '#EF9F2711', tension: 0.3, pointRadius: d.length > 60 ? 0 : 3 },
    ]}, options: chartOpts('g')
  }))

  charts.push(new Chart(tempCanvas.value, {
    type: 'line', data: { labels: lb, datasets: [
      { label: '溫度', data: d.map(r => r.temperature_c), borderColor: '#E24B4A', backgroundColor: '#E24B4A11', tension: 0.3, pointRadius: d.length > 60 ? 0 : 3, fill: true },
    ]}, options: chartOpts('°C')
  }))

  charts.push(new Chart(cfCanvas.value, {
    type: 'line', data: { labels: lb, datasets: [
      { label: '峰值因子', data: d.map(r => r.vibration.crest_factor), borderColor: '#7F77DD', backgroundColor: '#7F77DD11', tension: 0.3, pointRadius: d.length > 60 ? 0 : 3 },
      { label: '警戒線 4.0', data: Array(lb.length).fill(4.0), borderColor: '#EF9F27', borderDash: [5,5], pointRadius: 0, borderWidth: 1.5 },
    ]}, options: chartOpts('')
  }))
}

// 範圍改變時重建圖表（debounce 避免拖移時太頻繁）
let rebuildTimer = null
watch(visibleData, () => {
  clearTimeout(rebuildTimer)
  rebuildTimer = setTimeout(buildCharts, 80)
})

onMounted(() => {
  applyPreset('all')
  nextTick(buildCharts)
})
watch(() => props.machine.machine_id, () => {
  applyPreset('all')
  setTimeout(buildCharts, 50)
})
onUnmounted(() => {
  charts.forEach(c => c.destroy())
  stopDrag()
})
</script>

<style scoped>
.detail { display: flex; flex-direction: column; height: 100%; }

/* Header */
.detail-header { padding: 14px 24px 0; border-bottom: 1px solid var(--border); background: var(--bg2); flex-shrink: 0; }
.back-btn { background: none; border: none; color: var(--text2); font-size: 13px; cursor: pointer; padding: 0 0 10px; display: flex; align-items: center; gap: 4px; transition: color .15s; }
.back-btn:hover { color: var(--text); }
.header-main { display: flex; align-items: center; gap: 14px; padding-bottom: 14px; }
.type-icon { font-size: 26px; }
.name { font-size: 18px; font-weight: 700; }
.sub { font-size: 12px; color: var(--text2); margin-top: 3px; }
.badge { display: flex; align-items: center; gap: 5px; margin-left: auto; font-size: 13px; font-weight: 500; padding: 4px 14px; border-radius: 20px; border: 1px solid; }
.dot { width: 7px; height: 7px; border-radius: 50%; }

/* Body */
.detail-body { flex: 1; overflow-y: auto; padding: 20px 24px; }

/* Stats */
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
.stat { background: var(--bg3); border-radius: 8px; padding: 12px 14px; }
.stat-label { font-size: 11px; color: var(--text2); margin-bottom: 5px; }
.stat-value { font-size: 20px; font-weight: 700; }
.stat-value .unit { font-size: 11px; color: var(--text2); margin-left: 2px; font-weight: 400; }
.stat-value.warn { color: #EF9F27; }

/* Range bar */
.range-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
.range-left { display: flex; align-items: center; gap: 10px; }
.range-label { font-size: 12px; color: var(--text2); white-space: nowrap; }
.preset-btns { display: flex; gap: 6px; }
.preset-btn { background: var(--bg3); border: 1px solid var(--border); color: var(--text2); border-radius: 16px; padding: 3px 12px; font-size: 12px; cursor: pointer; transition: all .15s; white-space: nowrap; }
.preset-btn:hover { color: var(--text); border-color: rgba(255,255,255,0.2); }
.preset-btn.active { background: #378ADD22; border-color: #378ADD88; color: #378ADD; font-weight: 500; }
.range-right { font-size: 12px; color: var(--text2); }
.range-count { color: var(--text2); opacity: .7; }

/* Overview track */
.overview-wrap { margin-bottom: 18px; }
.overview-label { font-size: 11px; color: var(--text2); margin-bottom: 5px; }
.overview-track {
  position: relative; height: 64px;
  background: var(--bg3); border-radius: 6px;
  overflow: hidden; cursor: crosshair;
  user-select: none; -webkit-user-select: none;
}
.overview-svg { position: absolute; inset: 0; width: 100%; height: calc(100% - 18px); }

/* 遮罩 */
.mask { position: absolute; top: 0; height: calc(100% - 18px); background: rgba(0,0,0,0.5); pointer-events: none; }
.mask.left  { left: 0; }
.mask.right { right: 0; }

/* 選取高亮 */
.selection {
  position: absolute; top: 0; height: calc(100% - 18px);
  background: rgba(55,138,221,0.12);
  border-top: 1px solid rgba(55,138,221,0.5);
  border-bottom: 1px solid rgba(55,138,221,0.5);
  cursor: grab;
}
.selection:active { cursor: grabbing; }

/* 手柄 */
.handle {
  position: absolute; top: 0; height: calc(100% - 18px);
  width: 12px; transform: translateX(-50%);
  display: flex; align-items: center; justify-content: center;
  cursor: ew-resize; z-index: 2;
}
.handle span {
  display: block; width: 3px; height: 20px;
  background: #378ADD; border-radius: 2px;
  box-shadow: 0 0 6px rgba(55,138,221,0.6);
}
.handle::before {
  content: ''; position: absolute; inset: 0;
  width: 20px; transform: translateX(-4px);
}

/* 時間刻度 */
.tick-row { position: absolute; bottom: 0; left: 0; right: 0; height: 18px; pointer-events: none; }
.tick { position: absolute; font-size: 10px; color: var(--text2); transform: translateX(-50%); white-space: nowrap; }
.tick:first-child { transform: translateX(0); }
.tick:last-child  { transform: translateX(-100%); }

/* Charts */
.charts { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
.chart-box { background: var(--bg3); border-radius: 8px; padding: 14px; }
.chart-box.wide { grid-column: 1 / -1; }
.chart-title { font-size: 12px; color: var(--text2); font-weight: 500; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
.chart-range { font-size: 11px; color: #378ADD; font-weight: 400; }

/* Table */
.data-table { background: var(--bg3); border-radius: 8px; padding: 14px; }
.table-title { font-size: 12px; color: var(--text2); font-weight: 500; margin-bottom: 10px; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; white-space: nowrap; }
th { color: var(--text2); font-weight: 500; text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--border); }
td { padding: 7px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); }
td.warn { color: #EF9F27; font-weight: 600; }
td.mono { font-family: monospace; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(255,255,255,0.02); }
</style>
