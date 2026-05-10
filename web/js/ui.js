const { log } = require("winjs");

// 初始化畫布
function initCanvas(resetData) {
  // 為了支持背景樣式，canvas 元素內容重建
  canvas.innerHTML = "";
  // 調整 grid 樣式
  canvas.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
  canvas.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
  canvas.style.width = `${cols * cellSize}px`; // 明確設定寬度以置中
  canvas.style.height = `${rows * cellSize}px`;

  previewData = [];
  clearUndoRedo();
  if (resetData) data = [];

  for (let r = 0; r < rows; r++) {
    const previewRow = [];
    const row = [];
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.style.fontSize = cellSize * 0.9 + "px";
      cell.style.width = cellSize + "px";
      cell.style.height = cellSize + "px";
      cell.dataset.row = r;
      cell.dataset.col = c;
      // 事件監聽
      cell.addEventListener("mousedown", handleCellDown);
      cell.addEventListener("mouseover", handleCellHover);
      cell.addEventListener("mouseout", handleCellOut);
      cell.addEventListener("mouseup", handleCellUp);
      canvas.appendChild(cell);

      previewRow.push({ char: "", color: "#000000" });
      if(resetData) row.push({ char: "", color: "#000000" });
    }
    previewData.push(previewRow);
    if (resetData) data.push(row);
  }
  render();
}

/** 依「是否在區域內」函式畫一組正交選取邊線（可重複呼叫以疊加多個獨立範圍） */
function addOutlineForRegion(cell, r, c, isInside) {
  if (!isInside(r, c)) return;
  cell.classList.add("selected");
  if (!isInside(r - 1, c)) cell.classList.add("sel-t");
  if (!isInside(r + 1, c)) cell.classList.add("sel-b");
  if (!isInside(r, c - 1)) cell.classList.add("sel-l");
  if (!isInside(r, c + 1)) cell.classList.add("sel-r");
}

function applySelectionOutlineToCell(cell, r, c) {
  // 加選拖曳中：舊範圍與新矩形各畫一框，確認合併後才變成單一聯集框線
  if (selectionAddRect) {
    addOutlineForRegion(cell, r, c, cellInFloatingUnion);
    const a = selectionAddRect;
    addOutlineForRegion(cell, r, c, (rr, cc) =>
      rr >= a.r && rr < a.r + a.h && cc >= a.c && cc < a.c + a.w);
    return;
  }
  if (floatingLayer && floatingPos) {
    addOutlineForRegion(cell, r, c, cellInFloatingUnion);
    return;
  }
  if (selection) {
    const s = selection;
    addOutlineForRegion(cell, r, c, (rr, cc) =>
      rr >= s.r && rr < s.r + s.h && cc >= s.c && cc < s.c + s.w);
  }
}

function render() {
  const cells = canvas.children;
  // 統一所有 typing-caret 的閃爍：JS 時鐘驅動 opacity，60fps render 全 caret 同步
  if (canvas && canvas.style) {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now(); // 目前時間軸
    const phaseMs = (now - typingCaretBlinkT0) % 1000; // 0~999ms 相位
    const blinkOn = phaseMs < 500 ? 1 : 0; // 與原 keyframes 0~50% 顯示一致
    canvas.style.setProperty("--typing-caret-opacity", String(blinkOn));
  }
  // 收集所有要顯示閃爍 caret 的格 key（組字時每個 caret 都跟隨各自預覽尾下一格）
  const caretKeySet = new Set();
  if (
    selectedTool === "type" &&
    typeCursor &&
    currentTool &&
    currentTool.name === "type" &&
    typeof currentTool.getVisualCaretCellsAll === "function"
  ) {
    for (const rc of currentTool.getVisualCaretCellsAll()) {
      caretKeySet.add(`${rc.r},${rc.c}`);
    }
  }
  const dragMulti =
    typeDragSelection &&
    typeDragSelection.cells &&
    typeDragSelection.cells.length > 1; // 拖曳中已跨多格
  const hideTypingCaret = !!typeSelection || dragMulti; // 打字選取或拖曳多格時隱藏閃爍 caret

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const cell = cells[i];
      
      // 1. 基礎層
      let char = data[r][c].char;
      let color = data[r][c].color;
      
      // 2. 浮動層 (選取剪下的內容；僅聯集遮罩內覆蓋底圖)
      if (floatingLayer && floatingPos) {
          const localR = r - floatingPos.r;
          const localC = c - floatingPos.c;
          
          if (localR >= 0 && localR < floatingLayer.length &&
              localC >= 0 && localC < floatingLayer[0].length) {
              const useFloat = !floatingMask || floatingMask[localR][localC];
              if (useFloat) {
                  const floatCell = floatingLayer[localR][localC];
                  char = floatCell.char;
                  color = floatCell.color;
              }
          }
      }

      // 3. 預覽層
      const preview = previewData[r][c];
      const usePreview = preview.char !== '';
      
      if (usePreview) {
          char = preview.char;
          color = preview.color;
      }

      if (useFlicker && usePreview) {
        color = applyAlphaToColor(preview.color, hexAAToAlpha(preview.color));
      }

      // 更新 DOM
      if(cell.textContent !== char) cell.textContent = char;
      cell.style.color = color;
      cell.style.backgroundColor = usePreview ? "#000" : "#0000";

      // 打字選取：拖曳僅單格時不顯示；確認後選取一律顯示
      const effTypeSel =
        typeDragSelection &&
        typeDragSelection.cells &&
        typeDragSelection.cells.length > 1
          ? typeDragSelection
          : typeSelection;
      const isTypeSelected =
        selectedTool === "type" &&
        effTypeSel &&
        effTypeSel.cellKeySet &&
        effTypeSel.cellKeySet.has(`${r},${c}`);
      if (isTypeSelected) {
        cell.classList.add("type-selected");
      } else if (cell.classList.contains("type-selected")) {
        cell.classList.remove("type-selected");
      }

      // ★★★ 4. 選取框視覺效果 (邊緣偵測) ★★★
      
      // 清除舊狀態
      cell.classList.remove("selected", "sel-t", "sel-b", "sel-l", "sel-r");

      applySelectionOutlineToCell(cell, r, c);

      // 打字游標：以 caretKeySet 集合判定，可同時顯示多個 caret
      const needTypingCaret =
        !hideTypingCaret && caretKeySet.has(`${r},${c}`);
      if (needTypingCaret) {
        cell.classList.add("typing-caret");
      } else if (cell.classList.contains("typing-caret")) {
        cell.classList.remove("typing-caret");
      }
    }
  }
  syncTypeImeHookPointerEvents();
}

// ... (SetTools 保持不變) ...
function SetTools() {
  toolbar.innerHTML = "";
  toolDatas.forEach(({ tool, color, disabled }) => {
    const label = t(`tool.${tool}.label`);
    const title = t(`tool.${tool}.title`);
    const btn = document.createElement("div");
    btn.className = "tool";
    btn.dataset.tool = tool;
    btn.title = (disabled ? t("toolbar.disabled") : "") + title;
    btn.textContent = label;
    if (!disabled) btn.style.color = color;
    else btn.classList.add("disabled");
    
    btn.addEventListener("click", () => {
      if(disabled) return;
      document.querySelectorAll(".tool").forEach(el => el.classList.remove("active"));
      btn.classList.add("active");
      SetCurrentTool(btn.dataset.tool);
    });
    toolbar.appendChild(btn);
  });
  
  const defaultTool = document.querySelector(`.tool[data-tool="${selectedTool}"]`);
  if(defaultTool) defaultTool.classList.add("active");

  const brushSettings = document.createElement("div");
  brushSettings.className = "brush-settings";
  brushSettings.innerHTML = `
    <label>${t("toolbar.brushChar")} <input id="brush-char" title="${t("toolbar.brushCharTitle")}" maxlength="1" value="字"></label>
    <label>${t("toolbar.brushColor")} <input id="brush-color" title="${t("toolbar.brushColorTitle")}" type="color" value="#ffff00"></label>
  `;
  toolbar.appendChild(brushSettings);
  
  brushCharInput = document.getElementById("brush-char");
  brushColorInput = document.getElementById("brush-color");
  brushCharInput.value = brushChar;
  brushColorInput.value = brushColor;
  brushCharInput.addEventListener("input", () => brushChar = brushCharInput.value);
  brushColorInput.addEventListener("input", () => brushColor = brushColorInput.value);
}

// 修改選單生成邏輯以支援下拉
function SetMenuButtons(buttons) {
  menuBar.innerHTML = "";
  buttons.forEach(item => {
    if (item.children) {
      // 下拉選單
      const dropdown = document.createElement("div");
      dropdown.className = "dropdown";
      
      const btn = document.createElement("button");
      btn.textContent = item.label;
      dropdown.appendChild(btn);

      const content = document.createElement("div");
      content.className = "dropdown-content";
      
      item.children.forEach(subItem => {
        const subBtn = document.createElement("button");
        subBtn.textContent = subItem.label;
        subBtn.onclick = subItem.onclick;
        content.appendChild(subBtn);
      });
      dropdown.appendChild(content);
      menuBar.appendChild(dropdown);
    } else {
      // 一般按鈕
      const btn = document.createElement("button");
      btn.textContent = item.label;
      if (item.title) btn.title = item.title;
      btn.onclick = item.onclick;
      menuBar.appendChild(btn);
    }
  });
}

// ... (showPopup 保持不變) ...
function showPopup({ title, message, intInputs = [], stringInputs = [],checkboxes = [], selects = [], extraBtns = [], onConfirm, onCancel }) {
  const mask = document.createElement('div');
  mask.className = 'popup-mask';
  const windowDiv = document.createElement('div');
  windowDiv.className = 'popup-window';

  const close = () => {
    if (onCancel) onCancel();
    if (mask.parentNode) {
      mask.parentNode.removeChild(mask);
    }
  };

  mask.addEventListener("click", (e) => {
    if (e.target !== mask) return;
    close();
  });

  const titleDiv = document.createElement('div');
  titleDiv.className = 'popup-title';
  titleDiv.textContent = title;

  const closeBtn = document.createElement('div');
  closeBtn.className = 'popup-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = close;

  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'popup-body';
  if (message) {
    const msg = document.createElement('div');
    msg.textContent = message;
    bodyDiv.appendChild(msg);
  }

  const result = {};

  intInputs.forEach(({ label, key, minValue, value, maxValue, title }) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'popup-input';
    wrapper.title = title || "";
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    if (minValue !== undefined) input.min = minValue;
    if (maxValue !== undefined) input.max = maxValue;
    input.value = value;
    result[key] = value;
    input.onchange = () => result[key] = parseInt(input.value);
    wrapper.appendChild(labelEl);
    wrapper.appendChild(input);
    bodyDiv.appendChild(wrapper);
  });

  // --- 新增：處理字串輸入框 (String Inputs) ---
  stringInputs.forEach(({ label, key, value, placeholder, title }) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'popup-input'; // 共用樣式
    wrapper.title = title || "";
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder || "";
    input.value = value || "";
    result[key] = value || "";
    input.oninput = () => result[key] = input.value; // 即時同步
    wrapper.appendChild(labelEl);
    wrapper.appendChild(input);
    bodyDiv.appendChild(wrapper);
  });
  
  // ... checkboxes, selects 邏輯 (同前) ...
  checkboxes.forEach(({ label, key, value, title }) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'popup-checkbox';
    wrapper.title = title || "";
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = value;
    result[key] = value;
    checkbox.onchange = () => result[key] = checkbox.checked;
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);
    wrapper.appendChild(checkbox);
    bodyDiv.appendChild(wrapper);
  });

  selects.forEach(({ label, key, value, options, title, onChange }) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'popup-select';
    wrapper.title = title || "";
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    const select = document.createElement('select');
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.text = opt.label;
      if (opt.value === value) option.selected = true;
      select.appendChild(option);
    });
    result[key] = value;
    select.onchange = () => {
      result[key] = select.value;
      if (onChange) onChange(select.value, result, mask);
    };
    wrapper.appendChild(labelEl);
    wrapper.appendChild(select);
    bodyDiv.appendChild(wrapper);
  });
  
  extraBtns.forEach(({ label, onClick, closeAfterClick = true }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    
    btn.onclick = () => {
      onClick(result); 
      // 增加一個判斷：是否在點擊後關閉視窗 (設定通常要關，但複製通常不關)
      if (closeAfterClick) {
        if (mask.parentNode) {
          mask.parentNode.removeChild(mask);
        }
      }
    };
    bodyDiv.appendChild(btn);
  });

  const footer = document.createElement('div');
  footer.className = 'popup-footer';
  
  if (onConfirm) {
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = typeof t === 'function' ? t('popup.confirm') : '確認';
    confirmBtn.onclick = () => {
      onConfirm(result);
      if (mask.parentNode) {
        mask.parentNode.removeChild(mask);
      }
    };
    footer.appendChild(confirmBtn);
  }
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = typeof t === 'function' ? t('popup.cancel') : '取消';
  cancelBtn.onclick = close;
  footer.appendChild(cancelBtn);

  windowDiv.append(titleDiv, closeBtn, bodyDiv, footer);
  mask.appendChild(windowDiv);
  document.body.appendChild(mask);
}

// 調色盤邏輯

function InitPaletteUI() {
  const win = document.getElementById("palette-window");
  const header = document.getElementById("palette-header");
  const addBtn = document.getElementById("btn-add-palette");

  const savedPalette = lsGetJson(STORAGE_LS_KEYS.PALETTE, null);
  if (savedPalette && Array.isArray(savedPalette)) {
    palette = savedPalette;
  }

  RenderPaletteGrid();

  // 1. 新增按鈕事件
  addBtn.onclick = () => {
    palette.push({ char: brushChar, color: brushColor });
    SavePalette();
    RenderPaletteGrid();
  };

  // 2. 視窗拖曳邏輯
  let isDragging = false;
  let offset = { x: 0, y: 0 };

  header.addEventListener("mousedown", (e) => {
    if(e.target.tagName === 'BUTTON') return; // 避免點到關閉按鈕
    isDragging = true;
    offset.x = e.clientX - win.offsetLeft;
    offset.y = e.clientY - win.offsetTop;
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      win.style.left = (e.clientX - offset.x) + "px";
      win.style.top = (e.clientY - offset.y) + "px";
      // 移除 right 定位避免衝突
      win.style.right = "auto"; 
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}

function SavePalette() {
  lsSetJson(STORAGE_LS_KEYS.PALETTE, palette);
}

function RenderPaletteGrid() {
  const grid = document.getElementById("palette-grid");
  grid.innerHTML = "";

  palette.forEach((item, index) => {
    const el = document.createElement("div");
    el.className = "palette-item";
    el.textContent = item.char;
    el.style.color = item.color;
    
    // 點擊：應用樣式 (類似吸管)
    el.onclick = () => {
      brushChar = item.char;
      brushColor = item.color;
      // 更新工具列顯示
      if(brushCharInput) brushCharInput.value = brushChar;
      if(brushColorInput) brushColorInput.value = brushColor;
      
      // 切換回筆刷工具
      SetCurrentTool("brush");
      document.querySelectorAll(".tool").forEach(t => t.classList.remove("active"));
      document.querySelector('.tool[data-tool="brush"]').classList.add("active");
    };

    // 右鍵：編輯選單
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showPopup({
        title: "編輯調色盤項目",
        message: "修改或刪除此筆刷設定",
        intInputs: [], // 無整數輸入
        // 我們手動加入字元與顏色輸入的邏輯稍微複雜，這裡用 inputs 模擬
        // 為了簡單，我們重用 showPopup 結構，這裡稍微 hack 一下或者擴充 showPopup
        // 為了保持穩定，我們用 confirm 做刪除，用 prompt 做簡單修改，或者直接呼叫 popup
        
        // 這裡使用 showPopup 的擴充用法 (動態生成內容)
        // 由於 globals.js 定義的 showPopup 比較死板，我們這裡用簡單的方式：
        // 彈出視窗詢問動作
        selects: [
           { 
             label: '動作', key: 'action', value: 'edit',
             options: [
               { value: 'edit', label: '修改內容' },
               { value: 'delete', label: '刪除項目' }
             ]
           }
        ],
        onConfirm: (res) => {
            if (res.action === 'delete') {
                palette.splice(index, 1);
                SavePalette();
                RenderPaletteGrid();
            } else {
                // 如果是編輯，再次彈出編輯視窗 (巢狀彈窗)
                // 稍微延遲一下讓上個視窗關閉
                setTimeout(() => {
                    EditPaletteItem(index);
                }, 100);
            }
        }
      });
    });

    grid.appendChild(el);
  });
}

function EditPaletteItem(index) {
    const item = palette[index];
    // 這裡我們需要一個能輸入文字和顏色的彈窗
    // 為了不大幅修改 showPopup，我們用一個取巧的方法：
    // 先把當前筆刷設為該項目的值，讓使用者在工具列改好後，再按「更新」? 
    // 不直觀。
    // 我們直接擴充 showPopup 支援 string 和 color 雖然最好，
    // 但為了最小化變動，我們用 HTML5 color input 在 popup 裡的替代方案：
    
    // 這裡直接手刻一個專用的編輯邏輯，或者擴充 showPopup
    // 讓我們簡單修改 showPopup 支援自定義 HTML
    // 或者... 簡單一點，用 prompt (雖然醜)
    // 決定：使用 showPopup 但針對 string input 做一點小修改，
    // 由於原版 showPopup 沒支援字串輸入，我們在這裡臨時擴充一下：
    
    // 建立臨時的編輯介面
    showPopup({
        title: '修改項目',
        message: '請輸入新的字元', // 顏色比較難在純文字框輸入，我們改為「讀取當前工具列設定」最簡單
        // 策略：將該項目「讀取」到工具列，使用者修改工具列後，再按「更新」
        // 但這裡我們實作：手動輸入
        // 由於原版限制，我們修改 globals.js 的 popup 支援 custom inputs 比較好，
        // 但如果不改 globals.js，我們可以這樣做：
        
        onConfirm: () => {} // 佔位
    });
    
    // 重新實作一個專用的簡單編輯器，因為原版 popup 功能不足
    const newChar = prompt("請輸入新字元:", item.char);
    if (newChar === null) return;
    
    // 顏色比較麻煩，我們讓它「吸取」當前工具列的顏色，或者讓使用者輸入 Hex
    // 為了體驗好，我們假設使用者想要把「目前的筆刷設定」覆蓋到這個格子
    if (confirm(t("palette.confirmReplace").replace("{char}", brushChar).replace("{color}", brushColor))) {
        palette[index].char = brushChar;
        palette[index].color = brushColor;
        SavePalette();
        RenderPaletteGrid();
    } else if (newChar && newChar !== item.char) {
        // 只改字
        palette[index].char = newChar;
        SavePalette();
        RenderPaletteGrid();
    }
}