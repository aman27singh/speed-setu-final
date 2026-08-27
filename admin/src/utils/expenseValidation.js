/**
 * Speed Setu Logistics Admin - Expense Allocation & Payables Aging Helpers
 */

export const calculateWeightBasedAllocation = (shipments = [], totalExpenseAmount = 0) => {
  const totalAmount = parseFloat(totalExpenseAmount) || 0;
  const totalWeight = shipments.reduce((acc, s) => acc + (parseFloat(s.actualWeight) || 0), 0);

  if (totalWeight <= 0 || totalAmount <= 0) {
    return shipments.map((s) => ({
      shipmentId: s.id,
      cnNumber: s.cnNumber,
      companyName: s.companyName,
      weight: s.actualWeight || 0,
      allocatedAmount: 0,
      percentage: 0
    }));
  }

  let allocatedSum = 0;
  const allocations = shipments.map((s, idx) => {
    const weight = parseFloat(s.actualWeight) || 0;
    const ratio = weight / totalWeight;
    let amount = Math.round(totalAmount * ratio);

    // Adjust rounding difference on last item
    if (idx === shipments.length - 1) {
      amount = totalAmount - allocatedSum;
    } else {
      allocatedSum += amount;
    }

    return {
      shipmentId: s.id,
      cnNumber: s.cnNumber,
      companyName: s.companyName,
      weight,
      allocatedAmount: Math.max(0, amount),
      percentage: ((ratio) * 100).toFixed(1)
    };
  });

  return allocations;
};

export const calculateRevenueBasedAllocation = (shipments = [], totalExpenseAmount = 0) => {
  const totalAmount = parseFloat(totalExpenseAmount) || 0;
  const totalRevenue = shipments.reduce((acc, s) => acc + (parseFloat(s.estimatedRevenue || s.actualRevenue || 20000) || 0), 0);

  if (totalRevenue <= 0 || totalAmount <= 0) {
    return shipments.map((s) => ({
      shipmentId: s.id,
      cnNumber: s.cnNumber,
      companyName: s.companyName,
      revenue: s.estimatedRevenue || 20000,
      allocatedAmount: 0,
      percentage: 0
    }));
  }

  let allocatedSum = 0;
  const allocations = shipments.map((s, idx) => {
    const rev = parseFloat(s.estimatedRevenue || s.actualRevenue || 20000) || 0;
    const ratio = rev / totalRevenue;
    let amount = Math.round(totalAmount * ratio);

    if (idx === shipments.length - 1) {
      amount = totalAmount - allocatedSum;
    } else {
      allocatedSum += amount;
    }

    return {
      shipmentId: s.id,
      cnNumber: s.cnNumber,
      companyName: s.companyName,
      revenue: rev,
      allocatedAmount: Math.max(0, amount),
      percentage: ((ratio) * 100).toFixed(1)
    };
  });

  return allocations;
};

export const validateExpenseForm = (formData) => {
  const errors = {};
  if (!formData.description || !formData.description.trim()) {
    errors.description = 'Description is required.';
  }
  const amt = parseFloat(formData.amount);
  if (!amt || amt <= 0) {
    errors.amount = 'Expense amount must be greater than 0.';
  }
  if (!formData.category) {
    errors.category = 'Category is required.';
  }
  return errors;
};
