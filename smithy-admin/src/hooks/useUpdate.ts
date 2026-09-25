import { useUpdate as useRefineUpdate } from "@refinedev/core";

/**
 * Wrapper around Refine's `useUpdate` that reliably exposes `isPending`.
 *
 * Refine v5 intersects `UseMutationResult` (a discriminated union) with
 * `UseLoadingOvertimeReturnType`, which causes TypeScript to lose track of
 * `isPending` on the resulting type. At runtime the property is always present
 * (it comes from TanStack Query's `useMutation`), so we cast it back.
 */
export function useUpdate() {
  const result = useRefineUpdate();
  return {
    ...result,
    isPending: (result as unknown as { isPending?: boolean }).isPending ?? false,
  };
}
