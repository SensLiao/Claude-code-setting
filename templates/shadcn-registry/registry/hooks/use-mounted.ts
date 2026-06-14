// Example registry:hook item. Replace with YOUR design-system hooks.
// Consumers get this when they run: npx shadcn add @acme/use-mounted
import * as React from "react";

/** SSR-safe: returns true only after the component has mounted on the client. */
export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
