from pathlib import Path
import re, sys


def replace_once(text, old, new, label):
    n=text.count(old)
    if n!=1:
        raise RuntimeError(f'{label}: expected 1 occurrence, found {n}')
    return text.replace(old,new,1)

TRANSFER_INSERT = r'''
/* 送球準備時間は「ボールをどう手に入れたか」で分ける。
   内野ゴロは打球を処理し、握り替え、送球先を選び、体勢を立て直すので守備力が強く効く。
   一方、けん制・挟殺・中継などの正確な送球を胸元で受けた後は、すでに捕球が完了しており、
   守備範囲の能力で1秒近く待たせない。捕球と送球精度だけを小さく効かせる。 */
function transferTime(f, context){
  const fld=clamp((f&&f.fld)||60,1,100)/100;
  const cat=clamp((f&&f.cat)||60,1,100)/100;
  const acc=clamp((f&&f.acc)||60,1,100)/100;
  switch(context){
    case 'pitcher-hold':       return 0.14 + 0.06*(1-acc);
    case 'pickoff-receive':    return 0.10 + 0.07*(1-cat) + 0.06*(1-acc);
    case 'rundown-receive':    return 0.11 + 0.08*(1-cat) + 0.06*(1-acc);
    case 'relay-receive':      return 0.16 + 0.09*(1-cat) + 0.07*(1-acc);
    case 'throw-receive':      return 0.14 + 0.10*(1-cat) + 0.08*(1-acc);
    case 'double-play-pivot':  return 0.20 + 0.10*(1-fld) + 0.08*(1-cat) + 0.06*(1-acc);
    case 'held-ball':          return 0.10 + 0.05*(1-acc);
    case 'batted-air':         return 0.42 + 0.18*(1-fld) + 0.18*(1-cat);
    case 'batted-ground':
    default:                    return A.transfer((f&&f.fld)||60,(f&&f.cat)||60);
  }
}
function setTransferContext(T,f,context,jitter){
  if(!T||!f) return 0;
  T.transferContext=context;
  f.possessionContext=context;
  T.transfer=transferTime(f,context)+(jitter?rnd(0,jitter):0);
  return T.transfer;
}
function receiveTransferContext(T){
  if(!T) return 'throw-receive';
  if(T.kind==='breakaway'||T.kind==='pickoff') return 'pickoff-receive';
  if(T.stage==='rundown'||T.decisionSource==='rundown-turn') return 'rundown-receive';
  if(T.relayTo!=null) return 'relay-receive';
  return 'throw-receive';
}
function transferContextForBattedBall(kind){
  return kind==='fly' || (ball && !ball.landed) ? 'batted-air' : 'batted-ground';
}
'''

BREAKAWAY_HELPERS = r'''
/* 投球前の早出しは通常の「けん制」ではなく、投手がボールを持ったままのライブな飛び出し。
   投手は元の塁へ固定せず、現在の走者の位置と進行方向から一〜本塁のどこへでも投げる。 */
function breakawayFallbackTarget(r){
  if(!r) return 'P';
  const dir=runnerObservedDir(r);
  if(dir<0) return clamp(Math.floor(r.p+1e-9),1,4);
  if(dir>0) return clamp(Math.ceil(r.p-1e-9),1,4);
  return clamp(r.origin,1,4);
}
function activeBreakawayRunner(){
  /* jumped は『このプレーを始めた印』であり、塁に着いた後も残る。
     現在も塁間にいる／動いている／次塁への未完の命令がある走者だけをライブとする。 */
  return runners.filter(r=>{
      if(r.out || r.p>=4-1e-9) return false;
      const offBase=Math.abs(r.p-Math.round(r.p))>=0.02;
      const moving=runnerObservedDir(r)!==0 || Math.abs((r.goal??r.p)-r.p)>=0.02;
      return offBase || moving;
    })
    .sort((a,b)=>{
      const ah=(a.p>3&&runnerObservedDir(a)>0)?10:0;
      const bh=(b.p>3&&runnerObservedDir(b)>0)?10:0;
      return (bh+b.p)-(ah+a.p);
    })[0]||null;
}
function decideBreakawayTarget(f,currentTarget){
  const live=activeBreakawayRunner();
  if(!live) return {nb:'P',source:'breakaway-settled',reason:'all-runners-settled',margin:0,utility:0};
  const d=decideThrowTarget(f,{kind:'live',homeIfAdvancing:true,
    fallbackTarget:breakawayFallbackTarget(live),currentTarget,
    manualTarget:(!isPlayerBatting()?manualThrow:null)});
  return {...d,source:d.source==='auto'?'breakaway-auto':d.source};
}
function continueBreakaway(holder,reason){
  const T=throwPlay;
  const live=activeBreakawayRunner();
  if(!live || baseOuts()+countOuts()>=3){
    T.stealText=T.stealText||'飛び出しから戻ってセーフ';
    return concludeSteal();
  }
  const d=decideBreakawayTarget(holder,T.target);
  if(d.nb==='P'){
    T.stealText=T.stealText||'飛び出しから戻ってセーフ';
    return concludeSteal();
  }
  T.thrower=holder; T.receiver=null; T.relayed=false;
  T.stage='transfer'; T.t=0; T.stepChecked=false;
  setTransferContext(T,holder,'pickoff-receive',0.04);
  setThrowTarget(T,d.nb,'breakaway-continue-'+(reason||d.source),d);
  setMsg('飛び出しが続く！','','#ffc23d');
}
function judgeBreakawayAtBase(b){
  const T=throwPlay, holder=T.receiver||T.thrower;
  const forward=runners.filter(r=>!r.out && r.p<b-0.01 && r.p>b-1.001 && runnerObservedDir(r)>0)
    .sort((a,c)=>c.p-a.p)[0];
  const backward=runners.filter(r=>!r.out && r.p>b+0.01 && r.p<b+1.001 && runnerObservedDir(r)<0)
    .sort((a,c)=>a.p-c.p)[0];
  const cand=forward||backward;
  if(cand){
    const eta=forward?runnerETA(cand,b):runnerBackETA({...cand,goal:b});
    if(eta>0.02){
      markOut(cand,'tag');
      T.stealText='飛び出しアウト！';
      if(baseOuts()+countOuts()>=3) return concludeSteal();
    }
  }
  return continueBreakaway(holder,'base-'+b);
}
'''


def patch(path:Path, build:str):
    text=path.read_text(encoding='utf-8')
    text=re.sub(r"const BUILD = 'b0805-26(?:-defense1)?';", f"const BUILD = '{build}';", text, count=1)
    if f"const BUILD = '{build}';" not in text:
        raise RuntimeError('build replacement failed')

    old="""      de:r2(throwPlay.decisionExpectedOuts||0), dc:r2(throwPlay.decisionContinuationProbability||0),
      ra:throwPlay.rd?throwPlay.rd.actionReason||'':'', rm:throwPlay.rd?r2(throwPlay.rd.actionMargin||0):0,"""
    new="""      de:r2(throwPlay.decisionExpectedOuts||0), dc:r2(throwPlay.decisionContinuationProbability||0),
      pc:throwPlay.transferContext||'', pt:r2(throwPlay.transfer||0),
      ra:throwPlay.rd?throwPlay.rd.actionReason||'':'', rm:throwPlay.rd?r2(throwPlay.rd.actionMargin||0):0,"""
    text=replace_once(text,old,new,'recording transfer context')
    text=text.replace('dc=併殺転送確率 / ball.cm=', 'dc=併殺転送確率 pc=保球文脈 pt=送球準備秒 / ball.cm=',1)

    marker="""  loft:  v => [3,8,12,16][clamp(v,1,4)-1]    // 弾道1〜4 → 打球角度の基準（実測の平均は約12度）
};"""
    text=replace_once(text,marker,marker+"\n"+TRANSFER_INSERT,'transfer model insert')

    old="""      cx:h.x, cy:h.y, tx:h.x, ty:h.y, primary:false, coverBase:null,
      roleSource:'init', roleSeq:0, run:0, face:0, v:0};"""
    new="""      cx:h.x, cy:h.y, tx:h.x, ty:h.y, primary:false, coverBase:null,
      roleSource:'init', roleSeq:0, run:0, face:0, v:0, possessionContext:'none'};"""
    text=replace_once(text,old,new,'fielder possession')

    marker2="""  T.decisionSource=source||'decision'; T.decisionSeq=(T.decisionSeq||0)+1;
  return true;
}"""
    text=replace_once(text,marker2,marker2+"\n"+BREAKAWAY_HELPERS,'breakaway helpers')

    old="""  const transfer=A.transfer(f.fld,f.cat);
  let t;"""
    new="""  const ctx=(throwPlay&&throwPlay.thrower===f&&throwPlay.transferContext)
    ||f.possessionContext||'batted-ground';
  const transfer=transferTime(f,ctx);
  let t;"""
    text=replace_once(text,old,new,'throw ETA context')
    text=replace_once(text,
        "const transfer=A.transfer(receiver.fld,receiver.cat)*0.75+0.16;",
        "const transfer=transferTime(receiver,'double-play-pivot');",
        'DP estimate context')

    old="""    transfer: A.transfer(f.fld,f.cat) + rnd(0,0.10)
              + (Math.random()<A.fumble(f.cat) ? rnd(0.55,1.15) : 0),
    thrower:f, kind, award,"""
    new="""    transfer: transferTime(f,transferContextForBattedBall(kind)) + rnd(0,0.10)
              + (Math.random()<A.fumble(f.cat) ? rnd(0.55,1.15) : 0),
    transferContext:transferContextForBattedBall(kind),
    thrower:f, kind, award,"""
    text=replace_once(text,old,new,'initial batted transfer')
    text=text.replace("  ball.vx=0; ball.vy=0; ball.vz=0; ball.z=4.6;\n  ball.x=f.cx; ball.y=f.cy;",
                      "  f.possessionContext=throwPlay.transferContext;\n  ball.vx=0; ball.vy=0; ball.vz=0; ball.z=4.6;\n  ball.x=f.cx; ball.y=f.cy;",1)

    contextual_replacements=[
      ("""        T.thrower=holder; setThrowTarget(T,nxt.nb,'post-tag-'+nxt.source); T.stage='transfer'; T.t=0;
        T.stepChecked=false; T.relayed=true;      // 追加の送球（併殺の2つ目）
        T.transfer=A.transfer(holder.fld,holder.cat)*0.75+0.16;""",
       """        T.thrower=holder; setThrowTarget(T,nxt.nb,'post-tag-'+nxt.source); T.stage='transfer'; T.t=0;
        T.stepChecked=false; T.relayed=true;      // 追加の送球（併殺の2つ目）
        setTransferContext(T,holder,'held-ball',0.03);""", 'post-tag'),
      ("T.transfer=A.transfer(T.thrower.fld,T.thrower.cat)*0.7+0.12;",
       "setTransferContext(T,T.thrower,'relay-receive',0.04);", 'relay'),
      ("""    T.stage='transfer'; T.t=0; T.stepChecked=false;
    T.transfer=A.transfer(holder.fld,holder.cat)*0.75+0.16;
    setThrowTarget(T,tgtBase,'rundown-turn');""",
       """    T.stage='transfer'; T.t=0; T.stepChecked=false;
    setTransferContext(T,holder,'rundown-receive',0.04);
    setThrowTarget(T,tgtBase,'rundown-turn');""", 'end rundown'),
      ("""    T.stage='transfer'; T.t=0; T.stepChecked=false;
    T.transfer=A.transfer(holder.fld,holder.cat)*0.75+0.16;
    setThrowTarget(T,decision.nb,'return-continue-'+decision.source);""",
       """    T.stage='transfer'; T.t=0; T.stepChecked=false;
    setTransferContext(T,holder,'throw-receive',0.04);
    setThrowTarget(T,decision.nb,'return-continue-'+decision.source);""", 'return continue'),
      ("""        T.stage='transfer'; T.t=0; T.stepChecked=false;
        T.transfer=A.transfer(holder.fld,holder.cat)*0.75+0.16;
        const nx=decideThrowTarget(holder,{kind:'live',fallbackTarget:Math.min(4,b+1)});""",
       """        T.stage='transfer'; T.t=0; T.stepChecked=false;
        setTransferContext(T,holder,'throw-receive',0.04);
        const nx=decideThrowTarget(holder,{kind:'live',fallbackTarget:Math.min(4,b+1)});""", 'steal continue'),
      ("T.transfer=A.transfer(T.thrower.fld,T.thrower.cat)*0.75+0.16; setThrowTarget(T,1,'double-play');",
       "setTransferContext(T,T.thrower,'double-play-pivot',0.04); setThrowTarget(T,1,'double-play');", 'DP actual'),
      ("""      T.stage='transfer'; T.t=0; T.stepChecked=false; T.relayed=true;
      T.transfer=A.transfer(holder.fld,holder.cat)*0.75+0.16;
      ball.x=holder.cx; ball.y=holder.cy;""",
       """      T.stage='transfer'; T.t=0; T.stepChecked=false; T.relayed=true;
      setTransferContext(T,holder,'throw-receive',0.04);
      ball.x=holder.cx; ball.y=holder.cy;""", 'chase'),
      ("""        T.stage='transfer'; T.t=0; T.stepChecked=false;
        T.transfer=A.transfer(holder.fld,holder.cat)*0.75+0.16;
        setThrowTarget(T,nxt.nb,'conclude-continue-'+nxt.source);""",
       """        T.stage='transfer'; T.t=0; T.stepChecked=false;
        setTransferContext(T,holder,'throw-receive',0.04);
        setThrowTarget(T,nxt.nb,'conclude-continue-'+nxt.source);""", 'conclude continue'),
    ]
    for old,new,label in contextual_replacements:
      text=replace_once(text,old,new,label)
    remaining=[line for line in text.splitlines() if 'T.transfer=A.transfer' in line]
    if remaining:
      raise RuntimeError('unreplaced T.transfer A.transfer remains: '+repr(remaining))

    old="""      T.stage='catch'; T.t=0;
      T.catchDur = rnd(0.04,0.30)*(1.30-armEff(T.thrower))*2.0;"""
    new="""      T.stage='catch'; T.t=0;
      const recvCat=clamp((T.receiver&&T.receiver.cat)||60,1,100)/100;
      T.catchDur = 0.04 + 0.08*(1-recvCat) + (T.chased?0.12:0) + rnd(0,0.04);
      if(T.receiver) T.receiver.possessionContext=receiveTransferContext(T);"""
    text=replace_once(text,old,new,'throw receive secure time')

    text=text.replace("if(trap && T.kind!=='fly' && !T.relayed){",
                      "if(trap && T.kind!=='fly' && T.kind!=='breakaway' && !T.relayed){",1)

    old="""  if(T.stage==='transfer'){
    ball.x=T.thrower.cx; ball.y=T.thrower.cy; ball.z=4.6;"""
    new="""  if(T.stage==='transfer'){
    ball.x=T.thrower.cx; ball.y=T.thrower.cy; ball.z=4.6;
    if(T.kind==='breakaway'){
      const liveDecision=decideBreakawayTarget(T.thrower,T.target);
      if(liveDecision.nb==='P'){
        T.stealText=T.stealText||'飛び出しから戻ってセーフ';
        return concludeSteal();
      }
      setThrowTarget(T,liveDecision.nb,'breakaway-live-'+liveDecision.source,liveDecision);
    }"""
    text=replace_once(text,old,new,'dynamic breakaway target')

    text=text.replace("if(T.kind==='pickoff'){", "if(T.kind==='pickoff'||T.kind==='breakaway'){",1)
    text=text.replace("const tr=runners.find(r=>!r.out && r.origin===T.target);",
                      "const tr=T.kind==='pickoff'?runners.find(r=>!r.out && r.origin===T.target):null;",1)
    text=text.replace("function judgeAtBase(b){\n  const T=throwPlay;\n  if(T.kind==='pickoff')", 
                      "function judgeAtBase(b){\n  const T=throwPlay;\n  if(T.kind==='breakaway') return judgeBreakawayAtBase(b);\n  if(T.kind==='pickoff')",1)

    old_func=re.search(r"/\* 牽制。投球前に飛び出した走者を、投手が塁へ投げて刺しにくる。[\s\S]*?\nfunction beginStealThrow", text)
    if not old_func:
      raise RuntimeError('beginPickoff block not found')
    new_block=r'''/* 投球前に走者が飛び出した。これは通常のけん制ではなく、投手が保球したままのライブプレー。
   投手は元の塁へ固定せず、走者の現在位置と進行方向から最もアウト価値の高い塁へ投げる。 */
function beginBreakaway(){
  S.jumpEarly=false;
  const pit = fielders.find(f=>f.n==='投') || fielders[0];
  const jump = runners.filter(r=>!r.out && r.jumped && r.origin<4)
                      .sort((a,b)=>(b.p-b.origin)-(a.p-a.origin))[0];
  if(!jump){ S.phase='windup'; S.timer=0.3; return; }
  clearAllCoverRoles('breakaway-reset');
  const map={1:'一',2:'遊',3:'三',4:'捕'};
  [1,2,3,4].forEach(b=>{ const f=fielders.find(x=>x.n===map[b]);
    if(f) assignCoverRole(f,b,'breakaway-cover'); });
  const decision=decideBreakawayTarget(pit,breakawayFallbackTarget(jump));
  ball={x:pit.cx, y:pit.cy, z:4.4, t:0, vx:0, vy:0, vz:0, landed:false, maxZ:0};
  throwPlay={ stage:'transfer', t:0,
    transfer:transferTime(pit,'pitcher-hold'), transferContext:'pitcher-hold',
    thrower:pit, kind:'breakaway', award:0, target:decision.nb,
    decisionSource:decision.source, decisionSeq:1, decisionReason:decision.reason||'',
    decisionMargin:decision.margin||0, decisionUtility:decision.utility||0,
    relayed:false, fieldT:0, jumpLead:Math.max(0,jump.p-jump.origin) };
  pit.possessionContext='pitcher-hold';
  S.phase='throwing'; S.fieldView=true; trail=[];
  setMsg('飛び出した！','','#ffc23d'); ui();
}
/* 捕手から盗塁を刺しに行く送球。打球のプレーとは別に、投球結果の適用を保留して先に決着させる。 */
function beginStealThrow'''
    text=text[:old_func.start()]+new_block+text[old_func.end():]

    text=text.replace("if(S.jumpEarly) return beginPickoff();          // 投球前に飛び出した＝牽制で刺しにくる",
                      "if(S.jumpEarly) return beginBreakaway();        // 投球前に飛び出した＝投手保球中のライブプレー",1)
    text=text.replace("const text = throwPlay && throwPlay.stealText ? throwPlay.stealText : '盗塁成功！';",
                      "const text = throwPlay && throwPlay.stealText ? throwPlay.stealText : (throwKind==='breakaway'?'飛び出しから進塁！':'盗塁成功！');",1)
    text=text.replace("S.stealAfter = (throwKind==='pickoff') ? 'none' : S.pendingStrike;",
                      "S.stealAfter = (throwKind==='pickoff'||throwKind==='breakaway') ? 'none' : S.pendingStrike;",1)
    text=text.replace("(throwPlay.kind==='pickoff' ? '牽制' : `${nm}ゴロ`)",
                      "(throwPlay.kind==='pickoff' ? '牽制' : (throwPlay.kind==='breakaway' ? '飛び出し' : `${nm}ゴロ`))",1)
    text=text.replace("守備力…守備範囲の広さ＋捕ってから投げるまでの動作の速さ<br>",
                      "守備力…守備範囲の広さ＋打球を処理して投げるまでの動作の速さ<br>",1)
    text=text.replace("<span style=\"color:#e8eef5\">持ち替え時間は守備力と捕球の両方で決まります</span>",
                      "<span style=\"color:#e8eef5\">打球処理は守備力＋捕球、送球の受け直しは捕球＋送球で決まります</span>",1)

    out=path.with_name(path.stem.replace('b0805-26','b0805-28')+'.html')
    out.write_text(text,encoding='utf-8')
    print(out)
    return out

if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    game=root/'baseball3d.html'
    patched=patch(game,'b0805-28')
    if patched!=game:
        game.write_text(patched.read_text(encoding='utf-8'),encoding='utf-8')
        patched.unlink()
    wf=root/'.github/workflows/baseball3d-regression.yml'
    w=wf.read_text(encoding='utf-8')
    w=w.replace('      - "_test_force_chain_decision_20260809.js"\n',
                '      - "_test_force_chain_decision_20260809.js"\n      - "_test_breakaway_transfer_context_20260810.js"\n')
    w=w.replace("assert \"const BUILD = 'b0805-26';\" in src","assert \"const BUILD = 'b0805-28';\" in src")
    w=w.replace('          node --check _test_force_chain_decision_20260809.js\n',
                '          node --check _test_force_chain_decision_20260809.js\n          node --check _test_breakaway_transfer_context_20260810.js\n')
    w=w.replace('          node _test_force_chain_decision_20260809.js\n',
                '          node _test_force_chain_decision_20260809.js\n          node _test_breakaway_transfer_context_20260810.js baseball3d.html\n')
    wf.write_text(w,encoding='utf-8')
