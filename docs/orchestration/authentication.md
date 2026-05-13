# Authentication Decision

## Status

Accepted for MVP implementation.

## Context

Design では、GT の閲覧は未ログインでも可能、投稿・返信・本人削除はログイン必須とする。認証は無料枠・低固定費を優先し、SMS のような従量課金や電話番号依存の要素には依存しない。

`tc.authgate` は、実装前に S1 の認証方式、Workers 上のライブラリ適合、RP／Cookie／CORS 境界を確定するためのゲートである。

## Decision

MVP の認証方式は **S1: パスキー（WebAuthn）によるパスワードレス認証** とする。

- **パスキー（WebAuthn）**: 採用する。登録・ログインの基本方式とし、Hono on Cloudflare Workers 上で `@simplewebauthn/server` により registration / authentication ceremony を検証する。
- **パスワード**: MVP では採用しない。パスワードハッシュ、リセットメール、パスワードポリシーを初期範囲から外し、認証状態はパスキーとサーバセッションに寄せる。
- **TOTP**: MVP では採用しない。パスキーが possession / user verification を担うため、初期実装では追加 2FA を持たない。
- **SMS**: 採用しない。ログイン、2FA、復旧のいずれも SMS 従量課金に依存しない。

アカウントは内部 `account_id` と WebAuthn 用の `user.id` を分ける。クレデンシャルは Neon Postgres に保存し、少なくとも credential ID、公開鍵、sign counter、device type、backup state、transport、所属 account を保持する。セッションも Neon を正本とし、Cookie はセッション ID を運ぶ transport に限定する。

## Passkey Spike

S1 のスパイクでは、`@simplewebauthn/server` を **Hono on Cloudflare Workers で採用する方針**とする。根拠は次の通り。

- Cloudflare Workers は Web Crypto の `crypto.subtle`、`crypto.getRandomValues()`、`crypto.randomUUID()` を提供する。WebAuthn 検証で必要な署名検証・ダイジェスト・ランダム challenge 生成は Workers runtime の Web 標準 API に寄せられる。
- SimpleWebAuthn の server package は credential の `publicKey: Uint8Array`、`counter`、`deviceType`、`backedUp`、`transports` などを永続化するモデルを前提としており、Neon Postgres に bytea / text / jsonb 等で保持する方針と整合する。
- Workers では Node.js Crypto API と Web Crypto API の差が実装リスクになるため、S1 の実装では `nodejs_compat` への依存を最小化し、Web Crypto / Web standard 型、Base64URL、`Uint8Array` の変換境界を contract test で固定する。
- スパイク時点の判定は **採用可**。ただし、実装タスクでは `generateRegistrationOptions`、`verifyRegistrationResponse`、`generateAuthenticationOptions`、`verifyAuthenticationResponse` を Workers の Miniflare / Vitest または同等環境で実行し、ESM bundle と runtime API の両方を確認する。

代替方針は **WebAuthn データモデルを維持した検証層の差し替え** とする。`@simplewebauthn/server` が Workers の bundle、Web Crypto 対応、依存更新のいずれかで詰まる場合でも、Neon の credential / challenge / session スキーマは変えず、検証処理だけを次の順で置き換える。

1. Workers の `nodejs_compat` を明示して同ライブラリを継続する。
2. Web Crypto だけを使う薄い WebAuthn 検証実装を Hono API 内に閉じる。
3. 最後の手段として、同じ REST 契約の認証検証だけを別 runtime に逃がす。ただし、セッション正本は Neon、Cookie 発行境界は Hono API に戻す。

## RP, Cookie, and CORS

- **RP ID**: 本番公開 Web ホストの registrable domain を使う。API と Web を分割ドメインにする場合でも、WebAuthn ceremony の `rpID` と `expectedOrigin` は利用者が操作する Web 側 origin を基準にする。localhost / preview / production は環境別に明示し、preview の RP ID 混入を本番へ持ち込まない。
- **公開 URL**: Web の公開 URL と API の公開 URL を環境変数で分ける。例: `PUBLIC_WEB_ORIGIN` は WebAuthn の `expectedOrigin`、`PUBLIC_API_ORIGIN` または `NEXT_PUBLIC_API_BASE_URL` は REST 呼び出し先。registration / authentication options 生成時の RP 表示名、RP ID、origin 検証値は `PUBLIC_WEB_ORIGIN` から導く。
- **Cookie ドメイン**: セッション Cookie は `Secure`、`HttpOnly`、`SameSite=Lax` を基本とする。同一ホストまたは API を Web と同一オリジンに見せられる構成では `__Host-` prefix を使い、`Domain` 属性は付けない。Web と API をサブドメイン分割し、credentials 付き cross-origin が必要な場合のみ `Domain=.example.com` 相当を検討するが、その場合は `__Host-` prefix は使えない。
- **CORS**: credentials 付き request を許可する origin は Web の公開 URL の明示リストに限定する。`Access-Control-Allow-Credentials: true` と wildcard origin は併用しない。`Vary: Origin` を付け、allowed methods / headers は登録・認証・書き込み API に必要な範囲へ絞る。

## Email Verification

MVP ではメール検証を **採用しない**。S1 はパスキーのみで登録・ログインを成立させるため、メールアドレスは初期登録の必須識別子にしない。理由は、数十人規模の実験ではメール送信基盤の固定費・運用・到達性対応が認証本体より大きくなりやすく、パスワードレス方針とも責務がずれるためである。

メールアドレスと検証済み状態は **将来候補** とする。採用条件は、アカウント復旧、通知、不正利用対策、複数デバイス移行のいずれかが MVP の実利用で問題になった場合。追加時も、GT 閲覧は未ログインで可能なまま維持し、投稿・返信・本人削除の書き込み境界だけを強化する。

## Session Source of Truth

MVP のセッション状態の単一正本は **Neon Postgres** とする。署名付き httpOnly Cookie はセッション識別子を運ぶための transport とし、最終的な有効性、失効、ローテーション、アカウントとの対応は Neon 側のレコードで判断する。Cookie には credential ID や公開鍵、account profile を載せない。

KV は MVP では採用しない。Cloudflare KV は低遅延キャッシュには向くが、セッション失効や本人削除の認可境界では整合性の説明が複雑になるため、初期実装では Neon に寄せる。将来、読み取り負荷やレイテンシが問題になった場合のみ、短 TTL の補助キャッシュとして再検討する。

## Boundaries

- 認証セッションは投稿・返信・本人削除の前提とする。
- GT の閲覧 API/UI は未ログインでも成立させる。
- WebAuthn の具体的な DB スキーマ、復旧フローの詳細は実装タスク側で決める。ただし、credential と session の正本は Neon から動かさない。
- 電話番号を必須識別子にしない。
- パスワードを必須識別子にしない。

## Consequences

- SMS コスト、電話番号収集、パスワードリセット運用を避けられる。
- パスキー非対応環境では MVP を利用できない可能性がある。初期の実験規模では許容し、必要なら将来メール検証または別認証を追加する。
- 復旧導線は弱くなるため、少なくとも複数端末登録または再登録時の運用ルールを実装タスクで検討する。
