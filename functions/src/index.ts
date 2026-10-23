import './lib/options';

export { addMember, createOrganization, ensureProfile, requestOtp, setPlatformRole, updateMember, updateProfile, verifyOtp } from './identity';
export { listAllEligibleRooms, onBedWritten, onPropertyWritten, onRoomWritten, setRoomListing, submitPropertyForVerification } from './inventory';
export { addResident, advanceBooking, completeMoveOut, createLead, logSearch, moveIn, startApplication, startMoveOut, trackRoomView, trackShare, transferResident } from './marketplace';
export { generateInvoicesNow, monthlyInvoices, onMaintenanceUpdated, onNoticeWritten, onParcelCreated, payRentOnline, raiseMaintenance, recordPayment, refreshInvoices } from './operations';
export { getPartnerEarnings, getServiceCatalog, onServiceOrderWritten, placeServiceOrder, updateServiceOrderStatus, upsertRevenueRule } from './services';
export { getPropertyInsights, reviewProperty, setPropertySuspended, setRoomSuspended } from './platform';
export { getResidentHome } from './resident';
