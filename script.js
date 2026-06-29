/* ===========================
   HomeBoard — script.js
=========================== */

// ===========================
// 祝日データ（holidays-jp API）
// ===========================
// https://holidays-jp.github.io/api/v1/{year}/date.json
// → { "2026-01-01": "元日", ... }

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
// 時計
// ===========================

function updateClock() {
  const now = new Date();
  const h = pad(now.getHours());
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  document.getElementById('clock-hm').textContent = `${h}:${m}`;
  document.getElementById('clock-s').textContent  = `${s}`;
}

// ===========================
// カレンダー
// ===========================

const MONTHS_JP = ['1月','2月','3月','4月','5月','6月',
                   '7月','8月','9月','10月','11月','12月'];
const DAYS_JP   = ['日','月','火','水','木','金','土'];

function buildCalendar() {
  const now    = new Date();
  const y      = now.getFullYear();
  const mo     = now.getMonth();
  const today  = now.getDate();

  // ヘッダー
  document.getElementById('cal-year-month').textContent =
    `${y}年 ${MONTHS_JP[mo]}`;

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  // 曜日ヘッダー
  DAYS_JP.forEach(d => {
    const el = document.createElement('div');
    el.className = 'dow';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDow    = new Date(y, mo, 1).getDay();
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const prevLastDay = new Date(y, mo, 0).getDate();

  // 常に6週（42マス）固定
  for (let i = 0; i < 42; i++) {
    const el  = document.createElement('div');
    const dow = i % 7;

    if (i < firstDow) {
      // 前月
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
      // 当月
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
      // 翌月
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
// 予定（ダミーデータ）
// Phase3でTimeTree/Google Calendar連携予定
// ===========================

const DUMMY_SCHEDULE = {
  allday: [
    '○○の誕生日',
    '△△提出期限',
  ],
  timed: [
    { time: '18:30', title: 'ピアノ' },
    { time: '20:00', title: 'オンラインMTG' },
  ],
};

function buildSchedule() {
  const now = new Date();
  const key = holidayKey(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const alldayList = document.getElementById('allday-list');
  alldayList.innerHTML = '';

  // 今日が祝日なら先頭に表示
  if (HOLIDAYS[key]) {
    const el = document.createElement('div');
    el.className   = 'allday-item';
    el.textContent = HOLIDAYS[key];
    alldayList.appendChild(el);
  }

  DUMMY_SCHEDULE.allday.forEach(text => {
    const el = document.createElement('div');
    el.className = 'allday-item';
    el.textContent = text;
    alldayList.appendChild(el);
  });

  const timedList = document.getElementById('timed-list');
  timedList.innerHTML = '';
  DUMMY_SCHEDULE.timed.forEach(item => {
    const el = document.createElement('div');
    el.className = 'timed-item';
    el.innerHTML = `
      <span class="timed-time">${item.time}</span>
      <span class="timed-title">${item.title}</span>
    `;
    timedList.appendChild(el);
  });
}

// ===========================
// 天気（Open-Meteo API）
// ===========================

// アイコンは ︎（テキスト表示セレクタ）でモノクロ強制
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

// 位置情報が取れない場合のフォールバック（東京）
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
    const url = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${latitude}&longitude=${longitude}`
      + '&current=temperature_2m,weather_code'
      + '&hourly=temperature_2m,weather_code,precipitation_probability'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
      + '&timezone=Asia%2FTokyo&forecast_days=2';

    const res  = await fetch(url);
    const data = await res.json();

    // 今日（現在のコード）
    const curW         = WMO_WEATHER[data.current.weather_code] ?? { label: '不明', icon: '？' };
    const todayMax     = Math.round(data.daily.temperature_2m_max[0]);
    const todayMin     = Math.round(data.daily.temperature_2m_min[0]);
    const todayPrecip  = data.daily.precipitation_probability_max[0] ?? '--';

    // 明日（日次サマリコード）
    const tmrW      = WMO_WEATHER[data.daily.weather_code[1]] ?? { label: '不明', icon: '？' };
    const tmrMax    = Math.round(data.daily.temperature_2m_max[1]);
    const tmrMin    = Math.round(data.daily.temperature_2m_min[1]);
    const tmrPrecip = data.daily.precipitation_probability_max[1] ?? '--';

    // 日付ラベル
    const now     = new Date();
    const tmr     = new Date(now);
    tmr.setDate(tmr.getDate() + 1);
    const fmtDate = d => `${d.getMonth() + 1}/${d.getDate()}(${DAYS_JP[d.getDay()]})`;

    // 今日のUI
    document.getElementById('today-label').textContent    = `今日`;
    document.getElementById('weather-icon').textContent   = curW.icon;
    document.getElementById('weather-label').textContent  = curW.label;
    document.getElementById('weather-precip').textContent = `${todayPrecip}%`;
    document.getElementById('weather-minmax').textContent = `↑${todayMax}° ↓${todayMin}°`;

    // 明日のUI
    document.getElementById('tomorrow-label').textContent      = `明日`;
    document.getElementById('weather-icon-tmr').textContent   = tmrW.icon;
    document.getElementById('weather-label-tmr').textContent  = tmrW.label;
    document.getElementById('weather-precip-tmr').textContent = `${tmrPrecip}%`;
    document.getElementById('weather-minmax-tmr').textContent = `↑${tmrMax}° ↓${tmrMin}°`;

    buildHourlyForecast(data);

    const updatedAt = new Date();
    document.getElementById('weather-updated').textContent =
      `${pad(updatedAt.getHours())}:${pad(updatedAt.getMinutes())} 更新`;
  } catch (e) {
    console.warn('天気データ取得失敗:', e);
  }
}

function buildHourlyForecast(data) {
  const now       = new Date();
  const todayStr  = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const currentHr = now.getHours();

  const times   = data.hourly.time;
  const temps   = data.hourly.temperature_2m;
  const codes   = data.hourly.weather_code;
  const precips = data.hourly.precipitation_probability;

  const startIdx = times.findIndex(t => t === `${todayStr}T${pad(currentHr)}:00`);
  if (startIdx === -1) return;

  const grid = document.getElementById('hourly-grid');
  grid.innerHTML = '';

  const count = Math.min(7, times.length - startIdx);
  for (let i = startIdx; i < startIdx + count; i++) {
    const hour   = parseInt(times[i].slice(11, 13));
    const temp   = Math.round(temps[i]);
    const w      = WMO_WEATHER[codes[i]] ?? { icon: '？' };
    const precip = precips[i] ?? '--';

    [
      ['h-time',   `${hour}時`],
      ['h-icon',   w.icon],
      ['h-temp',   `${temp}°`],
      ['h-precip', `${precip}%`],
    ].forEach(([cls, text]) => {
      const el = document.createElement('div');
      el.className   = cls;
      el.textContent = text;
      grid.appendChild(el);
    });
  }
}

// ===========================
// 初期化 & 定期更新
// ===========================

async function init() {
  const now = new Date();
  const y   = now.getFullYear();

  // 当年・翌年の祝日を取得
  await fetchHolidays(y);
  await fetchHolidays(y + 1);

  updateClock();
  buildCalendar();
  buildSchedule();
  await updateWeather();

  // 1秒ごとに時計更新
  setInterval(updateClock, 1000);

  // 毎時0分にカレンダー・祝日・予定を再構築（日付またぎ対応）
  setInterval(() => {
    const t = new Date();
    if (t.getMinutes() === 0) {
      fetchHolidays(t.getFullYear()).then(buildCalendar);
      buildSchedule();
    }
  }, 60 * 1000);

  // 30分ごとに天気更新
  setInterval(updateWeather, 30 * 60 * 1000);
}

init();
