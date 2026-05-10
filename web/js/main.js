// ===== 1. 選單資料（字串由 i18n 依語系切換） =====
function getMenuButtons() {
  const buttons = [
    { label: t("menu.file"), children: [
        { label: t("menu.openNew"), onclick: TryOpenNew },
        { label: t("menu.openOld"), onclick: Load },
        { label: t("menu.saveAs"), onclick: TrySaveAs },
        { label: t("menu.exportWorld"), onclick: TryExport },
        { label: t("menu.exportPng"), onclick: SavePng }
      ]
    },
    { label: t("menu.image"), children: [
        { label: t("menu.flipH"), onclick: FlipHorizontal },
        { label: t("menu.flipV"), onclick: FlipVertical },
        { label: t("menu.canvasSize"), onclick: TryResizeCanvas }
      ]
    },
    { label: t("menu.window"), children: [
        { label: t("menu.palette"), onclick: TogglePalette },
        { label: t("menu.welcome"), onclick: showWelcome }
      ]
    },
    { label: t("menu.settings"), children: [
        { label: t("menu.preferences"), onclick: OpenUserPreferences }
      ]
    },
  ];
  return buttons;
}

function applyBetaToUI() {
  const root = document.documentElement; // 套用 beta-enabled class 的根節點
  if (!root) return;
  root.classList.toggle("beta-enabled", !!isBetaEnabled);
}

function setBetaEnabled(enabled, opts = {}) {
  const refresh = opts.refresh !== false; // 是否同步刷新 UI；一般使用應為 true
  isBetaEnabled = !!enabled; // 不寫入 storage：每次開啟網頁由 globals 預設關閉
  applyBetaToUI();
  if (refresh) refreshShellUI();
}

function refreshShellUI() {
  SetMenuButtons(getMenuButtons());
  SetTools();
  refreshWelcomeStaticI18n();
  refreshPaletteChromeI18n();
  refreshDocumentTitle();
  populateWelcomeVersion();
}

function showWelcome() {
  document.getElementById("welcome-overlay")?.classList.remove("hidden");
  renderWelcomeRecentButtons();
}

function hideWelcome() {
  document.getElementById("welcome-overlay")?.classList.add("hidden");
}

function wireWelcomeUI() {
  const root = document.getElementById("welcome-overlay");
  if (!root) return;
  root.addEventListener("click", (e) => {
    if (e.target !== root) return;
    hideWelcome();
  });
  document.getElementById("welcome-close")?.addEventListener("click", hideWelcome);
  document.getElementById("welcome-btn-start")?.addEventListener("click", hideWelcome);
  document.getElementById("welcome-btn-new")?.addEventListener("click", () => {
    hideWelcome();
    TryOpenNew();
  });
  document.getElementById("welcome-btn-open")?.addEventListener("click", () => {
    hideWelcome();
    Load();
  });
  root.querySelectorAll(".welcome-link-placeholder").forEach((a) => {
    a.addEventListener("click", (e) => e.preventDefault());
  });
  populateWelcomeVersion();
  renderWelcomeRecentButtons();
}

const WELCOME_RECENT_MAX = 3;

function getRecentLevelsMeta() {
  const arr = lsGetJson(STORAGE_LS_KEYS.WELCOME_RECENT_META, []);
  return Array.isArray(arr) ? arr : [];
}

function saveRecentLevelsMeta(list) {
  lsSetJson(STORAGE_LS_KEYS.WELCOME_RECENT_META, list);
}

function truncateRecentLabel(s, max = 26) {
  if (!s) return "（無名稱）";
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function populateWelcomeVersion() {
  const line = document.getElementById("welcome-version-line");
  const body = document.getElementById("welcome-version-body");
  if (line) {
    line.textContent = "";
    const ver = document.createElement("span");
    ver.className = "welcome-version-number";
    ver.textContent = APP_RELEASE.version;
    line.appendChild(ver);
    line.appendChild(document.createTextNode(` ${t("app.releaseChannel")}`));
    line.appendChild(
      document.createTextNode(`${t("app.releaseDateLabel")}${APP_RELEASE.updatedAt}`)
    );
  }
  if (body) {
    body.innerHTML = "";
    const releaseMsgs =
      getUILocale() === "zh-CN"
        ? [1, 2, 3, 4, 5, 6, 7].map((n) => t(`welcome.releaseLine${n}`))
        : APP_RELEASE.messages;
    releaseMsgs.forEach((msg) => {
      const p = document.createElement("p");
      p.className = "welcome-note";
      p.textContent = msg;
      body.appendChild(p);
    });
  }
}

function renderWelcomeRecentButtons() {
  const container = document.getElementById("welcome-recent-list");
  const block = document.getElementById("welcome-recent-block");
  if (!container) return;
  container.innerHTML = "";
  const list = getRecentLevelsMeta();
  if (block) block.classList.toggle("welcome-recent--empty", list.length === 0);
  list.forEach((item, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "welcome-btn welcome-btn-recent";
    const label = item.path || item.name || "";
    btn.textContent = truncateRecentLabel(label);
    btn.title = label;
    btn.addEventListener("click", () => openRecentLevel(index));
    container.appendChild(btn);
  });
}

function removeRecentLevelAt(index) {
  const list = getRecentLevelsMeta();
  const item = list[index];
  if (!item) return;
  if (item.key) levelSnapshotsDelete(item.key).catch(() => {});
  list.splice(index, 1);
  saveRecentLevelsMeta(list);
  renderWelcomeRecentButtons();
}

function openRecentLevel(index) {
  const list = getRecentLevelsMeta();
  const item = list[index];
  if (!item || !item.key) return;
  levelSnapshotsGet(item.key)
    .then((text) => {
      if (text == null || text === undefined || text === "") {
        removeRecentLevelAt(index);
        showPopup({
          title: t("err.fileNotFound"),
          message: t("err.fileNotFoundDetail1"),
        });
        return;
      }
      if (applyLoadedJsonText(text, item.name || item.path || "關卡.wp", { skipRecent: true })) {
        hideWelcome();
      }
    })
    .catch(() => {
      removeRecentLevelAt(index);
      showPopup({
        title: t("err.fileNotFound"),
        message: t("err.fileNotFoundDetail2"),
      });
    });
}

function recordRecentLevel(rawText, pathLabel) {
  if (!window.indexedDB) return Promise.resolve();
  const key = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return levelSnapshotsPut(key, rawText)
    .then(() => {
      const list = getRecentLevelsMeta();
      list.unshift({ key, path: pathLabel || "", name: pathLabel || "關卡" });
      while (list.length > WELCOME_RECENT_MAX) {
        const dropped = list.pop();
        if (dropped && dropped.key) levelSnapshotsDelete(dropped.key).catch(() => {});
      }
      saveRecentLevelsMeta(list);
      renderWelcomeRecentButtons();
    })
    .catch(() => {});
}

function applyLoadedJsonText(text, displayFileName, { skipRecent = false } = {}) {
  try {
    const result = JSON.parse(text);
    if (!Array.isArray(result) || !Array.isArray(result[0])) throw new Error();
    data = result.map((row) => row.map((cell) => ({ ...cell })));
    rows = data.length;
    cols = data[0].length;
    const base = (displayFileName || "關卡").replace(/\.[^/.]+$/, "");
    fileName = base || "文字畫";
    initCanvas(false);
    if (!skipRecent) {
      recordRecentLevel(text, displayFileName || `${fileName}.wp`);
    }
    return true;
  } catch (err) {
    alert(t("err.loadFormat"));
    return false;
  }
}

function normalizeBrushCharForPref(s) {
  if (typeof s !== "string" || !s.length) return USER_PREFERENCES_DEFAULT.defaultBrush.char;
  const ch = [...s][0];
  return ch || USER_PREFERENCES_DEFAULT.defaultBrush.char;
}

function normalizeBrushColorForPref(s) {
  const d = USER_PREFERENCES_DEFAULT.defaultBrush.color;
  if (typeof s !== "string") return d;
  const t = s.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t;
  if (/^#[0-9A-Fa-f]{3}$/.test(t)) {
    return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  }
  return d;
}

function mergeUserPreferences(saved) {
  const o = {
    locale: USER_PREFERENCES_DEFAULT.locale,
    defaultBrush: {
      char: USER_PREFERENCES_DEFAULT.defaultBrush.char,
      color: USER_PREFERENCES_DEFAULT.defaultBrush.color,
    },
    animationEnabled: USER_PREFERENCES_DEFAULT.animationEnabled,
  };
  if (!saved || typeof saved !== "object") return o;
  if (saved.locale === UserPreferenceLocale.ZH_TW || saved.locale === UserPreferenceLocale.ZH_CN) {
    o.locale = saved.locale;
  }
  if (saved.defaultBrush && typeof saved.defaultBrush === "object") {
    o.defaultBrush.char = normalizeBrushCharForPref(
      String(saved.defaultBrush.char != null ? saved.defaultBrush.char : o.defaultBrush.char)
    );
    o.defaultBrush.color = normalizeBrushColorForPref(
      String(saved.defaultBrush.color != null ? saved.defaultBrush.color : o.defaultBrush.color)
    );
  }
  if (typeof saved.animationEnabled === "boolean") o.animationEnabled = saved.animationEnabled;
  return o;
}

function getMergedUserPreferences() {
  const raw = lsGetJson(STORAGE_LS_KEYS.USER_PREFERENCES, null);
  return mergeUserPreferences(raw);
}

function preferencesFromPopupResult(res) {
  const base = getMergedUserPreferences();
  if (res.locale === UserPreferenceLocale.ZH_TW || res.locale === UserPreferenceLocale.ZH_CN) {
    base.locale = res.locale;
  }
  base.defaultBrush = {
    char: normalizeBrushCharForPref(res.brushChar != null ? String(res.brushChar) : base.defaultBrush.char),
    color: normalizeBrushColorForPref(res.brushColor != null ? String(res.brushColor) : base.defaultBrush.color),
  };
  base.animationEnabled = !!res.animationEnabled;
  return base;
}

/**
 * @param {object} opts
 * @param {boolean} [opts.applyDefaultBrushToSession=true] 是否把 prefs.defaultBrush 套到目前筆刷（僅初次載入網頁時應為 true；偏好視窗按確認時為 false，只寫入 storage）
 */
function applyUserPreferences(prefs, opts = {}) {
  const applyDefaultBrushToSession = opts.applyDefaultBrushToSession !== false;
  setUILocale(prefs.locale);
  useBucketFillAnimation = prefs.animationEnabled;
  if (applyDefaultBrushToSession && prefs.defaultBrush) {
    brushChar = prefs.defaultBrush.char;
    brushColor = prefs.defaultBrush.color;
    if (brushCharInput) brushCharInput.value = brushChar;
    if (brushColorInput) brushColorInput.value = brushColor;
  }
  refreshShellUI();
  // 須在 initCanvas 建立 data／格線之後才能 render，否則 data[r] 為 undefined
  if (
    data.length === rows &&
    rows > 0 &&
    cols > 0 &&
    data[0] &&
    data[0].length === cols
  ) {
    render();
  }
}

/**
 * 與 showPopup 建 DOM 順序一致：intInputs → stringInputs → checkboxes → selects
 * 偏好視窗為：預設筆刷字面、預設筆刷顏色、填色動畫、介面語言
 */
function refreshPreferencesPopupLayout(mask) {
  if (!mask) return;
  const win = mask.querySelector(".popup-window");
  if (!win) return;
  const titleEl = win.querySelector(".popup-title");
  if (titleEl) titleEl.textContent = t("prefs.title");
  const rows = win.querySelectorAll(
    ".popup-body > .popup-input, .popup-body > .popup-checkbox, .popup-body > .popup-select"
  );
  if (rows[0]) {
    const lab = rows[0].querySelector("label");
    if (lab) lab.textContent = t("prefs.defaultBrushChar");
    const inp = rows[0].querySelector("input");
    if (inp) inp.placeholder = t("prefs.placeholderChar");
  }
  if (rows[1]) {
    const lab = rows[1].querySelector("label");
    if (lab) lab.textContent = t("prefs.defaultBrushColor");
    const inp = rows[1].querySelector("input");
    if (inp) inp.placeholder = t("prefs.placeholderColor");
  }
  if (rows[2]) {
    const lab = rows[2].querySelector("label");
    if (lab) lab.textContent = t("prefs.bucketAnim");
  }
  if (rows[3]) {
    const lab = rows[3].querySelector("label");
    if (lab) lab.textContent = t("prefs.betaEnabled");
  }
  if (rows[4]) {
    const lab = rows[4].querySelector("label");
    if (lab) lab.textContent = t("prefs.uiLang");
    const sel = rows[4].querySelector("select");
    if (sel) {
      const opts = sel.querySelectorAll("option");
      if (opts[0]) opts[0].text = t("prefs.langZhTW");
      if (opts[1]) opts[1].text = t("prefs.langZhCN");
    }
  }
  const footer = win.querySelector(".popup-footer");
  if (footer) {
    const btns = footer.querySelectorAll("button");
    if (btns[0]) btns[0].textContent = t("popup.confirm");
    if (btns[1]) btns[1].textContent = t("popup.cancel");
  }
}

function OpenUserPreferences() {
  const prefs = getMergedUserPreferences();
  const snapshot = {
    locale: prefs.locale,
    animationEnabled: prefs.animationEnabled,
    brushChar,
    brushColor,
    betaEnabled: isBetaEnabled,
  };
  showPopup({
    title: t("prefs.title"),
    selects: [
      {
        label: t("prefs.uiLang"),
        key: "locale",
        value: prefs.locale,
        options: [
          { value: UserPreferenceLocale.ZH_TW, label: t("prefs.langZhTW") },
          { value: UserPreferenceLocale.ZH_CN, label: t("prefs.langZhCN") },
        ],
        onChange: (newLocale, _res, mask) => {
          setUILocale(newLocale);
          refreshShellUI();
          refreshPreferencesPopupLayout(mask);
        },
      },
    ],
    stringInputs: [
      {
        label: t("prefs.defaultBrushChar"),
        key: "brushChar",
        value: prefs.defaultBrush.char,
        placeholder: t("prefs.placeholderChar"),
      },
      {
        label: t("prefs.defaultBrushColor"),
        key: "brushColor",
        value: prefs.defaultBrush.color,
        placeholder: t("prefs.placeholderColor"),
      },
    ],
    checkboxes: [
      {
        label: t("prefs.bucketAnim"),
        key: "animationEnabled",
        value: prefs.animationEnabled,
      },
      {
        label: t("prefs.betaEnabled"),
        key: "betaEnabled",
        value: isBetaEnabled,
      },
    ],
    onConfirm: (res) => {
      const next = preferencesFromPopupResult(res);
      lsSetJson(STORAGE_LS_KEYS.USER_PREFERENCES, next);
      applyUserPreferences(next, { applyDefaultBrushToSession: false });
      setBetaEnabled(!!res.betaEnabled);
    },
    onCancel: () => {
      applyUserPreferences(
        {
          locale: snapshot.locale,
          animationEnabled: snapshot.animationEnabled,
          defaultBrush: {
            char: snapshot.brushChar,
            color: snapshot.brushColor,
          },
        },
        { applyDefaultBrushToSession: true }
      );
      setBetaEnabled(!!snapshot.betaEnabled);
    },
  });
}

document.addEventListener("DOMContentLoaded", () => {
  canvas = document.getElementById("canvas");
  typeImeHook = document.getElementById("type-ime-hook");
  overlay = document.getElementById("dialog-overlay");
  dialog = document.getElementById("dialog");
  toolbar = document.getElementById("toolbar");
  menuBar = document.querySelector(".menu-bar");

  try {
    sessionStorage.removeItem(STORAGE_SS_KEYS.BETA_ENABLED); // 清除舊版 session 紀錄（已不再使用）
  } catch {
    /* ignore */
  }
  applyBetaToUI();

  applyUserPreferences(getMergedUserPreferences(), { applyDefaultBrushToSession: true });
  SetCurrentTool("brush");
  initCanvas(true);
  InitPaletteUI();
  refreshPaletteChromeI18n();

  wireWelcomeUI();
  showWelcome();

  canvas.addEventListener("contextmenu", e => e.preventDefault());

  setInterval(() => {
    if (!useFlicker) return;
    updatePreviewAlpha();
    render();
  }, 1000 / fps);
});

function syncModifiersFromEvent(e) {
  isShiftDown = e.shiftKey;
  isAltDown = e.altKey;
  isCtrlDown = e.ctrlKey;
  applyModifierCurrentTool();
  if (currentTool && currentGrid) {
    currentTool.Input(ToolInputType.ModifiersChanged);
  }
}

window.addEventListener("keydown", syncModifiersFromEvent);
window.addEventListener("keyup", syncModifiersFromEvent);

/** 選取工具使用 Alt 減選時，避免瀏覽器第二次 Alt 搶焦（選單列等）；捕獲階段較早攔截 */
function preventBrowserAltMenuSteal(e) {
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  if (e.key !== "Alt" && e.code !== "AltLeft" && e.code !== "AltRight") return;
  e.preventDefault();
}
window.addEventListener("keydown", preventBrowserAltMenuSteal, true);
window.addEventListener("keyup", preventBrowserAltMenuSteal, true);

window.addEventListener("blur", () => {
  isShiftDown = false;
  isAltDown = false;
  isCtrlDown = false;
  applyModifierCurrentTool();
  if (currentTool && currentGrid) {
    currentTool.Input(ToolInputType.ModifiersChanged);
  }
});

// ... (事件處理函式保持不變 handleCellHover, handleCellDown etc.) ...
function handleCellHover(e) {
  currentGrid = e.currentTarget;
  if(currentTool) currentTool.Input(ToolInputType.Enter);
}
function handleCellOut(e) {
  if(currentTool) currentTool.Input(ToolInputType.Exit);
  currentGrid = null;
}
function handleCellDown(e) {
  // 與 hover 無關時也必須以「被點擊的格」為準（避免 currentGrid 過期導致打字錨在錯格／isInSelection 失敗）
  if (e.currentTarget && e.currentTarget.classList.contains("cell")) {
    currentGrid = e.currentTarget;
  }
  if (e.button === 0) {
    // 打字工具：避免 mousedown 預設行為在 mouseup 前後搶回焦點，導致須再點一次才能輸入
    if (selectedTool === "type") {
      e.preventDefault();
    }
    isPointerDown = true;
    if(currentTool) currentTool.Input(ToolInputType.LeftDown);
  } else if (e.button === 2) {
    if(currentTool) currentTool.Input(ToolInputType.RightDown);
  }
}
function handleCellUp(e) {
  if (e.button === 0) {
    if(currentTool) currentTool.Input(ToolInputType.LeftUp);
  } else if (e.button === 2) {
    if(currentTool) currentTool.Input(ToolInputType.RightUp);
  }
}

document.addEventListener("mouseup", (e) => {
  if (isPointerDown && e.button === 0) {
    if(currentTool) currentTool.Input(ToolInputType.LeftUp);
    isPointerDown = false;
  } else if (e.button === 2) {
    if(currentTool) currentTool.Input(ToolInputType.RightUp);
  }
  
  // 點擊畫布外部取消選取 (select 工具專用)
  if(selectedTool === 'select' && e.target.closest('.canvas') === null && e.button === 0) {
      if(selection || selectionAddRect) {
          selection = null;
          selectionAddRect = null;
          render();
      }
  }
});

// ... (Keydown, updatePreviewAlpha, 歷史紀錄 保持不變) ...
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  }
});
function updatePreviewAlpha() {
  const speed = 0.0003 * fps;
  if (flickerIncreasing) {
    currentFlickerPhase += speed;
    if (currentFlickerPhase >= 1) { currentFlickerPhase = 1; flickerIncreasing = false; }
  } else {
    currentFlickerPhase -= speed;
    if (currentFlickerPhase <= 0) { currentFlickerPhase = 0; flickerIncreasing = true; }
  }
}
function saveSnapshot() {
  undoStack.push(deepClone(data));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
}
function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(deepClone(data));
  data = undoStack.pop();
  
  // Undo 可能會改變畫布尺寸，需重繪 DOM
  if(data.length !== rows || data[0].length !== cols) {
      rows = data.length;
      cols = data[0].length;
      initCanvas(false); // 不重置 data
  } else {
      render();
  }
}
function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(deepClone(data));
  data = redoStack.pop();
  if(data.length !== rows || data[0].length !== cols) {
      rows = data.length;
      cols = data[0].length;
      initCanvas(false);
  } else {
      render();
  }
}
function clearUndoRedo() {
  undoStack.length = 0;
  redoStack.length = 0;
}


// ===== 影像處理功能 =====

function FlipHorizontal() {
    saveSnapshot();
    data.forEach(row => row.reverse());
    render();
}

function FlipVertical() {
    saveSnapshot();
    data.reverse();
    render();
}

function TryResizeCanvas() {
    showPopup({
        title: t("dialog.resizeCanvas"),
        message: t("dialog.resizeCanvasMsg"),
        intInputs: [
            { label: t("dialog.newWidth"), key: 'cols', value: cols, minValue: 1, maxValue: 99 },
            { label: t("dialog.newHeight"), key: 'rows', value: rows, minValue: 1, maxValue: 99 }
        ],
        selects: [
            {
                label: t("dialog.anchor"), key: 'anchor', value: 'top-left',
                options: [
                    { value: 'top-left', label: t("dialog.anchorTL") },
                    { value: 'center', label: t("dialog.anchorC") },
                    { value: 'bottom-right', label: t("dialog.anchorBR") }
                ]
            }
        ],
        onConfirm: (res) => {
            ResizeCanvas(res.rows, res.cols, res.anchor);
        }
    });
}

function ResizeCanvas(newRows, newCols, anchor) {
    saveSnapshot();
    
    let offsetR = 0;
    let offsetC = 0;
    
    // 計算偏移量
    if (anchor === 'center') {
        offsetR = Math.floor((newRows - rows) / 2);
        offsetC = Math.floor((newCols - cols) / 2);
    } else if (anchor === 'bottom-right') {
        offsetR = newRows - rows;
        offsetC = newCols - cols;
    }
    // top-left: offset = 0, 0
    
    data = resizeCanvasData(data, rows, cols, newRows, newCols, offsetR, offsetC);
    rows = newRows;
    cols = newCols;
    
    // 重新初始化 DOM
    initCanvas(false); 
}

// ===== 檔案功能 (保持不變) =====
// TryOpenNew, Load, TrySaveAs, TryExport, Save, SavePng ... 
// 這裡直接引用上面的舊代碼即可，不需要變動。
// 但為了完整性，這裡簡略列出 TryOpenNew 的更新（因為 menuButtons 結構變了）

function TryOpenNew() {
  showPopup({
    title: t("dialog.newFile"),
    message: t("dialog.newFileMsg"),
    intInputs: [
      { label: t("dialog.height"), key: 'rows', minValue: 1, value: rows, maxValue: 99 },
      { label: t("dialog.width"), key: 'cols', minValue: 1, value: cols, maxValue: 99 }
    ],
    onConfirm: (res) => {
      rows = res.rows; cols = res.cols;
      initCanvas(true);
    }
  });
}

function Load() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,.wp";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      applyLoadedJsonText(reader.result, file.name, { skipRecent: false });
    };
    reader.readAsText(file);
  };
  input.click();
}

function TrySaveAs() {
  showPopup({
    title: t("dialog.saveAsWp"),
    checkboxes: [{ label: t("dialog.cropEmpty"), key: 'crop', value: saveOptions.crop }],
    selects: [{
      label: t("dialog.charMode"), key: 'mode', value: saveOptions.mode,
      options: [
        { value: 'keep', label: t("mode.keep") }, { value: 'toFullWidth', label: t("mode.toFullWidth") },
        { value: 'fullSpace', label: t("mode.fullSpace") }, { value: 'fullUnderscore', label: t("mode.fullUnderscore") }
      ]
    }],
    onConfirm: (res) => { saveOptions = { ...res }; Save(saveOptions.crop, saveOptions.mode, 'wp'); }
  });
}

function TryExport() {
  if (!isBetaEnabled && exportOptions.type === 'world') {
    exportOptions = { ...exportOptions, type: 'txt' };
  }

  if (exportOptions.worldSpatial != null) {
    exportOptions.worldObjectMode =
      exportOptions.worldSpatial === "full" ? "full" : "classic";
    delete exportOptions.worldSpatial;
  }
  delete exportOptions.worldGroupName;

  const isMagic = exportOptions.type === 'magic';
  const isWorld = exportOptions.type === 'world';

  const formatOptions = [
    { value: 'txt', label: t("export.fmtTxt") },
    { value: 'wwt', label: t("export.fmtWwt") },
    { value: 'magic', label: t("export.fmtMagic") }
  ];
  if (isBetaEnabled) {
    formatOptions.push({ value: 'world', label: t("export.fmtWorld") });
  }

  // 定義額外按鈕陣列
  const extraBtns = [];

  if (isMagic) {
    // 按鈕 1：進入設定視窗
    extraBtns.push({
      label: t("export.magicSettings"),
      onClick: (currentRes) => {
        exportOptions = { ...currentRes };
        showMagicSettingsPopup(); 
      },
      closeAfterClick: true
    });

    // 按鈕 2：一鍵複製格式字串
    extraBtns.push({
      label: t("export.copyMagic"),
      onClick: (currentRes) => {
        // 這裡直接調用轉換邏輯，但不觸發下載
        const magicObject = convertToMagicFormat(processCanvasData(data, currentRes.crop, currentRes.mode), magicOptions);
        const copyText = `@[type] ${JSON.stringify(magicObject, null, 2)}`;
        
        navigator.clipboard.writeText(copyText).then(() => {
          alert(t("export.copied"));
        }).catch(err => {
          console.error("複製失敗", err);
        });
      },
      closeAfterClick: false
    });
  }

  const exportSelects = [];

  if (!(isWorld && isBetaEnabled)) {
    exportSelects.push({
      label: t("dialog.charMode"),
      key: "mode",
      value: exportOptions.mode,
      options: [
        { value: "keep", label: t("mode.keep") },
        { value: "toFullWidth", label: t("mode.toFullWidth") },
        { value: "fullSpace", label: t("mode.fullSpace") },
        { value: "fullUnderscore", label: t("mode.fullUnderscore") }
      ]
    });
  }

  exportSelects.push({
    label: t("export.outFormat"),
    key: "type",
    value: exportOptions.type,
    options: formatOptions,
    onChange: (newValue, currentResult) => {
      if (exportOptions.type !== newValue) {
        exportOptions = { ...exportOptions, ...currentResult, type: newValue };
        document.querySelector(".popup-mask").remove();
        TryExport();
      }
    }
  });

  if (isWorld && isBetaEnabled) {
    exportSelects.push({
      label: t("export.worldObjectMode"),
      key: "worldObjectMode",
      value: exportOptions.worldObjectMode || "classic",
      options: [
        { value: "classic", label: t("export.worldObjectPreset") },
        { value: "minRect", label: t("export.worldObjectMinRectBounds") },
        { value: "full", label: t("export.worldObjectFillCanvas") }
      ],
      onChange: (newValue, currentResult) => {
        exportOptions = { ...exportOptions, ...currentResult, worldObjectMode: newValue };
        document.querySelector(".popup-mask").remove();
        TryExport();
      }
    });
  }

  /** .world 不顯示「空字元處理」，一律以全型底線輸入 processCanvasData */
  const exportCheckboxes = [{ label: t("dialog.cropEmpty"), key: "crop", value: exportOptions.crop }];
  if (isWorld && isBetaEnabled) {
    exportCheckboxes.push({
      label: t("export.worldGroupObjects"),
      key: "worldGroupObjects",
      value: !!exportOptions.worldGroupObjects
    });
  }

  showPopup({
    title: t("export.title"),
    checkboxes: exportCheckboxes,
    selects: exportSelects,
    extraBtns: extraBtns,
    onConfirm: (res) => {
      exportOptions = { ...exportOptions, ...res };
      Save(res.crop, res.mode, res.type, magicOptions);
    }
  });
}

function showMagicSettingsPopup(prevRes) {
  showPopup({
    title: t("magic.title"),
    intInputs: [
      { label: t("magic.posX"), key: 'posX', value: magicOptions.posX },
      { label: t("magic.posY"), key: 'posY', value: magicOptions.posY }
    ],
    stringInputs: [
      { 
        label: t("magic.tags"), 
        key: 'tagsString', 
        value: magicOptions.tagsString 
      }
    ],
    checkboxes: [
      { label: t("magic.fixed"), key: 'fixed', value: magicOptions.fixed },
      { label: t("magic.hasSe"), key: 'has_se', value: magicOptions.has_se },
      { label: t("magic.hasAnim"), key: 'has_animation', value: magicOptions.has_animation },
      { label: t("magic.needAccept"), key: 'need_accept', value: magicOptions.need_accept },
      { label: t("magic.canSkip"), key: 'can_skip', value: magicOptions.can_skip },
      { label: t("magic.wait"), key: 'wait', value: magicOptions.wait }
    ],
    selects: [
      { 
        label: t("magic.layer"), key: 'layer', value: magicOptions.layer,
        options: [
          { value: 'front', label: t("magic.layerFront") },
          { value: 'mid', label: t("magic.layerMid") },
          { value: 'back', label: t("magic.layerBack") }
        ]
      },
      {
        label: t("magic.charType"), key: 'char_type', value: magicOptions.char_type,
        options: [
          { value: 'null', label: t("magic.ctNone") },
          { value: 'princess', label: t("magic.ctPrincess") },
          { value: 'dragon', label: t("magic.ctDragon") },
          { value: 'snake', label: t("magic.ctSnake") },
          { value: 'poet', label: t("magic.ctPoet") },
          { value: 'giant_l', label: t("magic.ctGiantL") },
          { value: 'giant_r', label: t("magic.ctGiantR") }
        ]
      }
    ],
    onConfirm: (magicSettings) => {
      magicOptions = { ...magicSettings }; // 存下進階設定
      TryExport(); // 重要：回到主選單
    },
    onCancel: () => {
      TryExport(); // 取消也回到主選單
    }
  });
}

function Save(crop, mode, type, magicSettings = null) {
  const effectiveCharMode = type === "world" ? "fullUnderscore" : mode;
  const processedData = processCanvasData(data, crop, effectiveCharMode);
  if (crop && (processedData.length === 0 || processedData[0].length === 0)) {
    alert(t("save.canvasEmpty")); return;
  }

  if (type === 'world') {
    if (!isBetaEnabled) {
      alert(t("export.worldBetaRequired"));
      return;
    }
    const worldDoc = convertToWorldFormat(processedData, {
      objectMode: exportOptions.worldObjectMode || "classic",
      groupObjects: !!exportOptions.worldGroupObjects
    });
    if (!worldDoc) {
      alert(t("export.worldNoPainted"));
      return;
    }
    const blob = new Blob([JSON.stringify(worldDoc, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (fileName || "magic_export") + ".world";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }
  
  let content, mime, ext;
  switch (type) {
    case 'txt':
      content = convertToPlainText(processedData); mime = "text/plain"; ext = ".txt"; break;
    case 'wwt':
      content = JSON.stringify(convertToParallelFormat(processedData), null, 2); mime = "application/json"; ext = ".wwt"; break;
    case 'magic':
      // 將設定傳入轉換函數
      const magicObject = convertToMagicFormat(processedData, magicSettings);
      content = `@[type] ${JSON.stringify(magicObject, null, 2)}`; 
      mime = "text/plain"; 
      ext = ".txt"; 
      break;
    default:
      content = JSON.stringify(processedData, null, 2); mime = "application/json"; ext = ".wp"; break;
  }

  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (fileName || "magic_export") + ext;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function convertToMagicFormat(processedData, settings) {
  const baseData = convertToParallelFormat(processedData);

  const formatValue = (val) => (val === 'null' ? null : val);

  const tagsArray = settings.tagsString
    ? settings.tagsString.split(',').map(s => s.trim()).filter(s => s !== "")
    : [];

  return {
    "texts": (baseData.texts || "").replace(/\n/g, '&'), 
    "pos": [settings.posX, settings.posY], // 從暫存讀取
    "tags": tagsArray,
    "fixed": settings.fixed,
    "has_se": settings.has_se,
    "has_animation": settings.has_animation,
    "need_accept": settings.need_accept,
    "can_skip": settings.can_skip,
    "layer": formatValue(settings.layer),
    "z_index": null, // 根據你目前的設定，暫不開放手動輸入
    "has_defalut_tag": true,
    "offset": [0, 0],
    "wait": settings.wait,
    "label_settings": baseData.label_settings || {},
    "char_type": formatValue(settings.char_type)
  };
}

function SavePng() {
  if (typeof html2canvas === 'undefined') {
    alert(t("save.needHtml2canvas"));
    return;
  }
  html2canvas(document.getElementById("canvas"), { backgroundColor: null }).then(cvs => {
    const a = document.createElement("a");
    a.download = fileName + ".png";
    a.href = cvs.toDataURL("image/png");
    a.click();
  });
}

function TogglePalette() {
  const win = document.getElementById("palette-window");
  isPaletteOpen = !isPaletteOpen;
  if (isPaletteOpen) {
    win.classList.remove("hidden");
  } else {
    win.classList.add("hidden");
  }
}