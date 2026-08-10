from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    path = root / "_test_harness_20260804.js"
    text = path.read_text(encoding="utf-8")
    if "afterRole==='rolling-handoff'" in text:
        print("test17 rolling-handoff scope already applied")
        return
    old = """          const after=ball&&ball.primary?ball.primary.n:null;
          if(before&&after&&before!==after&&dot>0) switchedWhileApproaching=true;
"""
    new = """          const after=ball&&ball.primary?ball.primary.n:null;
          const afterF=ball&&ball.primary;
          const afterRole=afterF&&afterF.roleSource;
          /* 壁反射では1フレーム内で球速方向が物理的に反転するため、更新前dot>0でも
             反射直後のwall-handoffは正しい。ここで検査するのは、通常の転がり球が
             旧担当へ接近中なのに発生するrolling-handoffだけ。 */
          if(before&&after&&before!==after&&dot>0&&afterRole==='rolling-handoff')
            switchedWhileApproaching=true;
"""
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"test17 anchor: expected 1 occurrence, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("scoped test17 to rolling handoffs")


if __name__ == "__main__":
    main()
