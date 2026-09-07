"""Optional pretrained matchers (SuperPoint+LightGlue, LoFTR).

Never fabricates matches. If torch/kornia/weights are missing, callers receive
an explicit unavailable status.
"""

from __future__ import annotations

from typing import Any

import numpy as np


def probe_torch_stack() -> dict[str, Any]:
    info: dict[str, Any] = {
        "torch": False,
        "kornia": False,
        "cuda": False,
        "detail": "",
    }
    try:
        import torch  # type: ignore

        info["torch"] = True
        info["cuda"] = bool(torch.cuda.is_available())
        info["torch_version"] = getattr(torch, "__version__", "unknown")
    except Exception as exc:  # noqa: BLE001
        info["detail"] = f"torch unavailable: {exc}"
        return info
    try:
        import kornia  # type: ignore  # noqa: F401

        info["kornia"] = True
        info["kornia_version"] = getattr(kornia, "__version__", "unknown")
    except Exception as exc:  # noqa: BLE001
        info["detail"] = f"kornia unavailable: {exc}"
    return info


def _to_rgb_float(img_bgr: np.ndarray) -> np.ndarray:
    import cv2

    if img_bgr.ndim == 2:
        rgb = cv2.cvtColor(img_bgr, cv2.COLOR_GRAY2RGB)
    else:
        rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    return rgb.astype(np.float32) / 255.0


def _gray_tensor(img_bgr: np.ndarray, device: Any) -> Any:
    import torch

    rgb = _to_rgb_float(img_bgr)
    gray = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]).astype(np.float32)
    return torch.from_numpy(gray)[None, None].to(device)


def _pack_matches(
    engine: str,
    matcher_label: str,
    k0: np.ndarray,
    k1: np.ndarray,
    conf: list[float],
    elapsed_ms: float,
    device: str,
) -> dict[str, Any]:
    mkpts0 = [[float(p[0]), float(p[1])] for p in np.asarray(k0).reshape(-1, 2)]
    mkpts1 = [[float(p[0]), float(p[1])] for p in np.asarray(k1).reshape(-1, 2)]
    mconf = [float(c) for c in conf]
    if len(mconf) != len(mkpts0):
        mconf = mconf[: len(mkpts0)]
        while len(mconf) < len(mkpts0):
            mconf.append(0.7)
    mean_c = float(np.mean(mconf)) if mconf else 0.0
    return {
        "available": True,
        "status": "ok",
        "engine": engine,
        "matcher": matcher_label,
        "mkpts0": mkpts0,
        "mkpts1": mkpts1,
        "mconf": mconf,
        "unmatched0": [],
        "unmatched1": [],
        "total_keypoints_evaluated": len(mkpts0) * 2,
        "num_matches": len(mkpts0),
        "num_unmatched": 0,
        "mean_confidence": round(mean_c, 4),
        "matched_mean_confidence": round(mean_c, 4),
        "weak_regions": [],
        "runtime_ms": round(elapsed_ms, 2),
        "device": device,
    }


def _unavailable(engine: str, error: str) -> dict[str, Any]:
    return {
        "available": False,
        "status": "unavailable",
        "engine": engine,
        "error": error,
        "mkpts0": [],
        "mkpts1": [],
        "mconf": [],
        "num_matches": 0,
    }


def run_superpoint_lightglue(ref_bgr: np.ndarray, src_bgr: np.ndarray) -> dict[str, Any]:
    """AI Fast path — SuperPoint + LightGlue via Kornia when installed."""
    stack = probe_torch_stack()
    if not (stack["torch"] and stack["kornia"]):
        return _unavailable(
            "superpoint-lightglue",
            stack.get("detail") or "Install optional AI deps: pip install -r requirements-ai.txt",
        )

    import time

    import torch

    device = torch.device("cuda" if stack["cuda"] else "cpu")
    t0 = time.perf_counter()
    errors: list[str] = []

    # Attempt A: LightGlueMatcher (kornia.feature)
    try:
        from kornia.feature import LightGlueMatcher, SuperPoint  # type: ignore

        sp = SuperPoint(pretrained=True).eval().to(device)
        lg = LightGlueMatcher("superpoint").eval().to(device)
        with torch.inference_mode():
            t_ref = _gray_tensor(ref_bgr, device)
            t_src = _gray_tensor(src_bgr, device)
            f0 = sp(t_ref)
            f1 = sp(t_src)
            # Common LightGlueMatcher signature: (desc1, desc2, lafs1, lafs2)
            if isinstance(f0, dict) and "descriptors" in f0 and "lafs" in f0:
                out = lg(f0["descriptors"], f1["descriptors"], f0["lafs"], f1["lafs"])
            else:
                out = lg({"image0": f0, "image1": f1})

            if isinstance(out, dict):
                if "keypoints0" in out and "keypoints1" in out:
                    k0 = out["keypoints0"].detach().cpu().numpy()
                    k1 = out["keypoints1"].detach().cpu().numpy()
                    conf_t = out.get("confidence")
                    conf = (
                        conf_t.detach().cpu().numpy().reshape(-1).tolist()
                        if conf_t is not None
                        else [0.75] * len(np.asarray(k0).reshape(-1, 2))
                    )
                elif "matches" in out and "lafs1" in f0:
                    # Index-based matches into SuperPoint keypoints
                    matches = out["matches"].detach().cpu().numpy()
                    kp0 = f0.get("keypoints")
                    kp1 = f1.get("keypoints")
                    if kp0 is None or kp1 is None:
                        raise RuntimeError("SuperPoint keypoints missing for LightGlue match indices")
                    kp0n = kp0.detach().cpu().numpy().reshape(-1, 2)
                    kp1n = kp1.detach().cpu().numpy().reshape(-1, 2)
                    idx0 = matches[:, 0].astype(int)
                    idx1 = matches[:, 1].astype(int)
                    k0 = kp0n[idx0]
                    k1 = kp1n[idx1]
                    conf = [0.75] * len(k0)
                else:
                    raise RuntimeError(f"Unexpected LightGlueMatcher keys: {list(out.keys())}")
            else:
                raise RuntimeError(f"Unexpected LightGlueMatcher output type {type(out)}")

        elapsed = (time.perf_counter() - t0) * 1000.0
        return _pack_matches(
            "superpoint-lightglue",
            "SuperPoint + LightGlue (pretrained)",
            k0,
            k1,
            conf,
            elapsed,
            str(device),
        )
    except Exception as exc:  # noqa: BLE001
        errors.append(f"LightGlueMatcher path: {exc}")

    # Attempt B: kornia.feature.lightglue.LightGlue module if present
    try:
        from kornia.feature import SuperPoint  # type: ignore

        try:
            from kornia.feature.lightglue import LightGlue  # type: ignore
        except Exception:
            from kornia.feature import LightGlue  # type: ignore

        sp = SuperPoint(pretrained=True).eval().to(device)
        lg = LightGlue(features="superpoint").eval().to(device)
        with torch.inference_mode():
            t_ref = _gray_tensor(ref_bgr, device)
            t_src = _gray_tensor(src_bgr, device)
            f0 = sp(t_ref)
            f1 = sp(t_src)
            feats0 = {
                "keypoints": f0["keypoints"][0],
                "descriptors": f0["descriptors"][0],
                "image_size": torch.tensor(t_ref.shape[-2:][::-1], device=device),
            }
            feats1 = {
                "keypoints": f1["keypoints"][0],
                "descriptors": f1["descriptors"][0],
                "image_size": torch.tensor(t_src.shape[-2:][::-1], device=device),
            }
            out = lg({"image0": feats0, "image1": feats1})
            matches0 = out["matches0"][0].detach().cpu().numpy()
            kp0 = feats0["keypoints"].detach().cpu().numpy()
            kp1 = feats1["keypoints"].detach().cpu().numpy()
            conf0 = out.get("matching_scores0")
            conf_arr = conf0[0].detach().cpu().numpy() if conf0 is not None else None
            pairs = []
            conf: list[float] = []
            for i, j in enumerate(matches0):
                if int(j) < 0:
                    continue
                pairs.append((kp0[i], kp1[int(j)]))
                conf.append(float(conf_arr[i]) if conf_arr is not None else 0.75)
            if not pairs:
                raise RuntimeError("LightGlue returned zero matches")
            k0 = np.asarray([p[0] for p in pairs], dtype=np.float32)
            k1 = np.asarray([p[1] for p in pairs], dtype=np.float32)

        elapsed = (time.perf_counter() - t0) * 1000.0
        return _pack_matches(
            "superpoint-lightglue",
            "SuperPoint + LightGlue (pretrained)",
            k0,
            k1,
            conf,
            elapsed,
            str(device),
        )
    except Exception as exc:  # noqa: BLE001
        errors.append(f"LightGlue module path: {exc}")

    return _unavailable(
        "superpoint-lightglue",
        "SuperPoint+LightGlue failed: " + " | ".join(errors),
    )


def run_loftr(ref_bgr: np.ndarray, src_bgr: np.ndarray) -> dict[str, Any]:
    """AI Robust path — Kornia LoFTR when installed + weights downloadable."""
    stack = probe_torch_stack()
    if not (stack["torch"] and stack["kornia"]):
        return _unavailable(
            "loftr",
            stack.get("detail") or "Install optional AI deps: pip install -r requirements-ai.txt",
        )

    import time

    import torch
    from kornia.feature import LoFTR  # type: ignore

    device = torch.device("cuda" if stack["cuda"] else "cpu")
    t0 = time.perf_counter()
    try:
        matcher = LoFTR(pretrained="outdoor").eval().to(device)
        with torch.inference_mode():
            inp = {"image0": _gray_tensor(ref_bgr, device), "image1": _gray_tensor(src_bgr, device)}
            out = matcher(inp)
            k0 = out["keypoints0"].detach().cpu().numpy()
            k1 = out["keypoints1"].detach().cpu().numpy()
            conf = out["confidence"].detach().cpu().numpy().reshape(-1).tolist()
        elapsed = (time.perf_counter() - t0) * 1000.0
        return _pack_matches("loftr", "LoFTR outdoor (pretrained)", k0, k1, conf, elapsed, str(device))
    except Exception as exc:  # noqa: BLE001
        return _unavailable("loftr", f"LoFTR failed: {exc}")
