/** 版本與公告（歡迎畫面繁體正文見 `messages`；簡體見 i18n `welcome.releaseLine1`～`7`） */
const APP_RELEASE = Object.freeze({
  version: "V1.0.0",
  channel: "測試版",
  updatedAt: "2026-04-19", // 對外顯示之版本更新日期（建議 ISO YYYY-MM-DD）
  messages: [
    "「文字小畫家」是一款幫助你輕鬆的完成複雜的文字畫網頁小工具，在這裡，不論是存成PNG圖檔向大家分享自己的創意，或是利用「黑魔法」置入於文字遊戲世界的關卡中都非常實用！！",
    "本次為首次公開版本，主要功能如下：",
    "-基本檔案功能，可以儲存、讀取畫到一半的內容，也能轉存成許多格式滿足各種需求。",
    "-影像功能，當你發現圖像畫反、畫布不夠大，這裡可以快速修改。",
    "-視窗，目前有調色盤功能，可以將你常用的文字存在這裡。",
    "-各種繪製工具：選取、打字、筆刷、橡皮擦、線段、圓形、油漆桶、吸管、清空",
    "目前僅提供本地版本，歡迎大家下載使用，如果有什麼問題、建議或是想許願功能，歡迎大家提出！"
  ]
});

/**
 * 介面語系偏好（繁／簡）。實際文案切換與持久化載入暫緩，先固定可選值。
 * 值建議沿用 BCP 47，便於與 `lang`／i18n 資源對齊。
 */
const UserPreferenceLocale = Object.freeze({
  ZH_TW: "zh-TW",
  ZH_CN: "zh-CN",
});

/**
 * 使用者偏好資料形狀之預設值（預設字面／顏色應與啟動時 `brushChar`／`brushColor` 一致）。
 * 持久化鍵：`STORAGE_LS_KEYS.USER_PREFERENCES`（見 storage.js）。
 * 合併／套用見 `main.js`。`defaultBrush` 僅決定**下次／首次載入**時筆刷初值；偏好視窗按確認不會改當前工作筆刷。
 */
const USER_PREFERENCES_DEFAULT = Object.freeze({
  locale: UserPreferenceLocale.ZH_TW,
  defaultBrush: Object.freeze({
    char: "字",
    color: "#ffff00",
  }),
  /** 油漆桶正式填色是否使用過程動畫（由點擊處依曼哈頓距離向外批次填滿）；false 為一次填滿 */
  animationEnabled: true,
});

// 常數與列舉
const ToolInputType = Object.freeze({
  Start: "start", Over: "over", Enter: "enter", Exit: "exit",
  LeftDown: "left_down", LeftUp: "left_up", RightDown: "right_down", RightUp: "right_up",
  /** 修飾鍵狀態已更新（keydown/keyup/blur 後）；有需要的工具可覆寫 ModifiersChanged */
  ModifiersChanged: "modifiers_changed"
});

// 全域資料
let canvas, overlay, dialog, toolbar, menuBar;
let brushCharInput, brushColorInput;

/** 是否啟用測試版（Beta）；每次載入網頁為 false，不寫入 storage（僅本次工作階段／偏好視窗內切換） */
let isBetaEnabled = false;

// 畫布狀態
let data = [];        
let previewData = []; 
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 16;

// 浮動選取層相關變數
let floatingLayer = null; 
let floatingPos = null;
/** 與 floatingLayer 同尺寸的聯集遮罩；true 為實際選中格 */
let floatingMask = null;
/** 加選時第二段框選的虛線矩形（與 floatingMask 聯集一併畫邊） */
let selectionAddRect = null;
let selection = null; 

// 設定
let rows = 18;
let cols = 32;
let cellSize = 24.0;
let fps = 60;
let fileName = "文字畫";

// 筆刷狀態
let selectedTool = "brush";
let currentTool = null;
let brushChar = "字";
let brushColor = "#ffff00";
let isMouseDown = false;
let isPointerDown = false;
let currentGrid = null;

/** 打字工具：目前游標格 `{ r, c }`，右鍵錨定後有效 */
let typeCursor = null;
/** 打字工具：額外 carets（不含主 caret typeCursor）。Alt+click 後追加，主 caret 永遠是最後一次點擊那格 */
let typeExtraCursors = [];
/** 打字 caret「|」閃爍相位基準（performance.now）；Alt 新增一個 caret 時更新，使新舊 caret 同相閃爍 */
let typingCaretBlinkT0 = typeof performance !== "undefined" ? performance.now() : 0;
/** 承接 IME 的隱藏 textarea（`main.js` DOMContentLoaded 指派） */
let typeImeHook = null;
/** 打字選取：拖曳起點格（LeftDown 時設定；僅打字工具使用） */
let typeSelectAnchor = null;
/** 打字選取：拖曳目前格（拖曳期間隨 hover 更新；僅打字工具使用） */
let typeSelectHead = null;
/** 打字選取：拖曳期間即時顯示用（LeftUp 後清除或轉成 typeSelection） */
let typeDragSelection = null;
/** 打字選取：確認後的選取（放開後若格數 > 1；用於刪除/輸入覆蓋/方向鍵定位） */
let typeSelection = null;

/** 修飾鍵狀態（由 main.js keydown/keyup/blur 同步） */
let isShiftDown = false;
let isAltDown = false;
let isCtrlDown = false;

// 渲染相關（筆刷等預覽閃爍，與油漆桶填色過程動畫無關）
let useFlicker = true;
/** 油漆桶左鍵填色：true 為距離環狀向外擴散批次填滿；false 為立即填滿（見 tools.js `fill`） */
let useBucketFillAnimation = true;
let flickerAlpha = 0.7;
let currentFlickerPhase = 0;
let flickerIncreasing = true;

// 儲存設定預設值
let saveOptions = { crop: false, mode: 'toFullWidth' };
let exportOptions = {
  crop: false,
  mode: 'toFullWidth',
  type: 'txt',
  worldObjectMode: 'classic', // .world：預設 classic／最小矩形範圍 minRect／填滿 full
  worldGroupObjects: true // .world：群組物件預設開（共用 groupId，groupName 固定「群組」）
};
let magicOptions = {
  posX: 0,
  posY: 0,
  tagsString: 'label #1',
  fixed: false,
  has_se: true,
  has_animation: false,
  need_accept: false,
  can_skip: false,
  wait: false,
  layer: 'mid',
  char_type: 'null'
};

/** 工具列按鈕（字面／說明由 i18n `tool.{id}.label`／`tool.{id}.title`） */
const toolDatas = [
  { tool: "select", color: "#fff", disabled: false },
  { tool: "type", color: "#ff0", disabled: false },
  { tool: "brush", color: "#ff0", disabled: false },
  { tool: "eraser", color: "#f00", disabled: false },
  { tool: "line", color: "#fff", disabled: false },
  { tool: "shape", color: "#fff", disabled: false },
  { tool: "bucket", color: "#fff", disabled: false },
  { tool: "eyedropper", color: "#fff", disabled: false },
  { tool: "clear", color: "#f00", disabled: false },
];

// 調色盤
let palette = [
  { char: "█", color: "#FFFFFF" },
  { char: "▒", color: "#888888" },
  { char: "░", color: "#444444" },
  { char: "草", color: "#00FF00" },
  { char: "水", color: "#0000FF" },
  { char: "火", color: "#FF0000" }
];
let isPaletteOpen = false;