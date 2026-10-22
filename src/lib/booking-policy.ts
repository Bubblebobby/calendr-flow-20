export type BookingPolicy = {
  notice_hours: number;
  allow_cancel: boolean;
  allow_reschedule: boolean;
  text: string | null;
};

/** One sentence clients see about changing their booking. */
export function policySummary(policy: BookingPolicy) {
  const notice =
    policy.notice_hours === 0
      ? "any time before"
      : `up to ${policy.notice_hours} hour${policy.notice_hours === 1 ? "" : "s"} before`;
  if (policy.allow_cancel && policy.allow_reschedule)
    return `You can cancel or reschedule online ${notice} your appointment.`;
  if (policy.allow_cancel) return `You can cancel online ${notice} your appointment.`;
  if (policy.allow_reschedule) return `You can reschedule online ${notice} your appointment.`;
  return "To change your booking, please contact the business.";
}

/** True when the policy lets clients change a booking at `start` online right now. */
export function changeableOnline(policy: BookingPolicy, start: Date, now = new Date()) {
  if (!policy.allow_cancel && !policy.allow_reschedule) return false;
  return start.getTime() - now.getTime() >= policy.notice_hours * 3_600_000;
}

/**
 * The policy sentence for one booking: the general rule, unless the appointment is already
 * inside the notice window, in which case it says changes have to go through the business.
 */
export function policyForBooking(policy: BookingPolicy, start: Date, businessName: string) {
  if ((policy.allow_cancel || policy.allow_reschedule) && !changeableOnline(policy, start)) {
    return `This appointment is less than ${policy.notice_hours} hour${
      policy.notice_hours === 1 ? "" : "s"
    } away, so it can't be changed online. Contact ${businessName} if your plans change.`;
  }
  return policySummary(policy);
}
