// ============================================================
// services/leadService.js
// CRM lead pipeline management — created from enquiries.
//
// Frontend alignment (types/domain/lead.ts):
//   - LeadStatus:       'new' | 'contacted' | 'qualified' | 'trial_scheduled' | 'converted' | 'lost'
//   - LeadSource:       'academy_detail' | 'coach_detail' | 'compare' | 'shortlist' | 'search'
//   - LeadOwnerType:    'academy' | 'coach'
//   - LeadActivityType: 'note' | 'status_change' | 'contact_attempt' | 'whatsapp_sent' | 'callback_logged'
//   - LeadActorType:    'system' | 'admin'
//
// Admin UI: components/admin/lead-board.tsx, lead-detail.tsx
//           app/(admin)/admin/leads/page.tsx, [id]/page.tsx
// ============================================================

const Lead         = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'trial_scheduled', 'converted', 'lost'];
const VALID_ACTIVITY = ['note', 'status_change', 'contact_attempt', 'whatsapp_sent', 'callback_logged'];

// ─── GET LEAD BY ID ──────────────────────────────────────────
// Fetches a full lead record with its activity history.
// Used in app/(admin)/admin/leads/[id]/page.tsx
const getLeadById = async (leadId) => {
  const lead = await Lead.findById(leadId).populate('enquiryId');
  if (!lead) throw new Error('Lead not found');

  const activities = await LeadActivity.find({ leadId }).sort({ createdAt: -1 });
  return { lead, activities };
};

// ─── GET LEADS BY OWNER ───────────────────────────────────────
// Returns all leads belonging to an academy or coach.
// Supports filtering by status and pagination.
const getLeadsByOwner = async ({ ownerType, ownerId, status, page = 1, limit = 20 }) => {
  const filter = { ownerType, ownerId };
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [leads, total] = await Promise.all([
    Lead.find(filter)
        .populate('enquiryId')
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(limit),
    Lead.countDocuments(filter),
  ]);

  return { leads, total, page, pages: Math.ceil(total / limit) };
};

// ─── GET ALL LEADS (Admin) ────────────────────────────────────
// Admin view of all leads across the platform.
// Matches app/(admin)/admin/leads/page.tsx (lead-board.tsx)
const getAllLeads = async ({ status, source, page = 1, limit = 20 }) => {
  const filter = {};
  if (status) filter.status = status;
  if (source) filter.source = source;

  const skip = (page - 1) * limit;
  const [leads, total] = await Promise.all([
    Lead.find(filter)
        .populate('enquiryId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    Lead.countDocuments(filter),
  ]);

  return { leads, total, page, pages: Math.ceil(total / limit) };
};

// ─── UPDATE LEAD STATUS ───────────────────────────────────────
// Admin or system moves a lead through the pipeline.
// Automatically logs a 'status_change' activity.
const updateLeadStatus = async (leadId, status, actorType = 'admin', actorId = null) => {
  if (!VALID_STATUSES.includes(status)) throw new Error('Invalid lead status');

  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error('Lead not found');

  const previousStatus = lead.status;

  const updated = await Lead.findByIdAndUpdate(
    leadId,
    { status, lastActivityAt: new Date() },
    { new: true }
  );

  // Auto-log the status change as an activity
  await LeadActivity.create({
    leadId,
    actorType,
    actorId: actorId || null,
    type:    'status_change',
    payload: { from: previousStatus, to: status },
  });

  return updated;
};

// ─── ASSIGN LEAD ─────────────────────────────────────────────
// Admin assigns a lead to a specific team member.
const assignLead = async (leadId, assignedTo, actorId = null) => {
  const lead = await Lead.findByIdAndUpdate(
    leadId,
    { assignedTo, lastActivityAt: new Date() },
    { new: true }
  );
  if (!lead) throw new Error('Lead not found');

  await LeadActivity.create({
    leadId,
    actorType: 'admin',
    actorId:   actorId || null,
    type:      'note',
    payload:   { action: 'assigned', assignedTo },
  });

  return lead;
};

// ─── LOG LEAD ACTIVITY ───────────────────────────────────────
// Adds any activity entry to a lead.
// type: 'note' | 'contact_attempt' | 'whatsapp_sent' | 'callback_logged'
// payload: free-form object with activity details
const logActivity = async (leadId, { type, actorType = 'admin', actorId, payload }) => {
  if (!VALID_ACTIVITY.includes(type)) throw new Error('Invalid activity type');

  const activity = await LeadActivity.create({
    leadId,
    actorType,
    actorId: actorId || null,
    type,
    payload: payload || {},
  });

  // Update the lastActivityAt timestamp on the lead
  await Lead.findByIdAndUpdate(leadId, { lastActivityAt: new Date() });

  return activity;
};

module.exports = {
  getLeadById,
  getLeadsByOwner,
  getAllLeads,
  updateLeadStatus,
  assignLead,
  logActivity,
};
