import type { PlanPayload } from "@/lib/projects/types";
import { hardenGeneratedHtml } from "@/lib/preview/harden-html";

export type DemoRecipe = {
  id: string;
  label: string;
  prompt: string;
  plan: PlanPayload;
  buildHtml: () => string;
};

const baseStyles = `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #0b1322; color: #eaf1ff; font-family: "Avenir Next", "Segoe UI", system-ui, sans-serif; }
    .shell { max-width: 720px; margin: 0 auto; padding: 24px 18px 60px; }
    h1 { font-size: 22px; letter-spacing: -0.02em; margin: 0 0 4px; }
    .sub { color: #8fa2bd; font-size: 12px; margin-bottom: 20px; }
    .card { background: #101c30; border: 1px solid #24354e; border-radius: 14px; padding: 16px; margin-bottom: 14px; }
    .row { display: flex; gap: 8px; align-items: center; }
    input, select, textarea { flex: 1; min-width: 0; background: #0a1424; border: 1px solid #2a3c57; border-radius: 10px; color: #eaf1ff; padding: 10px 12px; font-size: 14px; font-family: inherit; }
    button { background: #8da2ff; color: #0a1322; border: 0; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
    button.ghost { background: transparent; color: #b7c7e0; border: 1px solid #2f425e; }
    button:disabled { opacity: .45; cursor: not-allowed; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid #1c2b42; font-size: 14px; }
    li:last-child { border-bottom: 0; }
    .muted { color: #8fa2bd; font-size: 12px; }
    .stat { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
    .pill { font-size: 11px; padding: 3px 8px; border-radius: 999px; background: rgba(141,162,255,.14); color: #a9b8ff; }
    @media (max-width: 520px) { .shell { padding: 18px 14px 48px; } h1 { font-size: 19px; } }
`;

type ShellScript = { styles: string; code: string };

const shell = (title: string, sub: string, body: string, script: ShellScript) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${baseStyles}${script.styles}</style>
</head>
<body>
<div class="shell">
<h1>${title}</h1>
<div class="sub">${sub}</div>
${body}
</div>
<script>${script.code}</script>
</body>
</html>`;

/* ------------------------------- 记账 ------------------------------- */

const ledgerStyles = `
    .kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
    .kpi { background: #101c30; border: 1px solid #24354e; border-radius: 14px; padding: 14px; }
    .kpi span { display: block; color: #8fa2bd; font-size: 12px; margin-bottom: 6px; }
    .amt-in { color: #52d6a1; }
    .amt-out { color: #ff8fa0; }
`;

const ledgerScript = `
var KEY = 'atomforge.ledger.v1';
var state = load();

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { items: [] }; }
  catch (e) { return { items: [] }; }
}
function persist() { localStorage.setItem(KEY, JSON.stringify(state)); }
function fmt(n) { return '¥' + Number(n).toFixed(2); }

function render() {
  var income = 0, expense = 0;
  state.items.forEach(function (it) { it.type === 'in' ? income += it.amount : expense += it.amount; });
  document.getElementById('income').textContent = fmt(income);
  document.getElementById('expense').textContent = fmt(expense);
  document.getElementById('balance').textContent = fmt(income - expense);

  var list = document.getElementById('list');
  if (!state.items.length) {
    list.innerHTML = '<li class="muted">还没有记录，先添加一笔吧。</li>';
    document.getElementById('count').textContent = '0 笔';
    return;
  }
  document.getElementById('count').textContent = state.items.length + ' 笔';
  list.innerHTML = state.items.map(function (it) {
    var cls = it.type === 'in' ? 'amt-in' : 'amt-out';
    return '<li><div><div>' + esc(it.title) + '</div><div class="muted">' + esc(it.category) + ' · ' + esc(it.date) + '</div></div>' +
      '<div class="row"><span class="' + cls + '">' + (it.type === 'in' ? '+' : '-') + fmt(it.amount) + '</span>' +
      '<button class="ghost" data-del="' + it.id + '">删除</button></div></li>';
  }).join('');
}

function esc(v) { return String(v).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

document.getElementById('form').addEventListener('submit', function (e) {
  e.preventDefault();
  var title = document.getElementById('title').value.trim();
  var amount = parseFloat(document.getElementById('amount').value);
  if (!title || !amount || amount <= 0) { document.getElementById('hint').textContent = '请填写名称和大于 0 的金额'; return; }
  document.getElementById('hint').textContent = '';
  state.items.unshift({
    id: String(Date.now()),
    title: title,
    amount: amount,
    type: document.getElementById('type').value,
    category: document.getElementById('category').value,
    date: new Date().toISOString().slice(0, 10)
  });
  persist();
  document.getElementById('title').value = '';
  document.getElementById('amount').value = '';
  render();
});

document.getElementById('list').addEventListener('click', function (e) {
  var id = e.target.getAttribute('data-del');
  if (!id) return;
  state.items = state.items.filter(function (it) { return it.id !== id; });
  persist();
  render();
});

document.getElementById('clear').addEventListener('click', function () {
  if (!confirm('确定清空全部记录？')) return;
  state.items = [];
  persist();
  render();
});

render();
`;

/* ------------------------------ 番茄钟 ------------------------------ */

const pomodoroStyles = `
    .ring { text-align: center; padding: 22px 0 8px; }
    .ring .clock { font-size: 54px; font-weight: 700; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
    .ring .phase { color: #a9b8ff; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; }
    .bar { height: 6px; background: #1b2a42; border-radius: 999px; overflow: hidden; margin: 16px 0 18px; }
    .bar > div { height: 100%; width: 0; background: #8da2ff; transition: width .3s linear; }
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; text-align: center; }
`;

const pomodoroScript = `
var KEY = 'atomforge.pomodoro.v1';
var FOCUS = 25 * 60, BREAK = 5 * 60;
var cfg = load();
var phase = 'focus', remaining = FOCUS, running = false, timer = null;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { focusMinutes: 25, sessions: 0, today: new Date().toISOString().slice(0, 10) }; }
  catch (e) { return { focusMinutes: 25, sessions: 0, today: new Date().toISOString().slice(0, 10) }; }
}
function persist() { localStorage.setItem(KEY, JSON.stringify(cfg)); }
function pad(n) { return n < 10 ? '0' + n : String(n); }
function tick() {
  if (remaining > 0) { remaining -= 1; paint(); return; }
  clearInterval(timer); timer = null; running = false;
  if (phase === 'focus') { finishSession(); phase = 'break'; remaining = BREAK; }
  else { phase = 'focus'; remaining = FOCUS; }
  paint();
  document.getElementById('phase').textContent = phase === 'focus' ? '专注' : '休息';
  document.getElementById('start').textContent = '开始';
}
function paint() {
  document.getElementById('clock').textContent = pad(Math.floor(remaining / 60)) + ':' + pad(remaining % 60);
  var total = phase === 'focus' ? FOCUS : BREAK;
  document.getElementById('bar').style.width = ((total - remaining) / total * 100).toFixed(2) + '%';
  document.getElementById('sessions').textContent = cfg.sessions;
  document.getElementById('mode').textContent = running ? (phase === 'focus' ? '专注中' : '休息中') : '已暂停';
}
function finishSession() {
  var today = new Date().toISOString().slice(0, 10);
  if (cfg.today !== today) { cfg.today = today; cfg.sessions = 0; }
  cfg.sessions += 1;
  persist();
}

document.getElementById('start').addEventListener('click', function () {
  if (running) {
    clearInterval(timer); timer = null; running = false;
    this.textContent = '继续';
    paint();
    return;
  }
  running = true;
  this.textContent = '暂停';
  timer = setInterval(tick, 1000);
  paint();
});
document.getElementById('reset').addEventListener('click', function () {
  clearInterval(timer); timer = null; running = false;
  remaining = phase === 'focus' ? FOCUS : BREAK;
  document.getElementById('start').textContent = '开始';
  paint();
});
document.getElementById('skip').addEventListener('click', function () {
  clearInterval(timer); timer = null; running = false;
  if (phase === 'focus') finishSession();
  phase = phase === 'focus' ? 'break' : 'focus';
  remaining = phase === 'focus' ? FOCUS : BREAK;
  document.getElementById('phase').textContent = phase === 'focus' ? '专注' : '休息';
  document.getElementById('start').textContent = '开始';
  paint();
});
document.getElementById('focusMinutes').addEventListener('change', function () {
  var v = Math.max(1, Math.min(90, parseInt(this.value, 10) || 25));
  this.value = v;
  cfg.focusMinutes = v;
  persist();
  if (!running && phase === 'focus') { FOCUS = v * 60; remaining = FOCUS; paint(); }
});

FOCUS = cfg.focusMinutes * 60;
remaining = FOCUS;
document.getElementById('focusMinutes').value = cfg.focusMinutes;
paint();
`;

/* ------------------------------ 习惯打卡 ------------------------------ */

const habitStyles = `
    .streak { font-size: 12px; color: #52d6a1; }
    .done { color: #52d6a1; text-decoration: line-through; }
    .bar { display: flex; gap: 4px; margin-top: 8px; }
    .bar i { flex: 1; height: 6px; border-radius: 2px; background: #1b2a42; }
    .bar i.on { background: #8da2ff; }
`;

const habitScript = `
var KEY = 'atomforge.habits.v1';
var state = load();
var today = new Date().toISOString().slice(0, 10);

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { habits: [] }; } catch (e) { return { habits: [] }; }
}
function persist() { localStorage.setItem(KEY, JSON.stringify(state)); }
function esc(v) { return String(v).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
function last7() {
  var out = [], d = new Date();
  for (var i = 6; i >= 0; i -= 1) { var t = new Date(d.getTime() - i * 86400000); out.push(t.toISOString().slice(0, 10)); }
  return out;
}
function render() {
  var list = document.getElementById('list');
  var doneToday = state.habits.filter(function (h) { return h.log[today]; }).length;
  document.getElementById('today').textContent = doneToday + '/' + state.habits.length;
  document.getElementById('rate').textContent = state.habits.length ? Math.round(doneToday / state.habits.length * 100) + '%' : '0%';

  if (!state.habits.length) { list.innerHTML = '<li class="muted">还没有习惯，先添加一个。</li>'; return; }
  list.innerHTML = state.habits.map(function (h) {
    var days = last7();
    var bars = days.map(function (d) { return '<i class="' + (h.log[d] ? 'on' : '') + '"></i>'; }).join('');
    var streak = 0;
    for (var i = days.length - 1; i >= 0; i -= 1) { if (h.log[days[i]]) streak += 1; else break; }
    return '<li><div style="flex:1"><div class="' + (h.log[today] ? 'done' : '') + '">' + esc(h.name) + '</div>' +
      '<div class="streak">连续 ' + streak + ' 天</div><div class="bar">' + bars + '</div></div>' +
      '<div class="row"><button data-toggle="' + h.id + '">' + (h.log[today] ? '撤销' : '打卡') + '</button>' +
      '<button class="ghost" data-del="' + h.id + '">删除</button></div></li>';
  }).join('');
}

document.getElementById('form').addEventListener('submit', function (e) {
  e.preventDefault();
  var input = document.getElementById('name');
  var name = input.value.trim();
  if (!name) return;
  state.habits.push({ id: String(Date.now()), name: name, log: {} });
  persist();
  input.value = '';
  render();
});

document.getElementById('list').addEventListener('click', function (e) {
  var t = e.target.getAttribute('data-toggle');
  var d = e.target.getAttribute('data-del');
  if (t) {
    state.habits.forEach(function (h) { if (h.id === t) { if (h.log[today]) delete h.log[today]; else h.log[today] = true; } });
    persist(); render();
  }
  if (d) { state.habits = state.habits.filter(function (h) { return h.id !== d; }); persist(); render(); }
});

render();
`;

/* ------------------------------- 导出 ------------------------------- */

export const DEMO_RECIPES: DemoRecipe[] = [
  {
    id: "ledger",
    label: "个人记账",
    prompt: "帮我做一个个人记账小工具，可以记录收入和支出，显示结余，能删除记录，数据要能保存。",
    plan: {
      title: "记账小工具",
      goal: "用一个单页应用记录每天的收入与支出，随时看到结余，数据在本地长期保存。",
      features: [
        "添加收入或支出记录，包含名称、金额、分类和日期",
        "实时汇总总收入、总支出与结余",
        "按条删除记录，支持一键清空",
        "数据写入浏览器本地存储，刷新后仍然存在",
      ],
      nonGoals: ["不做多人共享账本", "不做云同步与账号体系"],
      assumptions: ["单人使用，货币单位按人民币处理"],
      openQuestions: ["是否需要按月份筛选账单？"],
    },
    buildHtml: () =>
      shell(
        "记账小工具",
        "记录每一笔收支，实时查看结余",
        `<div class="kpis">
  <div class="kpi"><span>总收入</span><div class="stat amt-in" id="income">¥0.00</div></div>
  <div class="kpi"><span>总支出</span><div class="stat amt-out" id="expense">¥0.00</div></div>
</div>
<div class="card"><span class="muted">当前结余</span><div class="stat" id="balance">¥0.00</div></div>
<div class="card">
  <form id="form" class="row" style="flex-wrap:wrap">
    <input id="title" placeholder="名称，例如：午餐" aria-label="名称">
    <input id="amount" type="number" min="0.01" step="0.01" placeholder="金额" aria-label="金额" style="max-width:120px">
    <select id="type" aria-label="类型"><option value="out">支出</option><option value="in">收入</option></select>
    <select id="category" aria-label="分类"><option>餐饮</option><option>交通</option><option>购物</option><option>工资</option><option>其他</option></select>
    <button type="submit">添加记录</button>
  </form>
  <div class="muted" id="hint" style="margin-top:8px"></div>
</div>
<div class="card">
  <div class="row" style="justify-content:space-between;margin-bottom:6px">
    <strong style="font-size:13px">记录明细</strong>
    <span class="muted" id="count">0 笔</span>
  </div>
  <ul id="list"></ul>
  <div style="margin-top:12px"><button class="ghost" id="clear">清空全部</button></div>
</div>`,
        { styles: ledgerStyles, code: ledgerScript },
      ),
  },
  {
    id: "pomodoro",
    label: "专注番茄钟",
    prompt: "做一个番茄钟，25 分钟专注加 5 分钟休息，可以开始暂停重置，记录今天完成的番茄数。",
    plan: {
      title: "专注番茄钟",
      goal: "用 25 分钟专注 + 5 分钟休息的节奏管理注意力，并记录当天完成的番茄数量。",
      features: [
        "专注与休息两阶段倒计时，自动流转",
        "开始、暂停、继续、重置和跳过当前阶段",
        "可调整专注时长（1-90 分钟）",
        "统计并持久化当天完成的番茄数",
      ],
      nonGoals: ["不做任务清单管理", "不做跨设备同步"],
      assumptions: ["休息时长固定为 5 分钟"],
      openQuestions: ["需要结束提示音吗？"],
    },
    buildHtml: () =>
      shell(
        "专注番茄钟",
        "25 分钟专注，5 分钟休息，保持节奏",
        `<div class="card">
  <div class="ring"><div class="phase" id="phase">专注</div><div class="clock" id="clock">25:00</div><div class="muted" id="mode">已暂停</div></div>
  <div class="bar"><div id="bar"></div></div>
  <div class="row" style="justify-content:center">
    <button id="start">开始</button>
    <button class="ghost" id="reset">重置</button>
    <button class="ghost" id="skip">跳过</button>
  </div>
</div>
<div class="card">
  <div class="stats">
    <div><span class="muted">今日完成</span><div class="stat" id="sessions">0</div></div>
    <div><span class="muted">专注时长</span><div class="row" style="justify-content:center"><input id="focusMinutes" type="number" min="1" max="90" style="max-width:80px" aria-label="专注时长"><span class="muted">分钟</span></div></div>
    <div><span class="muted">节奏</span><div class="pill" style="margin-top:8px">25 / 5</div></div>
  </div>
</div>`,
        { styles: pomodoroStyles, code: pomodoroScript },
      ),
  },
  {
    id: "habits",
    label: "习惯打卡",
    prompt: "做一个习惯打卡工具，可以添加习惯，每天打卡，显示连续天数和最近 7 天的完成情况。",
    plan: {
      title: "习惯打卡",
      goal: "用最少的操作坚持每日习惯，并直观看到最近一周的完成情况和连续天数。",
      features: [
        "添加与删除习惯",
        "每日打卡与撤销打卡",
        "展示每个习惯的连续打卡天数",
        "用近 7 天进度条展示完成情况，并持久化保存",
      ],
      nonGoals: ["不做提醒推送", "不做社交排行榜"],
      assumptions: ["以浏览器本地日期为打卡基准"],
      openQuestions: ["是否需要按月查看历史？"],
    },
    buildHtml: () =>
      shell(
        "习惯打卡",
        "每天一次打卡，看到坚持的轨迹",
        `<div class="card">
  <div class="row" style="justify-content:space-between">
    <div><span class="muted">今日完成</span><div class="stat" id="today">0/0</div></div>
    <div style="text-align:right"><span class="muted">完成率</span><div class="stat" id="rate">0%</div></div>
  </div>
</div>
<div class="card">
  <form id="form" class="row"><input id="name" placeholder="新习惯，例如：阅读 20 分钟" aria-label="新习惯"><button type="submit">添加</button></form>
</div>
<div class="card"><ul id="list"></ul></div>`,
        { styles: habitStyles, code: habitScript },
      ),
  },
];

export function findDemoRecipe(prompt: string): DemoRecipe {
  const text = prompt.toLowerCase();
  if (/番茄|专注|pomodoro|focus/.test(text)) return DEMO_RECIPES[1];
  if (/习惯|打卡|habit|streak/.test(text)) return DEMO_RECIPES[2];
  if (/记账|账单|收支|预算|expense|budget|ledger|账本/.test(text)) return DEMO_RECIPES[0];
  return DEMO_RECIPES[0];
}

export function buildDemoHtml(recipe: DemoRecipe): string {
  return hardenGeneratedHtml(recipe.buildHtml());
}
