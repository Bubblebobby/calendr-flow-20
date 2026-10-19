export type BookingPolicy = { notice_hours: number; allow_cancel: boolean; allow_reschedule: boolean; text: string | null };

/** One sentence clients see about changing their booking. */
export function policySummary(policy: BookingPolicy) {
  const notice = policy.notice_hours === 0 ? "any time before" : `up to ${policy.notice_hours} hour${policy.notice_hours === 1 ? "" : "s"} before`;
  if (policy.allow_cancel && policy.allow_reschedule) return `You can cancel or reschedule online ${notice} your appointment.`;
  if (policy.allow_cancel) return `You can cancel online ${notice} your appointment.`;
  if (policy.allow_reschedule) return `You can reschedule online ${notice} your appointment.`;
  return "To change your booking, please contact the business.";
}
