import { ref, readonly } from 'vue'

// ── 設定區 ────────────────────────────────────────────
// 靜態模式（開發測試）：檔案放在 public/data/ 讓 Vite dev server 直接 serve
// 生產模式：把 DATA_URLS 換成實際 API endpoint，或改用單一 /api/machines endpoint
const DATA_URLS = [
  '/data/M001_fan.json',
  '/data/M002_fan.json',
  '/data/M003_pump.json',
  '/data/M004_motor.json',
  '/data/M005_motor.json',
]

// 自動輪詢間隔（毫秒），設 0 則停用
const POLL_INTERVAL_MS = 5 * 60 * 1000  // 5 分鐘

// ── 單例 state（模組層級，所有 useMachines() 呼叫共用） ──
const machines   = ref([])
const loading    = ref(false)
const error      = ref(null)
const lastFetchAt = ref(null)
let   pollTimer  = null

// ── 核心 fetch 函式 ────────────────────────────────────
async function fetchAll() {
  loading.value = true
  error.value   = null
  try {
    const results = await Promise.all(
      DATA_URLS.map(url =>
        fetch(url, { cache: 'no-store' })           // no-store：每次都跳過瀏覽器快取
          .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`)
            return r.json()
          })
      )
    )
    // 支援兩種 JSON 格式：
    //   { machine: {...} }   ← 單機格式（interval_hours 或 interval_minutes）
    //   { machines: [...] }  ← 未來 API 回傳陣列格式
    const flat = results.flatMap(r =>
      r.machine  ? [r.machine]  :
      r.machines ? r.machines   : []
    )
    machines.value  = flat
    lastFetchAt.value = new Date()
  } catch (e) {
    error.value = e.message
    console.error('[useMachines] fetch failed:', e)
  } finally {
    loading.value = false
  }
}

// ── 輪詢控制 ──────────────────────────────────────────
function startPolling() {
  if (!POLL_INTERVAL_MS || pollTimer) return
  pollTimer = setInterval(fetchAll, POLL_INTERVAL_MS)
}

function stopPolling() {
  clearInterval(pollTimer)
  pollTimer = null
}

// ── 初始化：模組載入時立刻抓一次，並啟動輪詢 ──────────
fetchAll().then(startPolling)

// ── 公開 composable ───────────────────────────────────
export function useMachines() {

  function getMachine(id) {
    return machines.value.find(m => m.machine_id === id)
  }

  function latestReading(machine) {
    const d = machine.data
    return d[d.length - 1]
  }

  function statusColor(status) {
    return { normal: '#1D9E75', warning: '#EF9F27', fault: '#E24B4A' }[status] ?? '#8b90a7'
  }

  function statusLabel(status) {
    return { normal: '正常', warning: '警告', fault: '故障' }[status] ?? status
  }

  function typeIcon(type) {
    return { fan: '🌀', pump: '💧', motor: '⚙️' }[type] ?? '🔧'
  }

  return {
    machines: readonly(machines),   // 外部只讀，防止意外修改
    loading:  readonly(loading),
    error:    readonly(error),
    lastFetchAt: readonly(lastFetchAt),
    getMachine,
    latestReading,
    statusColor,
    statusLabel,
    typeIcon,
    refresh: fetchAll,              // 手動觸發重新抓取
    startPolling,
    stopPolling,
  }
}
