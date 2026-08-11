#!/usr/bin/env python3
"""Apply the isolated b0805-29a owner-requested bounce/slide repair.

The script is deliberately anchor-based and fails if the exact reviewed b0805-29
source is not present. It modifies production, focused tests, and the permanent
regression workflow in one reproducible operation.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "baseball3d.html"
SLIDE_TEST = ROOT / "_test_runner_controls_sliding_20260809.js"
REGRESSION = ROOT / ".github/workflows/baseball3d-regression.yml"
AUDIT = ROOT / "docs/audits/b0805_29a_entitled_slide_fixes.md"


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one anchor, found {count}")
    return source.replace(old, new, 1)


def main() -> int:
    src = HTML.read_text(encoding="utf-8")

    src = replace_once(
        src,
        "const BUILD = 'b0805-29';",
        "const BUILD = 'b0805-29a';",
        "build label",
    )

    bounce_helper = r'''/* First-impact rebound for batted balls.
   The old universal 0.55 restitution let a high fly descending around 50 ft/s
   rebound above the 9.4 ft fence. Keep visible ground-ball hops, but cap the
   first rebound of medium/high air trajectories. This changes vertical impact
   response only; rolling drag and horizontal impact retention remain unchanged. */
function bounceVerticalSpeed(b,impactVz){
  const impact=Math.max(0,-impactVz);
  const firstImpact=!b.landed;
  const maxZ=Number.isFinite(b.maxZ)?b.maxZ:0;
  let restitution=0.55, cap=20.0;
  if(firstImpact && maxZ>=18){ restitution=0.28; cap=14.0; }
  else if(firstImpact && maxZ>=10){ restitution=0.38; cap=16.0; }
  else if(impact>32){ restitution=0.43; cap=20.0; }
  return Math.min(cap, impact*restitution);
}
'''
    src = replace_once(
        src,
        "function stepBall(b,dt){",
        bounce_helper + "function stepBall(b,dt){",
        "bounce helper insertion",
    )
    src = replace_once(
        src,
        "    if(b.vz<-1.2){ b.vz=-b.vz*0.55; b.vx*=0.78; b.vy*=0.78; }",
        "    if(b.vz<-1.2){ b.vz=bounceVerticalSpeed(b,b.vz); b.vx*=0.78; b.vy*=0.78; }",
        "impact response",
    )

    src = replace_once(
        src,
        "function interceptPoint(f){\n  const b={x:ball.x,y:ball.y,z:ball.z,vx:ball.vx,vy:ball.vy,vz:ball.vz};",
        "function interceptPoint(f){\n  const b={x:ball.x,y:ball.y,z:ball.z,vx:ball.vx,vy:ball.vy,vz:ball.vz,\n    landed:ball.landed,maxZ:ball.maxZ,la:ball.la};",
        "intercept metadata parity",
    )
    src = replace_once(
        src,
        "      const b2={x:ball.x,y:ball.y,z:ball.z,vx:ball.vx,vy:ball.vy,vz:ball.vz};",
        "      const b2={x:ball.x,y:ball.y,z:ball.z,vx:ball.vx,vy:ball.vy,vz:ball.vz,\n        landed:ball.landed,maxZ:ball.maxZ,la:ball.la};",
        "slow-roll metadata parity",
    )

    old_slide_policy = """  if(dir>0 && (base===2 || base===3)) return {mode:'feet',base,dir};
  if(runnerClosePlayAtBase(r,base) && (dir<0 || base===1 || base===4 || r.mustReturn))
    return {mode:'head',base,dir};"""
    new_slide_policy = """  /* Returning runners protect the bag with a head-first slide even when the
     current throw has not yet been classified as a close play. This is visual
     only: speed, p, ETA, and tag timing are unchanged. */
  if(dir<0) return {mode:'head',base,dir};
  if(dir>0 && (base===2 || base===3)) return {mode:'feet',base,dir};
  if(runnerClosePlayAtBase(r,base) && (base===1 || base===4 || r.mustReturn))
    return {mode:'head',base,dir};"""
    src = replace_once(src, old_slide_policy, new_slide_policy, "return slide policy")

    src = replace_once(
        src,
        "    return {lean:1.28,crouch:1.38,rise:-0.52,glove:false,",
        "    return {lean:1.18,crouch:0,rise:0.34,glove:false,",
        "head-first ground height",
    )
    src = replace_once(
        src,
        "  return {lean:-0.72,crouch:1.18,rise:-0.58,glove:false,",
        "  return {lean:-0.72,crouch:0,rise:0.18,glove:false,",
        "feet-first ground height",
    )

    HTML.write_text(src, encoding="utf-8", newline="\n")

    slide = SLIDE_TEST.read_text(encoding="utf-8")
    slide_anchor = """ctx.throwPlay={target:2,stage:'fly',kind:'pickoff',decisionMargin:0.1};r=ctx.makeRunner(2.12,2,2,24);r.mustReturn=true;ctx.updateRunnerSlide(r,0);assert(r.slideMode==='head','no headfirst return slide');
ctx.throwPlay={target:1,stage:'transfer',kind:'infield',decisionMargin:1.2};r=ctx.makeRunner(0.9,1,0,24);ctx.updateRunnerSlide(r,0);assert(r.slideT===0,'routine first-base arrival slid');"""
    slide_replacement = """ctx.throwPlay={target:2,stage:'fly',kind:'pickoff',decisionMargin:0.1};r=ctx.makeRunner(2.12,2,2,24);r.mustReturn=true;ctx.updateRunnerSlide(r,0);assert(r.slideMode==='head','no headfirst return slide');
clear();r=ctx.makeRunner(2.12,2,2,24);ctx.updateRunnerSlide(r,0);assert(r.slideMode==='head'&&r.slideDir===-1,'ordinary return did not slide headfirst');
let pose=ctx.runnerSlidePose(r);assert((pose.rise||0)-(pose.crouch||0)>=0.25,'headfirst slide body is below the field');
clear();r=ctx.makeRunner(1.88,2,1,24);ctx.updateRunnerSlide(r,0);pose=ctx.runnerSlidePose(r);assert((pose.rise||0)-(pose.crouch||0)>=0.10,'feet-first slide body is below the field');
ctx.throwPlay={target:1,stage:'transfer',kind:'infield',decisionMargin:1.2};r=ctx.makeRunner(0.9,1,0,24);ctx.updateRunnerSlide(r,0);assert(r.slideT===0,'routine first-base arrival slid');"""
    slide = replace_once(slide, slide_anchor, slide_replacement, "focused slide assertions")
    slide = replace_once(
        slide,
        "console.log('targeted b0805-25 runner controls/sliding PASS');",
        "console.log('targeted b0805-29a runner controls/sliding PASS');",
        "focused test label",
    )
    SLIDE_TEST.write_text(slide, encoding="utf-8", newline="\n")

    workflow = REGRESSION.read_text(encoding="utf-8")
    workflow = workflow.replace(
        '      - "_test_runner_controls_sliding_20260809.js"\n',
        '      - "_test_runner_controls_sliding_20260809.js"\n      - "_test_bounce_slide_ownerfix_20260811.js"\n',
    )
    if workflow.count('_test_bounce_slide_ownerfix_20260811.js') != 2:
        raise RuntimeError("regression paths: expected push and pull_request entries")
    workflow = replace_once(
        workflow,
        "          assert \"const BUILD = 'b0805-29';\" in src",
        "          assert \"const BUILD = 'b0805-29a';\" in src",
        "workflow build assertion",
    )
    workflow = replace_once(
        workflow,
        "          node --check _test_runner_controls_sliding_20260809.js\n",
        "          node --check _test_runner_controls_sliding_20260809.js\n          node --check _test_bounce_slide_ownerfix_20260811.js\n",
        "workflow node check",
    )
    workflow = replace_once(
        workflow,
        "          node _test_runner_controls_sliding_20260809.js\n",
        "          node _test_runner_controls_sliding_20260809.js\n          node _test_bounce_slide_ownerfix_20260811.js\n",
        "workflow focused execution",
    )
    REGRESSION.write_text(workflow, encoding="utf-8", newline="\n")

    AUDIT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT.write_text(
        """# b0805-29a entitlement-bounce and runner-slide repair audit

Date: 2026-08-11
Branch: `agent/b0805-29a-entitled-slide-fixes`
Gameplay base: `60b993b73fed854934a976e45e8feb9437deb584` (`b0805-29`)
Target build: `b0805-29a`
Status: implementation tree generated; final commit and CI run are recorded in the GitHub handoff/comment after push.

## Changes

- replaced universal vertical impact restitution with trajectory-aware first-impact rebound;
- capped medium/high fly first-bounce vertical speed below fence-clearing height;
- preserved visible low-angle ground-ball hops and unchanged horizontal retention/rolling drag;
- carried `landed`, `maxZ`, and `la` into interception/slow-roll prediction clones;
- ordinary returns now start a head-first slide within the existing 12.6 ft window;
- removed double vertical lowering from head-first and feet-first slide poses;
- retained routine upright first-base arrivals when the play is not close;
- no slide speed, ETA, tag, scoring, throw, or fielding-policy changes.

## Automated contracts

`_test_bounce_slide_ownerfix_20260811.js` verifies:

- old 0.55 high-fly rebound would clear the 9.4 ft fence;
- new high-fly first rebound cannot clear it;
- low-angle ground-ball bounce remains visibly non-zero;
- production uses the helper and prediction metadata;
- head-first / feet-first pose bases are not underground;
- ordinary return slides and routine first-base non-slide behavior.

The existing focused runner controls/sliding test is extended with ordinary-return and body-height assertions. Full architecture, focused contracts, and browser regression are run before the implementation commit is pushed.

## Remaining owner checks

- deep fly balls near the wall no longer generate frequent entitlement doubles;
- ordinary grounders still visibly hop rather than slide;
- batter-runner remains visible through a close head-first slide into first;
- returns to first/second/third visibly slide and do not receive a timing bonus.

No merge is authorized by this audit.
""",
        encoding="utf-8",
        newline="\n",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
