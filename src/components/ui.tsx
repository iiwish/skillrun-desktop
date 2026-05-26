import { CircleAlert, Loader2, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  children,
  icon: Icon,
  variant = "primary",
  loading = false,
  ...props
}: {
  children: ReactNode;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const ButtonIcon = loading ? Loader2 : Icon;
  return (
    <button {...props} className={`button ${variant} ${props.className ?? ""}`}>
      {ButtonIcon ? <ButtonIcon aria-hidden="true" className={loading ? "spin" : ""} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function Metric({
  icon: Icon,
  label,
  value,
  detail,
  compact = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <article className={compact ? "metric compact" : "metric"}>
      <div className="metric-icon">
        <Icon aria-hidden="true" />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}

export function SummaryStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className={`summary-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Alert({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="alert" role="alert">
      <CircleAlert aria-hidden="true" />
      <div>
        {title ? <strong>{title}</strong> : null}
        <p>{children}</p>
      </div>
    </div>
  );
}

export function InlineStatus({ children }: { children: ReactNode }) {
  return (
    <div className="inline-status">
      <Loader2 aria-hidden="true" className="spin" />
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="empty-state">
      <Icon aria-hidden="true" />
      <p>{title}</p>
    </div>
  );
}

export function DescriptionList({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="description-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
