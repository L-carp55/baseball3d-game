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
    if "const BUILD = 'b0805-28';" not in text:
        raise RuntimeError("expected b0805-28 materialized source")
    if "const preApproachDot=" in text:
        print("handoff hysteresis already applied")
        return
    text = replace_once(
        text,
        "function stepFlight(dt){\n  stepBall(ball,dt); ball.t+=dt;",
        "function stepFlight(dt){\n"
        "  /* 担当交代の方向門番は、更新後だけでなく更新開始時にも球が旧担当から\n"
        "     遠ざかっていた場合にだけ開く。1フレーム内で担当を通過した瞬間に、\n"
        "     更新前はまだ接近中だったのに同じ刻みで担当を替える境界退行を防ぐ。 */\n"
        "  const prePrim=ball&&ball.primary;\n"
        "  const preApproachDot=(prePrim&&ball)\n"
        "    ? (ball.vx*(prePrim.cx-ball.x)+ball.vy*(prePrim.cy-ball.y)) : 0;\n"
        "  stepBall(ball,dt); ball.t+=dt;",
        "stepFlight pre-approach",
    )
    text = replace_once(
        text,
        "if(Math.hypot(ball.x-prim.cx, ball.y-prim.cy) > CATCH_R + 3 && !approaching){",
        "if(Math.hypot(ball.x-prim.cx, ball.y-prim.cy) > CATCH_R + 3\n"
        "       && !approaching && preApproachDot<=0){",
        "handoff direction gate",
    )
    path.write_text(text, encoding="utf-8")
    print("applied b0805-28 handoff hysteresis")


if __name__ == "__main__":
    main()
