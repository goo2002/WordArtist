// ===== 輔助函式：統一繪圖接口 =====
function drawPixel(r, c, char, color) {
    if (floatingLayer && floatingPos) {
        if (!cellInFloatingUnion(r, c)) return;
        const localR = r - floatingPos.r;
        const localC = c - floatingPos.c;
        floatingLayer[localR][localC] = { char, color };
        return;
    }
    if (r >= 0 && r < data.length && c >= 0 && c < data[0].length) {
        data[r][c] = { char, color };
    }
}

/** #type-ime-hook 一律不攔截指標，讓格子上可 mousedown／拖曳（含游標格長按選取）；鍵盤／IME 靠程式 focus */
function syncTypeImeHookPointerEvents() {
  if (!typeImeHook) return;
  typeImeHook.style.pointerEvents = "none";
}

class Tool {
  constructor(name) { this.name = name; }
  Input(type) {
    switch(type){
        case ToolInputType.Start: this.Start(); break;
        case ToolInputType.Over: this.Over(); break;
        case ToolInputType.Enter: this.Enter(); break;
        case ToolInputType.Exit: this.Exit(); break;
        case ToolInputType.LeftDown: this.LeftDown(); break;
        case ToolInputType.LeftUp: this.LeftUp(); break;
        case ToolInputType.RightDown: this.RightDown(); break;
        case ToolInputType.RightUp: this.RightUp(); break;
        case ToolInputType.ModifiersChanged: this.ModifiersChanged(); break;
    }
  }
  Start(){} Over(){} Enter(){} Exit(){} LeftDown(){} LeftUp(){} RightDown(){} RightUp(){}
  ModifiersChanged() {}
  SaveSnapshot(){ saveSnapshot(); }
  ClearPreview() {
     previewData.forEach(r => r.forEach(c => { c.char = ''; c.color = "#000000"; }));
  }
}

// =================================
// 1. 筆刷
// =================================
class Brush extends Tool {
  isLeftDown = false;
  lastDrawPos = null;
  smoothDraw = true;
  
  Enter() {
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    
    // 預覽
    if (floatingLayer && floatingPos && cellInFloatingUnion(r, c)) {
        previewData[r][c] = { char: brushChar, color: brushColor };
    } else if (!floatingLayer || !floatingPos) {
        previewData[r][c] = { char: brushChar, color: brushColor };
    }

    if (this.isLeftDown) {
      if (this.smoothDraw && this.lastDrawPos) {
        const path = getLineBetween(this.lastDrawPos.r, this.lastDrawPos.c, r, c);
        for (const { r: pr, c: pc } of path) {
            drawPixel(pr, pc, brushChar, brushColor);
        }
      } else {
        drawPixel(r, c, brushChar, brushColor);
      }
      this.lastDrawPos = { r, c };
    }
    render();
  }
  
  Exit() {
    const r = currentGrid.dataset.row;
    const c = currentGrid.dataset.col;
    previewData[r][c] = { char: '', color: "#000000" };
    render();
  }
  
  LeftDown() {
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    
    // 若有浮動層，限制只能畫在內部
    if (floatingLayer && floatingPos && !cellInFloatingUnion(r, c)) {
         return;
    }

    this.SaveSnapshot();
    this.isLeftDown = true;
    drawPixel(r, c, brushChar, brushColor);
    previewData[r][c] = { char: '', color: "#000000" };
    this.lastDrawPos = { r, c };
    render();
  }
  LeftUp() { this.isLeftDown = false; this.lastDrawPos = null; }
  Over() { this.ClearPreview(); render(); }
  ModifiersChanged() {
    if (currentGrid) this.Enter();
  }
}

// =================================
// 2. 橡皮擦
// =================================
class Eraser extends Tool {
  isLeftDown = false;
  lastDrawPos = null;
  smoothDraw = true;

  Enter() {
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    
    if (floatingLayer && floatingPos && cellInFloatingUnion(r, c)) {
        previewData[r][c] = { char: '擦', color: "#ffffff33" };
    } else if (!floatingLayer || !floatingPos) {
        previewData[r][c] = { char: '擦', color: "#ffffff33" };
    }

    if (this.isLeftDown) {
      if (this.smoothDraw && this.lastDrawPos) {
        const path = getLineBetween(this.lastDrawPos.r, this.lastDrawPos.c, r, c);
        path.forEach(({ r: pr, c: pc }) => {
            drawPixel(pr, pc, '', '#000000');
        });
      } else {
        drawPixel(r, c, '', '#000000');
      }
      this.lastDrawPos = { r, c };
    }
    render();
  }
  Exit() {
    const r = currentGrid.dataset.row;
    const c = currentGrid.dataset.col;
    previewData[r][c] = { char: '', color: "#000000" };
    render();
  }
  LeftDown() {
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    
    if (floatingLayer && floatingPos && !cellInFloatingUnion(r, c)) {
         return;
    }

    this.SaveSnapshot();
    this.isLeftDown = true;
    drawPixel(r, c, '', '#000000');
    this.lastDrawPos = { r, c };
    render();
  }
  LeftUp() { this.isLeftDown = false; this.lastDrawPos = null; }
  Over() { this.ClearPreview(); render(); }
  ModifiersChanged() {
    if (currentGrid) this.Enter();
  }
}

// =================================
// 3. 線段
// =================================
class Line extends Tool {
  startPos = null;
  Enter() {
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    this.ClearPreview();
    
    const isValid = (pr, pc) => {
        if (floatingLayer && floatingPos) {
            return cellInFloatingUnion(pr, pc);
        }
        return true;
    };

    if (this.startPos) {
      const path = getLineBetween(this.startPos.r, this.startPos.c, r, c);
      for (const { r: pr, c: pc } of path) {
        if(isValid(pr, pc))
            previewData[pr][pc] = { char: brushChar, color: brushColor + "CC" };
      }
    } else {
        if(isValid(r, c))
            previewData[r][c] = { char: brushChar, color: brushColor + "CC" };
    }
    render();
  }
  Exit() {
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    previewData[r][c] = { char: '', color: "#000000" };
    render();
  }
  LeftDown() {
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    
    if (floatingLayer && floatingPos && !cellInFloatingUnion(r, c)) {
         return;
    }

    if (!this.startPos) {
      this.startPos = { r, c };
    } else {
      this.SaveSnapshot();
      const path = getLineBetween(this.startPos.r, this.startPos.c, r, c);
      for (const { r: pr, c: pc } of path) {
          drawPixel(pr, pc, brushChar, brushColor);
      }
      this.startPos = { r, c };
    }
    this.ClearPreview();
    render();
  }
  RightDown() { this.startPos = null; this.ClearPreview(); render(); }
  Over() { this.startPos = null; this.ClearPreview(); render(); }
  ModifiersChanged() {
    if (currentGrid) this.Enter();
  }
}

// =================================
// 4. 油漆桶 (修正：加入預覽功能)
// =================================
class Bucket extends Tool {
  Enter() {
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    
    // 預覽填色效果 (不開動畫，開啟預覽模式)
    let targetChar, targetColor;
    if (floatingLayer && floatingPos) {
        if (!cellInFloatingUnion(r, c)) return;
        const lr = r - floatingPos.r;
        const lc = c - floatingPos.c;
        targetChar = floatingLayer[lr][lc].char;
        targetColor = floatingLayer[lr][lc].color;
    } else {
        targetChar = data[r][c].char;
        targetColor = data[r][c].color;
    }

    // 只有當目標顏色不同時才預覽
    if (targetChar !== brushChar || targetColor !== brushColor) {
        fill(r, c, targetChar, targetColor, false, true);
    }
    render();
  }

  Exit() { this.ClearPreview(); render(); }

  LeftDown() {
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    
    let target;
    if(floatingLayer && floatingPos) {
        if (!cellInFloatingUnion(r, c)) return;
        const lr = r - floatingPos.r;
        const lc = c - floatingPos.c;
        target = floatingLayer[lr][lc];
    } else {
        target = data[r][c];
    }

    if(target.char === brushChar && target.color === brushColor) return;
    
    this.SaveSnapshot();
    fill(r, c, target.char, target.color, useBucketFillAnimation, false); // 正式填色（過程動畫由偏好控制）
    this.ClearPreview();
    render();
  }
  Over() { this.ClearPreview(); render(); }
  ModifiersChanged() {
    if (currentGrid) this.Enter();
  }
}

let isFilling = false;
// 修正：加入 previewMode 參數
async function fill(r, c, targetChar, targetColor, isAnimated = true, previewMode = false) {
  if (isFilling && !previewMode) return;
  if (!previewMode) isFilling = true;
  
  // 決定資料來源
  let targetLayer = previewMode ? null : data; // 預覽時不改動 data
  let rows, cols, offsetX = 0, offsetY = 0;

  // 如果有浮動層，計算基礎參數
  if (floatingLayer && floatingPos) {
      if (!previewMode) targetLayer = floatingLayer;
      offsetX = floatingPos.r;
      offsetY = floatingPos.c;
      rows = floatingLayer.length;
      cols = floatingLayer[0].length;
  } else {
      rows = data.length;
      cols = data[0].length;
  }

  // 轉換座標
  const lr = r - offsetX;
  const lc = c - offsetY;
  
  // 搜尋符合條件的格子 (使用真實資料層做判斷)
  const sourceLayer = (floatingLayer && floatingPos) ? floatingLayer : data;
  const targets = [];
  
  for (let x = 0; x < rows; x++) {
    for (let y = 0; y < cols; y++) {
      if (floatingLayer && floatingPos && floatingMask && !floatingMask[x][y]) continue;
      const cell = sourceLayer[x][y];
      if (cell.char === targetChar && cell.color === targetColor) {
        targets.push({ 
            layerR: x, layerC: y, 
            globalR: x + offsetX, globalC: y + offsetY,
            dist: Math.abs(lr - x) + Math.abs(lc - y) 
        });
      }
    }
  }

  if (previewMode) {
      // 預覽模式：寫入 previewData
      for (const t of targets) {
          if (t.globalR >= 0 && t.globalR < previewData.length && t.globalC >= 0 && t.globalC < previewData[0].length) {
              previewData[t.globalR][t.globalC] = { char: brushChar, color: brushColor + "CC" }; // 半透明
          }
      }
  } else {
      // 正式模式
      if (!isAnimated) {
        for (const t of targets) {
            targetLayer[t.layerR][t.layerC] = { char: brushChar, color: brushColor };
        }
        render();
      } else {
        targets.sort((a, b) => a.dist - b.dist);
        let currentDist = -1;
        let batch = [];
        for (const t of targets) {
          if (t.dist !== currentDist) {
            if (batch.length > 0) {
                batch.forEach(item => {
                    targetLayer[item.layerR][item.layerC] = { char: brushChar, color: brushColor };
                });
                render();
                await new Promise(res => setTimeout(res, 20));
            }
            batch = [];
            currentDist = t.dist;
          }
          batch.push(t);
        }
        batch.forEach(item => {
            targetLayer[item.layerR][item.layerC] = { char: brushChar, color: brushColor };
        });
        render();
      }
      isFilling = false;
  }
}

// =================================
// 5. 吸管
// =================================
class Eyedropper extends Tool {
  Enter() {
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    let color = "#333333";
    let target = data[r][c];
    if(floatingLayer && floatingPos && cellInFloatingUnion(r, c)) {
        const lr = r - floatingPos.r;
        const lc = c - floatingPos.c;
        target = floatingLayer[lr][lc];
    }
    if(target.color !== "#000000") color = target.color;
    
    previewData[r][c] = { char: "吸", color: color };
    render();
  }
  Exit() { this.ClearPreview(); render(); }
  LeftDown() {
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    let target = data[r][c];
    if(floatingLayer && floatingPos && cellInFloatingUnion(r, c)) {
        const lr = r - floatingPos.r;
        const lc = c - floatingPos.c;
        target = floatingLayer[lr][lc];
    }

    brushCharInput.value = brushChar = target.char || " ";
    brushColorInput.value = brushColor = target.color;
    this.ClearPreview();
    render();
    const back =
      selectedTool === "brush" ||
      selectedTool === "eraser" ||
      selectedTool === "line" ||
      selectedTool === "bucket" ||
      selectedTool === "shape"
        ? selectedTool
        : "brush";
    SetCurrentTool(back);
    document.querySelectorAll(".tool").forEach((el) => el.classList.remove("active"));
    const activeBtn = document.querySelector(`.tool[data-tool="${back}"]`);
    if (activeBtn) activeBtn.classList.add("active");
  }
  Over() { this.ClearPreview(); render(); }
  ModifiersChanged() {
    if (currentGrid) this.Enter();
  }
}

// =================================
// 6. 選取工具 (優化：切換工具保留選取、預覽顯示)
// =================================
class SelectTool extends Tool {
  selectingStart = null; // 框選第一點
  
  // 浮動層拖曳狀態
  isDragging = false;
  dragStartMouse = null;
  dragStartPos = null;

  /** Shift 加選、Alt 減選、皆無一般選（Shift 優先） */
  getEffectiveSelectionMode() {
    if (isShiftDown) return "add";
    if (isAltDown) return "subtract";
    return "select";
  }

  Enter() { this.UpdatePreview(); }

  ModifiersChanged() {
    if (currentGrid) this.UpdatePreview();
  }

  // 根據狀態更新畫面與選取框
  UpdatePreview() {
    const r = currentGrid ? parseInt(currentGrid.dataset.row) : -1;
    const c = currentGrid ? parseInt(currentGrid.dataset.col) : -1;
    
    // 清除舊的預覽 (白色半透明底)
    this.ClearPreview();

    // 情境 1: 已有浮動內容 (選取已確認)
    if (floatingLayer) {
        // 如果正在拖曳，更新浮動位置
        if (this.isDragging && r !== -1) {
            const dr = r - this.dragStartMouse.r;
            const dc = c - this.dragStartMouse.c;
            floatingPos = {
                r: this.dragStartPos.r + dr,
                c: this.dragStartPos.c + dc
            };
        }
        const fr = floatingPos.r;
        const fc = floatingPos.c;
        const fh = floatingLayer.length;
        const fw = floatingLayer[0].length;

        // 加選／減選：第二段框選預覽；虛線由 ui 以 floatingMask ∪ selectionAddRect 繪製
        const mode = this.getEffectiveSelectionMode();
        if (this.selectingStart && (mode === "add" || mode === "subtract")) {
            const s = this.selectingStart;
            let ar1, ac1, ar2, ac2;
            if (r === -1) {
                ar1 = ar2 = s.r;
                ac1 = ac2 = s.c;
            } else {
                ar1 = Math.min(s.r, r);
                ac1 = Math.min(s.c, c);
                ar2 = Math.max(s.r, r);
                ac2 = Math.max(s.c, c);
            }
            for (let i = ar1; i <= ar2; i++) {
                for (let j = ac1; j <= ac2; j++) {
                    previewData[i][j] = { char: '', color: '#ffffff33' };
                }
            }
            selectionAddRect = { r: ar1, c: ac1, h: ar2 - ar1 + 1, w: ac2 - ac1 + 1 };
            selection = null;
        } else {
            selectionAddRect = null;
            selection = { r: fr, c: fc, h: fh, w: fw };
        }

        // 加/減選：聯集內外皆顯示「加」「減」；一般模式僅聯集外顯示「選」
        if (r !== -1) {
            if (mode === "add" || mode === "subtract") {
                previewData[r][c] = {
                    char: mode === "add" ? "加" : "減",
                    color: "#333333"
                };
            } else if (!cellInFloatingUnion(r, c)) {
                previewData[r][c] = { char: "選", color: "#333333" };
            }
        }
        render();
        return;
    }

    // 若滑鼠離開畫布且無浮動層，清除選取框
    if (r === -1) {
        if (!this.selectingStart) selection = null;
        render();
        return;
    }

    // 情境 2: 正在定義選取框 (已點第一點，游標移動中)
    if (this.selectingStart) {
       const r1 = Math.min(this.selectingStart.r, r);
       const c1 = Math.min(this.selectingStart.c, c);
       const r2 = Math.max(this.selectingStart.r, r);
       const c2 = Math.max(this.selectingStart.c, c);
       
       // 顯示白色半透明底色
       for(let i=r1; i<=r2; i++){
           for(let j=c1; j<=c2; j++){
               previewData[i][j] = { char: '', color: '#ffffff33' };
           }
       }
       // ★ 顯示虛線外框 (兩點間的矩形)
       selection = { r: r1, c: c1, h: r2 - r1 + 1, w: c2 - c1 + 1 };
    }
    // 情境 3: 閒置狀態 (尚未點擊第一點；此分支無浮動層)
    else {
        const m = this.getEffectiveSelectionMode();
        const ch =
            m === "add" ? "加" :
            m === "subtract" ? "減" : "選";
        previewData[r][c] = { char: ch, color: "#333333" };
    }
    
    render();
  }

  Exit() {
    const r = currentGrid.dataset.row;
    const c = currentGrid.dataset.col;
    previewData[r][c] = { char: '', color: "#000000" };
    render();
  }

  LeftDown() {
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    const mode = this.getEffectiveSelectionMode();

    // 情境 A: 已有浮動內容
    if (floatingLayer) {
        // 加選且已有第二段錨點：合併（第二點在聯集內也確認）
        if (mode === "add" && this.selectingStart) {
            const r1 = Math.min(this.selectingStart.r, r);
            const c1 = Math.min(this.selectingStart.c, c);
            const r2 = Math.max(this.selectingStart.r, r);
            const c2 = Math.max(this.selectingStart.c, c);
            this.MergeAddSelection(r1, c1, r2, c2);
            this.selectingStart = null;
            render();
        }
        // 減選且已有第二段錨點：從聯集扣掉與新矩形之交集
        else if (mode === "subtract" && this.selectingStart) {
            const r1 = Math.min(this.selectingStart.r, r);
            const c1 = Math.min(this.selectingStart.c, c);
            const r2 = Math.max(this.selectingStart.r, r);
            const c2 = Math.max(this.selectingStart.c, c);
            this.MergeSubtractSelection(r1, c1, r2, c2);
            this.selectingStart = null;
            render();
        }
        // 加/減選：聯集內外都錨第二段矩形，不進入拖曳
        else if (mode === "add" || mode === "subtract") {
            this.selectingStart = { r, c };
            this.UpdatePreview();
        }
        // 一般模式且點在聯集內 -> 拖曳浮動層
        else if (cellInFloatingUnion(r, c)) {
            this.selectingStart = null;
            this.isDragging = true;
            this.dragStartMouse = { r, c };
            this.dragStartPos = { ...floatingPos };
        } else {
            this.StampAndClear();
            this.selectingStart = { r, c };
            this.UpdatePreview();
        }
    }
    // 情境 B: 正在框選 (第二點確認)
    else if (this.selectingStart) {
        const r1 = Math.min(this.selectingStart.r, r);
        const c1 = Math.min(this.selectingStart.c, c);
        const r2 = Math.max(this.selectingStart.r, r);
        const c2 = Math.max(this.selectingStart.c, c);

        // 剪下內容到浮動層
        this.CutToFloating(r1, c1, r2, c2);
        
        this.selectingStart = null;
        render();
    }
    // 情境 C: 開始新選取 (第一點定錨)
    else {
        this.selectingStart = { r, c };
        this.UpdatePreview();
    }
  }
  
  LeftUp() {
      if (this.isDragging) {
          this.isDragging = false;
          return;
      }
      if (!this.selectingStart || !currentGrid) return;

      const r = parseInt(currentGrid.dataset.row);
      const c = parseInt(currentGrid.dataset.col);
      if (r === this.selectingStart.r && c === this.selectingStart.c) return;

      const r1 = Math.min(this.selectingStart.r, r);
      const c1 = Math.min(this.selectingStart.c, c);
      const r2 = Math.max(this.selectingStart.r, r);
      const c2 = Math.max(this.selectingStart.c, c);

      if (floatingLayer) {
          const modeUp = this.getEffectiveSelectionMode();
          if (modeUp === "add") {
              this.MergeAddSelection(r1, c1, r2, c2);
          } else if (modeUp === "subtract") {
              this.MergeSubtractSelection(r1, c1, r2, c2);
          } else {
              return;
          }
          this.selectingStart = null;
          render();
          return;
      }

      this.CutToFloating(r1, c1, r2, c2);
      this.selectingStart = null;
      render();
  }

  /** 加選：外接矩形存浮動層，floatingMask 為兩矩形之聯集；重疊處保留浮動層像素 */
  MergeAddSelection(br1, bc1, br2, bc2) {
      this.SaveSnapshot();
      const fr = floatingPos.r;
      const fc = floatingPos.c;
      const fh = floatingLayer.length;
      const fw = floatingLayer[0].length;

      const rU1 = Math.min(fr, br1);
      const cU1 = Math.min(fc, bc1);
      const rU2 = Math.max(fr + fh - 1, br2);
      const cU2 = Math.max(fc + fw - 1, bc2);
      const nH = rU2 - rU1 + 1;
      const nW = cU2 - cU1 + 1;

      const oldActive = (gr, gc) => {
          if (gr < fr || gr >= fr + fh || gc < fc || gc >= fc + fw) return false;
          const lr = gr - fr;
          const lc = gc - fc;
          if (floatingMask) return !!floatingMask[lr][lc];
          return true;
      };
      const inB = (gr, gc) =>
          gr >= br1 && gr <= br2 && gc >= bc1 && gc <= bc2;

      const next = [];
      const nextMask = [];
      for (let i = 0; i < nH; i++) {
          const row = [];
          const maskRow = [];
          for (let j = 0; j < nW; j++) {
              const gr = rU1 + i;
              const gc = cU1 + j;
              const active = oldActive(gr, gc) || inB(gr, gc);
              maskRow.push(active);
              let cell;
              if (oldActive(gr, gc)) {
                  cell = { ...floatingLayer[gr - fr][gc - fc] };
              } else if (inB(gr, gc)) {
                  cell = { ...data[gr][gc] };
                  data[gr][gc] = { char: '', color: '#000000' };
              } else {
                  cell = { char: '', color: '#000000' };
              }
              row.push(cell);
          }
          next.push(row);
          nextMask.push(maskRow);
      }

      floatingLayer = next;
      floatingMask = nextMask;
      floatingPos = { r: rU1, c: cU1 };
      selectionAddRect = null;
      selection = { r: rU1, c: cU1, h: nH, w: nW };
  }

  /**
   * 減選：將原浮動聯集與軸對齊矩形 [br1,br2]×[bc1,bc2] 的交集從選取移除，
   * 交集內容貼回 data，並收縮外接矩形（若無剩餘選取則清除浮動層）。
   */
  MergeSubtractSelection(br1, bc1, br2, bc2) {
      this.SaveSnapshot();
      const fr = floatingPos.r;
      const fc = floatingPos.c;
      const fh = floatingLayer.length;
      const fw = floatingLayer[0].length;

      const inSubtractRect = (gr, gc) =>
          gr >= br1 && gr <= br2 && gc >= bc1 && gc <= bc2;

      for (let lr = 0; lr < fh; lr++) {
          for (let lc = 0; lc < fw; lc++) {
              const inUnion = !floatingMask || floatingMask[lr][lc];
              if (!inUnion) continue;
              const gr = fr + lr;
              const gc = fc + lc;
              if (!inSubtractRect(gr, gc)) continue;
              const rows = data.length;
              const cols = data[0].length;
              if (gr >= 0 && gr < rows && gc >= 0 && gc < cols) {
                  data[gr][gc] = { ...floatingLayer[lr][lc] };
              }
              floatingMask[lr][lc] = false;
              floatingLayer[lr][lc] = { char: '', color: '#000000' };
          }
      }

      this.ShrinkFloatingToMaskOrClear();
      selectionAddRect = null;
      if (floatingLayer) {
          selection = {
              r: floatingPos.r,
              c: floatingPos.c,
              h: floatingLayer.length,
              w: floatingLayer[0].length
          };
      }
  }

  /** 依仍為 true 的遮罩收縮浮動層；若全空則清除浮動 */
  ShrinkFloatingToMaskOrClear() {
      if (!floatingLayer || !floatingMask) {
          floatingLayer = null;
          floatingPos = null;
          floatingMask = null;
          selection = null;
          return;
      }
      const fh = floatingLayer.length;
      const fw = floatingLayer[0].length;
      let minR = fh;
      let maxR = -1;
      let minC = fw;
      let maxC = -1;
      for (let i = 0; i < fh; i++) {
          for (let j = 0; j < fw; j++) {
              if (floatingMask[i][j]) {
                  minR = Math.min(minR, i);
                  maxR = Math.max(maxR, i);
                  minC = Math.min(minC, j);
                  maxC = Math.max(maxC, j);
              }
          }
      }
      if (maxR < 0) {
          floatingLayer = null;
          floatingPos = null;
          floatingMask = null;
          selection = null;
          return;
      }
      const fr = floatingPos.r;
      const fc = floatingPos.c;
      const nH = maxR - minR + 1;
      const nW = maxC - minC + 1;
      const next = [];
      const nextMask = [];
      for (let i = 0; i < nH; i++) {
          const row = [];
          const mRow = [];
          for (let j = 0; j < nW; j++) {
              row.push({ ...floatingLayer[minR + i][minC + j] });
              mRow.push(!!floatingMask[minR + i][minC + j]);
          }
          next.push(row);
          nextMask.push(mRow);
      }
      floatingLayer = next;
      floatingMask = nextMask;
      floatingPos = { r: fr + minR, c: fc + minC };
  }

  // 剪下
  CutToFloating(r1, c1, r2, c2) {
      this.SaveSnapshot();
      const h = r2 - r1 + 1;
      const w = c2 - c1 + 1;
      floatingLayer = [];
      floatingPos = { r: r1, c: c1 };
      
      floatingMask = [];
      for(let i=0; i<h; i++){
          const row = [];
          const maskRow = [];
          for(let j=0; j<w; j++){
              row.push({ ...data[r1+i][c1+j] }); 
              data[r1+i][c1+j] = { char: '', color: '#000000' }; 
              maskRow.push(true);
          }
          floatingLayer.push(row);
          floatingMask.push(maskRow);
      }
      selectionAddRect = null;
      selection = { r: r1, c: c1, h, w };
  }

  // 貼上並清除
  StampAndClear() {
      if(!floatingLayer) return;
      this.SaveSnapshot();
      
      const rows = data.length;
      const cols = data[0].length;
      
      for(let i=0; i<floatingLayer.length; i++){
          for(let j=0; j<floatingLayer[0].length; j++){
              if (floatingMask && !floatingMask[i][j]) continue;
              const tr = floatingPos.r + i;
              const tc = floatingPos.c + j;
              if(tr >= 0 && tr < rows && tc >= 0 && tc < cols) {
                  data[tr][tc] = floatingLayer[i][j];
              }
          }
      }
      
      floatingLayer = null;
      floatingPos = null;
      floatingMask = null;
      selectionAddRect = null;
      selection = null;
      this.selectingStart = null;
      render();
  }

  RightDown() {
      if (floatingLayer) this.StampAndClear();
      else {
          this.selectingStart = null;
          selectionAddRect = null;
          selection = null;
      }
      this.UpdatePreview();
  }
  
  // ★ 關鍵：離開工具時的處理
  Over() {
      // 重置內部狀態
      this.selectingStart = null;
      this.isDragging = false;
      this.ClearPreview();
      selectionAddRect = null;

      // ★ 如果有浮動內容，保留 `selection` (讓筆刷等工具能看到框並受限)
      if (floatingLayer) {
          selection = {
            r: floatingPos.r, c: floatingPos.c,
            h: floatingLayer.length, w: floatingLayer[0].length
          };
      } 
      // ★ 如果只是滑鼠懸停預覽 (無浮動層)，清除 `selection` (避免筆刷被單格框擋住)
      else {
          selection = null;
      }
      
      render(); // 強制更新畫面確保邊框狀態正確
  }
}

// ... (ShapeTool, ClearTool, toolMap, SetCurrentTool 保持不變) ...
class ShapeTool extends Tool {
  startPos = null;
  Enter() {
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    this.ClearPreview();
    
    const isValid = (pr, pc) => {
        if (floatingLayer && floatingPos) {
            return cellInFloatingUnion(pr, pc);
        }
        return true;
    };

    if(this.startPos) {
        const points = getEllipsePoints(this.startPos.r, this.startPos.c, r, c);
        for(const p of points) {
             if(isValid(p.r, p.c))
                previewData[p.r][p.c] = { char: brushChar, color: brushColor + "CC" };
        }
    }
    else
    {
      if (floatingLayer && floatingPos && cellInFloatingUnion(r, c)) {
          previewData[r][c] = { char: brushChar, color: brushColor };
      } else if (!floatingLayer || !floatingPos) {
          previewData[r][c] = { char: brushChar, color: brushColor };
      }
    }
    render();
  }

  Exit() {
    const r = currentGrid.dataset.row;
    const c = currentGrid.dataset.col;
    previewData[r][c] = { char: '', color: "#000000" };
    render();
  }
  
  LeftDown() {
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    
    if (floatingLayer && floatingPos && !cellInFloatingUnion(r, c)) {
         return;
    }

    if(!this.startPos) {
        this.startPos = { r, c };
    } else {
        this.SaveSnapshot();
        const points = getEllipsePoints(this.startPos.r, this.startPos.c, r, c);
        for(const p of points) {
             drawPixel(p.r, p.c, brushChar, brushColor);
        }
        this.startPos = null;
    }
    this.ClearPreview();
    render();
  }
  RightDown() { 
    this.startPos = null; 
    this.ClearPreview(); 
    const r = parseInt(currentGrid.dataset.row);
    const c = parseInt(currentGrid.dataset.col);
    if (floatingLayer && floatingPos && cellInFloatingUnion(r, c)) {
      previewData[r][c] = { char: brushChar, color: brushColor };
    } else if (!floatingLayer || !floatingPos) {
        previewData[r][c] = { char: brushChar, color: brushColor };
    }
    render(); 
  }
  Over() { this.startPos = null; this.ClearPreview(); render(); }
  ModifiersChanged() {
    if (currentGrid) this.Enter();
  }
}

// =================================
// 7. 打字（左鍵錨定游標、右鍵取消；IME、依選區換格）
// =================================
class TypeTool extends Tool {
  _imeBound = false;
  _composing = false;
  /** 組字預覽目前佔用的格，清除時需整批還原 */
  _compositionPreviewCells = [];
  /** 組字預覽：主 caret 的預覽尾格，供 IME 錨點（與 _perCaretPreviewLast[0] 同步寫入） */
  _primaryPreviewLast = null;
  /** 組字預覽：每個 caret 的預覽尾格（與 _allCarets() 順序對齊），供多 caret 視覺位置與閃爍 */
  _perCaretPreviewLast = null;
  /** 組字預覽：每個 caret 的完整預覽路徑（與 _allCarets() 同序），用於 IME 選字時定位 | */
  _perCaretPreviewPaths = null;
  /** IME 組字游標於組字字串中的索引（0..text.length），組字期間由 selectionchange 持續更新 */
  _imeSelStart = null;
  /** 打字選取：是否正在左鍵拖曳中（僅用於顯示 typeDragSelection） */
  _isTypeSelecting = false;

  _isActive() {
    return selectedTool === "type" && currentTool && currentTool.name === "type";
  }

  /** 全部 carets：主 caret 在前，後接 typeExtraCursors（無主 caret 時回傳空陣列） */
  _allCarets() {
    if (!typeCursor) return [];
    return [typeCursor, ...typeExtraCursors];
  }

  /**
   * 把整理後的 caret 列表寫回主 caret + extras。
   * - newList[0] 為主 caret；其餘為 extras。
   * - newList 為空時：typeCursor=null、extras=[]，呼叫端再決定是否 blur IME。
   */
  _setCaretsKeepingPrimary(newList) {
    if (!newList || newList.length === 0) {
      typeCursor = null; // 主 caret 失效
      typeExtraCursors = []; // 額外 carets 全清
      return;
    }
    typeCursor = { r: newList[0].r, c: newList[0].c }; // 主 caret
    typeExtraCursors = newList.slice(1).map(p => ({ r: p.r, c: p.c })); // 其餘 carets
  }

  /** 依 rcKey 去重，保留 list 中先出現者（傳入時讓主 caret 在前→碰撞時主身份保留） */
  _dedupeKeepFirst(list) {
    const seen = new Set(); // 已出現過的 rcKey
    const out = []; // 去重後結果
    for (const p of list) {
      if (!p) continue;
      const k = rcKey(p.r, p.c);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ r: p.r, c: p.c });
    }
    return out;
  }

  /**
   * 依打字順序（左上→右下、逐列）排序：用 buildTypeOrderIndex 取得索引。
   * 不在打字索引內者（少數邊界情況）排到尾端，順序由 list 原本順序決定。
   */
  _sortCaretsByTypingOrder(list) {
    const { indexByKey } = buildTypeOrderIndex(); // 目前可打字格的索引
    return list
      .map((p, i) => ({
        p, // caret
        idx: indexByKey.has(rcKey(p.r, p.c)) ? indexByKey.get(rcKey(p.r, p.c)) : Number.POSITIVE_INFINITY, // 打字順序索引
        ord: i, // 原順序，作為 stable 比較的次鍵
      }))
      .sort((a, b) => (a.idx - b.idx) || (a.ord - b.ord))
      .map(x => x.p);
  }

  Start() {
    if (!this._imeBound && typeImeHook) {
      this._bindIme(typeImeHook);
      this._imeBound = true;
    }
  }

  _bindIme(ta) {
    ta.addEventListener("compositionstart", () => {
      if (!this._isActive()) return;
      this._composing = true;
      this._imeSelStart = 0; // 組字一開始游標在最前
      this.syncImeToCaretCell();
    });
    ta.addEventListener("compositionupdate", (e) => {
      if (!this._isActive() || !typeCursor) return;
      this._clearCompositionPreviewCell();
      const text = e.data || "";
      this._applyCompositionPreedit(text);
      // 取得 IME 在組字字串內的目前游標位置；無法取得時退回字串尾
      const sel = ta.selectionStart;
      this._imeSelStart = (sel == null) ? text.length : sel;
      render();
      this.syncImeToCaretCell();
    });
    ta.addEventListener("compositionend", (e) => {
      if (!this._isActive()) return;
      this._composing = false;
      this._clearCompositionPreviewCell();
      ta.value = "";
      const text = e.data || "";
      if (typeCursor && text) {
        for (const ch of text) {
          if (!this._commitChar(ch)) break;
        }
      }
      render();
    });
    // 監聽 IME 選字游標移動：方向鍵在組字字串內移動時 selectionStart 會變
    document.addEventListener("selectionchange", () => {
      if (!this._isActive() || !this._composing) return;
      if (document.activeElement !== ta) return;
      const sel = ta.selectionStart; // IME 在組字字串內的目前游標
      if (sel == null) return;
      if (this._imeSelStart === sel) return; // 無變化則不必重繪
      this._imeSelStart = sel;
      render();
    });
    ta.addEventListener("input", (e) => {
      if (!this._isActive() || !typeCursor) return;
      if (this._composing || e.isComposing) return;
      if (
        e.inputType === "insertCompositionText" ||
        e.inputType === "insertFromComposition"
      ) {
        return;
      }
      if (e.inputType === "deleteContentBackward") return;
      const d = e.data;
      ta.value = "";
      if (d) {
        // 有打字選取時：先刪除，再寫入
        this._deleteTypeSelectionIfAny();
        for (const ch of d) {
          if (!this._commitChar(ch)) break;
        }
      }
      render();
    });
    ta.addEventListener("keydown", (e) => {
      if (!this._isActive()) return;
      if (e.key === "Enter") {
        if (this._composing || e.isComposing) return;
        e.preventDefault();
        // 有打字選取時：先刪除，再換行到「刪完最前面那格」的下一行行首
        if (typeSelection && typeSelection.start) {
          const start = { r: typeSelection.start.r, c: typeSelection.start.c }; // 刪除定位起點
          this._deleteTypeSelectionIfAny();
          const target = firstTypeCellInRow(start.r + 1);
          if (target) {
            typeCursor = { r: target.r, c: target.c };
            if (typeImeHook) {
              typeImeHook.value = "";
              this.syncImeToCaretCell();
            }
            render();
          }
        } else {
          this._tryNewlineTypeCursor();
        }
        return;
      }
      if (e.key === "Backspace") {
        if (this._composing || e.isComposing) return;
        e.preventDefault();
        // 有打字選取時：直接刪除整段；否則刪除前一格
        if (!this._deleteTypeSelectionIfAny()) {
          this._deletePrevCommittedChar();
        }
      }
      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        if (this._composing || e.isComposing) return;
        if (this._tryMoveTypeCursorByArrow(e)) e.preventDefault();
      }
    });
  }

  /**
   * Backspace：對所有 caret 各自刪除前一格內容並退回。
   * - 兩個 caret 的 prev 落在同格 → drawPixel 寫空（同樣空值無差異），退回後 dedup 合併。
   * - 任一 caret 無 prev 則該 caret 保留原位（不退）。
   * - 全部都無 prev 則整體不動、不存 snapshot。
   * 組字中不呼叫，交由 IME。
   */
  _deletePrevCommittedChar() {
    if (!typeCursor) return;
    const all = this._allCarets(); // 全部 carets

    // 預先計算每個 caret 的 prev；無 prev 則保留原位
    const targets = all.map(p => {
      const prev = prevTypeCell(p.r, p.c); // 前一格
      return { has: !!prev, pos: prev || { r: p.r, c: p.c } };
    });
    const hasAny = targets.some(t => t.has); // 是否有任何 caret 真的能退
    if (!hasAny) return;

    this.SaveSnapshot();

    // 依打字順序逆序刪（與 _commitChar 對稱；雖然清空格子順序對結果無差，但保持一致性）
    const sortedAsc = this._sortCaretsByTypingOrder(
      targets.filter(t => t.has).map(t => t.pos)
    );
    for (let i = sortedAsc.length - 1; i >= 0; i--) {
      const p = sortedAsc[i];
      drawPixel(p.r, p.c, "", "#000000");
    }

    // 退回：每 caret 都退到 prev（無 prev 者保留原位）
    const newList = targets.map(t => ({ r: t.pos.r, c: t.pos.c }));
    const dedup = this._dedupeKeepFirst(newList); // 主 caret 在前→碰撞主身份保留
    this._setCaretsKeepingPrimary(dedup);

    if (typeImeHook) {
      typeImeHook.value = "";
      this.syncImeToCaretCell();
    }
    render();
  }

  /** 打字選取：清除拖曳中與確認後選取（不改動畫布內容）；同時清空多 caret 的 extras */
  _clearTypeSelectionVisual() {
    typeDragSelection = null; // 拖曳中選取（視覺）
    typeSelection = null; // 確認後選取
    typeSelectAnchor = null; // 拖曳起點
    typeSelectHead = null; // 拖曳目前點
    this._isTypeSelecting = false; // 是否拖曳中
    typeExtraCursors = []; // 額外 carets 一併清
  }

  /**
   * 打字選取：刪除確認後選取的所有格。
   * - 只在「已存在 typeSelection」時做事。\n+   * - 刪除後游標設為 start，並清除選取。\n+   * @returns {boolean} 是否有刪除（有選取且已處理）
   */
  _deleteTypeSelectionIfAny() {
    if (!typeSelection || !typeSelection.cells || typeSelection.cells.length === 0) return false;
    this.SaveSnapshot();
    for (const { r, c } of typeSelection.cells) {
      drawPixel(r, c, "", "#000000");
    }
    typeCursor = { r: typeSelection.start.r, c: typeSelection.start.c };
    typeExtraCursors = []; // typeSelection 與多 caret 互斥
    typeSelection = null;
    typeDragSelection = null;
    typeSelectAnchor = null;
    typeSelectHead = null;
    this._isTypeSelecting = false;
    if (typeImeHook) {
      typeImeHook.value = "";
      this.syncImeToCaretCell();
    }
    render();
    return true;
  }

  /**
   * 方向鍵：左右在同行掃描、上下在同欄掃描，找上一／下一個 isInSelection 可編輯格。
   * - 多 caret 模式（typeExtraCursors 非空）：每 caret 各自移動，移動後 dedup；不啟動 typeSelection 邏輯。
   * @returns {boolean} 是否應 preventDefault（成功移動、或目標在畫布內但不可編輯、或越出畫布邊界）
   */
  _tryMoveTypeCursorByArrow(e) {
    if (!typeCursor) return false;
    const isArrow =
      e.key === "ArrowLeft" || e.key === "ArrowRight" ||
      e.key === "ArrowUp" || e.key === "ArrowDown";
    if (!isArrow) return false;

    // 多 caret 模式：每 caret 各自獨立移動
    if (typeExtraCursors.length > 0) {
      const all = this._allCarets(); // 主 caret 在前
      const moved = all.map(p => {
        let target = null; // 移動目標
        if (e.key === "ArrowLeft") target = prevTypeCellInRowOrPrevRow(p.r, p.c);
        else if (e.key === "ArrowRight") target = nextTypeCellInRowOrNextRow(p.r, p.c);
        else if (e.key === "ArrowUp") target = prevTypeCellInCol(p.r, p.c);
        else if (e.key === "ArrowDown") target = nextTypeCellInCol(p.r, p.c);
        return target ? { r: target.r, c: target.c } : { r: p.r, c: p.c }; // 不可移動者保留原位
      });
      const dedup = this._dedupeKeepFirst(moved);
      this._clearCompositionPreviewCell();
      this._setCaretsKeepingPrimary(dedup);
      if (typeImeHook) {
        typeImeHook.value = "";
        this.syncImeToCaretCell();
      }
      render();
      return true;
    }

    // 有打字選取時：先取消選取並依規格定位（上/左到前一格；下/右到最後一格）
    if (typeSelection && typeSelection.start && typeSelection.end) {
      const start = typeSelection.start; // 選取最前格
      const end = typeSelection.end; // 選取最後格
      const goPrev = e.key === "ArrowUp" || e.key === "ArrowLeft";
      const goEnd = e.key === "ArrowDown" || e.key === "ArrowRight";
      if (goPrev) {
        if (e.key === "ArrowLeft") {
          const prev = prevTypeCellInRowOrPrevRow(start.r, start.c);
          typeCursor = prev ? { r: prev.r, c: prev.c } : { r: start.r, c: start.c };
        } else {
          const prev = prevTypeCellInCol(start.r, start.c);
          typeCursor = prev ? { r: prev.r, c: prev.c } : { r: start.r, c: start.c };
        }
      } else if (goEnd) {
        if (e.key === "ArrowRight") {
          const next = nextTypeCellInRowOrNextRow(end.r, end.c);
          typeCursor = next ? { r: next.r, c: next.c } : { r: end.r, c: end.c };
        } else {
          const next = nextTypeCellInCol(end.r, end.c);
          typeCursor = next ? { r: next.r, c: next.c } : { r: end.r, c: end.c };
        }
      } else {
        return false;
      }
      typeSelection = null;
      typeDragSelection = null;
      typeSelectAnchor = null;
      typeSelectHead = null;
      this._clearCompositionPreviewCell();
      if (typeImeHook) {
        typeImeHook.value = "";
        this.syncImeToCaretCell();
      }
      render();
      return true;
    }
    // 左右：同行找上一／下一個可編輯格，同行無則換列；上下：同欄掃描
    let target = null; // 目標格
    if (e.key === "ArrowLeft") target = prevTypeCellInRowOrPrevRow(typeCursor.r, typeCursor.c);
    else if (e.key === "ArrowRight") target = nextTypeCellInRowOrNextRow(typeCursor.r, typeCursor.c);
    else if (e.key === "ArrowUp") target = prevTypeCellInCol(typeCursor.r, typeCursor.c);
    else if (e.key === "ArrowDown") target = nextTypeCellInCol(typeCursor.r, typeCursor.c);
    else return false;
    if (!target) return true;
    this._clearCompositionPreviewCell();
    typeCursor = { r: target.r, c: target.c };
    if (typeImeHook) {
      typeImeHook.value = "";
      this.syncImeToCaretCell();
    }
    render();
    return true;
  }

  /**
   * Enter：每個 caret 各自跳到下一列由左起第一個可編輯格；無下一列或該列無可編輯格則該 caret 保留原位。
   * 推進後 dedup（多個 caret 同時跳到同一列首時合併）。
   */
  _tryNewlineTypeCursor() {
    if (!typeCursor) return;
    const all = this._allCarets(); // 主 caret 在前
    const moved = all.map(p => {
      const target = firstTypeCellInRow(p.r + 1); // 下一列行首可打字格
      return target ? { r: target.r, c: target.c } : { r: p.r, c: p.c }; // 跳不到者保留原位
    });
    // 全部 caret 都跳不動 → 不需 render
    const anyChanged = moved.some((m, i) => m.r !== all[i].r || m.c !== all[i].c);
    if (!anyChanged) return;

    const dedup = this._dedupeKeepFirst(moved);
    this._clearCompositionPreviewCell();
    this._setCaretsKeepingPrimary(dedup);
    if (typeImeHook) {
      typeImeHook.value = "";
      this.syncImeToCaretCell();
    }
    render();
  }

  _clearCompositionPreviewCell() {
    for (const { r, c } of this._compositionPreviewCells) {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        previewData[r][c] = { char: "", color: "#000000" };
      }
    }
    this._compositionPreviewCells = [];
    this._primaryPreviewLast = null; // 主 caret 預覽尾也要清
    this._perCaretPreviewLast = null; // 各 caret 預覽尾也要清
    this._perCaretPreviewPaths = null; // 完整預覽路徑也要清
    this._imeSelStart = null; // IME 選字索引也要清
  }

  /**
   * 組字預覽：自每個 caret 起沿 nextTypeCell 鋪預覽字，順序與 compositionend 後 _commitChar 相同。
   * - 多 caret 重疊規則：依「打字順序前者勝出」 → 依 caret 打字順序逆序鋪；後者先寫、前者後寫。
   * - 所有 preview 格集中放進 _compositionPreviewCells，由 _clearCompositionPreviewCell 整批清。
   * - ASCII（拼音階段）：每個 caret 各自只佔一格、整串文字塞在主 caret 那格那種既有顯示。
   */
  _applyCompositionPreedit(text) {
    if (!text || !typeCursor) return;
    const all = this._allCarets(); // 主 caret 在前
    if (all.length === 0) return;

    const asciiOnly = /^[\t\n\x20-\x7e]*$/.test(text); // 拼音階段顯示

    // 計算每個 caret 要鋪的 preview 路徑（可能因到底而中斷）
    // pathsByOriginIndex[i] = [ {r,c,ch}, ... ]
    const paths = all.map(start => {
      const out = [];
      if (asciiOnly) {
        if (isInSelection(start.r, start.c)) {
          out.push({ r: start.r, c: start.c, ch: text }); // 整串塞單格
        }
        return out;
      }
      let pos = { r: start.r, c: start.c };
      for (const ch of text) {
        const cp = ch.codePointAt(0);
        if (cp < 32 && ch !== "\t") continue;
        if (!isInSelection(pos.r, pos.c)) break;
        out.push({ r: pos.r, c: pos.c, ch });
        const next = nextTypeCell(pos.r, pos.c);
        if (!next) break;
        pos = next;
      }
      return out;
    });

    // 依打字順序逆序套用：較後者先寫、較前者後寫，重疊格會留下前者的預覽字
    const sortedAsc = this._sortCaretsByTypingOrder(all); // 排序後仍是 all 元素的引用
    const indexInAll = new Map();
    all.forEach((p, i) => indexInAll.set(p, i));
    for (let i = sortedAsc.length - 1; i >= 0; i--) {
      const originIdx = indexInAll.get(sortedAsc[i]); // 對應 paths 的索引
      const path = paths[originIdx];
      for (const { r, c, ch } of path) {
        previewData[r][c] = { char: ch, color: brushColor + "CC" };
      }
    }

    // 收集所有 preview 格，去重後放入 _compositionPreviewCells（清除時整批還原）
    const seen = new Set();
    for (const path of paths) {
      for (const { r, c } of path) {
        const k = rcKey(r, c);
        if (seen.has(k)) continue;
        seen.add(k);
        this._compositionPreviewCells.push({ r, c });
      }
    }
    // 完整預覽路徑：供 getVisualCaretCellsAll 在 IME 選字時定位 |
    this._perCaretPreviewPaths = paths.map(path => path.map(p => ({ r: p.r, c: p.c })));
    // 每個 caret 的預覽尾（與 paths 索引一致），供 getVisualCaretCellsAll／IME
    this._perCaretPreviewLast = paths.map(path => {
      if (!path || path.length === 0) return null; // 無預覽格時視覺 caret 用錨點
      const last = path[path.length - 1]; // 該 caret 預覽最後一個已佔格
      return { r: last.r, c: last.c };
    });
    this._primaryPreviewLast = this._perCaretPreviewLast[0] || null; // 主 caret 預覽尾（IME）
  }

  /**
   * 寫入一字並前進游標（多 caret 同步）。
   * - 多 caret 重疊規則：依打字順序「前者覆蓋後者」。實作：依打字順序逆序寫入，前者最後寫，留下其字。
   * - 推進後依「主 caret 在前」順序去重，碰撞時主身份保留。
   * - 全部 caret 都失效則 blur IME。
   * @returns {boolean} 是否仍有任何 caret 可繼續
   */
  _commitChar(ch) {
    if (!ch) return typeCursor !== null;
    if (!typeCursor) return false;
    // 若有打字選取：先刪除，再從最前格開始輸入（單 caret 模式）
    this._deleteTypeSelectionIfAny();
    const cp = ch.codePointAt(0);
    if (cp < 32 && ch !== "\t") return true;

    const all = this._allCarets(); // 主 caret 在前
    if (all.length === 0) return false;

    // 過濾掉不在可打字區的 caret（理論上 LeftDown 已守住，仍保險過濾）
    const writable = all.filter(p => isInSelection(p.r, p.c));
    if (writable.length === 0) return false;

    this.SaveSnapshot();

    // 依打字順序排序，再逆序寫入：後者先寫、前者後寫，重疊格留下前者的字
    const sortedAsc = this._sortCaretsByTypingOrder(writable);
    for (let i = sortedAsc.length - 1; i >= 0; i--) {
      const p = sortedAsc[i];
      drawPixel(p.r, p.c, ch, brushColor);
    }

    // 推進：以「識別順序」(all 的順序：主 caret 在前) 各自取 nextTypeCell
    const advanced = []; // 可繼續的 caret
    for (const p of all) {
      if (!isInSelection(p.r, p.c)) continue; // 失效 caret
      const next = nextTypeCell(p.r, p.c); // 下一格
      if (next) advanced.push(next);
      // 無下一格者：該 caret 失效，移除
    }

    const dedup = this._dedupeKeepFirst(advanced); // 主 caret 在前→碰撞主身份保留
    this._setCaretsKeepingPrimary(dedup);

    if (typeImeHook) {
      typeImeHook.value = "";
      if (typeCursor) this.positionTypeInput(typeCursor.r, typeCursor.c);
      else typeImeHook.blur();
    }
    return typeCursor !== null;
  }

  positionTypeInput(r, c) {
    const ta = typeImeHook;
    if (!ta || !canvas) return;
    const idx = r * cols + c;
    const cell = canvas.children[idx];
    if (!cell) return;
    const rect = cell.getBoundingClientRect();
    ta.style.left = `${rect.left}px`;
    ta.style.top = `${rect.top}px`;
    ta.style.width = `${rect.width}px`;
    ta.style.height = `${rect.height}px`;
  }

  /**
   * 單一 caret 的視覺插入格（與 getVisualCaretCellsAll()[0] 相同）：主 caret + IME 錨點用。
   */
  getVisualCaretCell() {
    const all = this.getVisualCaretCellsAll(); // 全部 caret 的視覺格
    if (!all.length) return null;
    return all[0]; // 主 caret
  }

  /**
   * 全部 caret 的視覺插入格。
   * - 非組字：每個 caret = 錨點格。
   * - 組字中：依 _imeSelStart 對該 caret 的預覽路徑取格；
   *   sel < path.length → 落在 path[sel]（IME 選字時 | 跟著走）；
   *   sel >= path.length → 落在預覽尾下一格（與舊行為一致）。
   *   ASCII（拼音階段）path 長 1：sel===0 留在該格、sel>0 走「尾端 → next」流程。
   * @returns {Array<{r:number,c:number}>}
   */
  getVisualCaretCellsAll() {
    if (!typeCursor) return [];
    const anchors = this._allCarets(); // 錨點順序：主 + extras
    const hasPaths = this._composing && this._perCaretPreviewPaths && this._perCaretPreviewPaths.length === anchors.length;
    if (!hasPaths) {
      return anchors.map(p => ({ r: p.r, c: p.c })); // 非組字回傳錨點
    }
    const sel = (this._imeSelStart != null) ? this._imeSelStart : Number.POSITIVE_INFINITY; // 無索引時走尾端
    return anchors.map((p, i) => {
      const path = this._perCaretPreviewPaths[i]; // 該 caret 完整預覽路徑
      if (!path || path.length === 0) return { r: p.r, c: p.c }; // 無預覽時用錨點
      if (sel < path.length) {
        const at = path[sel]; // 落在 path[sel]：IME 選字時跟著選到的字
        return { r: at.r, c: at.c };
      }
      const last = path[path.length - 1]; // 落在尾端
      const next = nextTypeCell(last.r, last.c); // 預覽尾下一格
      if (next && isInSelection(next.r, next.c)) return { r: next.r, c: next.c };
      return { r: last.r, c: last.c };
    });
  }

  /** 將隱藏 textarea 對齊 getVisualCaretCell()，使選字窗跟著「當前插入格」 */
  syncImeToCaretCell() {
    const rc = this.getVisualCaretCell();
    if (rc) this.positionTypeInput(rc.r, rc.c);
  }

  /** 清除全畫布懸停用的「打」預覽（左鍵錨定當下須立刻清掉，否則該格仍留 Enter 寫入的字） */
  _clearTypeHoverCharPreview() {
    for (let rr = 0; rr < rows; rr++) {
      for (let cc = 0; cc < cols; cc++) {
        if (previewData[rr][cc].char === "打") {
          previewData[rr][cc] = { char: "", color: "#000000" };
        }
      }
    }
  }

  /** 游標懸停格顯示「打」預覽（與筆刷 Enter 相同條件） */
  _applyHoverPreview(r, c) {
    // 已錨定游標、已確認打字選取、或拖曳選取預覽中：不顯示「打」預覽
    if (typeCursor !== null || typeSelection !== null || typeDragSelection !== null) return;
    if (floatingLayer && floatingPos && cellInFloatingUnion(r, c)) {
      previewData[r][c] = { char: "打", color: brushColor };
    } else if (!floatingLayer || !floatingPos) {
      previewData[r][c] = { char: "打", color: brushColor };
    }
  }

  Enter() {
    const r = parseInt(currentGrid.dataset.row, 10);
    const c = parseInt(currentGrid.dataset.col, 10);
    this._applyHoverPreview(r, c);
    // 左鍵拖曳期間：即時更新打字選取範圍（視覺用 typeDragSelection）
    if (this._isTypeSelecting && isPointerDown && typeSelectAnchor) {
      const ar = typeSelectAnchor.r; // 拖曳錨點列
      const ac = typeSelectAnchor.c; // 拖曳錨點欄
      const nextHead = lastInSelectionTowards(ar, ac, r, c); // 在選區外時沿直線貼到選區邊界上的合理端點
      if (nextHead) typeSelectHead = nextHead;
      const range = collectTypeRangeCells(typeSelectAnchor, typeSelectHead);
      typeDragSelection = range; // 拖曳中即時顯示
    }
    if (typeCursor) {
      this.syncImeToCaretCell();
    }
    render();
  }

  Exit() {
    // 組字中離開某一格：不可整批清 composition（會讓所有預覽閃滅）；只清該格的「打」懸停
    if (!this._composing) {
      this._clearCompositionPreviewCell();
    }
    if (currentGrid) {
      const r = parseInt(currentGrid.dataset.row, 10); // 離開的格列
      const c = parseInt(currentGrid.dataset.col, 10); // 離開的格欄
      const pv = previewData[r][c]; // 該格預覽層
      if (pv.char === "打") {
        previewData[r][c] = { char: "", color: "#000000" };
      } else if (!this._composing) {
        previewData[r][c] = { char: "", color: "#000000" };
      }
    }
    render();
  }

  LeftDown() {
    const r = parseInt(currentGrid.dataset.row, 10);
    const c = parseInt(currentGrid.dataset.col, 10);
    if (!isInSelection(r, c)) return;
    this._clearCompositionPreviewCell();

    // Alt+click：在已有 caret 的前提下加 caret／toggle 移除（不啟動拖曳選取）
    if (isAltDown && typeCursor) {
      const key = rcKey(r, c); // 點擊格的 key
      const isPrimary = rcKey(typeCursor.r, typeCursor.c) === key; // 是否點到主 caret
      const extraHitIdx = typeExtraCursors.findIndex(p => rcKey(p.r, p.c) === key); // 點到第幾個 extra（-1 為沒點到）
      if (isPrimary) {
        // 主 caret 被 toggle：以最後一個 extra 接任主，全無 extras 則整體清空
        if (typeExtraCursors.length === 0) {
          typeCursor = null;
          if (typeImeHook) {
            typeImeHook.blur();
            typeImeHook.value = "";
          }
        } else {
          const newPrimary = typeExtraCursors[typeExtraCursors.length - 1]; // 最後加入的 extra
          typeCursor = { r: newPrimary.r, c: newPrimary.c };
          typeExtraCursors = typeExtraCursors.slice(0, -1).map(p => ({ r: p.r, c: p.c }));
        }
      } else if (extraHitIdx >= 0) {
        // 非主 caret 被 toggle：直接從 extras 移除，主 caret 不變
        typeExtraCursors = typeExtraCursors.filter((_, i) => i !== extraHitIdx).map(p => ({ r: p.r, c: p.c }));
      } else {
        // 新增 caret：舊主 caret 與其他 extras 都退到 extras，新點擊格成為主
        typeExtraCursors = this._allCarets().map(p => ({ r: p.r, c: p.c }));
        typeCursor = { r, c };
      }
      // 任何 caret 異動後重設閃爍相位，使新舊 | 同相從顯示相位開始；同時清掉殘留的 IME 選字索引
      typingCaretBlinkT0 = typeof performance !== "undefined" ? performance.now() : Date.now();
      this._imeSelStart = null;
      // Alt 模式：不啟動拖曳選取、清除已存在的拖曳/確認選取
      this._isTypeSelecting = false;
      typeSelectAnchor = null;
      typeSelectHead = null;
      typeDragSelection = null;
      typeSelection = null;
      this._clearTypeHoverCharPreview();
      if (typeCursor) {
        this.syncImeToCaretCell();
        if (typeImeHook) {
          typeImeHook.value = "";
          typeImeHook.focus();
        }
      }
      render();
      // 與一般 LeftDown 同理：下一個 microtask 再對齊一次焦點
      if (typeCursor && typeImeHook) {
        const self = this;
        queueMicrotask(() => {
          if (selectedTool === "type" && typeCursor && typeImeHook) {
            self.syncImeToCaretCell();
            typeImeHook.focus();
          }
        });
      }
      return;
    }

    // 無 Alt：恢復為單一 caret，先清掉所有 extras
    typeExtraCursors = [];
    // 開始拖曳選取：記住 anchor/head，並先清掉舊選取（避免殘影）
    this._isTypeSelecting = true;
    typeSelectAnchor = { r, c }; // 拖曳起點
    typeSelectHead = { r, c }; // 拖曳目前點
    typeDragSelection = collectTypeRangeCells(typeSelectAnchor, typeSelectHead); // 立即顯示單格（拖曳中）
    typeSelection = null; // 進入新一輪選取時，清掉已確認選取
    typeCursor = { r, c };
    this._clearTypeHoverCharPreview(); // 點擊當下立即去掉仍顯示的「打」
    this.syncImeToCaretCell();
    if (typeImeHook) {
      typeImeHook.value = "";
      typeImeHook.focus();
    }
    render();
    // render() 與高頻重繪後部分環境會搶焦；下一個 microtask 再對齊一次
    if (typeImeHook) {
      queueMicrotask(() => {
        if (selectedTool === "type" && typeCursor && typeImeHook) {
          this.syncImeToCaretCell();
          typeImeHook.focus();
        }
      });
    }
  }

  /** 滑鼠放開後再聚焦：與 LeftDown 搭配，解決「第一次點擊只錨定、鬆鍵後才能真正輸入」 */
  LeftUp() {
    if (selectedTool !== "type" || !typeCursor || !typeImeHook) return;
    // 結束拖曳：若拖曳範圍格數 > 1，轉成確認後選取；否則清除拖曳選取
    if (this._isTypeSelecting && typeSelectAnchor && typeSelectHead) {
      const range = collectTypeRangeCells(typeSelectAnchor, typeSelectHead);
      if (range && range.cells && range.cells.length > 1) {
        typeSelection = range;
        typeCursor = { r: range.start.r, c: range.start.c };
      } else {
        typeSelection = null;
      }
      typeDragSelection = null;
      typeSelectAnchor = null;
      typeSelectHead = null;
      this._isTypeSelecting = false;
      this.syncImeToCaretCell();
      render();
    }
    const self = this;
    queueMicrotask(() => {
      if (selectedTool === "type" && typeCursor && typeImeHook) {
        self.syncImeToCaretCell();
        typeImeHook.focus();
      }
    });
  }

  RightDown() {
    this._composing = false;
    if (typeImeHook) {
      typeImeHook.blur();
      typeImeHook.value = "";
    }
    typeCursor = null;
    typeExtraCursors = []; // 額外 carets 一併清
    this._clearTypeSelectionVisual();
    this.ClearPreview();
    if (currentGrid) {
      const r = parseInt(currentGrid.dataset.row, 10);
      const c = parseInt(currentGrid.dataset.col, 10);
      this._applyHoverPreview(r, c);
    }
    render();
  }

  Over() {
    this._composing = false;
    this._clearCompositionPreviewCell();
    if (typeImeHook) {
      typeImeHook.blur();
      typeImeHook.value = "";
    }
    typeCursor = null;
    typeExtraCursors = []; // 額外 carets 一併清
    this._clearTypeSelectionVisual();
    this.ClearPreview();
    render();
  }
}

class ClearTool extends Tool {
    Start() {
        if(confirm(t("tool.clear.confirm"))) {
            this.SaveSnapshot();
            for(let r=0; r<rows; r++){
                for(let c=0; c<cols; c++){
                    data[r][c] = { char: '', color: '#000000' };
                }
            }
            floatingLayer = null;
            floatingPos = null;
            floatingMask = null;
            selectionAddRect = null;
            selection = null;
            typeCursor = null;
            typeExtraCursors = []; // 額外 carets 一併清
            if (typeImeHook) {
              typeImeHook.blur();
              typeImeHook.value = "";
            }
            render();
        }
        SetCurrentTool("brush");
        document.querySelector('.tool[data-tool="brush"]').classList.add("active");
        document.querySelector('.tool[data-tool="clear"]').classList.remove("active");
    }
}

const toolMap = {
  brush: new Brush("brush"),
  eraser: new Eraser("eraser"),
  line: new Line("line"),
  bucket: new Bucket("bucket"),
  eyedropper: new Eyedropper("eyedropper"),
  select: new SelectTool("select"),
  type: new TypeTool("type"),
  shape: new ShapeTool("shape"),
  clear: new ClearTool("clear")
};

/**
 * 黏著工具依修飾鍵決定實際操作工具：
 * brush／eraser：Shift 互換，Alt（未按 Shift）→ 吸管；Shift 優先於 Alt。
 * line／bucket／shape：Alt → 吸管（與筆刷 Alt 吸管相同機制）。
 */
function getEffectivePaintingToolName() {
  const base = selectedTool;
  if (base === "brush" || base === "eraser") {
    if (isShiftDown) return base === "brush" ? "eraser" : "brush";
    if (isAltDown) return "eyedropper";
    return base;
  }
  if (base === "line" || base === "bucket" || base === "shape") {
    if (isAltDown) return "eyedropper";
    return base;
  }
  return base;
}

function applyModifierCurrentTool() {
  const name = getEffectivePaintingToolName();
  const next = toolMap[name];
  if (!next || currentTool === next) return;
  const prev = currentTool;
  if (
    prev &&
    (prev.name === "brush" || prev.name === "eraser") &&
    (name === "brush" || name === "eraser")
  ) {
    next.isLeftDown = prev.isLeftDown;
    next.lastDrawPos = prev.lastDrawPos;
  }
  currentTool = next;
}

function SetCurrentTool(type) {
  if (currentTool != null && type == currentTool.name && type !== 'clear') return;
  if (currentTool != null) currentTool.Over();
  selectedTool = type;
  currentTool = toolMap[type];
  if (currentTool != null) currentTool.Start();
  applyModifierCurrentTool();
}