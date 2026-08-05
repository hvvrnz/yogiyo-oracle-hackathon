from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path


def calculate_correction_factors(history_csv: Path) -> dict[str, float]:
    ratios: dict[str, list[float]] = defaultdict(list)
    with history_csv.open(encoding="utf-8-sig", newline="") as fp:
        for row in csv.DictReader(fp):
            predicted = float(row.get("predicted_cooking_min") or 0)
            actual = float(row.get("actual_cooking_min") or 0)
            if predicted > 0 and actual > 0:
                ratios[row["store_id"]].append(actual / predicted)
    return {
        store_id: round(sum(values) / len(values), 4)
        for store_id, values in sorted(ratios.items())
        if values
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="매장별 조리시간 보정계수를 계산합니다.")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data/dummy/catalog/cooking_history.csv"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/dummy/catalog/correction_factors.json"),
    )
    args = parser.parse_args()
    factors = calculate_correction_factors(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(factors, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(factors)}개 매장의 보정계수를 {args.output}에 저장했습니다.")


if __name__ == "__main__":
    main()
