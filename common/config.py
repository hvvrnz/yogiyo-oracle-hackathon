from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = PROJECT_ROOT / "static"
DUMMY_DATA_DIR = PROJECT_ROOT / "data" / "dummy"

load_dotenv(PROJECT_ROOT / ".env")


def env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def env_int(name: str, default: int, minimum: int | None = None) -> int:
    value = os.getenv(name)
    try:
        parsed = int(value) if value is not None else default
    except ValueError:
        parsed = default
    return max(minimum, parsed) if minimum is not None else parsed


@dataclass(frozen=True)
class Settings:
    app_version: str = "1.2.0"
    dummy_dataset: str = os.getenv("DUMMY_DATASET", "balanced").strip() or "balanced"
    auto_reassign_enabled: bool = env_bool("AUTO_REASSIGN_ENABLED", True)
    rider_offer_timeout_sec: int = env_int("RIDER_OFFER_TIMEOUT_SEC", 30, minimum=10)
    map_provider: str = os.getenv("MAP_PROVIDER", "naver").strip().lower()
    naver_maps_ncp_key_id: str = os.getenv("NAVER_MAPS_NCP_KEY_ID", "").strip()
    google_maps_api_key: str = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()


settings = Settings()
