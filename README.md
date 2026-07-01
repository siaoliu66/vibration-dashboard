# 震動監測儀表板

Vue 3 + Vite 設備震動監測儀表板，讀取 PW-RVT 感測器 JSON 資料。

## 快速啟動

```bash
npm install
npm run dev
```

瀏覽器開啟 http://localhost:5173

## 專案結構

```
src/
├── data/               ← 5 台機器 JSON 檔案
│   ├── M001_fan.json
│   ├── M002_fan.json
│   ├── M003_pump.json
│   ├── M004_motor.json
│   └── M005_motor.json
├── components/
│   ├── MachineCard.vue   ← 機器卡片（含 sparkline）
│   ├── MachineDetail.vue ← 詳細圖表 modal
│   └── Sparkline.vue     ← 迷你趨勢折線圖
├── composables/
│   └── useMachines.js    ← 資料載入與工具函式
├── App.vue               ← 主版面（filter + grid）
├── main.js
└── style.css
```

## 功能說明

- 機器卡片顯示：RMS、峰值因子、溫度、主頻、三軸 sparkline
- 狀態篩選：全部 / 風扇 / 幫浦 / 馬達 / 異常
- 點擊卡片開啟詳細頁：三軸趨勢圖、溫度趨勢圖、峰值因子趨勢、原始資料表格
- 狀態色碼：綠色正常 / 黃色警告 / 紅色故障

## 新增機器

在 `src/data/` 放入新的 JSON 檔案，並在 `src/composables/useMachines.js` import 後加入 `RAW` 陣列即可。
