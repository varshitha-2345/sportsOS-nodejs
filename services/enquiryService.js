// ============================================================
// services/enquiryService.js
// Handles admission/contact enquiries from users to academies/coaches.
//
// Frontend alignment (types/domain/enquiry.ts):
//   - EnquiryTargetType: 'academy' | 'coach'
//   - EnquiryIntent: 'contact' | 'callback' | 'trial' | 'enrollment_interest' | 'whatsapp'
//   - EnquiryStatus: 'submitted' | 'delivered' | 'failed' | 'bounced'
//   - parentInfo: { name, email, phone }
//   - childInfo?: { name, age }
//   - whatsappConfirmationSent, deliveryAttempts, leadId
//
// API request/response shapes (types/api/index.ts):
//   - EnquiryCreateRequest: targetType, targetId, intent, parentInfo, childInfo?, sportInterest, message?
//   - EnquiryCreateResponse: { enquiryId, leadId, whatsappConfirmationSent }
// ============================================================

const Enquiry = require('../models/Enquiry');
const Lead    = require('../models/Lead');

// ─── VALID ENUMS ─────────────────────────────────────────────
const VALID_INTENTS   = ['contact', 'callback', 'trial', 'enrollment_interest', 'whatsapp'];
const VALID_STATUSES  = ['submitted', 'delivered', 'failed', 'bounced'];

// ─── CREATE ENQUIRY ──────────────────────────────────────────
// User submits an enquiry from academy/coach detail pages.
// Creates both an Enquiry document AND a Lead document for the CRM pipeline.
// Returns enquiryId, leadId, and whatsapp confirmation status.
const createEnquiry = async ({
  userId,
  childId,
  targetType,    // 'academy' | 'coach'
  targetId,
  targetName,    // display name of the academy/coach
  intent,        // 'contact' | 'callback' | 'trial' | 'enrollment_interest' | 'whatsapp'
  parentInfo,    // { name, email, phone }
  childInfo,     // { name, age } — optional
  sportInterest,
  message,
  source,        // 'academy_detail' | 'coach_detail' | 'compare' | 'shortlist' | 'search'
  ipHash,
  userAgentHash,
}) => {
  if (!VALID_INTENTS.includes(intent)) throw new Error('Invalid enquiry intent');

  // Create the enquiry record
  const enquiry = await Enquiry.create({
    userId:         userId || null,
    childId:        childId || null,
    targetType,
    targetId,
    targetName:     targetName || '',
    intent,
    parentInfo,
    childInfo:      childInfo || null,
    sportInterest,
    message:        message || '',
    status:         'submitted',
    deliveryAttempts: 0,
    whatsappConfirmationSent: false,
    ipHash:         ipHash || null,
    userAgentHash:  userAgentHash || null,
  });

  // Create a lead in the CRM pipeline for this enquiry
  const lead = await Lead.create({
    enquiryId:   enquiry._id,
    source:      source || 'academy_detail',
    ownerType:   targetType,     // 'academy' or 'coach'
    ownerId:     targetId,
    userId:      userId || null,
    childId:     childId || null,
    status:      'new',          // starts in 'new' state in the lead pipeline
    lastActivityAt: new Date(),
  });

  // Link the lead back to the enquiry
  await Enquiry.findByIdAndUpdate(enquiry._id, { leadId: lead._id });

  // TODO: Trigger WhatsApp confirmation message via messaging gateway
  // On success: await Enquiry.findByIdAndUpdate(enquiry._id, { whatsappConfirmationSent: true, whatsappMessageId: ... })

  return {
    enquiryId:                enquiry._id,
    leadId:                   lead._id,
    whatsappConfirmationSent: false, // will be set to true after gateway responds
  };
};

// ─── GET ENQUIRIES BY USER ────────────────────────────────────
// Returns all enquiries submitted by a user for their profile enquiries page.
// Matches app/(private)/profile/enquiries/page.tsx
const getEnquiriesByUser = async (userId) => {
  return Enquiry.find({ userId })
    .sort({ createdAt: -1 });
};

// ─── GET ENQUIRIES BY ACADEMY ─────────────────────────────────
// Returns all enquiries received by an academy (academy owner dashboard view).
// Includes parent contact info for follow-up.
const getEnquiriesByAcademy = async (academyId) => {
  return Enquiry.find({ targetType: 'academy', targetId: academyId })
    .sort({ createdAt: -1 });
};

// ─── GET ENQUIRIES BY COACH ───────────────────────────────────
// Returns all enquiries received by a coach.
const getEnquiriesByCoach = async (coachId) => {
  return Enquiry.find({ targetType: 'coach', targetId: coachId })
    .sort({ createdAt: -1 });
};

// ─── UPDATE ENQUIRY DELIVERY STATUS ──────────────────────────
// Called by the messaging/delivery system when WhatsApp/email delivery status changes.
// status: 'submitted' | 'delivered' | 'failed' | 'bounced'
const updateEnquiryDeliveryStatus = async (enquiryId, { status, failureReason, whatsappMessageId }) => {
  if (!VALID_STATUSES.includes(status)) throw new Error('Invalid status');

  const updates = {
    status,
    $inc: { deliveryAttempts: 1 },
    lastDeliveryAt: new Date(),
  };
  if (failureReason)    updates.failureReason = failureReason;
  if (whatsappMessageId) {
    updates.whatsappMessageId        = whatsappMessageId;
    updates.whatsappConfirmationSent = true;
  }

  const enquiry = await Enquiry.findByIdAndUpdate(enquiryId, updates, { new: true });
  if (!enquiry) throw new Error('Enquiry not found');
  return enquiry;
};

module.exports = {
  createEnquiry,
  getEnquiriesByUser,
  getEnquiriesByAcademy,
  getEnquiriesByCoach,
  updateEnquiryDeliveryStatus,
};
