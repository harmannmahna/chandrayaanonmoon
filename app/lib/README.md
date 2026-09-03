# LUNA/REGISTER · `app/lib`

In-browser registration library. Stages are intentionally separated so a future server/GPU matcher can replace only the matching module.

## Current flow

1. **Upload / demo load** (`io/`) — normalize images or embedded-image XML to PNG `ImageData`, carry optional `sensorInfo`.
2. **Preprocess** (`preprocessing/`) — CLAHE contrast equalization.
3. **Match** (`matching/`) — LoFTR-style adapter and classical baseline both return `MatchResult`.
4. **RANSAC** (`ransac/`) — estimate homography `H` and keep inliers.
5. **Warp** (`warp/`) — apply `H` and build overlay proofs.
6. **Metrics** (`metrics/`) — RMSE, inlier ratio, coverage/uniformity, quality labels.
7. **Export** (`exports/`) — registered PNGs, CSV/JSON match points, metrics package.

## Where a server or GPU plugs in

- Replace `matching/loftrAdapter.ts` `findCorrespondences()` with an authenticated call to a LoFTR inference service.
- Keep RANSAC / warp / metrics / export unchanged so UI and product exports stay stable.
- Classical matching can remain local as a cheap baseline even when deep matching is remote.

## Tiling for large rasters

- Guard large uploads in `io/imageSizeGuards.ts` and downsample for interactive preview.
- Future tiled path:
  1. Split each image into overlapping tiles.
  2. Match tile pairs (local or remote).
  3. Merge correspondences into one list.
  4. Run a single RANSAC / homography on the merged set.
- TODO comments in the matching modules mark this extension point.

## Design rule

Prefer thin adapters and shared TypeScript interfaces over a single monolithic engine file. That keeps demos honest about what runs locally today versus what can scale later.
