import { formatGSD, type SensorInfo } from "@/app/lib/types";

type Props = {
  sensor?: SensorInfo;
  slot?: string;
  emptyLabel?: string;
};

export function SensorCard({ sensor, slot, emptyLabel = "No sensor metadata for this upload" }: Props) {
  if (!sensor) {
    return (
      <article className="panel border-dashed p-4">
        {slot ? <div className="kicker mb-2">{slot}</div> : null}
        <p className="muted text-sm">{emptyLabel}</p>
      </article>
    );
  }

  return (
    <article className="panel p-4">
      {slot ? <div className="kicker mb-2">{slot}</div> : null}
      <h3 className="text-base font-medium text-[var(--text-primary)]">{sensor.label}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="kicker !text-[9px] !tracking-[0.12em] opacity-70">Approx GSD</dt>
          <dd className="mt-1 text-[var(--text-primary)]">{formatGSD(sensor.approxGSD)}</dd>
        </div>
        <div>
          <dt className="kicker !text-[9px] !tracking-[0.12em] opacity-70">Modality</dt>
          <dd className="mt-1 capitalize text-[var(--text-primary)]">{sensor.modality.replace("-", " ")}</dd>
        </div>
      </dl>
      {sensor.notes ? <p className="muted mt-3 text-sm leading-6">{sensor.notes}</p> : null}
    </article>
  );
}
