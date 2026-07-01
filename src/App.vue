<template>
  <div class="app">
    <!-- Top header -->
    <header class="topbar">
      <div class="topbar-left">
        <button class="toggle-btn" @click="sidebarOpen = !sidebarOpen" :title="sidebarOpen ? '收合選單' : '展開選單'">
          <span class="hamburger" :class="{ open: sidebarOpen }">
            <span></span><span></span><span></span>
          </span>
        </button>
        <div class="logo">⚡ 震動監測儀表板</div>
        <div class="subtitle">Prowave PW-RVT · 即時設備健康監測</div>
      </div>
      <div class="topbar-right">
        <div class="summary-pills">
          <span class="pill normal">✓ 正常 {{ countByStatus('normal') }}</span>
          <span class="pill warning">⚠ 警告 {{ countByStatus('warning') }}</span>
          <span class="pill fault">✕ 故障 {{ countByStatus('fault') }}</span>
        </div>
        <div class="topbar-meta">
          <span v-if="loading" class="fetch-status loading">⟳ 更新中…</span>
          <span v-else-if="error" class="fetch-status err" :title="error">⚠ 抓取失敗</span>
          <span v-else class="fetch-status ok">
            最後更新：{{ lastFetchedTime }}
          </span>
          <button class="refresh-btn" :disabled="loading" @click="refresh" title="立即重新抓取">
            <span :class="{ spin: loading }">↻</span>
          </button>
        </div>
      </div>
    </header>

    <div class="body-layout">
      <!-- Sidebar -->
      <aside class="sidebar" :class="{ collapsed: !sidebarOpen }">
        <div class="sidebar-inner">
          <div class="sidebar-section-label">設備列表</div>

          <!-- Type groups -->
          <div v-for="group in machineGroups" :key="group.type" class="type-group">
            <div class="group-header" @click="toggleGroup(group.type)">
              <span class="group-icon">{{ group.icon }}</span>
              <span class="group-label">{{ group.label }}</span>
              <span class="group-count">{{ group.machines.length }}</span>
              <span class="chevron" :class="{ rotated: openGroups.has(group.type) }">›</span>
            </div>
            <transition name="slide">
              <div v-if="openGroups.has(group.type)" class="group-items">
                <button
                  v-for="m in group.machines"
                  :key="m.machine_id"
                  class="machine-item"
                  :class="{ active: selected?.machine_id === m.machine_id }"
                  @click="selectMachine(m)"
                >
                  <span class="item-dot" :style="{ background: statusColor(m.status) }"></span>
                  <span class="item-name">{{ m.name }}</span>
                  <span class="item-id">{{ m.machine_id }}</span>
                </button>
              </div>
            </transition>
          </div>

          <!-- Divider -->
          <div class="sidebar-divider"></div>
          <div class="sidebar-section-label">快速篩選</div>

          <button
            v-for="f in filters"
            :key="f.value"
            class="filter-item"
            :class="{ active: activeFilter === f.value && !selected }"
            @click="setFilter(f.value)"
          >
            <span>{{ f.label }}</span>
            <span class="filter-count">{{ f.count }}</span>
          </button>
        </div>
      </aside>

      <!-- Main content -->
      <main class="main-content">
        <!-- Machine detail view -->
        <MachineDetail
          v-if="selected"
          :machine="selected"
          :inline="true"
          @close="selected = null"
        />

        <!-- Grid view (no machine selected) -->
        <template v-else>
          <div class="grid-header">
            <div class="grid-title">
              {{ activeFilterLabel }}
              <span class="grid-count">{{ filteredMachines.length }} 台設備</span>
            </div>
          </div>

          <!-- Loading skeleton -->
          <div v-if="loading && machines.length === 0" class="skeleton-grid">
            <div class="skeleton-card" v-for="n in 5" :key="n"></div>
          </div>

          <!-- Error banner -->
          <div v-else-if="error && machines.length === 0" class="error-banner">
            <span>⚠ 無法載入設備資料：{{ error }}</span>
            <button @click="refresh">重試</button>
          </div>

          <div v-else class="grid">
            <MachineCard
              v-for="m in filteredMachines"
              :key="m.machine_id"
              :machine="m"
              @select="selectMachine"
            />
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import MachineCard from './components/MachineCard.vue'
import MachineDetail from './components/MachineDetail.vue'
import { useMachines } from './composables/useMachines'

const { machines, loading, error, lastFetchAt, statusColor, refresh } = useMachines()

const selected = ref(null)
const sidebarOpen = ref(true)
const activeFilter = ref('all')
const openGroups = reactive(new Set(['fan', 'pump', 'motor']))

const typesMeta = {
  fan:   { label: '風扇', icon: '🌀' },
  pump:  { label: '幫浦', icon: '💧' },
  motor: { label: '馬達', icon: '⚙️' },
}

const machineGroups = computed(() =>
  Object.entries(typesMeta).map(([type, meta]) => ({
    type,
    ...meta,
    machines: machines.value.filter(m => m.type === type)
  }))
)

const filters = computed(() => [
  { label: '全部設備', value: 'all', count: machines.value.length },
  { label: '⚠ 異常設備', value: 'abnormal', count: machines.value.filter(m => m.status !== 'normal').length },
])

const filteredMachines = computed(() => {
  if (activeFilter.value === 'all') return machines.value
  if (activeFilter.value === 'abnormal') return machines.value.filter(m => m.status !== 'normal')
  return machines.value.filter(m => m.type === activeFilter.value)
})

const activeFilterLabel = computed(() => {
  return filters.value.find(f => f.value === activeFilter.value)?.label ?? '全部設備'
})

function countByStatus(status) {
  return machines.value.filter(m => m.status === status).length
}

function selectMachine(machine) {
  selected.value = machine
  activeFilter.value = 'all'
}

function setFilter(val) {
  activeFilter.value = val
  selected.value = null
}

function toggleGroup(type) {
  if (openGroups.has(type)) openGroups.delete(type)
  else openGroups.add(type)
}

const lastFetchedTime = computed(() => {
  if (!lastFetchAt.value) return '—'
  return lastFetchAt.value.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
})
</script>

<style scoped>
.app { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

/* ── Topbar ── */
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; height: 56px; flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg2);
  z-index: 20;
}
.topbar-left { display: flex; align-items: center; gap: 14px; }
.logo { font-size: 17px; font-weight: 700; }
.subtitle { font-size: 12px; color: var(--text2); }
.topbar-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.summary-pills { display: flex; gap: 8px; }
.pill { font-size: 12px; padding: 2px 10px; border-radius: 20px; font-weight: 500; }
.pill.normal  { background: #1D9E7520; color: #1D9E75; }
.pill.warning { background: #EF9F2720; color: #EF9F27; }
.pill.fault   { background: #E24B4A20; color: #E24B4A; }
.updated { font-size: 11px; color: var(--text2); }

.topbar-meta { display: flex; align-items: center; gap: 8px; }
.fetch-status { font-size: 11px; }
.fetch-status.ok      { color: var(--text2); }
.fetch-status.loading { color: #378ADD; }
.fetch-status.err     { color: #E24B4A; cursor: default; }

.refresh-btn {
  background: var(--bg3); border: 1px solid var(--border);
  color: var(--text2); border-radius: 6px;
  width: 28px; height: 28px; font-size: 16px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: color .15s, background .15s;
}
.refresh-btn:hover:not(:disabled) { color: var(--text); background: var(--bg2); }
.refresh-btn:disabled { opacity: .4; cursor: not-allowed; }
@keyframes spin { to { transform: rotate(360deg); } }
.spin { display: inline-block; animation: spin .8s linear infinite; }

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px; padding: 12px 24px 24px;
}
.skeleton-card {
  height: 180px; border-radius: var(--radius);
  background: linear-gradient(90deg, var(--bg2) 25%, var(--bg3) 50%, var(--bg2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer { to { background-position: -200% 0; } }

.error-banner {
  margin: 20px 24px; padding: 14px 18px;
  background: #E24B4A18; border: 1px solid #E24B4A55;
  border-radius: 8px; color: #E24B4A;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  font-size: 13px;
}
.error-banner button {
  background: #E24B4A22; border: 1px solid #E24B4A55;
  color: #E24B4A; border-radius: 6px; padding: 4px 14px;
  cursor: pointer; font-size: 13px;
}
.error-banner button:hover { background: #E24B4A33; }

/* Hamburger */
.toggle-btn {
  background: none; border: none; cursor: pointer;
  padding: 6px; border-radius: 6px; display: flex; align-items: center;
}
.toggle-btn:hover { background: var(--bg3); }
.hamburger { display: flex; flex-direction: column; gap: 4px; width: 18px; }
.hamburger span { display: block; height: 2px; background: var(--text2); border-radius: 2px; transition: all .25s; }
.hamburger.open span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
.hamburger.open span:nth-child(2) { opacity: 0; }
.hamburger.open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }

/* ── Body layout ── */
.body-layout { display: flex; flex: 1; overflow: hidden; }

/* ── Sidebar ── */
.sidebar {
  width: 220px; flex-shrink: 0;
  background: var(--bg2);
  border-right: 1px solid var(--border);
  overflow-y: auto; overflow-x: hidden;
  transition: width .25s ease, opacity .2s;
}
.sidebar.collapsed { width: 0; opacity: 0; pointer-events: none; }

.sidebar-inner { padding: 12px 0; min-width: 220px; }

.sidebar-section-label {
  font-size: 10px; font-weight: 600; letter-spacing: .08em;
  color: var(--text2); text-transform: uppercase;
  padding: 6px 16px 4px;
}

/* Type groups */
.type-group { margin-bottom: 2px; }
.group-header {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 16px; cursor: pointer;
  transition: background .15s; user-select: none;
}
.group-header:hover { background: var(--bg3); }
.group-icon { font-size: 15px; }
.group-label { flex: 1; font-size: 13px; font-weight: 500; }
.group-count {
  font-size: 11px; background: var(--bg3); color: var(--text2);
  padding: 1px 7px; border-radius: 10px;
}
.chevron {
  font-size: 16px; color: var(--text2);
  display: inline-block; transition: transform .2s;
}
.chevron.rotated { transform: rotate(90deg); }

/* Machine items */
.group-items { padding-bottom: 4px; }
.machine-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 6px 16px 6px 32px;
  background: none; border: none; cursor: pointer; text-align: left;
  color: var(--text2); font-size: 13px; transition: all .15s;
  border-left: 2px solid transparent;
}
.machine-item:hover { background: var(--bg3); color: var(--text); }
.machine-item.active {
  background: #378ADD15; color: #378ADD;
  border-left-color: #378ADD;
}
.item-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.item-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-id { font-size: 10px; color: var(--text2); opacity: .6; }

/* Filter items */
.filter-item {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 7px 16px;
  background: none; border: none; cursor: pointer; text-align: left;
  color: var(--text2); font-size: 13px; transition: all .15s;
  border-left: 2px solid transparent;
}
.filter-item:hover { background: var(--bg3); color: var(--text); }
.filter-item.active { background: #378ADD15; color: #378ADD; border-left-color: #378ADD; }
.filter-count {
  font-size: 11px; background: var(--bg3); color: var(--text2);
  padding: 1px 7px; border-radius: 10px;
}

.sidebar-divider { margin: 10px 0; border-top: 1px solid var(--border); }

/* ── Main content ── */
.main-content { flex: 1; overflow-y: auto; }

.grid-header {
  display: flex; align-items: center; padding: 16px 24px 4px;
}
.grid-title { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
.grid-count { font-size: 12px; color: var(--text2); font-weight: 400; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  padding: 12px 24px 24px;
}

/* Slide transition */
.slide-enter-active, .slide-leave-active { transition: all .2s ease; overflow: hidden; }
.slide-enter-from, .slide-leave-to { max-height: 0; opacity: 0; }
.slide-enter-to, .slide-leave-from { max-height: 300px; opacity: 1; }
</style>
