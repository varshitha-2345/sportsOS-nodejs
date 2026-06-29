// utils/academyMapper.js
// Converts raw MongoDB academy document to frontend-expected format

const mapAcademy = (doc) => {
    if (!doc) return null;

    const d = doc.toObject ? doc.toObject() : doc;

    return {
        id: d._id?.toString(),
        name: d.name || '',
        slug: d.slug || '',
        description: d.description || '',

        // location object
        location: {
            address: d.address || '',
            city: d.city || '',
            state: d.state || '',
            country: 'India',
            lat: d.latitude || 0,
            lng: d.longitude || 0,
        },

        // contact object
        contact: {
            phone: d.contactNumber || '',
            email: d.email || '',
            website: d.website || '',
            googleMaps: d.googleMapsLink || '',
        },

        // sports as array
        sportsOffered: d.sport
            ? (Array.isArray(d.sport) ? d.sport : [d.sport])
            : [],

        // image
        coverImage: d.academyImage || '',
        gallery: [],

        // rating object
        rating: {
            average: d.rating || 0,
            count: d.reviewCount || 0,
        },

        // verification
        verificationStatus: d.verified === true ? 'verified' : 'unverified',

        // social
        socialLinks:
        typeof d.socialLinks === "string"
        ? JSON.parse(d.socialLinks)
        : (d.socialLinks || {}),

        // defaults for missing fields
        facilities: Array.isArray(d.facilities)
        ? d.facilities
        : (typeof d.facilities === "string"
        ? d.facilities.split(",").map(f => f.trim())
        : []),
        trainingLevels: d.batchTimings ? [d.batchTimings] : [],
        certifications: [],
        achievementSignals: {},
        fees: d.fees || '',
        ageGroups: d.ageGroups || '',
        gender: d.gender || '',
        batchCapacity: d.batchCapacity || 0,
        savedCount: d.savedCount || 0,

        status: 'published',
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
    };
};

module.exports = { mapAcademy };