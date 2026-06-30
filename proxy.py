#!/usr/bin/env python3
"""TimeTree → HomeBoard ローカルプロキシ

使い方:
  ~/.bashrc に以下を追加してから source ~/.bashrc を実行:
    export TIMETREE_EMAIL="your@email.com"
    export TIMETREE_PASSWORD="your-password"
    export TIMETREE_CALENDAR="カレンダー名"

  python3 proxy.py       # localhost:3001 で起動

エンドポイント:
  GET /events  → 今日の予定を JSON で返す
"""

import json
import os
import time
import uuid
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, date, timezone
from pathlib import Path

# ── 環境変数から読み込み（ファイルには保存しない）─────────

EMAIL    = os.environ.get('TIMETREE_EMAIL', '')
PASSWORD = os.environ.get('TIMETREE_PASSWORD', '')
CAL_NAME = os.environ.get('TIMETREE_CALENDAR', '')

if not all([EMAIL, PASSWORD, CAL_NAME]):
    raise SystemExit(
        '環境変数が未設定です。~/.bashrc に以下を追加してください:\n'
        '  export TIMETREE_EMAIL="your@email.com"\n'
        '  export TIMETREE_PASSWORD="your-password"\n'
        '  export TIMETREE_CALENDAR="カレンダー名"\n'
        'その後: source ~/.bashrc'
    )

# ── 定数 ──────────────────────────────────────────────────

BASE       = 'https://timetreeapp.com/api/v1'
UA         = 'web/2.1.0/en'
CACHE_FILE = Path(__file__).parent / 'session_cache.json'
PORT       = 3001

# レスポンスの in-memory キャッシュ（5分）
_cache: dict = {'data': None, 'at': 0}
CACHE_TTL = 5 * 60

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

# ── 認証 & セッションキャッシュ ──────────────────────────

def login():
    print('[proxy] TimeTree にログイン中...')
    _, ck = api('/auth/email/signin', 'PUT', {
        'uid': EMAIL,
        'password': PASSWORD,
        'uuid': uuid.uuid4().hex,
    })
    sid = ck.get('_session_id', '')
    if not sid:
        raise RuntimeError('ログイン失敗: セッションIDが取得できません。メールとパスワードを確認してください')
    CACHE_FILE.write_text(json.dumps({
        'session_id': sid,
        'date': date.today().isoformat(),
    }))
    print('[proxy] ログイン成功')
    return sid

def get_session():
    today = date.today().isoformat()
    if CACHE_FILE.exists():
        try:
            cached = json.loads(CACHE_FILE.read_text())
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

def to_datetime(ts):
    """タイムスタンプ（秒 or ミリ秒）を datetime に変換"""
    if ts > 1e11:  # ミリ秒
        ts /= 1000
    return datetime.fromtimestamp(ts, tz=timezone.utc).astimezone()

def fetch_today():
    """今日の予定を取得して {"allday": [...], "timed": [...]} で返す"""
    now = time.time()
    if _cache['data'] and now - _cache['at'] < CACHE_TTL:
        return _cache['data']

    sid = get_session()

    # カレンダー一覧
    data, _ = api('/calendars?since=0', session_id=sid)
    calendars = data.get('calendars', [])

    target = next((c for c in calendars if CAL_NAME in c.get('name', '')), None)
    if not target:
        names = [c.get('name', '') for c in calendars]
        raise RuntimeError(f'カレンダー "{CAL_NAME}" が見つかりません。利用可能: {names}')

    cal_id = target.get('id') or target.get('uuid') or target.get('token')
    print(f'[proxy] カレンダー: {target.get("name")} (id={cal_id})')

    # 予定取得（since=0 で全件、件数が多い場合は要調整）
    events_data, _ = api(f'/calendar/{cal_id}/events/sync?since=0', session_id=sid)
    events = events_data.get('events', [])
    print(f'[proxy] 取得イベント数: {len(events)}')

    today_str = date.today().isoformat()
    allday, timed = [], []

    for ev in events:
        raw = ev.get('start_at', 0)
        if not raw:
            continue
        dt = to_datetime(raw)
        if dt.date().isoformat() != today_str:
            continue
        title = ev.get('title') or '(無題)'
        if ev.get('all_day'):
            allday.append(title)
        else:
            timed.append({'time': dt.strftime('%H:%M'), 'title': title})

    timed.sort(key=lambda x: x['time'])
    result = {'allday': allday, 'timed': timed}

    _cache['data'] = result
    _cache['at']   = now
    return result

# ── HTTP サーバー ─────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/events':
            self.send_response(404)
            self.end_headers()
            return
        try:
            payload = json.dumps(fetch_today(), ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(payload)
        except Exception as e:
            print(f'[proxy] エラー: {e}')
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(str(e).encode())

    def log_message(self, fmt, *args):
        pass  # アクセスログは省略

if __name__ == '__main__':
    print(f'[proxy] http://localhost:{PORT}/events で起動')
    print(f'[proxy] カレンダー: {CAL_NAME}')
    HTTPServer(('', PORT), Handler).serve_forever()
