"""Fetch the Adult Income dataset (OpenML id 1590 / 'adult') and write a manifest."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from sklearn.datasets import fetch_openml

OUT = Path(__file__).resolve().parents[1] / "data" / "raw"
OUT.mkdir(parents=True, exist_ok=True)

bunch = fetch_openml(name="adult", version=2, as_frame=True, data_home=str(OUT / "_cache"))
df = bunch.frame
df.to_csv(OUT / "adult_raw.csv", index=False)

sha = hashlib.sha256((OUT / "adult_raw.csv").read_bytes()).hexdigest()
manifest = {
    "provider": "OpenML (mirrors UCI Machine Learning Repository / 1994 US Census Bureau extract)",
    "canonical_url": "https://www.openml.org/d/1590",
    "openml_id": 1590,
    "version": 2,
    "access_date_utc": datetime.now(timezone.utc).isoformat(),
    "license": "Public domain (US Census Bureau data); UCI/OpenML redistribution terms: "
               "free for research/educational use, no warranty, cite source.",
    "rows": int(df.shape[0]),
    "columns": list(df.columns),
    "sha256_adult_raw_csv": sha,
}
(OUT / "MANIFEST.json").write_text(json.dumps(manifest, indent=2))
print(json.dumps(manifest, indent=2))
