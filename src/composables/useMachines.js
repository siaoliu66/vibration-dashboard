import { ref, readonly } from 'vue'

// ── 設定區 ────────────────────────────────────────────
// 靜態模式（開發測試）：檔案放在 public/data/ 讓 Vite dev server 直接 serve
// 生產模式：把 DATA_URLS 換成實際 API endpoint，或改用單一 /api/machines endpoint
const DATA_URLS = [
  import.meta.env.BASE_URL + 'data/M001_fan.json',
  import.meta.env.BASE_URL + 'data/M002_fan.json',
  import.meta.env.BASE_URL + 'data/M003_pump.json',
  import.meta.env.BASE_URL + 'data/M004_motor.json',
  import.meta.env.BASE_URL + 'data/M005_motor.json',
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
    // Promise.allSettled：每個 URL 各自處理，一個失敗不影響其他的
    const settled = await Promise.allSettled(
      DATA_URLS.map(url =>
        fetch(url, { cache: 'no-store' })
          .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`)
            return r.json()
          })
      )
    )

    // 把成功的挑出來，失敗的記錄 console 但不中斷
    const failedUrls = []
    const succeeded  = settled.flatMap((result, i) => {
      if (result.status === 'fulfilled') {
        const r = result.value
        return r.machine  ? [r.machine]  :
               r.machines ? r.machines   : []
      } else {
        failedUrls.push(DATA_URLS[i])
        console.warn('[useMachines] 單筆失敗:', DATA_URLS[i], result.reason)
        return []
      }
    })

    // 成功的更新，失敗的機器保留上一次的資料
    if (succeeded.length > 0) {
      const failedIds = new Set(
        failedUrls.map(url => {
          const match = url.match(/\/(M\d+)_/)
          return match ? match[1] : null
        }).filter(Boolean)
      )
      machines.value = [
        ...machines.value.filter(m => failedIds.has(m.machine_id)),
        ...succeeded,
      ]
    }

    // 有失敗的話顯示部分失敗提示
    if (failedUrls.length > 0) {
      error.value = `${failedUrls.length} 台機器資料更新失敗，其餘正常`
    }

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