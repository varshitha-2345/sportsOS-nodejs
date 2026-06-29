// utils/coachMapper.js

const mapCoach = (doc) => {
    if (!doc) return null;

    const d = doc.toObject ? doc.toObject() : doc;

    return {
        id: d._id,

        name: d.name || '',
        slug: d.slug || '',

        avatar: d.avatar || '',

        academyId: d.academyId || '',

        location: {
            city: d.location?.city || '',
            state: d.location?.state || '',
            country: d.location?.country || 'India',
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

        certifications: Array.isArray(d.certifications)
            ? d.certifications
            : d.certifications
                ? [d.certifications]
                : [],

        experienceYears: d.experienceYears || 0,

        rating: {
            average: typeof d.rating === 'number' ? d.rating : 0,
            count: d.reviewCount || 0,
        },

        verificationStatus:
            d.verificationStatus ||
            (d.verified ? 'verified' : 'unverified'),

        status: d.status || 'published',

        createdAt: d.createdAt || null,
        updatedAt: d.updatedAt || null,
    };
};

module.exports = { mapCoach };
