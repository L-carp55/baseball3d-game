from pathlib import Path

g={}
for i in range(1,6):
    exec(Path(f'.cc_patch_b0805_16_part{i}.py').read_text(encoding='utf-8'),g)
