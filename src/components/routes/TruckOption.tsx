import { useTruckName } from '../../queries/fleet';

export function TruckOption({ id }: { id: string }) {
  return <option value={id}>{useTruckName(id)}</option>;
}
