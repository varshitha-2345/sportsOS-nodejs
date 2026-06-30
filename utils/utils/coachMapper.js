// utils/coachMapper.js
// Converts a raw MongoDB Coach document into the frontend-expected shape.
// Mirrors the structure produced by academyMapper.js so that List, Detail,
// Save/Shortlist, and Compare all return the same shape for a coach.

const mapCoach = (doc) => {
    if (!doc) return null;

    const d = doc.toObject ? doc.toObject() : doc;

    return {
        id: d._id?.toString(),

        name: d.name || '',
        slug: d.slug || '',

        avatar: d.avatar || '',
        bio: d.bio || '',

        academyId: d.academyId ? d.academyId.toString() : null,

        location: {
            address: d.location?.address || '',
            city: d.location?.city || '',
            state: d.location?.state || '',
            country: d.location?.country || 'IN',
            lat: d.location?.lat || 0,
            lng: d.location?.lng || 0,
        },

        contact: {
            phone: d.contact?.phone || '',
            email: d.contact?.email || '',
            website: d.contact?.website || '',
        },

        sportsCoached: Array.isArray(d.sportsCoached)
            ? d.sportsCoached
            : d.sportsCoached
                ? [d.sportsCoached]
                : [],

        specialization: Array.isArray(d.specialization)
            ? d.specialization
            : d.specialization
                ? [d.specialization]
                : [],

        // certifications is an array of { name, issuer, year, documentUrl } objects
        certifications: Array.isArray(d.certifications) ? d.certifications : [],

        achievements: Array.isArray(d.achievements) ? d.achievements : [],

        experienceYears: d.experienceYears || 0,

        // rating is stored as { average, count } on the Coach schema — never a bare number
        rating: {
            average: d.rating?.average || 0,
            count: d.rating?.count || 0,
        },

        verificationStatus: d.verificationStatus || 'unverified',
        status: d.status || 'published',

        createdAt: d.createdAt || null,
        updatedAt: d.updatedAt || null,
    };
};

module.exports = { mapCoach };
