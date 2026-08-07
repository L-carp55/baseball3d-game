# 守備AI 野球的判断レビュー

対象: `_sol_defense_excerpt.js`
レビュー日: 2026-08-01

## 前提

- 指示書 `_sol_task_defense_ai.md` に従い、「動くが野球としておかしい」判断を対象にした。
- 対象ファイルは実測841行だった。指示書にある833行との差分を含め、1行目から841行目まで読了した。
- コードは変更していない。引用は対象ファイルの逐語引用で、行番号は実ファイルの行番号である。
- 重大度は指示書の定義に従う。確証が限定される箇所は、その限界を本文に明記する。

## 指摘
### 指摘1: 守備判定が走者の内部意図 `goal` を直接読む

- **場面**: 走者が塁間にいて、位置 `p`・向き `dir`・速度 `v`・押し出しの有無だけでは判断すべき送球／盗塁／挟殺の場面。たとえば、二塁へ向かう走者が `p<2`・`dir>0` なのに、内部の `goal` だけが2未満になっている場面。
- **今のコードがする行動**: `judgeAtBase` は `goal>=b` の走者だけを送球先の候補にし、挟殺中も `goal` で走者の進行方向・到達判定を決める。`goal` と物理状態がずれた場合、実際には二塁へ向かう走者を候補から外したり、逆方向へ追い込んだりする。

  **コード引用（逐語）**:

  ```js
   608:     const cand=runners.filter(r=>!r.out && r.p<b && r.goal>=b).sort((x,y)=>y.p-x.p)[0];
   609:     if(cand && runnerETA(cand,b)>0.02){ markOut(cand,'tag'); T.stealText='盗塁失敗！'; }
   610:     else T.stealText='盗塁成功！';
   629:       const tagger = runners.filter(r=>!r.out && !r.mustReturn && r.p<b && r.goal>=b)
   630:                             .sort((x,y)=>y.p-x.p)[0];
   638:   const cand = runners.filter(r=>!r.out && r.p<b && r.goal>=b).sort((x,y)=>y.p-x.p)[0];
   647:     const forceable = (cand.origin===0) ? (b===1) : (isForced(cand) && b===cand.origin+1);
   648:     if(!forceable) return beginRundown(cand, b);
   524:     const ahead={...r, p: clamp(r.p + (r.goal>r.p?0.09:-0.09), 0, 4)};
   529:     if(R.t>0.25 && Math.abs(r.p-r.goal)<0.02 && Math.abs(r.goal-Math.round(r.goal))<0.01)
   538:       const goingHi = r.goal > (R.loLim+R.hiLim)/2;
  ```

- **野球としての正しい行動**: 守備は走者の `goal` を見ず、`p`・`dir`・`v`・押し出しの有無から、誰がどの塁へ向かっているかとタッチ対象を判断する。
- **重大度**: 高（送球のたびにアウト候補と挟殺の方向が変わり、内部意図と物理状態がずれた場面では結果が変わる）。規約違反自体はコード上確定だが、その状態が実戦で何回発生するかは抜粋外の `goal` 更新処理を読まないと確定できない。

### 指摘2: 牽制送球の対象走者を塁で絞っていない

- **場面**: 一塁・二塁に走者がいて、両走者がリードを取っているとき、投手が一塁へ牽制する場面。
- **今のコードがする行動**: 一塁への牽制でも、`jumped` であり `p` が牽制先と異なる走者を全員候補にし、塁ごとの所属を確認せず、元の塁から最も離れた走者を選ぶ。二塁走者のリードが大きければ、二塁走者を一塁牽制の対象にして、二塁走者を一・二塁間の挟殺へ送ることがある。

  **コード引用（逐語）**:

  ```js
   594: function judgeAtBase(b){
   595:   const T=throwPlay;
   596:   if(T.kind==='pickoff'){
   597:     // 飛び出した走者が塁へ戻れていなければアウト。塁間で捕まったら挟殺へ
   598:     const cand=runners.filter(r=>!r.out && r.jumped && Math.abs(r.p-b)>0.02)
   599:                       .sort((x,y)=>Math.abs(y.p-y.origin)-Math.abs(x.p-x.origin))[0];
   600:     if(cand){
   601:       if(cand.p>b+0.12){ T.stealText='牽制で挟まれた！'; return beginRundown(cand, b+1); }
   602:       markOut(cand,'tag'); T.stealText='牽制アウト！';
   603:     }else T.stealText='戻ってセーフ';
  ```

- **野球としての正しい行動**: 一塁牽制なら一塁走者が一塁へ戻れたかだけを判定し、二塁走者は二塁への送球・実際の走路上の接触がない限り対象にしない。
- **重大度**: 中（複数走者がリードを取る牽制時に、別の走者を誤ってアウト判定・挟殺へ送る）。

### 指摘3: 後退中の非強制走者を送球対象から外す

- **場面**: 走者が二塁から三塁方向へ進んだ後、外野返球を見て二塁へ戻っている場面。後ろに走者がいないため、その走者は非強制で、`dir<0` になっている。
- **今のコードがする行動**: `chooseThrowTarget` の `live` に入るのは、前進中の走者か、押し出されている走者だけである。後退中の非強制走者は候補から消え、他に候補がなければ投手へ返球するため、二塁へ戻る走者を追って送球・タッチする判断をしない。

  **コード引用（逐語）**:

  ```js
   198: function chooseThrowTarget(f){
   199:   const throwETA=b=>throwETAof(f,b);
   204:   const live=runners.filter(r=>!r.out && (
   205:     r.dir>0 || (r.origin===0 && r.p<1) || (r.origin>0 && isForced(r) && r.p<r.origin+1)));
   206:   let best=null, fallback=null;
   216:     const nextB = Math.min(4, Math.floor(r.p+1e-9)+1);
   217:     const bMax = (Math.hypot(f.cx,f.cy) < 158) ? nextB : 4;
   231:   if(best) return {nb:best.nb};
   232:   return {nb: fallback ? fallback.nb : 'P'};
  ```

- **野球としての正しい行動**: 後退中でも塁間にいる走者はアウト対象なので、走者の位置と向きを見て戻り先への送球または詰め寄りを選ぶ。
- **重大度**: 中（非強制走者が進塁を取りやめて戻る場面で、守備が送球機会を失う）。

### 指摘4: 送球に負けていても固定の余裕時間で自動進塁させる

- **場面**: 外野手が打球を処理し、走者が次の塁へ進むか止まるかを決める場面。たとえば先頭走者で、次の塁への走者到達が送球到達より0.3秒遅い場面。
- **今のコードがする行動**: 先頭走者には0.55秒、先頭以外には1.35秒の固定余裕を足し、走者が送球より遅くても `runnerETA < throwETA + slack` なら次の塁へ進ませる。上の例では、送球が先に着くのに進塁を選ぶ。

  **コード引用（逐語）**:

  ```js
   236: function safeReach(r, f){
   239:   const lead=runners.filter(x=>!x.out && x.p<4-1e-9).sort((a,b)=>b.p-a.p)[0];
   240:   /* 先頭の走者にも少しだけ余裕を見る。実際の走塁でも、間一髪なら回す（送球が逸れる・
   241:      捕り損ねる可能性があるため）。ここを0にすると確実な時しか走らず、単打で誰も還れない。 */
   242:   const slack=(r===lead)?0.55:1.35;
   243:   let best=Math.max(r.origin, Math.floor(r.p+1e-9));
   244:   for(let b=best+1; b<=4; b++){
   245:     if(runnerETA(r,b) < throwETAof(f,b)+slack) best=b; else break;
   246:   }
   247:   return best;
  ```

- **野球としての正しい行動**: 送球が先に到達する見込みなら基本は手前の塁で止まり、進む判断は実際の送球の方向・走者の位置・守備の乱れを見て行う。
- **重大度**: 中（外野返球で、アウトになり得る走者を自動的に次の塁へ進ませる）。固定余裕を採用する妥当性は数値較正の問題ではなく、進塁判断の分岐そのものにある。

### 指摘5: 塁から約3フィート以内の走者をタッチ不能として扱う

- **場面**: 野手がボールを持って走者へ近づき、走者が塁そのものには触れていないが、塁から約3フィート以内にいる場面。
- **今のコードがする行動**: `p` の整数値から0.035以内なら「塁の上」としてタッチ判定をスキップする。指示書の前提どおり `p` は塁間の連続値で、コード自身が1塁間を90ftとしているため、0.035は約3.15ftである。

  **コード引用（逐語）**:

  ```js
     7: const RUN_SPEED = 1/90;                  // 1ft/秒あたりの塁進行。走力から出した速度を掛ける
   307: function tagNearbyRunner(holder){
   309:   for(const r of runners){
   310:     if(r.out) continue;
   311:     if(Math.abs(r.p-Math.round(r.p))<0.035) continue;   // 塁の上にいる走者は触れてもセーフ
   312:     if(r.p>=4-1e-6) continue;                            // 生還済み
   313:     const q=runnerPos(r);
   314:     if(Math.hypot(holder.cx-q.x, holder.cy-q.z) < 3.0){ markOut(r,'tag'); return r; }
  ```

- **野球としての正しい行動**: 走者が塁に実際に触れていなければ、ボールを持った野手はタッチできる。塁から近いことだけで安全扱いしない。
- **重大度**: 中（挟殺・牽制・ベース際のタッチで、塁に触れていない走者を取り逃がす）。

### 指摘6: 挟殺で実際のタッチなしに時間・抽象的な幅だけでアウトにする

- **場面**: 走者が二塁・三塁間などで挟まれ、野手が追い込み中だが、ボールを持つ野手がまだ走者へタッチできていない場面。
- **今のコードがする行動**: 走者の使える範囲 `hiLim-loLim` が0.13未満になるだけでタッチ判定なしにアウトにし、さらに挟殺開始から9秒経過してもタッチ判定なしにアウトにする。実際の走者位置と保持者の距離が条件に入っていない。

  **コード引用（逐語）**:

  ```js
   531:     if(Math.hypot(R.holder.cx-rp.x, R.holder.cy-rp.z) < 3.0){
   532:       markOut(r,'tag'); return endRundown('タッチアウト！','#95a3b4');
   533:     }
   534:     // 逃げ場が無くなったらタッチアウト
   535:     if(R.hiLim-R.loLim < 0.13){ markOut(r,'tag'); return endRundown('タッチアウト！','#95a3b4'); }
   ...
   568:       /* 走者は急停止して逆走する。切り返しのたびに止まって加速し直すので、
   569:          そのぶん詰められる（挟殺で走者が追い込まれていくのはこのため）。 */
   570:       r.extra=0; setAutoGoal(r, away); r.v=0;
   571:     }
   572:     if(R.t>9){ markOut(r,'tag'); return endRundown('タッチアウト！','#95a3b4'); }
  ```

- **野球としての正しい行動**: 挟殺のアウトは、走者へのタッチ、または走者が走路から大きく外れた場合など、規則上のアウト事由が成立した瞬間だけ宣告する。経過時間や抽象的な逃げ幅だけではアウトにしない。
- **重大度**: 中（挟殺という頻度の低い場面だが、成立すればセーフ／アウトが直接変わる）。

### 指摘7: 挟殺の両端に同じ野手を割り当てられる

- **場面**: 走者が二塁・三塁間などで挟まれ、保持者以外の野手のうち、同じ野手が両方の塁に最も近い位置にいる場面。
- **今のコードがする行動**: `beginRundown` が上下の塁に対して `rundownCover` を連続で呼ぶが、2回目の呼び出しで1回目に割り当てた野手を除外しない。したがって同じ野手の `coverBase` が後の塁で上書きされ、一方の塁が無人になる。

  **コード引用（逐語）**:

  ```js
   477: function rundownCover(base, exclude){
   478:   const p=throwPoint(base);
   479:   let best=null,bd=1e9;
   480:   fielders.forEach(f=>{ if(f===exclude) return;
   481:     const d=Math.hypot(p[0]-f.cx,p[1]-f.cy); if(d<bd){bd=d;best=f;} });
   482:   if(best){ best.coverBase=base; setTarget(best,p[0],p[1]); }
   483:   return best||fielders[0];
   ...
   499: function beginRundown(r, hi){
   505:   T.rd={ r, hi, lo, loLim:lo, hiLim:hi, holder:(T.receiver||T.thrower), sub:'chase', t:0, ex:0 };
   506:   // 挟殺が始まったら、両側の塁にそれぞれ別の野手が入る（遊撃手・三塁手も加わる）
   507:   rundownCover(hi, T.rd.holder);
   508:   rundownCover(lo, T.rd.holder);
  ```

- **野球としての正しい行動**: 挟殺の両端には保持者以外の別々の野手を配置し、片側への送球後も反対側の帰塁先を空けない。
- **重大度**: 中（最短距離の野手が両塁に近い配置で、帰塁先のカバーが消える）。

### 指摘8: 中継野手の選定でベースカバーを外してしまう

- **場面**: 深い外野打球で、外野手から目的塁まで肩が届かず中継が必要な場面。たとえば一塁走者がいるため、一塁手が一塁カバーに入っている場面。
- **今のコードがする行動**: 目的塁までの経路が短い野手を、`coverBase` の有無や、その野手が守っている塁の重要性を確認せず中継役にする。中継役に選ばれた野手は送球地点へ移動し、元のベースカバーを維持する別役を同時には立てない。

  **コード引用（逐語）**:

  ```js
   381:       // 投手への返球は投手本人が受ける。それ以外はカバーに入っている野手が受ける
   382:       let recv = (T.target==='P') ? fielders.find(f=>f.n==='投') : coverOf(T.target, T.thrower);
   383:       let p = (T.target==='P' && recv) ? [recv.cx, recv.cy] : throwPoint(T.target);
   389:       if(far>maxD){
   390:         let cut=null,cd=1e9;
   391:         fielders.forEach(f=>{ if(f===T.thrower) return;
   392:           const t=Math.hypot(p[0]-f.cx,p[1]-f.cy)+Math.hypot(f.cx-T.thrower.cx,f.cy-T.thrower.cy);
   393:           if(t<cd && Math.hypot(f.cx-T.thrower.cx,f.cy-T.thrower.cy)<maxD){ cd=t; cut=f; } });
   394:         if(cut){ recv=cut; p=[cut.cx,cut.cy]; T.relayTo=T.target; }
   395:       }
   396:       launchThrow(T.thrower.cx,T.thrower.cy,p[0],p[1],armEff(T.thrower));
   688:   fielders.forEach(f=>{ f.coverBase=null; });
   689:   const put = (b, names) => { const f=take(names); if(f){ f.coverBase=b; const p=throwPoint(b); setTarget(f,p[0],p[1]); } };
   690:   put(1, ['一','投','二']);          // 一塁手が捕りに出たら投手が入る
  ```

- **野球としての正しい行動**: ベースカバーを崩さない野手を中継に選び、必要なら中継に入った野手が抜けた塁を別の野手が埋める。
- **重大度**: 中（候補野手の位置関係によって、返球中に本来のベースが無人になる）。発生頻度は実際の座標と打球ごとの配置を実行しないと確定できないが、除外条件がないことはコード上確定している。

### 指摘9（仮説）: 送球先選択が実在する中継野手を使わない仮想中継で評価される

- **場面**: 外野手から本塁・三塁などへ直接届かない深い打球で、どの塁へ返すかを決める場面。
- **今のコードがする行動**: `throwETAof` は、肩が届かない場合に `maxD*0.62` の地点で中継される前提の2本の飛行時間を足すが、その地点に実際の中継野手がいるか、誰が捕ってどの塁を守っているかを使わない。このETAが `chooseThrowTarget` の塁選択に使われるため、実際の中継体制と違う「間に合う／間に合わない」を根拠に送球先を選ぶ可能性がある。

  **コード引用（逐語）**:

  ```js
   146: function throwETAof(f, b){
   149:   const reach=110 + 60*(armEff(f)-0.55), maxD=reach*reach/32.2*0.92;
   150:   const transfer=A.transfer(f.fld,f.cat);
   151:   let t;
   152:   if(d>maxD){                                  // 肩が届かない＝中継が入る
   153:     const d1=maxD*0.62;
   154:     t = transfer + throwFlightTime(d1,armEff(f)) + transfer*0.7 + throwFlightTime(d-d1,armEff(f)) + 0.28;
   155:   }else{
   156:     t = transfer + throwFlightTime(d,armEff(f)) + 0.28;
   157:   }
   158:   // 送球が着いても、塁に人がいなければアウトにはできない。遅い方が成立時刻
   159:   return Math.max(t, coverArrival(b, f)) + 0.12;   // 受けてからタッチするまでの時間
   ```

- **野球としての正しい行動**: 実際に中継へ入る野手の位置・ベースカバー・中継後の送球可能性を比較してから、返球先を選ぶ。
- **重大度**: 中（深い外野打球で送球先の優先順位が変わり得る）。実際にどの場面で結果が逆転するかは座標と走者状態を実行していないため、仮説として扱う。

### 指摘10: 飛球の離塁アウトを封殺として記録する

- **場面**: 走者が三塁から早く離れ、飛球捕球後に三塁へ戻り切っていないため、守備が三塁へ送球してアピールする場面。
- **今のコードがする行動**: 元の塁を離れて戻れていない走者を `markOut(back,'force')` でアウトにする。飛球捕球後のリタッチ失敗は封殺ではなく、元の塁へのアピールアウト（または走者へのタッチ）である。

  **コード引用（逐語）**:

  ```js
   618:   if(T.kind==='fly'){
   620:     // 離塁していて戻り切れていない走者は離塁アウト。タッチアップ組は間に合えばセーフ
   621:     /* 離塁アウトにできるのは、投げた塁を元の塁とする走者だけ。
   622:        送球先と無関係に「一番離れている走者」を選ぶと、一塁へ投げて三塁走者がアウトになる。 */
   623:     const back = runners.filter(r=>!r.out && r.mustReturn && r.origin===b && Math.abs(r.p-r.origin)>0.02)
   624:                         .sort((x,y)=>Math.abs(y.p-y.origin)-Math.abs(x.p-x.origin))[0];
   625:     if(back && Math.abs(back.p-back.origin)>0.02){
   626:       markOut(back,'force');
   627:       T.flyText='離塁アウト！';
  ```

- **野球としての正しい行動**: 捕球後に元の塁へ戻っていない走者は、守備がその塁を踏んでアピールするか走者にタッチしてアウトにする。封殺として扱わない。
- **重大度**: 中（アウト自体は成立し得るが、封殺とアピール／タッチの区別が記録・3アウト目の得点処理に影響する可能性がある。`markOut` の下流処理はこの抜粋にないため、影響範囲は未確定）。

## 観点別の整理

- **送球先の選択**: 指摘1〜4、指摘9。
- **ベースカバー**: 指摘7、指摘8。
- **中継・カットオフ**: 指摘8、指摘9。
- **挟殺プレー**: 指摘6、指摘7。なお、`goal` を読む問題は指摘1にも含む。
- **走者が塁間にいる時の判断**: 指摘1、指摘3、指摘6。
- **走者の自動進塁**: 指摘4。
- **タッチアップ・離塁アウト**: 指摘1、指摘10。
- **封殺とタッチの区別**: 指摘1、指摘5、指摘10。
- **3アウト目の得点無効**: **該当なし**。この抜粋内には ground play 後の得点確定を完結させる `finishPlay` の実装がなく、推測で追加指摘しない。飛球の離塁アウトの種別誤りは指摘10として別に扱った。

## そもそも守備の判断として実装されていない概念

以下は「この抜粋内で確認できない」ことを根拠にした整理であり、抜粋外のコードに存在する可能性は断定しない。

1. **状況別の守備位置取り**: 前進守備、定位置、深め、内野のダブルプレー深度、内野前進時の本塁優先、三塁線・一塁線の詰め、外野の守備深度がない。`buildFielders` は全員を `POS_HOME` の固定座標に置き、`startFlight` 後は残った野手を打球方向へ一律25%移動させるだけである。

   **コード引用（逐語）**:

   ```js
    15: // 守備側チームの9人から守備陣を作る
    16: function buildFielders(team){
    17:   return ROSTER[team].map(p=>{
    18:     const h=POS_HOME[p.pos]||POS_HOME['投'];
    19:     return {n:p.pos, name:p.n, x:h.x, y:h.y,
    20:       sp:A.speed(p.走), zone:A.zone(p.守), arm:A.arm(p.肩), fld:p.守, cat:p.捕,
    21:       cx:h.x, cy:h.y, tx:h.x, ty:h.y, primary:false, run:0, face:0, v:0};
    22:   });
    23: }
   694:   fielders.forEach(f=>{
    695:     if(f.primary){ setTarget(f, plan.x, plan.y); return; }
    696:     if(assigned.has(f)) return;
    697:     setTarget(f, f.x+(plan.x-f.x)*0.25, f.y+(plan.y-f.y)*0.25);   // 残りは打球方向へ
    698:   });
   ```

2. **点差・イニング・アウト数に応じた守備優先順位**: 1点を防ぐため本塁を最優先する、無理な本塁送球を避けて確実に一つ取る、同点・リード時で進塁許容を変える、といった戦略の入力が `chooseThrowTarget` に見当たらない。関数は野手 `f` と走者の到達時間を中心に判断している。

   **コード引用（逐語）**:

   ```js
    198: function chooseThrowTarget(f){
    199:   const throwETA=b=>throwETAof(f,b);
    204:   const live=runners.filter(r=>!r.out && (
    205:     r.dir>0 || (r.origin===0 && r.p<1) || (r.origin>0 && isForced(r) && r.p<r.origin+1)));
    206:   let best=null, fallback=null;
    207:   for(const r of live){
    218:     for(let b=nextB; b<=bMax; b++){
    219:       const te=throwETA(b), re=runnerETA(r,b);
    220:       const m = re - te - ((b===4)?0.35:0.05);
    221:       if(m>0){                                    // ここなら刺せる
    222:         if(!best || b>best.nb) best={nb:b};
    223:         break;
    224:       }
    231:   if(best) return {nb:best.nb};
    232:   return {nb: fallback ? fallback.nb : 'P'};
   ```

3. **バント守備の作戦選択**: 無死一塁のバントで三塁を取るか、一塁を確実に取るか、本塁を守るか、誰が前進して処理するかという分岐がない。この抜粋の打球処理は `infield` と `outfield` の二分だけである。

   **コード引用（逐語）**:

   ```js
    835:   if(ball.landed && ((d2<CATCH_R && ball.z<6.0) || ball.t>7) || ball.t>9){
    836:     const fd=Math.hypot(prim.cx,prim.cy);
    837:     if(fd<158 && ball.maxZ<26){ beginThrowPhase(prim,'infield',1); return true; }
    838:     beginThrowPhase(prim,'outfield',1); return true;   // 塁打数は走者の到達で決まる
   ```

4. **牽制・盗塁に対する守備側の事前設計**: `pickoff` の結果判定はあるが、いつ牽制するか、二塁牽制で遊撃手・二塁手のどちらが入りどこへ返球するか、盗塁時に中間守備へどう動くかという選択は、この抜粋内では確認できない。

   **コード引用（逐語）**:

   ```js
    594: function judgeAtBase(b){
    596:   if(T.kind==='pickoff'){
    597:     // 飛び出した走者が塁へ戻れていなければアウト。塁間で捕まったら挟殺へ
    598:     const cand=runners.filter(r=>!r.out && r.jumped && Math.abs(r.p-b)>0.02)
    604:     return concludeSteal();
    606:   if(T.kind==='steal'){
    607:     // 盗塁はタッチプレー。送球が着いた時に走者が塁に達していなければアウト
   ```

5. **打球別の中継・バックアップ配置**: 実際に誰がカットに入り、誰が後方バックアップをするかを打球方向・走者・送球先別に事前配置する概念がない。存在するのは、送球距離が肩の範囲を超えたときに全野手から距離だけで `cut` を選ぶ処理である。これは指摘8・9の根拠でもある。

   **コード引用（逐語）**:

   ```js
    389:       if(far>maxD){
    390:         let cut=null,cd=1e9;
    391:         fielders.forEach(f=>{ if(f===T.thrower) return;
    392:           const t=Math.hypot(p[0]-f.cx,p[1]-f.cy)+Math.hypot(f.cx-T.thrower.cx,f.cy-T.thrower.cy);
    393:           if(t<cd && Math.hypot(f.cx-T.thrower.cx,f.cy-T.thrower.cy)<maxD){ cd=t; cut=f; } });
    394:         if(cut){ recv=cut; p=[cut.cx,cut.cy]; T.relayTo=T.target; }
   ```

