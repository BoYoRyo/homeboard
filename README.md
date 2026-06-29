# HomeBoard

家族向け情報ダッシュボード。リビングの10インチ縦型モニター向け。

## フェーズ

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | 時計・カレンダー・祝日 | ✅ 実装済み |
| 2 | 天気 | 🔜 TODO |
| 3 | 家族予定 | 🔜 TODO |

## ローカル確認

VSCode の Live Server 拡張機能で `index.html` を開く。
または以下でシンプルなサーバーを立てる：

```bash
# Python がある場合
python3 -m http.server 8080

# Node.js がある場合
npx serve .
```

## デプロイ

GitHub → Vercel（静的ホスティング）

## 技術メモ

- 祝日: https://holidays-jp.github.io/api/v1/{year}/date.json
- 天気（予定）: https://api.open-meteo.com/v1/forecast（無料・APIキー不要）
- カレンダー連携（予定）: TimeTree または Google Calendar API

## デザイン方針

- 白黒（電子ペーパー対応）
- 今日：黒塗り・文字は背景色
- 土日・祝日：枠線で区別（色なし）
