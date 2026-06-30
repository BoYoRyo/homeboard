"""Vercel サーバーレス関数 — TimeTree 今日の予定を返す

セッションは /tmp に日付付きでキャッシュ。
日付が変わった最初のリクエスト（＝ 0時の buildSchedule）で自動再ログイン。

Vercel 環境変数（ダッシュボードで設定）:
  TIMETREE_EMAIL
  TIMETREE_PASSWORD
  TIMETREE_CALENDAR
"""

import json
import os
import uuid
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler
from datetime import datetime, date, timezone
from pathlib import Path

BASE        = 'https://timetreeapp.com/api/v1'
UA          = 'web/2.1.0/en'
SESSION_TMP = Path('/tmp/timetree_session.json')

EMAIL    = os.environ.get('TIMETREE_EMAIL', '')
PASSWORD = os.environ.get('TIMETREE_PASSWORD', '')
CAL_NAME = os.environ.get('TIMETREE_CALENDAR', '')

# ── API ヘルパー ───────────────────────────────────────────

def api(path, method='GET', body=None, session_id=None):
    req = urllib.request.Request(f'{BASE}{path}', method=method)
    req.add_header('Content-Type', 'application/json')
    req.add_header('X-Timetreea', UA)
    if session_id:
        req.add_header('Cookie', f'_session_id={session_id}')
    if body:
        req.data = json.dumps(body).encode()
    with urllib.request.urlopen(req, timeout=10) as res:
        cookies = {}
        for h in (res.headers.get_all('Set-Cookie') or []):
            if '_session_id=' in h:
                cookies['_session_id'] = h.split('_session_id=')[1].split(';')[0]
        return json.loads(res.read()), cookies

# ── 認証（1日1回、日付ベースキャッシュ）─────────────────

def login():
    _, ck = api('/auth/email/signin', 'PUT', {
        'uid': EMAIL, 'password': PASSWORD, 'uuid': uuid.uuid4().hex,
    })
    sid = ck.get('_session_id', '')
    if not sid:
        raise RuntimeError('TimeTree ログイン失敗（メール/パスワードを確認してください）')
    SESSION_TMP.write_text(json.dumps({
        'session_id': sid,
        'date': date.today().isoformat(),
    }))
    return sid

def get_session():
    today = date.today().isoformat()
    if SESSION_TMP.exists():
        try:
            cached = json.loads(SESSION_TMP.read_text())
            # 同じ日のセッションがあれば使い回す
            if cached.get('date') == today:
                sid = cached.get('session_id', '')
                try:
                    api('/calendars?since=0', session_id=sid)
                    return sid
                except urllib.error.HTTPError as e:
                    if e.code not in (401, 403):
                        raise
        except Exception:
            pass
    # 日付が変わった or セッション切れ → 再ログイン
    return login()

# ── 予定取得 ──────────────────────────────────────────────

def to_dt(ts):
    if ts > 1e11:
        ts /= 1000
    return datetime.fromtimestamp(ts, tz=timezone.utc).astimezone()

def fetch_today():
    if not all([EMAIL, PASSWORD, CAL_NAME]):
        raise RuntimeError('環境変数 TIMETREE_EMAIL / PASSWORD / CALENDAR が未設定です')

    sid = get_session()

    data, _ = api('/calendars?since=0', session_id=sid)
    calendars = data.get('calendars', [])
    target = next((c for c in calendars if CAL_NAME in c.get('name', '')), None)
    if not target:
        names = [c.get('name') for c in calendars]
        raise RuntimeError(f'カレンダー "{CAL_NAME}" が見つかりません。利用可能: {names}')

    cal_id = target.get('id') or target.get('uuid') or target.get('token')

    events_data, _ = api(f'/calendar/{cal_id}/events/sync?since=0', session_id=sid)
    events = events_data.get('events', [])

    today_str = date.today().isoformat()
    allday, timed = [], []
    for ev in events:
        raw = ev.get('start_at', 0)
        if not raw:
            continue
        dt = to_dt(raw)
        if dt.date().isoformat() != today_str:
            continue
        title = ev.get('title') or '(無題)'
        if ev.get('all_day'):
            allday.append(title)
        else:
            timed.append({'time': dt.strftime('%H:%M'), 'title': title})

    timed.sort(key=lambda x: x['time'])
    return {'allday': allday, 'timed': timed}

# ── Vercel ハンドラ ────────────────────────────────────────

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            payload = json.dumps(fetch_today(), ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(payload)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(str(e).encode())

    def log_message(self, fmt, *args):
        pass
