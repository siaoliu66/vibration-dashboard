# 專案技術說明文件

> 設備震動監測儀表板 — 每個檔案的設計邏輯與技術決策

---

## 專案結構總覽

```
src/
├── main.js                        # 應用程式進入點
├── App.vue                        # 根元件：版面、側邊欄、路由邏輯
├── style.css                      # 全域 CSS 變數與基礎樣式
├── composables/
│   └── useMachines.js             # 核心狀態層：資料抓取、輪詢、共享
└── components/
    ├── MachineCard.vue            # 機器卡片（總覽用）
    ├── MachineDetail.vue          # 機器詳細頁（含圖表）
    └── Sparkline.vue              # 迷你趨勢折線圖（SVG）
```

---

## `main.js` — 應用程式進入點

```js
import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')
```

**說明：**
這是最精簡的 Vue 3 進入點。值得注意的是 `style.css` 在這裡 import，
確保 CSS Variables（`--bg`、`--text` 等）在所有元件掛載前就已定義，
避免元件首次渲染時出現樣式閃爍。

---

## `style.css` — 設計系統基礎

```css
:root {
  --bg: #0f1117;
  --bg2: #1a1d27;
  --bg3: #22263a;
  --border: rgba(255,255,255,0.08);
  --blue: #378ADD;
  --teal: #1D9E75;
  --amber: #EF9F27;
  --red: #E24B4A;
  /* ... */
}
```

**設計決策：**

- 所有顏色集中在 `:root` 定義為 CSS Variables，元件內不出現 hardcode 色碼
- 深色系三層背景（`--bg` / `--bg2` / `--bg3`）製造視覺深度，而不需要陰影
- 狀態色（綠/黃/紅）統一命名，讓 JavaScript 透過 `statusColor()` 動態注入時保持一致

---

## `composables/useMachines.js` — 核心狀態層

這是整個專案最關鍵的檔案，負責所有資料的生命週期管理。

### 模組結構

```
useMachines.js
├── 設定區（DATA_URLS、POLL_INTERVAL_MS）
├── 模組層級單例 state（machines、loading、error、lastFetchAt）
├── fetchAll()    ← 核心抓取函式
├── startPolling() / stopPolling()
├── 初始化（模組載入時立刻執行）
└── export useMachines()  ← 對外公開的 composable
```

### 關鍵設計：模組層級單例

```js
// ❌ 如果寫在 composable 函式內：
export function useMachines() {
  const machines = ref([])  // 每次呼叫都建立新的 ref，互不共用
}

// ✅ 實際作法：寫在函式外（模組層級）
const machines = ref([])    // 整個模組只有一份，所有呼叫者共享

export function useMachines() {
  return { machines }       // 回傳的是同一個 ref 的參考
}
```

這樣 `App.vue`、`MachineCard.vue`、`MachineDetail.vue` 呼叫 `useMachines()` 時，
拿到的都是同一份資料，不會重複發出 HTTP 請求。

### 關鍵設計：`readonly()` 防止意外修改

```js
return {
  machines: readonly(machines),  // 外部只能讀，不能寫
  loading:  readonly(loading),
}
```

子元件若嘗試 `machines.value.push(...)` 會在 dev 模式下收到警告。
這確保資料流是單向的：只有 `fetchAll()` 可以修改 `machines`。

### 關鍵設計：`cache: 'no-store'`

```js
fetch(url, { cache: 'no-store' })
```

瀏覽器預設會快取 GET 請求。加上 `cache: 'no-store'` 後，
每次 fetch 都強制向伺服器重新取得資料，確保輪詢能拿到最新內容。
若不加這個，可能 5 分鐘後抓到的還是舊的快取版本。

### 關鍵設計：`Promise.all` 並行抓取

```js
const results = await Promise.all(
  DATA_URLS.map(url => fetch(url).then(r => r.json()))
)
```

5 台機器同時發出請求，而不是一台等一台，
總等待時間 = 最慢那台的時間，而不是 5 台加總。

### 從靜態檔案切換到 API

只需修改 `DATA_URLS`，元件層完全不用動：

```js
// 目前（靜態 JSON 放在 public/data/）
const DATA_URLS = [
  '/data/M001_fan.json',
  '/data/M002_fan.json',
  // ...
]

// 換成後端 API（每台機器一支 endpoint）
const DATA_URLS = [
  'https://api.example.com/machines/M001',
  'https://api.example.com/machines/M002',
  // ...
]

// 或單一 endpoint 回傳全部（需調整 flatMap 邏輯）
// GET /api/machines → { machines: [...] }
```

---

## `App.vue` — 根元件

負責整體版面配置與狀態協調，不直接處理資料邏輯。

### 版面結構

```
App.vue
├── <header class="topbar">       ← 固定在頂部：Logo、狀態統計、刷新按鈕
└── <div class="body-layout">
    ├── <aside class="sidebar">   ← 可收合側邊欄
    │   ├── 機器分組列表（風扇/幫浦/馬達）
    │   └── 快速篩選（全部/異常）
    └── <main class="main-content">
        ├── MachineDetail         ← 選了機器時顯示
        └── Grid + MachineCard    ← 未選機器時顯示
```

### 關鍵設計：兩種顯示模式切換

```vue
<template>
  <!-- 選了機器 → 詳細頁 -->
  <MachineDetail v-if="selected" :machine="selected" @close="selected = null" />

  <!-- 未選機器 → 卡片總覽 -->
  <template v-else>
    <MachineCard v-for="m in filteredMachines" ... />
  </template>
</template>
```

`selected` 是一個 `ref(null)`，點擊側邊欄機器項目時設值，
點擊「返回總覽」時清空。用 `v-if / v-else` 切換，而非 router，
保持專案簡單（不需要引入 vue-router）。

### 關鍵設計：側邊欄的 CSS 收合動畫

```css
.sidebar {
  width: 220px;
  transition: width .25s ease, opacity .2s;
}
.sidebar.collapsed {
  width: 0;
  opacity: 0;
  pointer-events: none;  /* 收合後無法點擊，避免 tab 鍵誤觸 */
}
```

使用 CSS transition 而非 JavaScript 動畫，效能更好（走 compositor thread）。
`pointer-events: none` 確保收合後的元素完全不可互動。

### 關鍵設計：Hamburger 動畫

```css
.hamburger.open span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
.hamburger.open span:nth-child(2) { opacity: 0; }
.hamburger.open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }
```

純 CSS 實現三條線 → X 的變形動畫，不需要 JavaScript 控制每一幀。

---

## `components/MachineCard.vue` — 機器卡片

顯示單台機器的摘要資訊，點擊後通知父元件切換到詳細頁。

### Props / Emits

```js
const props = defineProps({ machine: Object })
const emit  = defineEmits(['select'])
// 點擊卡片時：emit('select', machine)
// 父元件（App.vue）接收後設定 selected.value = machine
```

### Sparkline 資料準備

```js
const xValues = computed(() => props.machine.data.map(d => d.vibration.x_axis_g))
const yValues = computed(() => props.machine.data.map(d => d.vibration.y_axis_g))
const zValues = computed(() => props.machine.data.map(d => d.vibration.z_axis_g))
```

`computed` 確保只有在 `machine.data` 變動時才重新計算，
不會每次渲染都跑一遍 `map`。

### 狀態警示的條件樣式

```vue
<div class="metric-value" :class="{ warn: latest.vibration.crest_factor > 4 }">
```

峰值因子（Crest Factor）正常值約 2.5–3.5，超過 4 開始進入警示區間，
超過 6 代表軸承可能已有明顯損傷。閾值直接寫在 template 裡，
未來可抽成 props 讓父元件傳入不同機器的客製閾值。

---

## `components/MachineDetail.vue` — 詳細頁

顯示單台機器的完整數據，包含三張 Chart.js 互動圖表。

### Chart.js 按需引入（Tree-shaking）

```js
import {
  Chart, LineController, LineElement, PointElement,
  LinearScale, CategoryScale, Legend, Tooltip, Filler
} from 'chart.js'

Chart.register(LineController, LineElement, PointElement, ...)
```

Chart.js v4 支援 tree-shaking，只引入用到的模組，
打包後比引入整個 `Chart` 物件小約 60%。

### 圖表生命週期管理

```js
let charts = []

onMounted(() => {
  charts.push(new Chart(vibCanvas.value, { ... }))
  charts.push(new Chart(tempCanvas.value, { ... }))
  charts.push(new Chart(cfCanvas.value,  { ... }))
})

onUnmounted(() => {
  charts.forEach(c => c.destroy())  // 釋放 canvas 記憶體
})
```

`onUnmounted` 時呼叫 `destroy()` 非常重要。
若不銷毀，切換機器後舊的 Chart 實例仍佔用記憶體，
且同一個 `<canvas>` 元素被重複初始化時 Chart.js 會報錯。

### 切換機器時重建圖表

```js
watch(() => props.machine.machine_id, () => {
  setTimeout(buildCharts, 50)
})
```

當側邊欄選擇不同機器時，`machine_id` 改變，
`watch` 觸發重建圖表。`setTimeout(50ms)` 確保 Vue 的 DOM 更新已完成，
`canvas` 元素已重新渲染，再初始化新的 Chart 實例。

### 峰值因子警戒線

```js
{
  label: '警戒線 4.0',
  data: Array(labels.length).fill(4.0),   // 所有點都是 4.0 的水平線
  borderColor: '#EF9F27',
  borderDash: [5, 5],                      // 虛線
  pointRadius: 0,                           // 不顯示資料點
  borderWidth: 1.5
}
```

用第二條折線模擬參考線，這是 Chart.js 常見的做法，
因為原生的「參考線」功能需要額外的 plugin。

---

## `components/Sparkline.vue` — 迷你折線圖

卡片上的迷你趨勢圖，純 SVG 實作，不依賴任何圖表庫。

### 核心邏輯：數值轉 SVG 座標

```js
const points = computed(() => {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 0.001   // 避免除以零（所有值相同時）

  return values.map((val, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((val - min) / range) * height  // SVG Y 軸朝下，需翻轉
    return `${x},${y}`
  }).join(' ')
})
```

**為什麼自己寫而不用 Chart.js：**
卡片上需要 10 幾個 sparkline 同時顯示，若每個都初始化 Chart.js 實例，
記憶體與渲染成本過高。純 SVG `<polyline>` 幾乎零成本，
且不需要 `onMounted` / `onUnmounted` 生命週期管理。

---

## 資料流向總覽

```
public/data/*.json  （或 REST API）
        │
        ▼  fetch（每 5 分鐘 + 手動觸發）
        │
useMachines.js  ──  machines (readonly ref)
        │               │
        │    ┌──────────┼──────────┐
        │    ▼          ▼          ▼
        │  App.vue  MachineCard  MachineDetail
        │    │
        │    ├─ 側邊欄點擊 → selected.value = machine
        │    └─ 篩選 → filteredMachines (computed)
        │
        ▼  emit('select', machine)
     selected ref  →  顯示 MachineDetail
```

資料永遠從 `useMachines.js` 向下流，子元件透過 `emit` 向上通知，
不直接修改共享狀態，符合 Vue 單向資料流原則。

---

## 未來可擴充的方向

| 功能 | 做法 |
|------|------|
| 接後端 API | 修改 `useMachines.js` 的 `DATA_URLS` |
| 新增機器類型 | 在 `useMachines.js` 的 `typeIcon()` 加一行 |
| 自訂警戒閾值 | 把 CF > 4 的硬碼改成從 JSON 讀取 `machine.thresholds` |
| 歷史趨勢查詢 | `MachineDetail` 新增日期選擇器，fetch 不同時間區間的 endpoint |
| 多語言 | 把中文字串抽到 `i18n` 設定檔 |
| PWA 離線支援 | 加 `vite-plugin-pwa`，Service Worker 快取最後一次的 JSON |
