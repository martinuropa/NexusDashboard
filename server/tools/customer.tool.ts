export interface CustomerProfile {
  id: '9812';
  name: 'Maria Santos';
  tier: 'VIP';
  preferredChannel: 'Viber';
}

const mariaSantos: CustomerProfile = {
  id: '9812',
  name: 'Maria Santos',
  tier: 'VIP',
  preferredChannel: 'Viber',
};

export function getCustomerProfile(customerId: string): CustomerProfile {
  if (customerId !== mariaSantos.id) throw new Error(`Unknown customer: ${customerId}`);
  return { ...mariaSantos };
}
