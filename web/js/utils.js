// 深層複製
function deepClone(arr) {
  return arr.map(row => row.map(cell => ({ ...cell })));
}

/** 畫布格 (r,c) 是否在浮動層聯集內（矩形內且遮罩為真；無遮罩則矩形內皆算） */
function cellInFloatingUnion(r, c) {
  if (!floatingLayer || !floatingPos) return false;
  const lr = r - floatingPos.r;
  const lc = c - floatingPos.c;
  if (lr < 0 || lr >= floatingLayer.length || lc < 0 || lc >= floatingLayer[0].length) return false;
  if (!floatingMask) return true;
  return !!floatingMask[lr][lc];
}

// 判斷座標是否在選取範圍內
function isInSelection(r, c) {
  if (floatingLayer && floatingPos) {
    return cellInFloatingUnion(r, c);
  }
  if (!selection) return true;
  return r >= selection.r && r < selection.r + selection.h &&
         c >= selection.c && c < selection.c + selection.w;
}

/**
 * 打字游標下一格：先右，否則自下一列最左掃描第一個在選取內的格。
 * 無選取時視為全畫布可打（isInSelection 全 true）。
 */
function nextTypeCell(r, c) {
  // 同一列：往右掃描找下一個可打字格（加/減選可能導致洞）
  for (let cc = c + 1; cc < cols; cc++) {
    if (isInSelection(r, cc)) return { r, c: cc };
  }
  for (let rr = r + 1; rr < rows; rr++) {
    const head = firstTypeCellInRow(rr); // 下一列由左起第一個可打字格
    if (head) return head;
  }
  return null;
}

/** 第 rr 列由左而右第一個可打字格（畫布內且 isInSelection）；無則 null */
function firstTypeCellInRow(rr) {
  if (rr < 0 || rr >= rows) return null;
  for (let cc = 0; cc < cols; cc++) {
    if (isInSelection(rr, cc)) return { r: rr, c: cc };
  }
  return null;
}

/**
 * 與 nextTypeCell 互逆：唯一一格 p 滿足 nextTypeCell(p) === (r,c)，無則 null。
 * 以全格掃描求逆，與錨點無關，與實際打字路徑一致。
 */
function prevTypeCell(r, c) {
  for (let rr = 0; rr < rows; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      if (!isInSelection(rr, cc)) continue;
      const n = nextTypeCell(rr, cc);
      if (n && n.r === r && n.c === c) return { r: rr, c: cc };
    }
  }
  return null;
}

/** 第 rr 列由右而左第一個可打字格（畫布內且 isInSelection）；無則 null */
function lastTypeCellInRow(rr) {
  if (rr < 0 || rr >= rows) return null;
  for (let cc = cols - 1; cc >= 0; cc--) {
    if (isInSelection(rr, cc)) return { r: rr, c: cc };
  }
  return null;
}

/** 同行（固定 r）：自 c 往右找下一個可編輯格；無則 null */
function nextTypeCellInRow(r, c) {
  if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
  for (let cc = c + 1; cc < cols; cc++) {
    if (isInSelection(r, cc)) return { r, c: cc };
  }
  return null;
}

/** 同行（固定 r）：自 c 往左找上一個可編輯格；無則 null */
function prevTypeCellInRow(r, c) {
  if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
  for (let cc = c - 1; cc >= 0; cc--) {
    if (isInSelection(r, cc)) return { r, c: cc };
  }
  return null;
}

/** 同列／同欄（固定 c）：自 r 往下找下一個可編輯格；無則 null */
function nextTypeCellInCol(r, c) {
  if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
  for (let rr = r + 1; rr < rows; rr++) {
    if (isInSelection(rr, c)) return { r: rr, c };
  }
  return null;
}

/** 同列／同欄（固定 c）：自 r 往上找上一個可編輯格；無則 null */
function prevTypeCellInCol(r, c) {
  if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
  for (let rr = r - 1; rr >= 0; rr--) {
    if (isInSelection(rr, c)) return { r: rr, c };
  }
  return null;
}

/** 右：同行下一可編輯格；無則自下一列起往下找第一個有可編輯格之列的行首；無則 null */
function nextTypeCellInRowOrNextRow(r, c) {
  const inRow = nextTypeCellInRow(r, c);
  if (inRow) return inRow;
  for (let rr = r + 1; rr < rows; rr++) {
    const head = firstTypeCellInRow(rr);
    if (head) return head;
  }
  return null;
}

/** 左：同行上一可編輯格；無則自上一列起往上找最後一個有可編輯格之列的尾格；無則 null */
function prevTypeCellInRowOrPrevRow(r, c) {
  const inRow = prevTypeCellInRow(r, c);
  if (inRow) return inRow;
  for (let rr = r - 1; rr >= 0; rr--) {
    const tail = lastTypeCellInRow(rr);
    if (tail) return tail;
  }
  return null;
}

/** 將 {r,c} 轉成唯一 key（供 Set/Map 使用） */
function rcKey(r, c) {
  return `${r},${c}`;
}

/**
 * 依 nextTypeCell 的順序建立索引表（僅包含 isInSelection 可打字格）。
 * @returns {{ indexByKey: Map<string, number>, rcByIndex: Array<{r:number,c:number}> }}
 */
function buildTypeOrderIndex() {
  const indexByKey = new Map(); // key -> index
  const rcByIndex = []; // index -> {r,c}
  let idx = 0; // 目前索引
  for (let rr = 0; rr < rows; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      if (!isInSelection(rr, cc)) continue;
      const key = rcKey(rr, cc);
      indexByKey.set(key, idx);
      rcByIndex.push({ r: rr, c: cc });
      idx++;
    }
  }
  return { indexByKey, rcByIndex };
}

/**
 * 依打字路徑收集兩點間（含首尾）的所有格。
 * - 先用 buildTypeOrderIndex 比較先後，取得 start/end。\n+ * - 再從 start 以 nextTypeCell 迭代直到 end（含）。\n+ * @returns {{ start:{r:number,c:number}, end:{r:number,c:number}, cells:Array<{r:number,c:number}>, cellKeySet:Set<string> } | null}
 */
function collectTypeRangeCells(a, b) {
  if (!a || !b) return null;
  if (!isInSelection(a.r, a.c) || !isInSelection(b.r, b.c)) return null;
  const { indexByKey } = buildTypeOrderIndex();
  const aKey = rcKey(a.r, a.c);
  const bKey = rcKey(b.r, b.c);
  const ai = indexByKey.get(aKey);
  const bi = indexByKey.get(bKey);
  if (ai == null || bi == null) return null;

  const start = ai <= bi ? { r: a.r, c: a.c } : { r: b.r, c: b.c };
  const end = ai <= bi ? { r: b.r, c: b.c } : { r: a.r, c: a.c };

  const cells = []; // 依 nextTypeCell 順序
  const cellKeySet = new Set(); // 快速命中用
  let cur = { r: start.r, c: start.c };
  while (cur) {
    const key = rcKey(cur.r, cur.c);
    if (!cellKeySet.has(key)) {
      cells.push({ r: cur.r, c: cur.c });
      cellKeySet.add(key);
    }
    if (cur.r === end.r && cur.c === end.c) break;
    cur = nextTypeCell(cur.r, cur.c);
  }

  return { start, end, cells, cellKeySet };
}

// 筆刷直線算法
function getLineBetween(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    points.push({ r: x0, c: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return points;
}

/**
 * 拖曳端點在選區外時：沿錨點 (ar,ac) 指向目標 (br,bc) 的直線，取路徑上「最後一個」仍 isInSelection 的格（貼邊／過洞後仍合理）。
 * 目標格已在選區內則回傳目標；起點不在選區內則 null。
 */
function lastInSelectionTowards(ar, ac, br, bc) {
  if (!isInSelection(ar, ac)) return null;
  if (isInSelection(br, bc)) return { r: br, c: bc };
  let last = null; // 沿路徑最後一個可編輯格
  for (const p of getLineBetween(ar, ac, br, bc)) {
    if (isInSelection(p.r, p.c)) last = { r: p.r, c: p.c };
  }
  return last;
}

// 改進版：Bresenham 橢圓演算法 (解決缺口與不圓的問題)
function getEllipsePoints(r0, c0, r1, c1) {
  const points = [];
  let minR = Math.min(r0, r1), maxR = Math.max(r0, r1);
  let minC = Math.min(c0, c1), maxC = Math.max(c0, c1);
  
  // 計算中心與半軸長
  let xc = (minC + maxC) / 2;
  let yc = (minR + maxR) / 2;
  let a = (maxC - minC) / 2; // 水平半軸
  let b = (maxR - minR) / 2; // 垂直半軸

  // 避免除以零
  if (a === 0 || b === 0) return getLineBetween(r0, c0, r1, c1);

  // 由於我們是在整數網格上畫圖，我們將橢圓參數化繪製
  // 使用簡單的角度掃描對於小半徑會有缺口，這裡使用改良的繪製法
  // 針對像素畫，我們可以遍歷一個象限並鏡像，或者使用標準 Bresenham
  
  // 這裡使用一個針對像素優化的簡易實作：
  // 遍歷角度 0 到 360，步長取決於周長，保證連續性
  const perimeter = 2 * Math.PI * Math.sqrt((a*a + b*b) / 2);
  const steps = Math.ceil(perimeter * 1.5); // 增加步數以確保無縫隙

  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const c = Math.round(xc + a * Math.cos(theta));
    const r = Math.round(yc + b * Math.sin(theta));
    
    // 去重 (Set 比較慢，這裡因為數量少直接推入，由繪製端覆蓋即可)
    points.push({ r, c });
  }

  return points;
}

// 調整畫布大小資料處理
// anchor: "top-left", "center", "bottom-right" ... 這裡簡化為 offsetR, offsetC
function resizeCanvasData(oldData, oldRows, oldCols, newRows, newCols, offsetR, offsetC) {
  const newData = [];
  for (let r = 0; r < newRows; r++) {
    const row = [];
    for (let c = 0; c < newCols; c++) {
      // 計算舊資料對應座標
      const sourceR = r - offsetR;
      const sourceC = c - offsetC;
      
      if (sourceR >= 0 && sourceR < oldRows && sourceC >= 0 && sourceC < oldCols) {
        row.push({ ...oldData[sourceR][sourceC] });
      } else {
        row.push({ char: "", color: "#000000" });
      }
    }
    newData.push(row);
  }
  return newData;
}

// 顏色處理
function applyAlphaToColor(color, baseAlpha = 1) {
  const alpha = baseAlpha * (1 + (flickerAlpha - 1) * currentFlickerPhase);
  // 簡單處理 Hex 轉 RGBA (如果是標準 #RRGGBB)
  if (color.startsWith('#')) {
    let r = 0, g = 0, b = 0;
    if (color.length === 4) { // #RGB
      r = parseInt(color[1] + color[1], 16);
      g = parseInt(color[2] + color[2], 16);
      b = parseInt(color[3] + color[3], 16);
    } else if (color.length >= 7) { // #RRGGBB
      r = parseInt(color.substr(1, 2), 16);
      g = parseInt(color.substr(3, 2), 16);
      b = parseInt(color.substr(5, 2), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }
  return color;
}

function hexAAToAlpha(hex) {
  if (hex.length === 9) {
    return parseInt(hex.slice(7, 9), 16) / 255;
  }
  return 1;
}

// 字元轉換
function toFullWidthChar(ch) {
  if (ch === ' ') return '\u3000';
  if (ch.length !== 1) return ch;
  const code = ch.charCodeAt(0);
  if (code >= 0x21 && code <= 0x7E) {
    return String.fromCharCode(code + 0xFEE0);
  }
  return ch;
}

// 資料處理與裁剪
function processCanvasData(inputData, cropTransparent = false, transformMode = 'toFullWidth') {
  const fullSpace = '　';
  const fullUnderscore = '＿';
  const isTransparentChar = (ch) => ch === '' || ch === ' ' || ch === '_' || ch === fullSpace || ch === fullUnderscore;

  let newData = inputData.map(row => row.map(cell => {
    let newChar = cell.char;
    let newColor = cell.color;
    if (isTransparentChar(newChar)) {
      if (transformMode === 'fullSpace') { newChar = fullSpace; newColor = "#ffffffff"; }
      else if (transformMode === 'fullUnderscore') { newChar = fullUnderscore; newColor = "#ffffffff"; }
      else if (transformMode === 'toFullWidth') { newChar = toFullWidthChar(newChar); }
    }
    return { char: newChar, color: newColor };
  }));

  if (cropTransparent) {
    let top = 0, bottom = newData.length - 1, left = 0, right = newData[0].length - 1;
    while (top <= bottom && newData[top].every(c => isTransparentChar(c.char))) top++;
    while (bottom >= top && newData[bottom].every(c => isTransparentChar(c.char))) bottom--;
    while (left <= right && newData.every(r => isTransparentChar(r[left].char))) left++;
    while (right >= left && newData.every(r => isTransparentChar(r[right].char))) right--;
    if(top <= bottom && left <= right) {
        newData = newData.slice(top, bottom + 1).map(row => row.slice(left, right + 1));
    }
  }
  return newData;
}

// 格式轉換
function convertToPlainText(data) {
  return data.map(row => row.map(cell => cell.char).join("")).join("\n");
}

function convertToParallelFormat(data) {
  const label_settings = {};
  const lines = [];
  data.forEach(row => {
    let textLine = "";
    let currentColor = "#ffffff";
    let buffer = "";
    row.forEach(cell => {
      const { char, color } = cell;
      if (color === currentColor) {
        buffer += char;
      } else {
        if (currentColor !== "#ffffff" && buffer) textLine += `<${currentColor}>${buffer}</${currentColor}>`;
        else textLine += buffer;
        currentColor = color;
        buffer = char;
      }
    });
    if (currentColor !== "#ffffff" && buffer) textLine += `<${currentColor}>${buffer}</${currentColor}>`;
    else textLine += buffer;
    lines.push(textLine);
  });

  const uniqueColors = new Set(data.flat().map(c => c.color).filter(c => c !== "#ffffff"));
  for (const color of uniqueColors) {
    label_settings[color] = { tags: [color], text_color: color + "ff" };
  }
  return { texts: lines.join("\n"), label_settings, _comment: "World Text Format" };
}