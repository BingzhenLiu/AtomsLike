import type { GenerateRequest, GenerateResponse } from "./contract";
import { hardenGeneratedHtml } from "@/lib/preview/harden-html";

type DemoKind = "expense" | "pomodoro" | "habit";

function identifyKind(value: string): DemoKind | null {
  value = value.toLowerCase();
  if (/记账|expense|收支|预算|balance/.test(value)) return "expense";
  if (/番茄|pomodoro|专注|计时/.test(value)) return "pomodoro";
  if (/习惯|habit|打卡|streak/.test(value)) return "habit";
  return null;
}

function expenseHtml(dark = false, chart = false) {
  const bg = dark ? "#111827" : "#f5f0e8";
  const card = dark ? "#1f2937" : "#fffdf8";
  const text = dark ? "#f8fafc" : "#172033";
  const muted = dark ? "#9ca3af" : "#697386";
  return `<!doctype html>
<html lang="zh-CN" data-demo-kind="expense"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Expense Ledger</title>
<style>*{box-sizing:border-box}body{margin:0;background:${bg};color:${text};font:15px/1.5 system-ui,sans-serif}button,input,select{font:inherit}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #f97316;outline-offset:2px}.shell{max-width:920px;margin:auto;padding:32px 20px}.top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#f97316;font-weight:800}h1{font-size:clamp(30px,5vw,48px);margin:5px 0 8px;letter-spacing:-.045em}.muted{color:${muted}}.balance{text-align:right}.balance strong{display:block;font-size:30px}.grid{display:grid;grid-template-columns:1fr 1.5fr;gap:16px;margin-top:28px}.card{background:${card};border:1px solid ${dark ? "#374151" : "#e8dfd1"};border-radius:18px;padding:20px;box-shadow:0 14px 40px rgba(30,25,20,.06)}label{display:block;font-size:12px;font-weight:750;margin:14px 0 6px}input,select{width:100%;border:1px solid ${dark ? "#4b5563" : "#d9cdbc"};background:${dark ? "#111827" : "#fff"};color:${text};border-radius:10px;padding:11px}button{border:0;border-radius:10px;padding:11px 15px;background:#f97316;color:#fff;font-weight:800;cursor:pointer}.submit{width:100%;margin-top:16px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}.metric{padding:12px;border-radius:12px;background:${dark ? "#111827" : "#f7f2e9"}}.metric span{display:block;color:${muted};font-size:11px;text-transform:uppercase;letter-spacing:.1em}.metric strong{display:block;margin-top:5px;font-size:19px}.entry{display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid ${dark ? "#374151" : "#eee5d9"}}.entry b{display:block}.entry small{color:${muted}}.expense{color:#e11d48}.income{color:#059669}.empty{padding:30px 0;text-align:center;color:${muted}}${chart ? ".chart{display:flex;align-items:flex-end;gap:8px;height:110px;margin:12px 0 22px}.bar{flex:1;background:#f97316;border-radius:7px 7px 2px 2px;min-height:8px;position:relative}.bar span{position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);font-size:10px;color:" + muted + "}" : ""}@media(max-width:700px){.top{display:block}.balance{text-align:left;margin-top:18px}.grid{grid-template-columns:1fr}.summary{grid-template-columns:1fr}}</style></head>
<body><main class="shell"><div class="top"><div><div class="eyebrow">Personal ledger</div><h1>让每一笔钱都有去处。</h1><div class="muted">添加收入或支出，余额会立即更新。</div></div><div class="balance"><span class="muted">当前余额</span><strong id="heroBalance">¥0.00</strong></div></div><section class="grid"><form class="card" id="entryForm"><h2>添加记录</h2><label for="title">项目</label><input id="title" placeholder="午餐、工资…" required><label for="amount">金额</label><input id="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required><label for="type">类型</label><select id="type"><option value="expense">支出</option><option value="income">收入</option></select><label for="category">分类</label><select id="category"><option>餐饮</option><option>交通</option><option>生活</option><option>收入</option></select><button class="submit">保存记录</button></form><div class="card"><div class="summary"><div class="metric"><span>收入</span><strong class="income" id="income">¥0</strong></div><div class="metric"><span>支出</span><strong class="expense" id="expense">¥0</strong></div><div class="metric"><span>记录</span><strong id="count">0</strong></div></div>${chart ? '<div class="chart" aria-label="分类支出图表" id="chart"></div>' : ""}<div id="list"><div class="empty">还没有记录，从左侧添加第一笔。</div></div></div></section></main>
<script>const entries=[];const money=n=>'¥'+n.toFixed(2);const els={form:document.querySelector('#entryForm'),title:document.querySelector('#title'),amount:document.querySelector('#amount'),type:document.querySelector('#type'),category:document.querySelector('#category'),income:document.querySelector('#income'),expense:document.querySelector('#expense'),count:document.querySelector('#count'),balance:document.querySelector('#heroBalance'),list:document.querySelector('#list'),chart:document.querySelector('#chart')};function render(){const inc=entries.filter(x=>x.type==='income').reduce((s,x)=>s+x.amount,0),exp=entries.filter(x=>x.type==='expense').reduce((s,x)=>s+x.amount,0);els.income.textContent=money(inc);els.expense.textContent=money(exp);els.count.textContent=entries.length;els.balance.textContent=money(inc-exp);els.list.innerHTML=entries.length?entries.map(x=>'<div class="entry"><div><b>'+escapeHtml(x.title)+'</b><small>'+x.category+'</small></div><strong class="'+x.type+'">'+(x.type==='income'?'+':'-')+money(x.amount)+'</strong></div>').join(''):'<div class="empty">还没有记录，从左侧添加第一笔。</div>';if(els.chart){const cats=['餐饮','交通','生活'],totals=cats.map(c=>entries.filter(x=>x.type==='expense'&&x.category===c).reduce((s,x)=>s+x.amount,0)),max=Math.max(...totals,1);els.chart.innerHTML=totals.map((n,i)=>'<div class="bar" style="height:'+Math.max(8,n/max*90)+'%" title="'+cats[i]+' '+money(n)+'"><span>'+cats[i]+'</span></div>').join('')}}function escapeHtml(v){const d=document.createElement('div');d.textContent=v;return d.innerHTML}els.form.addEventListener('submit',e=>{e.preventDefault();entries.unshift({title:els.title.value.trim(),amount:Number(els.amount.value),type:els.type.value,category:els.category.value});els.form.reset();render()});render();</script></body></html>`;
}

function pomodoroHtml() {
  return `<!doctype html><html lang="zh-CN" data-demo-kind="pomodoro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Focus Room</title><style>*{box-sizing:border-box}body{margin:0;background:#e8eef4;color:#142033;font:15px system-ui}.wrap{max-width:780px;margin:auto;padding:34px 20px}header{display:flex;justify-content:space-between;align-items:end}h1{font-size:42px;margin:0}.card{background:#fff;border:1px solid #cfd9e5;border-radius:22px;padding:26px;margin-top:22px}.timer{text-align:center;font-size:clamp(64px,15vw,110px);font-weight:800;letter-spacing:-.07em}.actions{display:flex;justify-content:center;gap:10px}button,input{font:inherit;border-radius:10px;padding:11px 15px;border:1px solid #b9c6d5}button{background:#315efb;color:white;border:0;font-weight:750;cursor:pointer}.secondary{background:#e8eef4;color:#20304a}.task-row{display:flex;gap:8px;margin-top:20px}.task-row input{flex:1}.task{padding:12px 0;border-top:1px solid #e2e8f0}.stats{color:#607087}@media(max-width:600px){header{display:block}h1{font-size:34px}.timer{font-size:70px}}</style></head><body><main class="wrap"><header><div><small>FOCUS ROOM</small><h1>一次，只做一件事。</h1></div><div class="stats">完成专注：<b id="sessions">0</b></div></header><section class="card"><div class="timer" id="timer">25:00</div><div class="actions"><button id="toggle">开始</button><button class="secondary" id="reset">重置</button></div><form class="task-row" id="taskForm"><input id="taskInput" placeholder="添加当前任务" aria-label="任务名称" required><button>添加</button></form><div id="tasks"></div></section></main><script>let remaining=1500,running=false,timerId=null,sessions=0;const timer=document.querySelector('#timer'),toggle=document.querySelector('#toggle'),tasks=[];function draw(){const m=String(Math.floor(remaining/60)).padStart(2,'0'),s=String(remaining%60).padStart(2,'0');timer.textContent=m+':'+s;document.querySelector('#sessions').textContent=sessions;document.querySelector('#tasks').innerHTML=tasks.map((x,i)=>'<div class="task"><input type="checkbox" data-i="'+i+'"> '+x+'</div>').join('')}toggle.onclick=()=>{running=!running;toggle.textContent=running?'暂停':'继续';clearInterval(timerId);if(running)timerId=setInterval(()=>{remaining--;if(remaining<=0){sessions++;remaining=1500;running=false;toggle.textContent='开始';clearInterval(timerId)}draw()},1000)};document.querySelector('#reset').onclick=()=>{remaining=1500;running=false;toggle.textContent='开始';clearInterval(timerId);draw()};document.querySelector('#taskForm').onsubmit=e=>{e.preventDefault();tasks.push(document.querySelector('#taskInput').value);e.target.reset();draw()};draw();</script></body></html>`;
}

function habitHtml() {
  return `<!doctype html><html lang="zh-CN" data-demo-kind="habit"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seven</title><style>*{box-sizing:border-box}body{margin:0;background:#f1eee7;color:#20231f;font:15px system-ui}.wrap{max-width:820px;margin:auto;padding:36px 20px}h1{font:700 46px Georgia,serif;margin:5px 0}.lead{color:#6c7069}.card{margin-top:26px;background:#fffefa;border:1px solid #ddd7ca;border-radius:18px;padding:22px}.row{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:16px 0;border-top:1px solid #e9e3d8}.row:first-child{border-top:0}.days{display:flex;gap:7px}.day{width:34px;height:34px;border-radius:50%;border:1px solid #c8c1b4;background:white;cursor:pointer}.day.done{background:#31735b;color:white;border-color:#31735b}.streak{color:#31735b;font-weight:800}@media(max-width:640px){.row{display:block}.days{margin-top:12px}.day{width:31px;height:31px}h1{font-size:38px}}</style></head><body><main class="wrap"><small>WEEKLY PRACTICE</small><h1>把坚持变得可见。</h1><p class="lead">点击日期完成打卡，连续记录会即时更新。</p><section class="card" id="habits"></section></main><script>const data=[{name:'晨间阅读',days:[1,1,1,0,0,0,0]},{name:'散步 30 分钟',days:[1,1,0,0,0,0,0]},{name:'睡前不看手机',days:[1,0,0,0,0,0,0]}],labels=['一','二','三','四','五','六','日'];function streak(days){let n=0;for(const d of days){if(d)n++;else break}return n}function render(){document.querySelector('#habits').innerHTML=data.map((h,i)=>'<div class="row"><div><b>'+h.name+'</b><div class="streak">连续 '+streak(h.days)+' 天</div></div><div class="days">'+h.days.map((d,j)=>'<button class="day '+(d?'done':'')+'" data-i="'+i+'" data-j="'+j+'" aria-label="星期'+labels[j]+' '+(d?'已完成':'未完成')+'">'+labels[j]+'</button>').join('')+'</div></div>').join('');document.querySelectorAll('.day').forEach(b=>b.onclick=()=>{data[b.dataset.i].days[b.dataset.j]=data[b.dataset.i].days[b.dataset.j]?0:1;render()})}render();</script></body></html>`;
}

export function generateDemo(request: GenerateRequest): GenerateResponse | null {
  const promptKind = identifyKind(request.prompt);
  const currentKind = request.currentHtml ? identifyKind(request.currentHtml.slice(0, 600)) : null;
  const supportedExpenseEdit = Boolean(
    request.currentHtml &&
    currentKind === "expense" &&
    /深色|dark|夜间|图表|统计|chart|visual/i.test(request.prompt),
  );
  const kind = promptKind ?? (supportedExpenseEdit ? "expense" : null);
  if (!kind) return null;
  const wantsDark = /深色|dark|夜间/.test(request.prompt.toLowerCase());
  const wantsChart = /图表|统计|chart|visual/.test(request.prompt.toLowerCase());
  const isEdit = Boolean(request.currentHtml);

  if (kind === "expense") {
    return {
      projectName: "个人记账本",
      summary: isEdit
        ? `已更新记账应用${wantsDark ? "，切换为深色界面" : ""}${wantsChart ? "并加入分类支出图表" : ""}。`
        : "已创建可添加收支记录并实时计算余额的个人记账应用。",
      html: hardenGeneratedHtml(expenseHtml(wantsDark, wantsChart)),
      mode: "demo",
    };
  }
  if (kind === "pomodoro") {
    return {
      projectName: "专注番茄钟",
      summary: "已创建带任务列表、开始/暂停/重置和完成次数统计的番茄钟。",
      html: hardenGeneratedHtml(pomodoroHtml()),
      mode: "demo",
    };
  }
  return {
    projectName: "每周习惯打卡",
    summary: "已创建支持每日打卡、连续天数和一周进度的习惯追踪器。",
    html: hardenGeneratedHtml(habitHtml()),
    mode: "demo",
  };
}
