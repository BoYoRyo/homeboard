# HomeBoard

家族向け情報ダッシュボード。リビングの縦型モニター向け。

## フェーズ

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | 時計・日付・月間カレンダー・祝日 | ✅ 実装済み |
| 2 | 天気（Open-Meteo） | ✅ 実装済み |
| 3 | 家族予定（TimeTree 連携） | ✅ 実装済み |

## 画面構成

```
┌─────────────────┐
│      時計        │  時・分を縦に大きく表示
│      日付        │
│   天気（今日）   │  天気・降水確率・現在気温・最高/最低
│  月間カレンダー  │  6週固定・祝日チップ
│  終日 | 時刻別   │  ← TimeTree 今日の予定
└─────────────────┘
```

## 技術スタック

- フロントエンド: 素の HTML / CSS / JS（フレームワークなし）
- 祝日: [holidays-jp](https://holidays-jp.github.io/api/v1/)（無料・APIキー不要）
- 天気: [Open-Meteo](https://api.open-meteo.com/)（無料・APIキー不要）
- 予定: TimeTree 内部 API（非公式・ローカルプロキシ経由）
- ホスティング: Vercel（静的 + サーバーレス関数）

## ローカルで動かす

### 1. 環境変数を設定

`~/.bashrc` に追記（ファイルには書かない）:

```bash
export TIMETREE_EMAIL="your@email.com"
export TIMETREE_PASSWORD="your-password"
export TIMETREE_CALENDAR="カレンダー名"
```

```bash
source ~/.bashrc
```

### 2. プロキシを起動

```bash
python3 proxy.py
```

`http://localhost:3001/events` で今日の予定を JSON で返す。

### 3. ページを開く

```bash
python3 -m http.server 8080
# → http://localhost:8080 を開く
```

または VSCode の Live Server 拡張でも可。

> `file://` で直接開くと `localhost:3001` に接続できないブラウザがあるため、ローカルサーバー推奨。

## Vercel へのデプロイ

### 1. 環境変数をダッシュボードで設定

Vercel ダッシュボード → プロジェクト → **Settings → Environment Variables**:

| 変数名 | 値 |
|---|---|
| `TIMETREE_EMAIL` | TimeTree のメールアドレス |
| `TIMETREE_PASSWORD` | TimeTree のパスワード |
| `TIMETREE_CALENDAR` | カレンダー名（部分一致） |

### 2. デプロイ

```bash
vercel deploy
```

`/api/events` のサーバーレス関数が自動で有効になる。

### セッション管理

TimeTree へのログインは **1 日 1 回**（日付ベースでキャッシュ）。
- ローカル: `session_cache.json`（gitignore 済み）
- Vercel: `/tmp/timetree_session.json`（関数コンテナ内）

毎日 0 時に `buildSchedule()` が呼ばれ、その最初のリクエストで再ログインする。

## デザイン方針

- 白黒（電子ペーパー対応）
- 今日：黒塗り・文字は背景色
- 土日・祝日：枠線で区別（色なし）
- フォントサイズは `clamp()` でレスポンシブ対応

## 注意事項

TimeTree の内部 API（非公式）を使用しているため、仕様変更により動作しなくなる可能性があります。
