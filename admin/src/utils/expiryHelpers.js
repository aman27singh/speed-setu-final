/**
 * Speed Setu Logistics Admin - Compliance & Expiry Helpers
 */

export const getExpiryStatus = (expiryDateString) => {
  if (!expiryDateString) {
    return { status: 'unknown', label: 'No Date Set', color: 'gray', daysRemaining: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDateString);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry - today;
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      status: 'expired',
      label: `Expired (${Math.abs(daysRemaining)} days ago)`,
      color: 'red',
      daysRemaining
    };
  }

  if (daysRemaining <= 30) {
    return {
      status: 'expiring_soon',
      label: `Expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
      color: 'yellow',
      daysRemaining
    };
  }

  return {
    status: 'valid',
    label: `Valid (${daysRemaining} days remaining)`,
    color: 'green',
    daysRemaining
  };
};
