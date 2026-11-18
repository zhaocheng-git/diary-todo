// ============================================================
// 日记 · 待办 —— 应用逻辑（网页版 & Electron 桌面版共用）
// 存储抽象：网页版用 IndexedDB；桌面版用 window.electronAPI 读写本地 diary 文件夹
// ============================================================
(function () {
  "use strict";

  /* ---------- 工具函数 ---------- */
  function pad(n) { return String(n).padStart(2, "0"); }
  function dateToStr(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function todayStr() { return dateToStr(new Date()); }
  function parseDate(s) { var p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(s, n) { var d = parseDate(s); d.setDate(d.getDate() + n); return dateToStr(d); }
  function fmtWeek(s) { return "周" + ["日", "一", "二", "三", "四", "五", "六"][parseDate(s).getDay()]; }
  function fmtDateLabel(s) { var d = parseDate(s); return (d.getMonth() + 1) + "月" + d.getDate() + "日 · " + fmtWeek(s); }
  function nowHM() { var d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- 存储抽象 ----------
     两种实现暴露相同接口：
       getAll()        -> Promise<Record[]>  所有有记录的日期（含 date/diary/tasks）
       getDate(date)   -> Promise<Record|null>
       saveDay(record) -> Promise<any>
       deleteDay(date) -> Promise<any>
     桌面版通过 preload.js 暴露的 window.electronAPI 走本地文件；网页版走 IndexedDB。 */
  var Storage = (function () {
    if (typeof window.electronAPI !== "undefined") {
      var api = window.electronAPI;
      return {
        type: "electron",
        getAll: function () {
          return api.listDays().then(function (dates) {
            return Promise.all(dates.map(function (d) { return api.readDay(d); }))
              .then(function (rs) { return rs.filter(Boolean); });
          });
        },
        getDate: function (date) { return api.readDay(date); },
        saveDay: function (rec) { return api.writeDay(rec); },
        deleteDay: function (date) { return api.deleteDay(date); }
      };
    }

    var DB_NAME = "diary-todo", DB_VER = 1, STORE = "days", dbPromise = null;
    function openDB() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise(function (resolve, reject) {
        var req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "date" });
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
      return dbPromise;
    }
    function run(mode, fn) {
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var t = db.transaction(STORE, mode);
          var req = fn(t.objectStore(STORE));
          req.onsuccess = function () { resolve(req.result); };
          req.onerror = function () { reject(req.error); };
        });
      });
    }
    return {
      type: "indexeddb",
      getAll: function () { return run("readonly", function (s) { return s.getAll(); }); },
      getDate: function (date) { return run("readonly", function (s) { return s.get(date); }); },
      saveDay: function (rec) { return run("readwrite", function (s) { return s.put(rec); }); },
      deleteDay: function (date) { return run("readwrite", function (s) { return s.delete(date); }); }
    };
  })();

  /* ---------- 应用状态 ---------- */
  var currentDate = todayStr();
  var currentDay = { date: currentDate, diary: "", tasks: [] }; // 当前显示的那天
  var allRecords = [];  // 全部有记录的日期，按日期倒序（供历史列表）
  var saveTimer = null;

  /* ---------- DOM 引用 ---------- */
  function $(id) { return document.getElementById(id); }
  var el = {
    themeBtn: $("themeBtn"), storageHint: $("storageHint"),
    prevBtn: $("prevBtn"), nextBtn: $("nextBtn"),
    weekday: $("weekday"), dateInput: $("dateInput"), todayBtn: $("todayBtn"),
    taskInput: $("taskInput"), addTaskBtn: $("addTaskBtn"),
    taskList: $("taskList"), taskEmpty: $("taskEmpty"), taskCount: $("taskCount"),
    diaryInput: $("diaryInput"), saveStatus: $("saveStatus"),
    historyList: $("historyList"), historyEmpty: $("historyEmpty")
  };

  /* ---------- 深浅色主题 ---------- */
  function currentTheme() {
    var saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function applyTheme() {
    var t = currentTheme();
    document.documentElement.setAttribute("data-theme", t);
    el.themeBtn.textContent = t === "dark" ? "☀️" : "🌙";
    el.themeBtn.title = t === "dark" ? "切换到浅色" : "切换到深色";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#111113" : "#f6f6f7");
  }
  el.themeBtn.addEventListener("click", function () {
    localStorage.setItem("theme", currentTheme() === "dark" ? "light" : "dark");
    applyTheme();
  });

  /* ---------- 渲染 ---------- */
  function renderDateNav() {
    el.weekday.textContent = fmtDateLabel(currentDate);
    el.dateInput.value = currentDate;
    el.todayBtn.style.visibility = currentDate === todayStr() ? "hidden" : "visible";
  }

  function renderTasks() {
    var tasks = currentDay.tasks || [];
    var done = tasks.filter(function (t) { return t.done; }).length;
    el.taskCount.textContent = tasks.length ? done + "/" + tasks.length : "";
    el.taskEmpty.style.display = tasks.length ? "none" : "";
    el.taskList.innerHTML = "";
    tasks.forEach(function (t) {
      var li = document.createElement("li");
      li.className = "task" + (t.done ? " done" : "");
      li.dataset.id = t.id;
      li.innerHTML =
        '<label class="task-check">' +
          '<input type="checkbox" ' + (t.done ? "checked" : "") + '>' +
          '<span class="box"></span>' +
          '<span class="task-text">' + esc(t.text) + "</span>" +
        "</label>" +
        '<button class="task-del" title="删除任务">×</button>';
      el.taskList.appendChild(li);
    });
  }

  function renderDiary() {
    el.diaryInput.value = currentDay.diary || "";
  }

  function renderHistory() {
    var st = el.historyList.scrollTop;
    el.historyEmpty.style.display = allRecords.length ? "none" : "";
    el.historyList.innerHTML = "";
    allRecords.forEach(function (r) {
      var tasks = r.tasks || [];
      var done = tasks.filter(function (t) { return t.done; }).length;
      var diary = (r.diary || "").trim();
      var preview = diary ? diary.replace(/\s+/g, " ").slice(0, 40) : "";
      var btn = document.createElement("button");
      btn.className = "history-item" + (r.date === currentDate ? " active" : "");
      btn.innerHTML =
        '<span class="h-date">' + r.date.slice(5) + " " + fmtWeek(r.date) + "</span>" +
        '<span class="h-info">' +
          (tasks.length ? "📋 " + tasks.length + " 项(" + done + " 完成)" : "") +
          (preview ? (tasks.length ? " · " : "") + "📝 " + esc(preview) : "") +
        "</span>" +
        '<span class="h-arrow">›</span>';
      btn.addEventListener("click", function () { setDate(r.date); });
      el.historyList.appendChild(btn);
    });
    el.historyList.scrollTop = st;
  }

  function renderAll() {
    renderDateNav();
    renderTasks();
    renderDiary();
    renderHistory();
  }

  /* ---------- 数据操作 ---------- */
  function loadAll() {
    return Storage.getAll().then(function (rs) {
      allRecords = rs.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    });
  }

  // 切换日期前，把上一个日期还没保存的日记先落盘，避免丢失
  function flushDiary() {
    clearTimeout(saveTimer);
    var v = el.diaryInput.value;
    if ((currentDay.diary || "") !== v) {
      currentDay.diary = v;
      persist();
    }
  }

  function setDate(date) {
    flushDiary();
    currentDate = date;
    return Storage.getDate(date).then(function (rec) {
      currentDay = rec || { date: date, diary: "", tasks: [] };
      renderAll();
    });
  }

  function persist() {
    var hasContent = (currentDay.diary || "").trim() || (currentDay.tasks || []).length;
    var p = hasContent
      ? Storage.saveDay(currentDay)
      : Storage.deleteDay(currentDate).then(function () { return null; });
    return p.then(function () { return loadAll(); }).then(renderHistory);
  }

  function saveDiaryDebounced() {
    el.saveStatus.textContent = "保存中…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      currentDay.diary = el.diaryInput.value;
      persist().then(function () {
        el.saveStatus.textContent = "已保存 " + nowHM();
      });
    }, 500);
  }

  function addTask() {
    var text = el.taskInput.value.trim();
    if (!text) return;
    currentDay.tasks = currentDay.tasks || [];
    currentDay.tasks.push({ id: uid(), text: text, done: false, createdAt: Date.now() });
    el.taskInput.value = "";
    renderTasks();
    persist();
  }

  function toggleTask(id) {
    currentDay.tasks.forEach(function (t) { if (t.id === id) t.done = !t.done; });
    renderTasks();
    persist();
  }

  function deleteTask(id) {
    currentDay.tasks = currentDay.tasks.filter(function (t) { return t.id !== id; });
    renderTasks();
    persist();
  }

  /* ---------- 事件绑定 ---------- */
  el.prevBtn.addEventListener("click", function () { setDate(addDays(currentDate, -1)); });
  el.nextBtn.addEventListener("click", function () { setDate(addDays(currentDate, 1)); });
  el.todayBtn.addEventListener("click", function () { setDate(todayStr()); });
  el.dateInput.addEventListener("change", function () { if (el.dateInput.value) setDate(el.dateInput.value); });

  el.addTaskBtn.addEventListener("click", addTask);
  el.taskInput.addEventListener("keydown", function (e) { if (e.key === "Enter") addTask(); });

  el.taskList.addEventListener("click", function (e) {
    var li = e.target.closest(".task");
    if (!li) return;
    if (e.target.closest(".task-del")) { deleteTask(li.dataset.id); return; }
    toggleTask(li.dataset.id);
  });

  el.diaryInput.addEventListener("input", saveDiaryDebounced);

  /* ---------- 启动 ---------- */
  function init() {
    el.storageHint.textContent = Storage.type === "electron"
      ? "桌面版 · 数据保存在「文档/diary」文件夹"
      : "网页版 · 数据保存在浏览器 IndexedDB";
    applyTheme();
    loadAll().then(function () { return setDate(todayStr()); });
  }

  init();
})();
