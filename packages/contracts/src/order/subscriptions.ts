export const SUBSCRIPTION_TIME_ZONE = 'Asia/Kolkata';
export const SUBSCRIPTION_SLOTS = [
  { id: 'morning-6-8', label: '06:00 AM - 08:00 AM', title: '6–8 AM', startMinute: 360, endMinute: 480 },
  { id: 'morning-7-9', label: '07:00 AM - 09:00 AM', title: '7–9 AM', startMinute: 420, endMinute: 540 },
  { id: 'morning-8-10', label: '08:00 AM - 10:00 AM', title: '8–10 AM', startMinute: 480, endMinute: 600 },
] as const;
export const SUBSCRIPTION_FREQUENCIES = ['DAILY', 'ALTERNATE_DAYS', 'WEEKDAYS_ONLY', 'WEEKLY'] as const;
export type SubscriptionFrequency = typeof SUBSCRIPTION_FREQUENCIES[number];

export function subscriptionSlot(value: string) {
  return SUBSCRIPTION_SLOTS.find((slot) => slot.id === value || slot.label === value);
}

export function subscriptionClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SUBSCRIPTION_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const part = (name: string) => parts.find((item) => item.type === name)!.value;
  return { date: `${part('year')}-${part('month')}-${part('day')}`, minute: Number(part('hour')) * 60 + Number(part('minute')) };
}

export function nextSubscriptionDate(date: string, frequency: SubscriptionFrequency, after = date): string {
  const day = new Date(`${date}T00:00:00Z`);
  const interval = frequency === 'WEEKLY' ? 7 : frequency === 'ALTERNATE_DAYS' ? 2 : 1;
  do {
    day.setUTCDate(day.getUTCDate() + interval);
  } while (day.toISOString().slice(0, 10) <= after || (frequency === 'WEEKDAYS_ONLY' && [0, 6].includes(day.getUTCDay())));
  return day.toISOString().slice(0, 10);
}
