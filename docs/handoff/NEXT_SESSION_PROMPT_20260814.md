# Next Session Startup Prompt — Baseball3D Unity

Use the following as the **first user message** in the next Browser GPT session.

---

野球ゲーム開発の続きです。前セッションの会話履歴を推測で補完せず、GitHub正本からcold-startしてください。

まず `L-carp55/baseball3d-game` の remote を読み、branch `agent/research-baseball-motion-ai` の最新HEADを確認してください。そのうえで次を順番に読んでください。

1. `docs/handoff/CURRENT_STATE.md`
2. `docs/handoff/SESSION_HANDOFF_20260814_UNITY_CORE_ALPHA.md`
3. `docs/handoff/NEXT_SESSION_PROMPT_20260814.md`
4. `docs/unity/AI_WORKER_POLICY_20260813.md`
5. 必要に応じて最新Browser GPT audit / owner-feedback closure matrix

Primary implementation workerはGrok Build、fallbackはCodex local/CLI、Browser GPTはarchitecture / tasking / independent red-team / batch gate担当です。Claude Codeはhistorical workerです。

開発方式は細かいtaskごとのSTOP/レビューではなく **batched autonomous development** です。

- Grok `/goal`でmeaningful checkpointを積む
- 原則4〜8 checkpointまたはcoherent major batchごとにまとめてBrowser GPTがred-team
- checkpointは勝手にmergeしない
- old test/build結果をnew HEADの証拠に使わない
- high-severity contract defectや破壊的操作がない限り、細かいレビューで開発を頻繁に止めない

次にGitHub上のprivate repo `L-carp55/baseball3d-unity` が存在するか必ず確認してください。

### Unity remoteが存在する場合

remoteのbranch/HEAD/historyを取得し、前セッションで報告された最新exact local HEAD

`f1d2292244178d1e630423a4e7fdeef459fee9a3`

がreachableか確認してください。

そのcommit周辺で報告された実装commit prefixは:

`3f04f4a` — `Core: assign grounder primary from intercept and ReachModel`

follow-up/record prefix:

`f1d2292`

また、より前のU4.5a provisional checkpoint

`d234bd7df8fad9e49cc1de273e8e77d1c4f4865e`

との実際のancestryもGitで確認し、推測しないでください。

Unity側の `AGENTS.md`、`docs/handoff/CURRENT_STATE.md`、audits、current branch/historyも読んでください。

### Unity remoteがまだ存在しない場合

Unity実コードはlocal-onlyです。新しいUnity projectを作り直さず、

`docs/unity/TASK_PUBLISH_EXISTING_UNITY_REPO_20260814.md`

を正本として、Grok Buildに既存local `baseball3d-unity` repoの履歴を保持したままprivate GitHub repoへpublish/pushさせることを最優先にしてください。merge/history rewriteはしないでください。

## 最新Unity progress（remote未検証のGrok報告）

旧 `Diamond.AssignPrimaryForGrounder(spray)` の固定角度表（>8°→2B / <-8°→SS / その他P）はassignment authorityから外され、1B/3Bもprimaryになれるようにしたと報告されています。

報告された現在のCore構成:

- `Assets/Baseball/Core/FieldingAssignment.cs` — primary assignment authority
- `BallPhysics.cs` — production `PlaySimulation` と同じ式でground-ball pathを先読み
- `ReachModel.cs` — reaction + acceleration + runningから到達時間
- P / 1B / 2B / 3B / SSのうち、最も早く現実的にinterceptできる野手をprimary
- Pには中間手の深さまで追わない制約

fixtureはexpected primaryをsimulation inputにしておらず、入力はEV/LA/sprayだけと報告されています。

代表fixture:

- 58mph / 2° / 0° -> P
- 78 / 2 / 42、82 / 2 / 40 -> 1B
- 91 / 1 / 19、88 / 1 / 15 -> 2B
- 78 / 2 / -42、82 / 2 / -40 -> 3B
- 88 / 1 / -18 -> SS

1B/2B、3B/SS境界では近い野手を打球点へ寄せるとprimaryが入れ替わることも報告されており、固定spray角表ではないことを狙ったtestになっています。

黄金ゴロ91mph / 1° / spray19°は引き続き2B・アウトと報告されています。

## 最新verification state

最新local HEAD `f1d2292244178d1e630423a4e7fdeef459fee9a3` について報告されたのは:

- `scripts/unity-validate.ps1`: PASS
- shipped Core/Simulation + EditMode testsを同じNUnit属性で非Editor実行: 48/48 PASS

ただしこれはUnity Editorの`unity-test.ps1`成功の代替ではありません。

- `scripts/unity-test.ps1`: 未完了
- blocker: Unity 6000.5.8f1をLunaのU4.5a worktreeも使用しておりIL post-processingが起動できず、再試行も同地点で失敗
- Grokは他projectのUnityを停止していない
- PlayMode Editor tests: 未再実行
- current-HEAD Windows/WebGL build: PASS証拠なし

したがって最新HEADはPARTIALLY VERIFIED / ENVIRONMENT-BLOCKEDです。古い29 EditMode / 4 PlayModeや旧buildを現HEADのPASS証拠として使わないでください。

Grokは `agent/luna-u4_5-owner-playtest-layer` を見ておらず、mergeもしていません。compatibility/ancestryを推測しないでください。

## 次の重要Core gap

1Bがgrounder primaryになれるようになった結果、新しい構造的gapが露出しています。

Grok報告:
- 1Bが打球を捕ってもCPUはまだ一塁へ投げる
- そのとき誰が一塁をcoverするかは未実装

次は **primary + base-cover coordination** を明示してください。1Bが一塁を離れてfieldingした場合、一塁のreceiver/cover（通常はlive geometryに応じたP等）が必要です。uncovered baseへ投げたり、1Bがfieldingとcoverを同時にしている前提にしないでください。

これはIssue #30のchase + cover joint assignment requirementとも一致します。fixture名やexpected-primaryをspecial-caseせず、live defensive role/geometryから決めてください。

## その後のbatched `/goal`優先順位

1. remote上でfive-role assignment実装/fixtures/testsを独立確認
2. primary + base-cover coordination（特に1B-fields -> first-base cover）
3. current-HEAD Unity Editor test/build executionを復旧
4. fielding assignment boundary realism
5. explicit BallPossession
6. FieldingExecution
7. ThrowRoute progress / cycle prevention
8. HOLD_BALL
9. receive -> transfer timing
10. RunnerContact / TagEvent
11. close-play authority
12. debugging / observability

Unity環境が正常化したら最新HEADで:
- full EditMode
- full PlayMode
- unity-validate
- Windows Development Build
- WebGL Development Build（既存moduleで可能なら）
- runtime smoke

を実行してください。

JS R2/R3、PR #32 automatic integration、Issue #30のJS実装、M1 Final Validation、P1は自動再開しないでください。Unityに移ってもIssue #30のroot requirementsは忘れないでください。

まずGitHub remoteの現在状態を実際に確認し、handoffと矛盾があればremote実態を優先してください。そのうえで、

- Unity remote repoの有無
- current branch/HEAD
- `f1d2292...`到達性
- `3f04f4a`の実diff要旨
- `d234bd7...`とのancestry
- current verification state
- 次のbatched goal

を簡潔に整理してから作業方針を決めてください。

勝手にmergeしないでください。

---
