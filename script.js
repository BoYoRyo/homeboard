/* ===========================
   HomeBoard — script.js
=========================== */

// ===========================
// 祝日データ（holidays-jp API）
// ===========================

let HOLIDAYS = {};

async function fetchHolidays(year) {
  try {
    const res = await fetch(`https://holidays-jp.github.io/api/v1/${year}/date.json`);
    const data = await res.json();
    Object.assign(HOLIDAYS, data);
  } catch (e) {
    console.warn('祝日データ取得失敗:', e);
  }
}

// ===========================
// ユーティリティ
// ===========================

function pad(n) {
  return String(n).padStart(2, '0');
}

function holidayKey(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

// ===========================
// 時計（時・分を縦表示）
// ===========================

function updateClock() {
  const now = new Date();
  document.getElementById('clock-h').textContent = pad(now.getHours());
  document.getElementById('clock-m').textContent = pad(now.getMinutes());
}

// ===========================
// 日付
// ===========================

const DAYS_JP = ['日','月','火','水','木','金','土'];

function updateDate() {
  const now = new Date();
  const m   = now.getMonth() + 1;
  const d   = now.getDate();
  const dow = DAYS_JP[now.getDay()];
  document.getElementById('date-display').textContent = `${m}月${d}日 (${dow})`;
}

// ===========================
// カレンダー
// ===========================

const MONTHS_JP = ['1月','2月','3月','4月','5月','6月',
                   '7月','8月','9月','10月','11月','12月'];

function buildCalendar() {
  const now    = new Date();
  const y      = now.getFullYear();
  const mo     = now.getMonth();
  const today  = now.getDate();

  document.getElementById('cal-year-month').textContent = `${y}年 ${MONTHS_JP[mo]}`;

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  DAYS_JP.forEach(d => {
    const el = document.createElement('div');
    el.className = 'dow';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDow    = new Date(y, mo, 1).getDay();
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const prevLastDay = new Date(y, mo, 0).getDate();

  for (let i = 0; i < 42; i++) {
    const el  = document.createElement('div');
    const dow = i % 7;

    if (i < firstDow) {
      const d      = prevLastDay - firstDow + 1 + i;
      const prevY  = mo === 0 ? y - 1 : y;
      const prevMo = mo === 0 ? 12 : mo;
      const key       = holidayKey(prevY, prevMo, d);
      const isHoliday = !!HOLIDAYS[key];
      const isWeekend = dow === 0 || dow === 6;
      const classes   = ['day', 'other-month'];
      if (isHoliday)      classes.push('holiday');
      else if (isWeekend) classes.push('weekend');
      el.className   = classes.join(' ');
      el.textContent = d;
    } else if (i < firstDow + daysInMonth) {
      const d         = i - firstDow + 1;
      const key       = holidayKey(y, mo + 1, d);
      const isHoliday = !!HOLIDAYS[key];
      const isWeekend = dow === 0 || dow === 6;
      const isToday   = d === today;
      const classes = ['day'];
      if (isToday)        classes.push('today');
      if (isHoliday)      classes.push('holiday');
      else if (isWeekend) classes.push('weekend');
      el.className   = classes.join(' ');
      el.textContent = d;
    } else {
      const d      = i - firstDow - daysInMonth + 1;
      const nextY  = mo === 11 ? y + 1 : y;
      const nextMo = mo === 11 ? 1 : mo + 2;
      const key       = holidayKey(nextY, nextMo, d);
      const isHoliday = !!HOLIDAYS[key];
      const isWeekend = dow === 0 || dow === 6;
      const classes   = ['day', 'other-month'];
      if (isHoliday)      classes.push('holiday');
      else if (isWeekend) classes.push('weekend');
      el.className   = classes.join(' ');
      el.textContent = d;
    }

    grid.appendChild(el);
  }

  buildHolidayList();
}

// ===========================
// 今月の祝日リスト
// ===========================

function buildHolidayList() {
  const now      = new Date();
  const y        = now.getFullYear();
  const mo       = now.getMonth() + 1;
  const monthStr = `${y}-${pad(mo)}`;

  const list = document.getElementById('cal-holiday-list');
  list.innerHTML = '';

  const entries = Object.entries(HOLIDAYS)
    .filter(([key]) => key.startsWith(monthStr))
    .sort(([a], [b]) => a.localeCompare(b));

  entries.forEach(([key, name]) => {
    const d  = parseInt(key.split('-')[2]);
    const el = document.createElement('span');
    el.className   = 'holiday-chip';
    el.textContent = `${d}日 ${name}`;
    list.appendChild(el);
  });
}

// ===========================
// 予定（TimeTree プロキシ連携）
// proxy.py を起動した状態で使用する
// ===========================

// ローカル(file:// or localhost) → proxy.py、それ以外(Vercel等) → /api/events
const PROXY_URL = (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3001/events'
  : '/api/events';

function renderSchedule(allday, timed) {
  const now = new Date();
  const key = holidayKey(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const alldayList = document.getElementById('allday-list');
  alldayList.innerHTML = '';

  if (HOLIDAYS[key]) {
    const el = document.createElement('div');
    el.className   = 'allday-item';
    el.textContent = HOLIDAYS[key];
    alldayList.appendChild(el);
  }

  allday.forEach(text => {
    const el = document.createElement('div');
    el.className   = 'allday-item';
    el.textContent = text;
    alldayList.appendChild(el);
  });

  const timedList = document.getElementById('timed-list');
  timedList.innerHTML = '';
  timed.forEach(item => {
    const el = document.createElement('div');
    el.className = 'timed-item';
    el.innerHTML = `<span class="timed-time">${item.time}</span><span class="timed-title">${item.title}</span>`;
    timedList.appendChild(el);
  });
}

async function buildSchedule() {
  renderSchedule([], []);  // 祝日のみ即時表示
  try {
    const res = await fetch(PROXY_URL);
    if (!res.ok) {
      console.warn('TimeTree API エラー:', res.status, await res.text());
      return;
    }
    const data = await res.json();
    renderSchedule(data.allday || [], data.timed || []);
  } catch (e) {
    console.warn('TimeTree プロキシ未接続:', e);
  }
}

// ===========================
// 天気（Open-Meteo API）
// 現在気温 + 今日の daily のみ取得
// ===========================

const WMO_WEATHER = {
  0:  { label: '快晴',           icon: '☀︎' },
  1:  { label: '晴れ',           icon: '☀︎' },
  2:  { label: '晴れ時々曇り',   icon: '⛅︎' },
  3:  { label: '曇り',           icon: '☁︎' },
  45: { label: '霧',             icon: '☁︎' },
  48: { label: '霧',             icon: '☁︎' },
  51: { label: '小雨',           icon: '☂︎' },
  53: { label: '小雨',           icon: '☂︎' },
  55: { label: '小雨',           icon: '☂︎' },
  61: { label: '雨',             icon: '☂︎' },
  63: { label: '雨',             icon: '☂︎' },
  65: { label: '大雨',           icon: '☂︎' },
  71: { label: '雪',             icon: '❄︎' },
  73: { label: '雪',             icon: '❄︎' },
  75: { label: '大雪',           icon: '❄︎' },
  77: { label: '霰',             icon: '❄︎' },
  80: { label: 'にわか雨',       icon: '☂︎' },
  81: { label: 'にわか雨',       icon: '☂︎' },
  82: { label: '激しいにわか雨', icon: '☂︎' },
  85: { label: 'にわか雪',       icon: '❄︎' },
  86: { label: 'にわか雪',       icon: '❄︎' },
  95: { label: '雷雨',           icon: '⚡︎' },
  96: { label: '雷雨（雹）',     icon: '⚡︎' },
  99: { label: '雷雨（雹）',     icon: '⚡︎' },
};

const DEFAULT_LOCATION = { latitude: 35.6762, longitude: 139.6503 };

function getLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(DEFAULT_LOCATION); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      ()  => resolve(DEFAULT_LOCATION),
      { timeout: 5000 }
    );
  });
}

async function updateWeather() {
  try {
    const { latitude, longitude } = await getLocation();
    // current: 現在気温のみ / daily: 今日1日分のみ
    const url = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${latitude}&longitude=${longitude}`
      + '&current=temperature_2m'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
      + '&timezone=Asia%2FTokyo&forecast_days=1';

    const res  = await fetch(url);
    const data = await res.json();

    const w           = WMO_WEATHER[data.daily.weather_code[0]] ?? { label: '不明', icon: '？' };
    const currentTemp = Math.round(data.current.temperature_2m);
    const max         = Math.round(data.daily.temperature_2m_max[0]);
    const min         = Math.round(data.daily.temperature_2m_min[0]);
    const precip      = data.daily.precipitation_probability_max[0] ?? '--';

    document.getElementById('weather-icon').textContent         = w.icon;
    document.getElementById('weather-label').textContent        = w.label;
    document.getElementById('weather-precip').textContent       = `${precip}%`;
    document.getElementById('weather-current-temp').textContent = `${currentTemp}°`;
    document.getElementById('weather-max').textContent          = `↑${max}°`;
    document.getElementById('weather-min').textContent          = `↓${min}°`;
  } catch (e) {
    console.warn('天気データ取得失敗:', e);
  }
}

// ===========================
// 初期化 & 定期更新
// ===========================

async function init() {
  const now = new Date();
  const y   = now.getFullYear();

  await fetchHolidays(y);
  await fetchHolidays(y + 1);

  updateClock();
  updateDate();
  buildCalendar();
  await buildSchedule();
  await updateWeather();

  // 1秒ごとに時計更新（秒は非表示だが正確な分変わりのため）
  setInterval(updateClock, 1000);

  // 毎時0分にカレンダー・日付・予定を再構築（日付またぎ対応）
  setInterval(() => {
    const t = new Date();
    if (t.getMinutes() === 0) {
      updateDate();
      fetchHolidays(t.getFullYear()).then(buildCalendar);
      buildSchedule();
    }
  }, 60 * 1000);

  // 30分ごとに天気・予定を更新
  setInterval(updateWeather, 30 * 60 * 1000);
  setInterval(buildSchedule, 30 * 60 * 1000);
}

init();
