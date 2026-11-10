import type { SendAlertRequest } from '../contracts';

// The server accepts any severity (and fills in 'info' when empty); the client limits the choice.
export const SEVERITIES = ['info', 'warning', 'critical'] as const;

const MESSAGE_MAX = 200;

export type AlertFormErrors = Partial<Record<keyof SendAlertRequest, string>>;

export type AlertFormResult =
  { ok: true; value: SendAlertRequest } | { ok: false; errors: AlertFormErrors };

export function validateAlert(input: SendAlertRequest): AlertFormResult {
  const message = input.message.trim();
  const errors: AlertFormErrors = {};

  if (!message) errors.message = 'Message is required';
  else if (message.length > MESSAGE_MAX) errors.message = `At most ${MESSAGE_MAX} characters`;
  if (!(SEVERITIES as readonly string[]).includes(input.severity))
    errors.severity = 'Pick a severity';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { message, severity: input.severity } };
}
