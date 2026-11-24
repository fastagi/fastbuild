import { useQuery } from '@tanstack/react-query';
import { systemService } from '@/features/system/services/system-service';

export function useOperatorSystem() {
  return useQuery({
    queryKey: ['operator', 'system'],
    queryFn: ({ signal }) => systemService.operatorSystem(signal),
    staleTime: 15_000,
  });
}
