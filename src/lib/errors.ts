// Database functions raise short codes ("insufficient_points: need 44, have 30").
// Turn them into messages people can act on.
const MESSAGES: Record<string, string> = {
  not_authenticated: "Please sign in first.",
  banned: "Your account is suspended. Contact support on Discord.",
  insufficient_points: "Not enough spendable points.",
  not_your_game: "You can only list your own games.",
  reward_too_low: "Reward is too low.",
  reward_too_high: "Reward can be at most 200 points per test.",
  bad_slots: "Choose between 1 and 50 testers.",
  campaign_already_active: "This game already has an active test campaign.",
  pending_reports: "Review the submitted reports before closing.",
  campaign_closed: "This campaign is closed.",
  own_game: "You can't test your own game.",
  already_tested: "You already took a slot in this campaign.",
  too_many_active_tests: "You can have at most 3 tests in progress. Finish one first.",
  pair_limit: "You've tested this developer's games 3 times this month. Try someone else's game.",
  no_free_slots: "All slots are taken right now.",
  not_open: "This test is no longer open.",
  deadline_passed: "The deadline for this test has passed.",
  report_too_short: "Your report is too short.",
  screenshot_required: "Attach at least one screenshot.",
  not_submitted: "This report was already reviewed.",
  reason_required: "Explain why you reject the report.",
  cannot_dispute: "This rejection can no longer be disputed.",
  already_claimed: "You already claimed this task.",
  requirements_not_met: "You haven't met this task's requirements yet.",
  unknown_task: "This task is not available.",
  daily_cap_reached: "This task reached its daily limit. Try again tomorrow.",
  forbidden: "You don't have permission to do that.",
  conflict_of_interest: "You can't resolve a dispute you are part of.",
  not_found: "Not found.",
};

export function friendlyError(message: string | undefined | null): string {
  if (!message) return "Something went wrong. Please try again.";
  const [code, detail] = message.split(/:\s*([\s\S]*)/);
  const base = MESSAGES[code.trim()];
  if (!base) return message;
  return detail ? `${base} (${detail})` : base;
}
