# Architecture guard: FieldingAssignment is now sole writer for both role states.
guard=GUARD.read_text(encoding='utf-8')
guard=swap(guard,"""check('fielding primary direct-write ratchet <=9',directPrimary<=9,directPrimary);
check('coverBase direct-write ratchet <=13',directCover<=13,directCover);
""","""check('fielding primary has exactly two writes in setPrimaryFielder',directPrimary===2,directPrimary);
const primaryBody=stripComments(extractFunction('setPrimaryFielder'));
check('all primary writes live in setPrimaryFielder',
  count(/\\b(?:ball|[A-Za-z_$][\\w$]*)\\.primary\\s*=(?!=)/g,primaryBody)===2,
  (primaryBody.match(/\\b(?:ball|[A-Za-z_$][\\w$]*)\\.primary\\s*=(?!=)/g)||[]).length);
check('coverBase has exactly two writes in assignment API',directCover===2,directCover);
const clearCoverBody=stripComments(extractFunction('clearCoverRole'));
const assignCoverBody=stripComments(extractFunction('assignCoverRole'));
check('cover clear writer lives in clearCoverRole',
  count(/\\b[A-Za-z_$][\\w$]*\\.coverBase\\s*=(?!=)/g,clearCoverBody)===1,
  (clearCoverBody.match(/\\b[A-Za-z_$][\\w$]*\\.coverBase\\s*=(?!=)/g)||[]).length);
check('cover assign writer lives in assignCoverRole',
  count(/\\b[A-Za-z_$][\\w$]*\\.coverBase\\s*=(?!=)/g,assignCoverBody)===1,
  (assignCoverBody.match(/\\b[A-Za-z_$][\\w$]*\\.coverBase\\s*=(?!=)/g)||[]).length);
""",'guard assignment writers')
# Add structural checks before failed calculation.
old="""const failed=checks.filter(x=>!x.ok);
"""
new="""const rundownBody=stripComments(extractFunction('rundownCover'));
check('rundownCover uses constrained candidate API',/findCoverCandidate\\(/.test(rundownBody)&&!/\\.coverBase\\s*=/.test(rundownBody),'candidate API');
const wallGuard=/if\\(handoff\\.changed\\) return false;/.test(script);
check('wall handoff ends stale-primary tick',wallGuard,wallGuard);
const resetBody=stripComments(extractFunction('resetFielders'));
check('reset clears all fielding assignments',/clearFieldingAssignments\\(/.test(resetBody),'reset boundary');
const failed=checks.filter(x=>!x.ok);
"""
guard=swap(guard,old,new,'guard structural checks')
GUARD.write_text(guard,encoding='utf-8')

# Architecture document Phase 3 status.
doc=DOC.read_text(encoding='utf-8')
old="""### Phase 3: FieldingAssignment

- `primary`と`coverBase`を一つの割当表へ統合。
- `rundownCover`の役割奪取、長距離中継の元カバー消失、壁反射後の旧担当参照を修理。
- 担当交代をトランザクション化する。
"""
new="""### Phase 3: FieldingAssignment基盤 — BUILD b0805-16

本PRで実施する。

- `primary`と`coverBase`の全変更を守備割当APIへ集約する。
- 役割変更元`roleSource`と更新番号`roleSeq`を録画へ追加する。
- `rundownCover`は既存同塁担当または無役野手だけを選び、別塁カバー/打球担当を奪わない。
- 中継・本塁カットでカバー野手を動かす場合は、代役を先に確保して原子的に再配置する。代役がいなければ引き抜かない。
- 壁反射で担当が変わった物理刻みは直ちに終了し、次刻みで新担当を再取得する。
- `resetFielders`はprimaryだけでなく全coverも消去する。

Phase 3完了後のラチェット:

- `primary`直接書き込み: 9 → **2**（両方`setPrimaryFielder`内）
- `coverBase`直接書き込み: 13 → **2**（clear/assign API内に各1）
- 役割奪取・元カバー消失・壁反射旧担当捕球の専用テストと変異検査をCIへ追加する。
"""
doc=swap(doc,old,new,'doc phase3')
DOC.write_text(doc,encoding='utf-8')
