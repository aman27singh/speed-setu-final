/**
 * Speed Setu Logistics Admin - POD & Package Count Validation Helpers
 */

export const validatePackageCountMatch = (shipmentPackages = 0, deliveredPackages = 0) => {
  const shipPkg = parseInt(shipmentPackages, 10) || 0;
  const delivPkg = parseInt(deliveredPackages, 10) || 0;

  if (shipPkg === delivPkg) {
    return {
      matched: true,
      status: 'matched',
      message: `✓ Package count matched (${delivPkg}/${shipPkg} delivered)`,
      difference: 0
    };
  }

  const diff = shipPkg - delivPkg;
  if (diff > 0) {
    return {
      matched: false,
      status: 'shortage',
      message: `⚠ Package shortage detected! ${diff} package${diff === 1 ? '' : 's'} missing (${delivPkg}/${shipPkg} delivered)`,
      difference: diff
    };
  }

  return {
    matched: false,
    status: 'excess',
    message: `⚠ Package excess! Delivered (${delivPkg}) exceeds shipment count (${shipPkg})`,
    difference: Math.abs(diff)
  };
};

export const validatePODForm = (formData) => {
  const errors = {};
  if (!formData.receiverName || !formData.receiverName.trim()) {
    errors.receiverName = 'Receiver Name is required.';
  }
  if (!formData.deliveryDate) {
    errors.deliveryDate = 'Delivery Date is required.';
  }
  if (formData.deliveredPackages === undefined || formData.deliveredPackages === null || isNaN(formData.deliveredPackages) || formData.deliveredPackages <= 0) {
    errors.deliveredPackages = 'Delivered Package Count must be greater than 0.';
  }
  return errors;
};
