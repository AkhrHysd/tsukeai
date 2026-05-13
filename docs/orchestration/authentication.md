# Authentication Decision

## Status

Accepted for MVP implementation.

## Context

Design では、GT の閲覧は未ログインでも可能、投稿・返信・本人削除はログイン必須とする。認証は無料枠・低固定費を優先し、SMS のような従量課金や電話番号依存の要素には依存しない。

`tc.authgate` は、実装前にパスワード／パスキー／TOTP の組み合わせを確定するためのゲートである。

## Decision

MVP の認証方式は次の組み合わせとする。

- **パスワード**: 初期登録・ログインの基本方式として採用する。
- **パスキー（WebAuthn）**: 追加ログイン方式として採用する。対応端末ではパスワードレスに近い導線を目指すが、MVP ではパスワードを完全には廃止しない。
- **TOTP**: 2FA として採用する。投稿・返信・本人削除を行うアカウントの保護強化に使う。
- **SMS**: 採用しない。ログイン、2FA、復旧のいずれも SMS 従量課金に依存しない。

実装上の初期方針は **パスワード + 任意のパスキー + 任意の TOTP** とする。将来、利用者が増えた段階で TOTP の必須化やパスキー優先への変更を検討できるが、MVP では登録離脱と実装量を抑えるため任意設定に留める。

## Passkey Spike

`@simplewebauthn/server` は Web Crypto を前提にした実装を持ち、Cloudflare Workers 上でも `globalThis.crypto` を使う構成で利用できる見込みがある。MVP のスパイク結果としては **採用候補** とし、実装タスクでは Workers の `nodejs_compat` に頼りすぎず、Web Crypto と `Uint8Array` 前提で登録・認証の検証を組む。

ただし、MVP ではパスキーを唯一の認証手段にはしない。端末・ブラウザ・復旧導線の差を吸収するため、パスワードを基本方式として残し、パスキーは任意の追加ログイン方式にする。もし Workers runtime またはライブラリ更新で問題が出る場合は、同じ WebAuthn データモデルを維持しつつ、検証処理だけを API 側の薄い別実装へ置き換える方針とする。

## RP, Cookie, and CORS

- **RP ID**: 本番公開ホストの eTLD+1 を使う。API と Web を分割ドメインにする場合でも、WebAuthn の ceremony は利用者が見る Web 側 origin を基準に設計する。
- **公開 URL**: `NEXT_PUBLIC_API_BASE_URL` などで Web から API を参照する場合、登録・認証 ceremony の `origin` 検証は Web の公開 URL と一致させる。
- **Cookie ドメイン**: API と Web を同一サイト配下に置ける場合は `__Host-` prefix、`Secure`、`HttpOnly`、`SameSite=Lax` を基本とする。サブドメインをまたぐ必要がある場合は `__Host-` を使えないため、Domain 属性の採用可否を実装タスクで明示する。
- **CORS**: credentials 付き request を許可する origin は明示リストに限定する。`Access-Control-Allow-Credentials: true` と wildcard origin は併用しない。

## Email Verification

MVP ではメール検証を **必須にしない**。理由は、数十人規模の実験ではメール送信基盤の固定費・運用・到達性対応が認証本体より大きくなりやすいためである。

アカウント復旧、通知、不正利用対策が必要になった段階で、メールアドレスと検証済み状態を追加する。追加時も、GT 閲覧は未ログインで可能なまま維持し、投稿・返信・本人削除の書き込み境界だけを強化する。

## Session Source of Truth

MVP のセッション状態の単一正本は **Neon Postgres** とする。署名付き httpOnly Cookie はセッション識別子またはアカウント識別子を運ぶための transport とし、最終的な有効性、失効、ローテーション、アカウントとの対応は Neon 側のレコードで判断する。

KV は MVP では採用しない。Cloudflare KV は低遅延キャッシュには向くが、セッション失効や本人削除の認可境界では整合性の説明が複雑になるため、初期実装では Neon に寄せる。将来、読み取り負荷やレイテンシが問題になった場合のみ、短 TTL の補助キャッシュとして再検討する。

## Boundaries

- 認証セッションは投稿・返信・本人削除の前提とする。
- GT の閲覧 API/UI は未ログインでも成立させる。
- ベンダー固定、具体的な DB スキーマ、復旧フローの詳細は実装タスク側で決める。
- 電話番号を必須識別子にしない。

## Consequences

- SMS コストと電話番号収集を避けられる。
- パスキー非対応環境でもパスワードで利用できる。
- TOTP 導入により復旧フローの検討が必要になるため、MVP では任意設定として実装範囲を制御する。
