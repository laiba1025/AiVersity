import json
import os
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt

"""
Generates coverage_heatmap.png using coverage/coverage-summary.json if present
(c8 --reporter=json-summary). Falls back to a synthetic example.

Usage (from repo root):
  python docs/images/src/coverage_heatmap.py
Output:
  docs/images/coverage_heatmap.png
"""

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs' / 'images' / 'coverage_heatmap.png'
SUMMARY = ROOT / 'coverage' / 'coverage-summary.json'

labels = []
data = []

if SUMMARY.exists():
    with open(SUMMARY, 'r', encoding='utf-8') as f:
        summary = json.load(f)
    # summary is a dict with file paths as keys
    for path, metrics in summary.items():
        if path == 'total':
            continue
        l = metrics.get('lines', {}).get('pct', 0)
        fct = metrics.get('functions', {}).get('pct', 0)
        br = metrics.get('branches', {}).get('pct', 0)
        labels.append(Path(path).name[:20])
        data.append([l, fct, br])
else:
    labels = ['routes.ts', 'storage.ts', 'openai.ts', 'schema.ts', 'client.tsx']
    data = [
        [82, 75, 60],
        [68, 55, 40],
        [85, 80, 70],
        [90, 95, 92],
        [65, 50, 35],
    ]

arr = np.array(data)
fig, ax = plt.subplots(figsize=(8, max(3, len(labels)*0.4)))
im = ax.imshow(arr, cmap='YlGnBu', vmin=0, vmax=100, aspect='auto')

ax.set_yticks(range(len(labels)))
ax.set_yticklabels(labels)
ax.set_xticks([0,1,2])
ax.set_xticklabels(['Lines %', 'Funcs %', 'Branches %'])

for i in range(arr.shape[0]):
    for j in range(arr.shape[1]):
        ax.text(j, i, f"{arr[i, j]:.0f}%", ha='center', va='center', color='black', fontsize=8)

ax.set_title('Coverage by File (example or c8 summary)')
fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
fig.tight_layout()
OUT.parent.mkdir(parents=True, exist_ok=True)
fig.savefig(OUT, dpi=200)
print(f"Wrote {OUT}")
