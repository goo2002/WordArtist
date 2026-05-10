/**
 * 瀏覽器持久化集中管理（鍵名／IDB 設定／讀寫輔助）
 *
 * 對照表（擴充新功能時先在此加鍵與註解）：
 * - localStorage STORAGE_LS_KEYS.PALETTE              → 自訂調色盤（ui.js）
 * - localStorage STORAGE_LS_KEYS.WELCOME_RECENT_META  → 歡迎畫面「最近開啟」清單 meta（最多 3 筆）
 * - localStorage STORAGE_LS_KEYS.USER_PREFERENCES     → 使用者偏好 JSON（形狀見 globals.js；讀寫於 main.js 偏好設定）
 * - IndexedDB STORAGE_IDB.name / store levelSnapshots → 上述清單對應之關卡 JSON 快照內容
 */

const STORAGE_LS_KEYS = Object.freeze({
  PALETTE: "pixel_painter_palette",
  WELCOME_RECENT_META: "welcomeRecentLevels",
  /** 與 USER_PREFERENCES_DEFAULT 同構（main.js 偏好設定） */
  USER_PREFERENCES: "text_painter_user_preferences",
});

/** sessionStorage：只在本分頁/本次開啟有效的設定 */
const STORAGE_SS_KEYS = Object.freeze({
  /** 舊版 Beta 開關鍵名；現已不再寫入，`main.js` 載入時會 removeItem 清除殘值 */
  BETA_ENABLED: "text_painter_beta_enabled",
});

const STORAGE_IDB = Object.freeze({
  name: "TextPainterWelcome",
  store: "levelSnapshots",
  version: 1,
});

function lsGetJson(key, fallback = null) {
  try {
    const s = localStorage.getItem(key);
    if (s === null || s === undefined) return fallback;
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function lsSetJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 配額等錯誤時略過，與舊行為一致（不拋出）
  }
}

function ssGetBool(key, fallback = false) {
  try {
    const v = sessionStorage.getItem(key);
    if (v === null || v === undefined) return fallback;
    if (v === "1" || v === "true") return true;
    if (v === "0" || v === "false") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function ssSetBool(key, value) {
  try {
    sessionStorage.setItem(key, value ? "1" : "0");
  } catch {
    // 配額等錯誤時略過（不拋出）
  }
}

function storageIdbOpen() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("no idb"));
      return;
    }
    const req = indexedDB.open(STORAGE_IDB.name, STORAGE_IDB.version);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORAGE_IDB.store)) {
        db.createObjectStore(STORAGE_IDB.store);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function levelSnapshotsPut(recordKey, value) {
  return storageIdbOpen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORAGE_IDB.store, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORAGE_IDB.store).put(value, recordKey);
      })
  );
}

function levelSnapshotsGet(recordKey) {
  return storageIdbOpen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORAGE_IDB.store, "readonly");
        const q = tx.objectStore(STORAGE_IDB.store).get(recordKey);
        q.onsuccess = () => resolve(q.result);
        q.onerror = () => reject(q.error);
      })
  );
}

function levelSnapshotsDelete(recordKey) {
  return storageIdbOpen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORAGE_IDB.store, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORAGE_IDB.store).delete(recordKey);
      })
  );
}
