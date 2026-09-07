import { Navigate } from "react-router-dom";

/** Illumination Lab is combined into /solar — keep this redirect for old links. */
export function IlluminationLabPage() {
  return <Navigate to="/solar" replace />;
}
