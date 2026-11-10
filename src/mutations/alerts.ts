import { useMutation } from '@tanstack/react-query';
import { sendAlert } from '../api/fleet';
import type { SendAlertRequest } from '../contracts';
import { useSession } from '../context/SessionContext';
import { useAlertStore } from '../stores/alertStore';

export function useSendAlert(truckId: string) {
  const { identity } = useSession();
  return useMutation({
    mutationFn: (alert: SendAlertRequest) => sendAlert(identity.id, truckId, alert),
    onSuccess: (alert) => useAlertStore.getState().add(alert),
  });
}
