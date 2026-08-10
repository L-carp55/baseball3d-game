from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    path = root / "baseball3d.html"
    text = path.read_text(encoding="utf-8")

    if "const BUILD = 'b0805-29';" in text and "function prepareThrowerFootwork(T)" in text:
        print("b0805-29 possession footwork already applied")
        return

    text = replace_once(
        text,
        "const BUILD = 'b0805-28';",
        "const BUILD = 'b0805-29';",
        "build stamp",
    )

    helper = r'''/* ボールを確保して送球準備へ入った野手は、直前の打球追跡目標を引きずらない。
   はじいた球を拾い直した後などに intercept-replan の古い目標へ走り続けると、
   ボールを手に持ったまま後退しながら送球する。transfer は「足を止めて送球姿勢を作る」段階で、
   自分で塁を踏む step や挟殺で詰める approach は別段階なので、ここでは止めない。 */
function prepareThrowerFootwork(T){
  if(!T || T.stage!=='transfer' || !T.thrower) return false;
  const f=T.thrower;
  setTarget(f,f.cx,f.cy);          // 打球追跡・中継位置などの古い移動目標を破棄
  f.v=0;                           // 送球準備中に旧目標へ惰性移動しない
  const p=throwPoint(T.target);
  const dx=p[0]-f.cx, dy=p[1]-f.cy;
  if(Math.hypot(dx,dy)>0.25) f.face=Math.atan2(dx,dy); // 送球先へ身体を向ける
  return true;
}
'''
    text = replace_once(
        text,
        "function updateThrowPhase(dt){",
        helper + "\nfunction updateThrowPhase(dt){",
        "footwork helper insert",
    )

    text = replace_once(
        text,
        "  updateRunners(dt);\n  moveFielders(dt,true);",
        "  updateRunners(dt);\n"
        "  /* moveFielders より先に保球者を固定する。後から止めると1フレームだけ古い\n"
        "     intercept 目標へ動き、録画上でも後退が残る。 */\n"
        "  if(T.stage==='transfer') prepareThrowerFootwork(T);\n"
        "  moveFielders(dt,true);",
        "pre-move transfer footwork",
    )

    old = """      setThrowTarget(T,liveDecision.nb,'breakaway-live-'+liveDecision.source,liveDecision);
    }
    /* 自分で塁を踏むなら持ち替えは要らない（握り直さず、そのまま踏みに行く）。"""
    new = """      setThrowTarget(T,liveDecision.nb,'breakaway-live-'+liveDecision.source,liveDecision);
    }
    /* transfer 中に送球先が変わった場合も、そのフレームで身体の向きを更新する。 */
    prepareThrowerFootwork(T);
    /* 自分で塁を踏むなら持ち替えは要らない（握り直さず、そのまま踏みに行く）。"""
    text = replace_once(text, old, new, "post-retarget orientation")

    path.write_text(text, encoding="utf-8")
    print("applied b0805-29 possession footwork")


if __name__ == "__main__":
    main()
