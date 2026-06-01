// Shared domain vocabulary. SQLite has no native enums, so these app-level
// constants keep values consistent across forms, validation, and display.

export const LOAN_STAGES = [
  "LEAD",
  "APPLICATION",
  "PROCESSING",
  "UNDERWRITING",
  "APPROVED",
  "FUNDED",
  "CLOSED",
  "DENIED",
] as const;
export type LoanStage = (typeof LOAN_STAGES)[number];

// Stages that represent active pipeline work (vs. terminal outcomes).
export const ACTIVE_LOAN_STAGES: LoanStage[] = [
  "LEAD",
  "APPLICATION",
  "PROCESSING",
  "UNDERWRITING",
  "APPROVED",
];

export const LOAN_STAGE_LABELS: Record<LoanStage, string> = {
  LEAD: "Lead",
  APPLICATION: "Application",
  PROCESSING: "Processing",
  UNDERWRITING: "Underwriting",
  APPROVED: "Approved",
  FUNDED: "Funded",
  CLOSED: "Closed",
  DENIED: "Denied",
};

export const LOAN_TYPES = [
  "Conventional",
  "FHA",
  "VA",
  "Jumbo",
  "HELOC",
  "Refinance",
] as const;
export type LoanType = (typeof LOAN_TYPES)[number];

export const PROPERTY_STATUSES = [
  "ACTIVE",
  "PENDING",
  "SOLD",
  "OFF_MARKET",
] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  SOLD: "Sold",
  OFF_MARKET: "Off Market",
};

export const PROPERTY_TYPES = [
  "Single Family",
  "Condo",
  "Townhouse",
  "Multi-Family",
  "Land",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const USER_ROLES = ["ADMIN", "OFFICER"] as const;
export type UserRole = (typeof USER_ROLES)[number];
