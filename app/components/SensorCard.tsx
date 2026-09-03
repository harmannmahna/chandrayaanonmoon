import { formatGSD, type SensorInfo } from "@/app/lib/types";

type Props = {
  sensor?: SensorInfo;
  slot?: string;
  emptyLabel?: string;
};

export function SensorCard({ sensor, slot, emptyLabel = "No sensor metadata for this upload" }: Props) {
  if (!sensor) {
    return (
      <article className="border border-dashed border-[#393937] bg-[#0c0c0c] p-4">
        {slot ? <div className="mono mb-2 text-[10px] uppercase tracking-[0.14em] text-[#666]">{slot}</div> : null}
        <p className="text-sm text-[#777]">{emptyLabel}</p>
      </article>
    );
  }

  return (
    <article className="border border-[#292927] bg-[#101010] p-4">
      {slot ? <div className="mono mb-2 text-[10px] uppercase tracking-[0.14em] text-[#d8ff3e]">{slot}</div> : null}
      <h3 className="text-base font-medium text-white">{sensor.label}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="mono text-[9px] uppercase tracking-[0.12em] text-[#666]">Approx GSD</dt>
          <dd className="mt-1 text-[#d8d8d4]">{formatGSD(sensor.approxGSD)}</dd>
        </div>
        <div>
          <dt className="mono text-[9px] uppercase tracking-[0.12em] text-[#666]">Modality</dt>
          <dd className="mt-1 capitalize text-[#d8d8d4]">{sensor.modality.replace("-", " ")}</dd>
        </div>
      </dl>
      {sensor.notes ? <p className="mt-3 text-sm leading-6 text-[#8a8a86]">{sensor.notes}</p> : null}
    </article>
  );
}
