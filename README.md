# 震動監測儀表板

設備震動即時監測儀表板，整合 PW-RVT 三軸振動感測器資料，提供設備健康狀態監測、異常預警與趨勢分析。

**🌐 線上展示：[https://siaoliu66.github.io/vibration-dashboard/](https://siaoliu66.github.io/vibration-dashboard/)**

---

## 技術棧

- **Vue 3** Composition API
- **Vite** 開發與打包工具
- **Chart.js / vue-chartjs** 互動式圖表
- **JSON / REST API** 資料來源（支援靜態檔案或後端 API）

---

## 功能介紹

### 側邊欄導航
- 左側欄列出所有設備，依類型分組（🌀 風扇 / 💧 幫浦 / ⚙️ 馬達）
- 每台機器旁有狀態色點即時反映健康狀態
  - 🟢 綠色：正常
  - 🟡 黃色：警告
  - 🔴 紅色：故障
- 點擊漢堡按鈕（左上角）可收合 / 展開側邊欄
- 底部快速篩選：全部設備 / 異常設備

### 設備總覽
- 每台機器以卡片呈現，顯示最新一筆的關鍵數值：
  - RMS（均方根振動值）
  - 峰值因子（Crest Factor）
  - 溫度（°C）
  - 主頻（Hz）
- 卡片底部三條迷你折線圖（Sparkline）即時顯示 X / Y / Z 三軸最近 10 筆趨勢

### 詳細數據頁
點擊任一機器卡片或側邊欄項目後進入詳細頁，包含：

#### 時間範圍選取（拖移功能）
- 頁面中央有一條**縮略圖軌道**，顯示全部資料的 RMS 趨勢
- **拖移左右手柄**調整時間範圍，主圖表與資料表格同步更新
- **拖移中間高亮區塊**可整體平移，不改變選取寬度
- 點擊軌道空白區域可快速跳移選取中心
- 支援觸控操作（手機 / 平板）

#### 快捷時間按鈕
- 最近 3 天 / 最近 7 天 / 最近 10 天 / 全部

#### 圖表
- **三軸振動趨勢**（X / Y / Z 軸，單位 g）
- **溫度趨勢**（°C）
- **峰值因子趨勢**（含警戒線 CF = 4.0）

#### 原始資料表格
顯示選取範圍內每一筆量測記錄，欄位包含：時間、X/Y/Z 軸振動值、RMS、Peak、CF、主頻、溫度

### 即時資料更新
- 每 **5 分鐘**自動重新抓取資料
- 右上角 **↻ 按鈕**可手動立即重新整理
- 任一台機器抓取失敗不影響其他機器（`Promise.allSettled`）
- 抓取中顯示 spinner 動畫，失敗顯示錯誤提示

---

## 資料格式

每台機器一個 JSON 檔案，放在 `public/data/`：

```json
{
  "machine": {
    "machine_id": "M001",
    "name": "冷卻塔風扇 A",
    "type": "fan",
    "status": "normal",
    "rpm": 1500,
    "location": "廠房 A 區 - 1F",
    "image": { "format": "png", "encoding": "base64", "data": "..." },
    "sensor": { "model": "PW-RVT", "axes": ["X","Y","Z"], "temp": true },
    "data": [
      {
        "timestamp": "2026-06-19T08:00:00",
        "vibration": {
          "x_axis_g": 0.1778,
          "y_axis_g": 0.1479,
          "z_axis_g": 0.0591,
          "rms_g": 0.1466,
          "peak_g": 0.2582,
          "crest_factor": 3.11,
          "dominant_freq_hz": 24.6
        },
        "temperature_c": 41.55
      }
    ]
  }
}
```

---

## 快速啟動

```bash
npm install
npm run dev
```

瀏覽器開啟 [http://localhost:5173](http://localhost:5173)

## 打包部署

```bash
npm run build
cp -r public/data dist/data
```

---

## 專案結構

```
src/
├── composables/
│   └── useMachines.js    ← 資料抓取、輪詢、共享狀態
├── components/
│   ├── MachineCard.vue   ← 機器卡片（含 Sparkline）
│   ├── MachineDetail.vue ← 詳細頁（圖表 + 拖移選取器）
│   └── Sparkline.vue     ← 迷你 SVG 折線圖
├── App.vue               ← 主版面（側邊欄 + 內容區）
├── main.js
└── style.css
public/
└── data/                 ← 機器 JSON 資料檔案
```

## 新增機器

1. 在 `public/data/` 放入新的 JSON 檔案
2. 在 `src/composables/useMachines.js` 的 `DATA_URLS` 陣列加入新路徑

## 換成後端 API

只需修改 `src/composables/useMachines.js` 的 `DATA_URLS`：

```js
const DATA_URLS = [
  'https://api.example.com/machines/M001',
  'https://api.example.com/machines/M002',
  // ...
]
```

元件層完全不需要修改。