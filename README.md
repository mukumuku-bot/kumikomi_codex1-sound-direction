# 組み込みデモ一覧

GitHub Pagesで公開するための整理済みフォルダです。

## ページ構成

- `index.html`
  - 入口ページです。
  - 2つのデモページへ移動するボタンを置いています。
- `person-detection/`
  - 人物中心ズレ検知です。
  - スマホのカメラで人物を検知し、画面中央からのズレに合わせて目が追従します。
- `sound-transcription/`
  - 音源方向推定と文字起こしです。
  - マイク入力の左右差から方向を推定し、同じ画面で文字起こしもできます。

## GitHub PagesのURL

同じリポジトリで公開しても、次のようにURLが分かれます。

```text
https://ユーザー名.github.io/リポジトリ名/
https://ユーザー名.github.io/リポジトリ名/person-detection/
https://ユーザー名.github.io/リポジトリ名/sound-transcription/
```

入口ページからボタンで移動できるので、公開URLを1つだけ共有しても2つの機能を選べます。

## ローカル確認

```powershell
python -m http.server 8000
```

PCで開く場合:

```text
http://localhost:8000
```

スマホで確認する場合は、PCとスマホを同じネットワークに接続し、PCのIPアドレスを使ってアクセスします。

```text
http://PCのIPアドレス:8000
```

カメラやマイクは、ブラウザの仕様により `localhost` または HTTPS のページで安定して動作します。GitHub PagesはHTTPSなので公開後の確認に向いています。
