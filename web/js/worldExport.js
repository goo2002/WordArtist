/**
 * .world 地圖轉出：結構對齊編輯器範本（見 `_local/研究用資料/文字小畫家格式拆解.world`）。
 */

// 與編輯器相容之版本字串
const WORLD_EXPORT_EDITOR_VERSION = "1.10.6";

// 矩形內「非該色」／透明區占位：編輯器中空字若用空白易變黑，強制使用全形底線（與 utils `fullUnderscore` 相同）
const WORLD_EXPORT_PLACEHOLDER_CHAR = "＿";

// 與範本相同長度之 thumbnail，避免未知長度限制
const WORLD_EXPORT_THUMBNAIL_PLACEHOLDER = [
  { word: "壹", color: "#ffffff" },
  { word: "貳", color: "#ffffff" },
  { word: "參", color: "#ffffff" },
  { word: "肆", color: "#ffffff" },
  { word: "伍", color: "#ffffff" },
  { word: "陸", color: "#ffffff" },
  { word: "柒", color: "#ffffff" },
  { word: "捌", color: "#ffffff" },
  { word: "玖", color: "#ffffff" },
  { word: "拾", color: "#ffffff" },
  { word: "拾", color: "#ffffff" },
  { word: "壹", color: "#ffffff" },
  { word: "拾", color: "#ffffff" },
  { word: "貳", color: "#ffffff" },
  { word: "拾", color: "#ffffff" },
  { word: "參", color: "#ffffff" },
  { word: "拾", color: "#ffffff" },
  { word: "肆", color: "#ffffff" },
  { word: "拾", color: "#ffffff" },
  { word: "伍", color: "#ffffff" },
  { word: "拾", color: "#ffffff" },
  { word: "陸", color: "#ffffff" },
  { word: "拾", color: "#ffffff" },
  { word: "柒", color: "#ffffff" },
  { word: "拾", color: "#ffffff" }
];

/**
 * @returns {string} RFC4122 UUID（環境不支援時回退隨機字串）
 */
function generateWorldUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** 與 `processCanvasData` 一致的「未繪製」字面判斷（避免複製 utils 內部區域變數） */
function isWorldExportTransparentChar(ch) {
  const fullSpace = "\u3000";
  const fullUnderscore = "＿"; // 與 `utils.js` processCanvasData 之 `fullUnderscore` 相同
  return ch === "" || ch === " " || ch === "_" || ch === fullSpace || ch === fullUnderscore;
}

/**
 * 正規化為 7 字元 #rrggbb（小寫），供分組與輸出 textColor
 * @param {string} hex
 * @returns {string}
 */
function normalizeWorldExportColor(hex) {
  let h = (hex || "").trim().toLowerCase();
  if (!h.startsWith("#")) return "#ffffff";
  if (h.length === 4 && /^#[0-9a-f]{3}$/.test(h)) {
    return "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  if (h.length >= 7 && /^#[0-9a-f]{6}/.test(h.slice(0, 7))) {
    return h.slice(0, 7);
  }
  return "#ffffff";
}

/**
 * 移除行尾連續占位字元（精簡匯出；與占位同字之若為使用者字面且恰在行尾會一併被截，無法區分）
 * @param {string} line
 * @param {string} placeholderChar // 與 WORLD_EXPORT_PLACEHOLDER_CHAR 相同
 */
function trimWorldExportTrailingPlaceholders(line, placeholderChar) {
  let end = line.length;
  while (end > 0 && line.charAt(end - 1) === placeholderChar) end--;
  return line.slice(0, end);
}

/**
 * 建立單一色塊事件（一色一物件）
 * @param {string} displayColor // 正規化後 #rrggbb
 * @param {number} posX // 格座標 x（欄）
 * @param {number} posY // 格座標 y（列）
 * @param {string} text // 多行，\n 分隔
 * @param {{ groupId: string, groupName: string }|null} groupMeta // 與編輯器「群組」一致：同色塊事件共用同一 groupId
 */
function createWorldExportColorEvent(displayColor, posX, posY, text, groupMeta) {
  const id = generateWorldUuid();
  const attribute = {
    pos: { x: posX, y: posY },
    text,
    textColor: displayColor,
    hasBackground: true,
    opacity: 1,
    layer: "mid",
    canPush: false,
    canDelete: false,
    canSplit: true,
    eventTriggerAction: "auto",
    existCondition: "",
    command: [],
    "#loopMoveRoute": []
  };
  if (groupMeta && groupMeta.groupId) {
    attribute.groupId = groupMeta.groupId;
    attribute.groupName = groupMeta.groupName || "群組";
  }
  return {
    id,
    name: `色_${displayColor}`,
    type: "event",
    attribute,
    propertyId: "customCommand",
    property: {
      commands: [],
      callbackId: null
    }
  };
}

/** 玩家在 events 末尾；座標可依範本，日後若要可設定請改呼叫端／常數 */
function createWorldExportPlayerEvent() {
  return {
    id: "player",
    name: "player",
    type: "player",
    attribute: {
      pos: { x: -2, y: 0 },
      text: "我",
      textColor: "#FFFFFF",
      hasBackground: true,
      opacity: 1,
      layer: "mid",
      canPush: false,
      canDelete: false,
      canSplit: false,
      eventTriggerAction: "auto",
      existCondition: "",
      command: [],
      "#loopMoveRoute": []
    },
    propertyId: "dummy",
    property: {
      callbackId: null
    }
  };
}

/**
 * @param {Array<Array<{char:string,color:string}>>} processedData
 * @param {{ objectMode?: 'classic'|'full'|'minRect', groupObjects?: boolean }} options
 * @returns {object|null}
 */
function convertToWorldFormat(processedData, options) {
  const objectMode =
    options && (options.objectMode === "full" || options.objectMode === "minRect" || options.objectMode === "classic")
      ? options.objectMode
      : "classic";
  const groupObjects = !!(options && options.groupObjects);
  /** 編輯器群組顯示名固定為「群組」（不開放自訂） */
  const WORLD_EXPORT_GROUP_DISPLAY_NAME = "群組";
  /** 同一張地圖匯出內，所有色塊事件共用此 id（見 `文字小畫家格式拆解_物件1-5(群組).world`） */
  const sharedGroupMeta = groupObjects
    ? { groupId: generateWorldUuid(), groupName: WORLD_EXPORT_GROUP_DISPLAY_NAME }
    : null;
  /** 經典／整個畫面：行尾清除占位；最小矩形：保留行尾占位 */
  const shouldTrimTrailingPlaceholders = objectMode !== "minRect";

  if (!processedData || processedData.length === 0 || !processedData[0] || processedData[0].length === 0) {
    return null;
  }

  const rows = processedData.length;
  const cols = processedData[0].length;

  /** @type {Map<string, { r: number, c: number }>} */
  const firstOccurrence = new Map();
  /** @type {Map<string, Array<{r:number,c:number}>>} */
  const positionsByColor = new Map();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = processedData[r][c];
      if (isWorldExportTransparentChar(cell.char)) continue;
      const nc = normalizeWorldExportColor(cell.color);
      if (!firstOccurrence.has(nc)) firstOccurrence.set(nc, { r, c });
      if (!positionsByColor.has(nc)) positionsByColor.set(nc, []);
      positionsByColor.get(nc).push({ r, c });
    }
  }

  if (positionsByColor.size === 0) return null;

  const orderedColors = [...firstOccurrence.keys()].sort((a, b) => {
    const fa = firstOccurrence.get(a);
    const fb = firstOccurrence.get(b);
    if (fa.r !== fb.r) return fa.r - fb.r;
    if (fa.c !== fb.c) return fa.c - fb.c;
    return a.localeCompare(b);
  });

  /** 色塊事件：陣列順序較後者可能在編輯器中覆蓋較前者（依遊戲實測為準） */
  const colorEvents = [];

  for (const colorKey of orderedColors) {
    const positions = positionsByColor.get(colorKey);
    if (objectMode === "full") {
      const lines = [];
      for (let r = 0; r < rows; r++) {
        let line = "";
        for (let c = 0; c < cols; c++) {
          const cell = processedData[r][c];
          if (isWorldExportTransparentChar(cell.char)) {
            line += WORLD_EXPORT_PLACEHOLDER_CHAR;
            continue;
          }
          line += normalizeWorldExportColor(cell.color) === colorKey ? cell.char : WORLD_EXPORT_PLACEHOLDER_CHAR;
        }
        lines.push(
          shouldTrimTrailingPlaceholders
            ? trimWorldExportTrailingPlaceholders(line, WORLD_EXPORT_PLACEHOLDER_CHAR)
            : line
        );
      }
      colorEvents.push(createWorldExportColorEvent(colorKey, 0, 0, lines.join("\n"), sharedGroupMeta));
    } else {
      let minR = rows;
      let maxR = -1;
      let minC = cols;
      let maxC = -1;
      for (const { r, c } of positions) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
      const subLines = [];
      for (let r = minR; r <= maxR; r++) {
        let line = "";
        for (let c = minC; c <= maxC; c++) {
          const cell = processedData[r][c];
          if (!isWorldExportTransparentChar(cell.char) && normalizeWorldExportColor(cell.color) === colorKey) {
            line += cell.char;
          } else {
            line += WORLD_EXPORT_PLACEHOLDER_CHAR;
          }
        }
        subLines.push(
          shouldTrimTrailingPlaceholders
            ? trimWorldExportTrailingPlaceholders(line, WORLD_EXPORT_PLACEHOLDER_CHAR)
            : line
        );
      }
      colorEvents.push(createWorldExportColorEvent(colorKey, minC, minR, subLines.join("\n"), sharedGroupMeta));
    }
  }

  const mapId = generateWorldUuid();

  const worldDoc = {
    id: generateWorldUuid(),
    title: "文字小畫家",
    author: {
      name: "PIXEL AXOLOTL",
      uid: "k56MQdUwwBEbq"
    },
    description: "",
    tags: [],
    audio_tags: [],
    maps: [
      {
        id: mapId,
        title: "圖層１",
        stageSize: {
          x: cols,
          y: rows
        },
        events: [...colorEvents, createWorldExportPlayerEvent()],
        variants: [],
        player: {
          text: "我",
          color: "#FFFFFF",
          opacity: 100
        }
      }
    ],
    version: WORLD_EXPORT_EDITOR_VERSION,
    thumbnail: WORLD_EXPORT_THUMBNAIL_PLACEHOLDER,
    editingMapId: mapId,
    murmur: {
      title: "",
      description: "",
      hint_1: "",
      hint_2: "",
      hint_3: ""
    },
    initialAbilities: {
      deleteAbility: true,
      pushAbility: true,
      splitAbility: true,
      ctrlZAbility: true
    },
    language: ["zh-TW"]
  };

  return worldDoc;
}
