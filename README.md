# LUNA/REGISTER

A black-and-white, browser-based prototype for comparing three lunar images across every pair.

## Pipeline

1. Upload three image products as images or embedded-image XML, or click **Load demo set**.
2. Normalize every decodable input to PNG.
3. Enhance local contrast with CLAHE.
4. Generate correspondences for A↔B, A↔C, and B↔C.
5. Estimate three homographies with RANSAC.
6. Warp and inspect each pair independently.

The final screen provides:

- registered images and 50/50 overlays
- visual match maps
- a three-pair scorecard
- reprojection RMSE, inlier ratios, and spatial coverage
- a 4×3 coverage grid for uniform-distribution checks
- three homography matrices
- combined CSV/JSON match data

## Demo samples

`public/samples/` includes:

- `chandrayaan2_ohr.png` — synthetic source A
- `lro_reference.png` — synthetic reference B
- `epoch_c.png` — synthetic third image C
- `epoch_c_embedded.xml` — image C wrapped as base64-embedded XML

Use **Load demo set** on the first screen to exercise PNG normalization plus XML conversion without bringing your own files.

## XML and PNG conversion

The local converter accepts browser-decodable images, SVG documents, XML containing an image data URI, and XML elements explicitly marked as base64 with embedded raster pixels. Inputs are normalized to PNG before preprocessing.

PDS XML labels normally contain metadata and a filename pointing to a separate `.img`, `.tif`, or other raster product. A metadata label has no pixels to convert by itself. For those products, upload the referenced browser-decodable raster rather than the XML label.

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
