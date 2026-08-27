/**
 * Speed Setu Trip & Fleet Form Validations
 */

export const validateTripForm = (formData) => {
  const errors = {};

  if (!formData.origin || !formData.origin.trim()) {
    errors.origin = 'Origin location/hub is required.';
  }
  if (!formData.destination || !formData.destination.trim()) {
    errors.destination = 'Destination location/hub is required.';
  }
  if (formData.origin && formData.destination && formData.origin.trim().toLowerCase() === formData.destination.trim().toLowerCase()) {
    errors.destination = 'Origin and Destination cannot be identical.';
  }
  if (!formData.tripDate) {
    errors.tripDate = 'Trip Date is required.';
  }
  if (!formData.mode) {
    errors.mode = 'Transport Mode is required.';
  }
  if (!formData.transporterId) {
    errors.transporterId = 'Transporter selection is required.';
  }
  if (!formData.shipmentIds || formData.shipmentIds.length === 0) {
    errors.shipmentIds = 'At least one Consignment Note (shipment) must be assigned to the trip.';
  }

  return errors;
};

export const validateTransporterForm = (formData) => {
  const errors = {};
  if (!formData.name || !formData.name.trim()) {
    errors.name = 'Transporter Name is required.';
  }
  if (!formData.contactPerson || !formData.contactPerson.trim()) {
    errors.contactPerson = 'Contact Person name is required.';
  }
  if (!formData.phone || !formData.phone.trim()) {
    errors.phone = 'Phone number is required.';
  }
  return errors;
};

export const validateDriverForm = (formData) => {
  const errors = {};
  if (!formData.name || !formData.name.trim()) {
    errors.name = 'Driver Name is required.';
  }
  if (!formData.phone || !formData.phone.trim()) {
    errors.phone = 'Phone number is required.';
  }
  if (!formData.licenseNumber || !formData.licenseNumber.trim()) {
    errors.licenseNumber = 'Driving License Number is required.';
  }
  if (!formData.licenseExpiry) {
    errors.licenseExpiry = 'License Expiry Date is required.';
  }
  return errors;
};

export const validateVehicleForm = (formData) => {
  const errors = {};
  if (!formData.vehicleNumber || !formData.vehicleNumber.trim()) {
    errors.vehicleNumber = 'Vehicle Number is required.';
  }
  if (!formData.vehicleType || !formData.vehicleType.trim()) {
    errors.vehicleType = 'Vehicle Type is required.';
  }
  return errors;
};
