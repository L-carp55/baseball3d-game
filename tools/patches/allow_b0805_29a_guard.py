#!/usr/bin/env python3
"""Permit an explicit one-letter hotfix suffix in the build architecture guard."""
from pathlib import Path

path=Path(__file__).resolve().parents[2]/'_architecture_guard_20260808.js'
src=path.read_text(encoding='utf-8')
old="check('BUILD stamp present',/^b\\d{4}-\\d+$/.test(build||''),build);"
new="check('BUILD stamp present',/^b\\d{4}-\\d+[a-z]?$/.test(build||''),build);"
if src.count(old)!=1:
    raise RuntimeError(f'BUILD guard anchor count={src.count(old)}')
path.write_text(src.replace(old,new,1),encoding='utf-8',newline='\n')
