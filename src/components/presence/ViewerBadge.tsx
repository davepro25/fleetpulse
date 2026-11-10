import { useViewersOf } from '../../stores/presenceStore';
import { Badge } from '../ui';

export function ViewerBadge({ truckId }: { truckId: string }) {
  const viewers = useViewersOf(truckId);
  if (viewers.length === 0) return null;
  return (
    <Badge tone="indigo" title={`Also viewing: ${viewers.join(', ')}`}>
      {viewers.length === 1 ? viewers[0] : `${viewers.length} dispatchers`}
    </Badge>
  );
}
