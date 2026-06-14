// Example registry:block item. Replace with YOUR design-system block.
// Demonstrates registryDependencies: this block pulls "button" automatically
// when a consumer runs: npx shadcn add @acme/stat-card
// All chassis values come from cssVars tokens (no raw hex/px) — keep it token-grounded.
import * as React from "react";
import { Button } from "@/components/ui/button";

export interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  onDrill?: () => void;
}

export function StatCard({ label, value, delta, onDrill }: StatCardProps) {
  return (
    <section
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-6"
      aria-label={label}
    >
      <p className="text-sm text-[var(--foreground)] opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{value}</p>
      {delta ? (
        <p className="mt-1 text-xs text-[var(--primary)]">{delta}</p>
      ) : null}
      {onDrill ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onDrill}>
          View details
        </Button>
      ) : null}
    </section>
  );
}
