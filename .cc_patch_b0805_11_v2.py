from pathlib import Path
src = Path('.cc_patch_b0805_11.py').read_text(encoding='utf-8')
needle = 'maxZ:12,z:5'
if src.count(needle) != 2:
    raise SystemExit(f'expected 2 low-liner fixtures, got {src.count(needle)}')
src = src.replace(needle, 'maxZ:6.5,z:5')
exec(compile(src, '.cc_patch_b0805_11.py', 'exec'))
