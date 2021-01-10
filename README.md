# p2p_sns
p2p_snsを作ってみる

## ToDo
 - SkyWayセットアップ
 - ２点間で通信
   - URLパラメータに接続先IDがなければ自分のIDを表示
   - URLパラメータに接続先があればそこに接続
   - BからAに接続があったらメッセージを送る
   - AからBにメッセージが来たら表示
 - AWSに上げる
 - 認証
   - 鍵ペアを生成
   - 公開鍵のDigestをIndexedDBに入れる
   - AがBに接続があったら公開鍵と「公開鍵＋セッションID＋プロフィール」暗号鍵で暗号化したものを送る
   - BはAの公開鍵を検証しBもAに公開鍵を送る
 - AからBに接続情報を送る
 - 何かつぶやくときは全員に
 - プロフィール更新も全員に
 - 動画で通信できる
 - 送信先を指定できる
 - ブロック機能
   - 一次 
   - 永続
 - 顔写真
 