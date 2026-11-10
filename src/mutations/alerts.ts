import { useMutation } from '@tanstack/react-query';
import { sendAlert } from '../api/fleet';
import type { SendAlertRequest } from '../contracts';
import { useSession } from '../context/SessionContext';
import { useAlertStore } from '../stores/alertStore';

export function useSendAlert(truckId: string) {
  const { identity } = useSession();
  return useMutation({
    mutationFn: (alert: SendAlertRequest) => sendAlert(identity.id, truckId, alert),
    // Shown at once, even if the WS echo is late or the socket is down.
    onSuccess: (alert) => useAlertStore.getState().add(alert),
  });
}
