# Scope Artifact

## Source Direction

`direction.md` および `direction.coverage.json` を **初期の**上位入力とする。角度 B（表現実験）、対称型返信の方針、GT 必須寄せ、ソロ開発制約を前提に MVP 境界を定義する。**Direction と矛盾しない範囲で**、**ユーザーが明示承認した Scope amendment** により Must を追記することがある（例: **M6 本人削除**）。その場合も Direction をすり替えるものではなく、Scope 文書としての再確定として扱う。

## MVP Outcome

**AI 生成のみが表に出る短歌形コミュニケーションの最小ループ**が、一次ユーザーに対して成立すること。

1. **投稿**: ユーザーが素（長文）を入力し、LLM が **5-7-5（上の句）**に変換する。**公開されるのは変換後の句のみ**で、素の長文は公開しない。
2. **閲覧**: **グローバルタイムライン（GT）**で、他者の変換済み投稿と、その返信スレッドの見え方を追える。
3. **返信（対称型）**: ユーザーが返信の素を入力し、LLM が **7-7**に変換する。**公開されるのは 7-7 のみ**。
4. **形式**: 5-7-5 および 7-7 が、定めた字数・音の規則に照らして **受理／却下**できる。

## First Target User

**AI 生成物を介したコミュニケーションに興味がある人**（Direction で確定した一次セグメント）。本 Scope で変更しない。

## MVP Scope

初期 MVP では以下を **Must** とする（いずれも classification: Must）。

- **M1 投稿変換** — direction_link: Chosen Direction／Constraints。user_value: 「自分の長文が、表では短歌形の上の句だけになる」体験。boundary: **含む** 長文入力→5-7-5 変換と非公開の素。**含まない** 自由文の公開フィード。acceptance_signal: 変換結果のみが GT に現れ、素がそのまま読めない。

- **M2 GT** — direction_link: Scope Boundary Seeds／MVP Outcome。user_value: コミュニティ全体の変換済み投稿を一覧で追える。boundary: **含む** 全体閲覧の最小 UI。**含まない** おすすめアルゴリズムやフォロー連動の並べ替え。acceptance_signal: 第三者が GT から投稿と返信の連なりを追える。

- **M3 返信変換・対称型** — direction_link: Success Criteria／返信ルール見直し。user_value: 「返信素→7-7 のみ公開」ができる。boundary: **含む** ユーザー入力→LLM による 7-7。**含まない** 文脈だけから返歌を自動生成する方式を MVP の主経路とすること（別ルートは Deferred）。acceptance_signal: 返信として公開されるのは常に 7-7 の変換結果のみ。

- **M4 形式検証** — direction_link: Constraints／Do Not Assume（音数判定は未定）。user_value: 投稿・返信が短歌形として成立しているか機械的に分かる。boundary: **含む** 受理／却下の判定。**含まない** 趣味・文学品質のスコアリング。acceptance_signal: 規則外は公開フローに乗らない。

- **M5 最小の識別** — direction_link: GT 必須・ソロ開発制約。user_value: 投稿と返信が誰のものか最小限わかり、乱用をやや抑える。boundary: **含む** アカウントまたは同等の識別子の発行・紐づけ。**含まない** リッチなプロフィールやソーシャルグラフ。acceptance_signal: GT 上で投稿／返信が識別可能で、無根の大量投稿だけでは運用が破綻しない最低限。

- **M6 本人削除** — direction_link: Scope amendment（認証・認可・本人の公開データの取り下げ）。user_value: 自分が公開した変換句だけは取り下げられる。**boundary: 含む** ログインユーザーが自分の公開投稿・返信（変換後の句）を削除できること。**含まない** 管理者による削除、通報チケット、モデレーション・キュー。acceptance_signal: 本人が削除した公開句は GT・スレッドから読めなくなる（または削除済みとして一貫して扱われる）。

## Scope amendment note

**2026-05-10（Scope として再確定）**: ユーザーは **「本人削除（M6）を MVP の Must に含めることに、このタイミングで Scope として確定する。更新した scope.md / scope.coverage.json を成果物としてよい。こちらいずれも承認しました」**と回答し、**M6** を Must に含めることおよび修正版成果物の出力を明示的に承認した（当初の Scope 確定時点では M6 を条文に単独行として含めていなかった）。

## Deferred Scope

- **形式オプションの拡張（字体・入力補助・表示モードなど）** — classification: Could。direction_link: Direction の Deferred／ユーザー発言。why_not_now: MVP は単一路線で変換ループの検証を最優先するため、選択肢を増やすと実装と検証が分散する。reevaluation_condition: 離脱や「書けない」が計測され、形式がボトルネックだと判断したとき。

- **フォロー・通知・検索** — classification: Should。direction_link: Scope Boundary Seeds。why_not_now: ソロ開発の工数と複雑度。GT が単体で混雑したときに優先してよい。reevaluation_condition: GT の情報量が実用上不足するとフィードバックが固まったとき。

- **高度なモデレーション** — classification: Could。direction_link: Risks。why_not_now: 最小の運用で実験を始め、ルールを厚くするとコストと判断が増える。reevaluation_condition: 被害・通報・法的リスクが観測されたとき。

- **自動生成型の返信（文脈のみから返歌を出す主経路）** — classification: Could。direction_link: 対称型確定の対案。why_not_now: MVP は対称型で学習コストと説明責任を抑える。reevaluation_condition: 対称型で継続的な投稿が得られない、または実験目的に合わないと判断したとき。

- **複数 LLM プロバイダやモデル切替** — classification: Could。why_not_now: 運用と検証の変数が増える。reevaluation_condition: 品質またはコストが実験を阻害するとき。

## Rejected

- **自由文そのものが流通するタイムライン** — classification: Won't。reason: Direction の non-goals と「変換後のみ公開」の制約に反する。

- **返信を「人間が直接入力した 7-7 のみ」に固定する製品定義（旧 Discovery 前提のまま固定）** — classification: Won't。reason: Scope 対話で対称型 AI 変換へ方針変更したため、旧固定は採らない。

- **短歌投稿サイトそのものの再現だけを目的とすること** — classification: Won't。reason: Direction の non-goals に沿わない。

## Cut Rationale

GT と対称返信の両方を Must に置くと負荷は増えるが、角度 B に対して **「見える場（GT）」と「返信も同じ規則（変換のみ公開）」**を同時に満たした方が、実験の芯がブレない。フォローや形式オプションは実験の変数を増やすため後ろへ倒した。

## Scope Expansion Risks

- **GT と双方向 LLM** で推論コストと運用負荷が一気に増える。
- **モデレーション表面積**が GT で広がり、ソロ運用が厳しくなる。
- **形式検証と生成品質**の両立に詰まったとき、機能追加圧がかかる（Deferred に逃がす設計が必要）。

## Assumptions and Dependencies

- 利用者が **変換結果に対する主観的納得**をどこまで示すかは、引き続き観察領域。
- **継続動機**は Discovery で未深掘りのまま。Scope ではブロッカーにしない。

## Success Signals

- GT 上で、上の句と返歌の連なりが **第三者から追える**。
- 投稿・返信とも **変換句だけ**が流通し、ルールに外れたものは公開されない。

## Do Not Cross

本 artifact は **製品境界**までとし、次は Design／Plan に委ねる。

- 画面ごとの詳細やワイヤー、具体的な利用フロー図は書かない。
- 実装の順序、工数見積り、リポジトリ内のファイル単位の作業は書かない。
- 永続化の具体的スキーマや外部サービス連携の契約形は書かない（必要なら Design で方針のみ）。

## Ready for Design

MVP の Must／Deferred／Rejected、カット理由、拡大リスクが揃い、一次ユーザーとアウトカムが製品レベルで説明できる。次フェーズ Design で、方式レベルの方針と境界を固める。

## Artifact Output Permission

Final Coverage Review 後の「`scope.md` / `scope.coverage.json` を出力してよいか」に対し、ユーザーは **「はい」**と回答した（2026-05-10）。

**M6 追記後の修正案について**: ユーザーは **「本人削除（M6）を MVP の Must に含めることに、このタイミングで Scope として確定する。更新した scope.md / scope.coverage.json を成果物としてよい。こちらいずれも承認しました」**と回答した（2026-05-10）。
