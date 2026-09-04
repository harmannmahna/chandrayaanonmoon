export function SpaceBackdrop() {
  return (
    <div aria-hidden="true" className="space-backdrop">
      <div className="space-nebula" />
      <div className="space-stars space-stars--drift" />
      <div className="space-stars-fine" />
      <div className="space-vignette" />
    </div>
  );
}
