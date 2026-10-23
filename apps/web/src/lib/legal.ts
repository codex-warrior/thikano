/**
 * Business details used by the legal pages. Fill these in before launch — while any value
 * is still a placeholder the pages show a DRAFT banner. Have a lawyer review the policies.
 */
export const LEGAL = {
  entityName: process.env.NEXT_PUBLIC_LEGAL_ENTITY ?? '[Registered company name]',
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS ?? '[Registered office address]',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? '[support@thikano.in]',
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '[Support phone]',
  grievanceOfficer: process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER ?? '[Grievance Officer name]',
  grievanceEmail: process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL ?? '[grievance@thikano.in]',
  effectiveDate: process.env.NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE ?? '[Effective date]',
};

export const isDraft = Object.values(LEGAL).some((v) => v.startsWith('['));
