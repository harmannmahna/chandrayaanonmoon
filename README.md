# LUNA/REGISTER

Next.js + TypeScript prototype for multi-modal lunar image registration.

## One-line pitch

We take three multi-modal lunar images, normalize them, enhance them with CLAHE, find correspondences for every pair, reject outliers with RANSAC, warp them into a common frame, and export registered products, match points, and homographies — with metrics and coverage proving the alignment.

## Run

```bash
npm install
npm run dev
```

Open `/` for the registration workspace and `/context` for sensor context, product spec, and performance notes.

Use **How to demo** in the header for the judge walkthrough.

## Architecture notes

See [`app/lib/README.md`](app/lib/README.md) for the stage flow and where a GPU/server matcher can plug in later.

This is a prototype, not an official ISRO product.
