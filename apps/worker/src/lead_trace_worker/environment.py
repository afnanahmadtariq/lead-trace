from __future__ import annotations

from pathlib import Path
from typing import Iterable, Optional

from dotenv import load_dotenv


def load_environment(paths: Optional[Iterable[Path]] = None) -> None:
    """Load local worker/provider settings without overriding the launch environment."""
    worker_root = Path(__file__).resolve().parents[2]
    candidates = paths if paths is not None else (
        Path.cwd() / '.env', worker_root / '.env', worker_root.parents[1] / '.env',
    )
    for path in dict.fromkeys(candidates):
        load_dotenv(path, override=False)
