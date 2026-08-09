#!/usr/bin/env python3
"""Deterministic browser regression/mutation runner for baseball3d.html."""
from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import subprocess
import tempfile
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BASE = (ROOT / "baseball3d.html").read_text(encoding="utf-8")
HARNESS = (ROOT / "_test_harness_20260804.js").read_text(encoding="utf-8")
MARKER = "  console.log(JSON.stringify(out,null,1));\n  return out;"
EXPOSED = (
    "  const __j=JSON.stringify(out); "
    "document.body.setAttribute('data-harness',encodeURIComponent(__j));\n"
    "  console.log(JSON.stringify(out,null,1));\n  return out;"
)
PRELUDE = (
    '<script>(()=>{let s=0x71D22228>>>0;Math.random=()=>{'
    's^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};})();'
    'window.requestAnimationFrame=()=>0;</script>\n<script>\n"use strict";'
)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return source.replace(old, new, 1)


def build_page(source: str, harness: str, path: Path) -> None:
    source = replace_once(source, '<script>\n"use strict";', PRELUDE, "script prelude")
    source = replace_once(source, "</body>", f"<script>\n{harness}\n</script>\n</body>", "body")
    path.write_text(source, encoding="utf-8")


def browser_json(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8", errors="replace")
    match = re.search(r'data-harness="([^"]+)"', raw)
    if not match:
        raise RuntimeError(f"{path.name}: data-harness missing")
    return json.loads(urllib.parse.unquote(html.unescape(match.group(1))))


def run_chrome(chrome: str, page: Path, dom: Path, timeout: int = 240) -> None:
    cmd = [
        chrome,
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--use-gl=swiftshader",
        "--enable-unsafe-swiftshader",
        "--allow-file-access-from-files",
        "--dump-dom",
        page.as_uri(),
    ]
    proc = subprocess.run(cmd, capture_output=True, timeout=timeout, check=False)
    if proc.returncode:
        raise RuntimeError(
            f"{page.name}: Chromium exit {proc.returncode}\n"
            + proc.stderr.decode("utf-8", errors="replace")[-4000:]
        )
    dom.write_bytes(proc.stdout)


def make_mutations(base: str) -> dict[int, str]:
    out: dict[int, str] = {}
    out[28] = replace_once(
        base,
        "      if(r.origin>=4 || !selected(r)) return;\n",
        "      if(r.origin>=4 || (r.origin!==0 && !selected(r))) return;\n",
        "mut28",
    )
    out[29] = replace_once(
        base,
        "function runnerObservedDir(r){\n  return r.obsDir===1 ? 1 : (r.obsDir===-1 ? -1 : 0);\n}\n",
        "function runnerObservedDir(r){\n  return r.p<r.goal-1e-6 ? 1 : (r.p>r.goal+1e-6 ? -1 : 0);\n}\n",
        "mut29",
    )
    out[30] = replace_once(base, "  if(o.updateAuto!==false) r.autoGoal=goal;\n", "  r.autoGoal=goal;\n", "mut30")
    out[31] = replace_once(
        base,
        "    if(ex.has(f) || f.primary) return;\n    if(f.coverBase!=null && f.coverBase!==base) return;\n",
        "    if(ex.has(f)) return;\n",
        "mut31",
    )
    out[32] = replace_once(base, "      if(handoff.changed) return false;\n", "", "mut32")
    out[33] = replace_once(base, "const REACH_TURN_MAX=0.30;", "const REACH_TURN_MAX=0;", "mut33")
    out[35] = replace_once(base, "const RETARGET_GAIN=0.12;", "const RETARGET_GAIN=0;", "mut35")
    out[36] = replace_once(base, "  if(targetPassedByBall(f.tx,f.ty)) return true;\n", "", "mut36")
    out[37] = replace_once(
        base,
        "  if(o.manualTarget!=null) return {nb:o.manualTarget,source:'manual',locked:true,\n    reason:'manual',margin:0,utility:99};\n",
        "  if(o.manualTarget!=null) return {nb:o.manualTarget==='P'?1:o.manualTarget,source:'manual',locked:true,reason:'mutated',margin:0,utility:99};\n",
        "mut37",
    )
    rule_anchor = "  if(o.kind==='steal' || o.kind==='pickoff' || o.lockCurrent){\n"
    stale = (
        "  if(o.relayed) return {nb:o.currentTarget!=null?o.currentTarget:'P',"
        "source:'relay-fixed',locked:true,reason:'stale',margin:0,utility:99};\n"
        + rule_anchor
    )
    out[38] = replace_once(base, rule_anchor, stale, "mut38")
    out[39] = replace_once(
        base,
        "  if(throwPlay && throwPlay.stage==='transfer') setThrowTarget(throwPlay,t,'manual-live');\n",
        "  if(throwPlay && throwPlay.stage==='transfer') throwPlay.target=(t==='P')?1:t;\n",
        "mut39",
    )
    out[40] = replace_once(
        base,
        "  const liveBall=!!(stageLive && ball && (ball.z>0.8 || ballSpeed>3));\n",
        "  const liveBall=false;\n",
        "mut40",
    )
    out[41] = replace_once(
        base,
        "  const canClose=thirdOut || !(liveBall||keyHeld||unsettled||activeRundown||flyDecision);\n",
        "  const canClose=!(liveBall||keyHeld||unsettled||activeRundown||flyDecision);\n",
        "mut41",
    )
    safe = (
        "  if(T.target==='P' && T.stage!=='rundown' && !flyWait && !keyHeld && allSettled){\n"
        "    /* 終了要求がlive-ball等で拒否された時はreturnしない。ここは物理更新より前なので、\n"
        "       returnすると同じ球位置・速度のまま毎フレーム再び拒否され、送球が永久に凍結する。 */\n"
        "    if(requestPlayConclusion('settled-return')) return;\n  }\n"
    )
    out[42] = replace_once(
        base,
        safe,
        "  if(T.target==='P' && T.stage!=='rundown' && !flyWait && !keyHeld && allSettled) return requestPlayConclusion('request');\n",
        "mut42",
    )
    out[43] = replace_once(
        base,
        "  const rundownExit=settleRundownExitIntent(T);\n",
        "  const rundownExit=null;\n",
        "mut43",
    )
    out[44] = replace_once(
        base,
        "return {runner:r,base:Math.min(4,Math.floor(r.p+1e-9)+1),dir:1,",
        "return {runner:r,base:Math.min(4,Math.floor(r.p+1e-9)+2),dir:1,",
        "mut44",
    )
    out[45] = replace_once(
        base,
        "    const future=findRoutineCatchWindow(f,b,{ground});\n",
        "    const future=null;\n",
        "mut45",
    )
    out[46] = replace_once(
        base,
        "  const earlyPenalty=Math.max(0,throwMargin-0.55)*1.8;  // 早着しすぎる球は反転時間を与える\n",
        "  const earlyPenalty=0;\n",
        "mut46",
    )
    out[47] = replace_once(
        base,
        "  if(source==='auto' && !o.force && (r.cmd||r.manualIntentLocked)) return false;\n",
        "  if(source==='auto' && !o.force && r.cmd) return false;\n",
        "mut47-manual-lock",
    )
    out[48] = replace_once(
        base,
        "  const directTarget=(advanceLead||returnLead)?lead:((advanceTrail||returnTrail)?trail:null);\n",
        "  const directTarget=(advanceLead||returnLead)?lead:null;\n",
        "mut48-tail-selection",
    )
    out[49] = replace_once(
        base,
        "function desiredRunnerSlide(r){\n",
        "function desiredRunnerSlide(r){ return null; // mutation: disable all runner slides\n",
        "mut49-slide",
    )
    out[50] = replace_once(
        base,
        "  const continuation=doublePlayContinuation(f,threat,te,outProbability);\n",
        "  const continuation={eligible:false,bonus:0,relayProbability:0,expectedOuts:outProbability};\n",
        "mut50-force-chain",
    )
    return out


def assert_full(results: dict[str, dict]) -> None:
    baseline = results["baseline"]
    bad = {k: v for k, v in baseline.items() if isinstance(v, dict) and v.get("verdict") != "PASS"}
    print(json.dumps({"baseline_count": len(baseline), "baseline_failed": bad}, ensure_ascii=False, indent=2))
    if len(baseline) != 51 or bad:
        raise RuntimeError("baseline failed")
    m = {n: results[f"mut{n}"] for n in [28,29,30,31,32,33,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50]}
    checks = [
        (28,"test28_個別走者選択"),(29,"test29_守備と走者意図の分離"),(30,"test30_RunnerIntent契約"),
        (31,"test31_FieldingAssignment契約"),(32,"test32_壁反射担当交代"),(33,"test33_ReachModel契約"),
        (33,"test34_動的到達方向"),(35,"test35_再照準採用"),(36,"test36_通過済み目標"),
        (38,"test37_ThrowDecision固定規則"),(39,"test39_手動投手返球"),(40,"test40_ライブ送球終了禁止"),
        (41,"test41_PlayLifecycle門番"),(43,"test43_挟殺終了goal清算"),(44,"test44_現在脅威送球ポリシー"),
        (45,"test45_捕球動作ポリシー"),(46,"test46_挟殺行動ポリシー"),
        (47,"test47_個別走者と手動固定"),(48,"test47_個別走者と手動固定"),(49,"test48_走者スライディング"),(50,"test49_先行封殺と併殺継続"),
    ]
    if m[37]["test37_ThrowDecision固定規則"].get("verdict") != "FAIL" and m[37]["test39_手動投手返球"].get("verdict") != "FAIL":
        raise RuntimeError("manual priority mutation escaped")
    for n, key in checks:
        if m[n][key].get("verdict") != "FAIL":
            raise RuntimeError(f"mutation escaped: {n} {key}")
    if m[42]["test42_Lifecycle拒否後物理継続"].get("verdict") != "FAIL" and m[42]["sweep128"].get("verdict") != "FAIL":
        raise RuntimeError("frozen-live-throw mutation escaped")
    print("all architecture and behavioral mutations detected")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manual", action="store_true", help="run baseline only; focused S/X checks run separately")
    args = parser.parse_args()
    if HARNESS.count(MARKER) != 1:
        raise RuntimeError("harness marker mismatch")
    harness = HARNESS.replace(MARKER, EXPOSED, 1)
    chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    if not chrome:
        raise RuntimeError("Chromium not found")
    with tempfile.TemporaryDirectory(prefix="baseball3d-reg-") as tmp_raw:
        tmp = Path(tmp_raw)
        pages = {"baseline": BASE}
        if not args.manual:
            pages.update({f"mut{k}": v for k, v in make_mutations(BASE).items()})
        for name, source in pages.items():
            build_page(source, harness, tmp / f"{name}.html")
        if not args.manual:
            guard_cases = {
                "goal": replace_once(BASE,
                    "    setRunnerIntent(r,back,{source:'rundown-timeout',force:true,updateAuto:true,cmd:null});\n",
                    "    r.goal=back; setRunnerIntent(r,back,{source:'rundown-timeout',force:true,updateAuto:true,cmd:null});\n", "guard-goal"),
                "cover": replace_once(BASE,
                    "          recv=cut; p=[cut.cx,cut.cy]; T.relayTo=T.target;\n",
                    "          cut.coverBase=null; recv=cut; p=[cut.cx,cut.cy]; T.relayTo=T.target;\n", "guard-cover"),
                "retarget": replace_once(BASE,
                    "      retargetFielder(prim,b2.x,b2.y,'slow-roll-replan');\n",
                    "      setTarget(prim,b2.x,b2.y);\n", "guard-retarget"),
            }
            for label, source in guard_cases.items():
                path = tmp / f"guard-{label}.html"
                path.write_text(source, encoding="utf-8")
                proc = subprocess.run(["node", str(ROOT / "_architecture_guard_20260808.js"), str(path)], check=False)
                if proc.returncode == 0:
                    raise RuntimeError(f"architecture mutation escaped: {label}")
        results: dict[str, dict] = {}
        for name in pages:
            page, dom = tmp / f"{name}.html", tmp / f"{name}.dom"
            run_chrome(chrome, page, dom)
            results[name] = browser_json(dom)
        if args.manual:
            bad = {k:v for k,v in results["baseline"].items() if isinstance(v,dict) and v.get("verdict") != "PASS"}
            if len(results["baseline"]) != 51 or bad:
                raise RuntimeError(f"manual baseline failed: {bad}")
            print("manual-runner browser baseline PASS")
        else:
            assert_full(results)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
