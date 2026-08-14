# Next Session Startup Prompt — Baseball3D Unity

Use the following as the **first user message** in the next Browser GPT session.

---

野球ゲーム開発の続きです。前セッションの会話履歴を推測で補完せず、GitHub正本からcold-startしてください。

まず `L-carp55/baseball3d-game` の remote を読み、branch `agent/research-baseball-motion-ai` の最新HEADを確認してください。そのうえで次を順番に読んでください。

1. `docs/handoff/CURRENT_STATE.md`
2. `docs/handoff/SESSION_HANDOFF_20260814_UNITY_CORE_ALPHA.md`
3. `docs/unity/AI_WORKER_POLICY_20260813.md`
4. 必要に応じて最新のBrowser GPT audit / owner-feedback closure matrix

Primary implementation workerはGrok Build、fallbackはCodex local/CLI、Browser GPTはarchitecture/tasking/independent red-team担当です。Claude Codeはhistorical workerです。

重要な開発方針:

- 1 checkpointごとに止める方式には戻さない。
- Grok `/goal`でbatched autonomous developmentを継続する。
- meaningful checkpoint commitを残し、原則4〜8 checkpointまたはcoherent major batchごとにBrowser GPTがまとめてred-teamする。
- checkpointは勝手にmergeしない。
- old test/build結果をnew HEADの証拠に使わない。
- high-severity contract defectを見つけない限り、細かいレビューで開発を頻繁に止めない。

Unity側の最新local-only exact checkpointとして前セッションで報告されたSHAは:

`d234bd7df8fad9e49cc1de273e8e77d1c4f4865e`

これはU4.5aのPROVISIONAL CHECKPOINTで、mergeされていません。

このcheckpointではInput System package削除後に残っていた `activeInputHandler: 1` と孤立Actions参照を修正し、`activeInputHandler: 0`、Legacy keyboard（Space/R/T/C）、IMGUI mouse UIを維持したと報告されています。Core/Simulation差分はparent比で空と報告されています。

現在のgrounder fixturesはP/2B/SSだけを期待する6ケースがあり、fixtureはprimaryを強制しない設計です。一方 `Diamond.AssignPrimaryForGrounder` は現在 P / 2B / SS しか返せず、1B / 3B assignment拡張が `GROK_REQUIRED` です。これをfixture側で回避してはいけません。Core側をP/1B/2B/3B/SSのdeterministic realistic competitionへ拡張し、1B/3B fixtureとboundary/competition fixtureを追加してください。fixture expected-primaryをsimulation inputにしてはいけません。

U4.5a current-code verificationは:

- static fixture/config checks: PASS
- `unity-validate.ps1`: PASS
- EditMode / PlayMode: Unity Licensing Client / Package Manager IPC障害でtest discovery前に停止
- Windows Development Build: 同IPC障害で未生成
- runtime確認: 新buildがないため未確認

過去の29 EditMode / 4 PlayModeや旧buildはU4.5a以前なので現HEADのPASS証拠として使わないでください。

Unity IPC問題はnon-destructiveに診断・復旧してよいですが、license/credential/project dataの破壊的削除はowner approvalなしで行わないでください。IPCが直ったら最新HEADでfull EditMode / PlayMode / validate / Windows build / WebGL build（installedなら）/ runtime smokeを実行してください。

次に、GitHubに `baseball3d-unity` private repoが存在するか必ず確認してください。

- 存在する場合: remote HEAD/historyを読み、`d234bd7...`がreachableか確認し、その後のcheckpointも含めて現在の実態を把握してから続行してください。
- 存在しない場合: Unity実コードはまだlocal-onlyです。新しいUnity projectを作り直さず、Grok Buildに既存local `baseball3d-unity` repoの履歴を保持したままprivate GitHub repoへpublish/pushさせることを最優先にしてください。mergeやhistory rewriteはしないでください。

その後はbatched `/goal` developmentを続けます。優先順位は:

1. P/1B/2B/3B/SSのground-ball primary assignment完成
2. fielding assignment quality
3. explicit BallPossession
4. FieldingExecution
5. ThrowRoute progress / cycle prevention
6. HOLD_BALL
7. receive -> transfer timing
8. RunnerContact / TagEvent
9. close-play authority
10. debugging / observability

JS R2/R3、PR #32 automatic integration、Issue #30のJS実装、M1 Final Validation、P1は自動再開しないでください。Unityが採用されてもIssue #30のroot requirementsを忘れないでください。

まずGitHub remoteの現在状態を確認し、前セッションhandoffと矛盾があればremote実態を優先してください。そのうえで「現在地・次のbatched goal・GitHub上で確認できたSHA」を簡潔に報告してから作業方針を決めてください。

---
