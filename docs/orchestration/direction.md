# Direction Artifact

## Source Discovery

`discovery.md` および `discovery.coverage.json`（Discovery 時点で LLM validation pass）を Direction の正本入力とする。推奨トピックのうち `constraints` / `emotional_motivation` / `continuation_reason` は partial 〜 tentative が残る旨を、Direction の判断材料として扱う。

## Chosen Direction

**AI インターフェースによる短歌コミュニケーターの実験**として、次を第一の方向とする。

- 長文の内面を **LLM が 5-7-5（上の句）へ圧縮**し、**流通・公開は変換後の句に限定**する（自由文のままの公開はしない）。
- 対話で選んだ角度 **B（表現実験）**を優先し、「**AI に解釈された自分**」が表に出る体験の価値を中心に据える。

## Primary User

**AI 生成物を介したコミュニケーションに興味がある人**（Discovery で選ばれた一次セグメント）。Direction 対話で「一次ユーザーはこの定義でよいか」に **「A はい」**と回答し、一次ターゲットを確定した。

## Success Criteria

**Direction で固定する部分**

- **上の句（5-7-5）の要約**に、利用者が **納得感・センス**を感じうること（Discovery の `success_signal` に沿う）。

**Scope に回す部分（Direction では固定しない）**

- コミュニケーション側の「成功」の測り方全般。対話で **③**（Direction では言い切らず Scope で詰める）を選んだ。
- **返信経路**（Discovery では人間 7-7 のみとされていた制約）について、**「見直していい」**と答えたため、**人間のみ固定を前提としない**。具体案は **Scope** で決める。

## Value Hypothesis

**長文の内面は直接は流通させず、AI が生成した短歌形の「表側」だけが動くとき、人は「自分の感情や人格を別の形で見せる」体験に価値を感じるのではないか。**

## Constraints

- **投稿の対外表示は、変換後の上の句（5-7-5）に限定**する。自由文のままの公開はしない（Discovery confirmed）。
- **返信に AI をどこまで入れるか、UI 上の必須補助の有無**は **Scope** で設計する（Direction では確定しない）。
- **ソロ開発**であること。運用・保守・LLM コストの現実的制約を常に前提とする。

## Decision Rationale

角度 **B（表現実験）**を採用。提示した A/B/C の比較のうち、**B** を選び、**A（平和・関係性仮説の直球）**や **C（形式・律の実験のみ）**より、**「AI に解釈された表現だけが流通する体験」**を最優先の実験軸とする。

## Non-Goals

Discovery の `non_goals_seed` に沿い、**普通の自由文タイムライン SNS**を目指すこと、**短歌投稿サイトそのもの**を再現することが目的であること、を引き続き外す。Direction 対話で **non-goals への追加は「なし」**と確定。

## Scope Boundary Seeds

- **Must 寄りの種**: 長文→上の句（5-7-5）変換、**変換結果**の露出、**返信のためのスロット**（返信の中身のルールは Scope で定義）。
- **Scope で開く種**: 返信に **AI 補助を入れるか**、タイムラインやスレッドの**最小の見せ方**、**モデレーション**の厚さ、投稿・閲覧の導線。

## Success Signals

- 上の句の品質に対する主観的な納得が得られる（Direction 固定部分）。
- 利用者が「**AI に解釈された自分**」を介したやりとりに価値を感じる具体例が観察できる（角度 B）。

## Risks and Assumptions

- 上の句品質が低いと価値が成立しない（Discovery Open Questions と整合）。
- 返信ルールを開いたことで **Scope の論点が増える**（意図的に先送りした代償）。
- Discovery で深掘りされなかった **継続動機**は引き続き不確実。

## Alternative Directions Considered

- **A** 平和・関係性仮説を最前に出す方向: 採用せず（B 優先）。
- **C** 律・形式の実験だけに寄せる方向: 採用せず（B 優先）。
- 自由文＋任意補助: 非採用（変換後のみ公開という実験軸を弱めるため）。

## Deferred Topics

- Discovery 推奨の **emotional_motivation** / **continuation_reason** の深掘りは未完了。Direction では必須外として扱い、**必要なら Scope 以降**で再訪。
- コミュニケーション成功指標の詳細は **Scope へ**（対話で ③ を選択）。

## Do Not Assume

- MVP 機能一覧・画面・技術スタックは未定（Scope / Design へ）。
- 音数判定の実装方式は未定。
- 返信が人間のみか・AI 補助かは **未決**（Scope で決める）。

## Ready for Scope

Direction としての同一性、角度 B、一次ユーザー、成功シグナル（上の句側）、価値仮説、制約、非目標、Scope へ渡す境界の種が揃った。次は MVP の Must / Deferred / Rejected の切り分けと、返信ルールの再設計を Scope で行う。

## Artifact Output Permission

- Final Coverage Review 後の質問「`direction.md` / `direction.coverage.json` を出力してよいですか」に対し、ユーザーは **「はい」**と回答した（2026-05-10）。
