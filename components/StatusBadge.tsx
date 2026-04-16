"use client";

interface Props {
  status: string;
}

export function StatusBadge({ status }: Props) {
  const classes: Record<string, string> = {
    "Open":        "badge-open",
    "In Progress": "badge-progress",
    "Resolved":    "badge-resolved",
  };

  return (
    <span className={classes[status] ?? "inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600"}>
      {status}
    </span>
  );
}
