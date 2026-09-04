type Props = {
  number: string;
  label: string;
  className?: string;
};

export function SectionLabel({ number, label, className = "" }: Props) {
  return (
    <div className={`section-label ${className}`}>
      <span className="section-label__text">
        <span className="section-label__num">{number}</span>
        {" / "}
        {label}
      </span>
      <span className="section-label__rule" aria-hidden="true" />
    </div>
  );
}
