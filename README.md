# LUNA/REGISTER

A black-and-white, browser-based prototype for registering Chandrayaan-2 imagery against an LRO reference image.

## Pipeline

1. Upload a source and reference image.
2. Enhance local contrast with CLAHE.
3. Generate cross-image terrain correspondences.
4. Reject inconsistent matches with RANSAC and estimate a homography.
5. Warp the source into the reference frame and inspect the result.

The final screen provides the registered image, 50/50 overlay, visual match map, reprojection RMSE, inlier ratio, spatial coverage, homography matrix, and downloadable CSV/JSON match data.

## Run locally

```bash
npm install
npm run dev
```

Create a production bundle with:

```bash
npm run build
```

## Matcher architecture

The feature stage uses a matcher adapter. This repository includes a lightweight, self-contained browser engine based on grid-distributed gradient descriptors so the full pipeline runs locally without a model server.

For operational use, connect that adapter to an authenticated LoFTR inference service or a locally hosted LoFTR runtime with trained weights. The UI intentionally identifies the included engine as a **local prototype engine**; it does not misrepresent the lightweight fallback as trained LoFTR inference.

## Accuracy note

Displayed RMSE is reprojection error on RANSAC inliers, not independent geodetic ground-truth error. A production evaluation should additionally use held-out control points and sensor/geospatial metadata.
