#!/usr/bin/env python3
"""Make shared stepBall record impact state for live and prediction balls.

The initial b0805-29a patch classified first impact from ``b.landed`` but legacy
``stepBall`` left that flag to selected callers.  Prediction clones therefore
could treat later bounces as another first impact.  Record the impact inside the
shared physics function after the first-impact rebound has been calculated.
"""
from pathlib import Path

path=Path(__file__).resolve().parents[2]/'baseball3d.html'
src=path.read_text(encoding='utf-8')
old="""    if(b.vz<-1.2){ b.vz=bounceVerticalSpeed(b,b.vz); b.vx*=0.78; b.vy*=0.78; }
    else {
      b.vz=0;"""
new="""    if(b.vz<-1.2){
      const reboundVz=bounceVerticalSpeed(b,b.vz); // classify before marking the impact
      b.landed=true; b.vz=reboundVz; b.vx*=0.78; b.vy*=0.78;
    }
    else {
      b.landed=true; b.vz=0;"""
if src.count(old)!=1:
    raise RuntimeError(f'landed-state anchor count={src.count(old)}')
path.write_text(src.replace(old,new,1),encoding='utf-8',newline='\n')
