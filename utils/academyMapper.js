// utils/academyMapper.js
const mapAcademy = (doc) => {
    if (!doc) return null;

    const d = doc.toObject ? doc.toObject() : doc;

    return {
        id: d._id,
        name: d.name || '',
        slug: d.slug || '',
        description: d.description || '',

        location: {
            address: d.address || '',
            city: d.city || '',
            state: d.state || '',
            country: 'India',
            lat: d.latitude || 0,
            lng: d.longitude || 0,
        },

        contact: {
            phone: d.contactNumber || '',
            googleMaps: d.googleMapsLink || '',
        },

        // Always return array — never undefined
        sportsOffered: d.sport
            ? (Array.isArray(d.sport) ? d.sport : [d.sport])
            : [],

        coverImage: d.academyImage || '',

        // ALL of these must be arrays — never undefined or null
        gallery: Array.isArray(d.gallery) ? d.gallery : [],

        facilities: Array.isArray(d.facilities)
            ? d.facilities
            : typeof d.facilities === 'string'
                ? d.facilities.split(',').map(item => item.trim())
                : [],

        trainingLevels: Array.isArray(d.trainingLevels) ? d.trainingLevels : [],
        certifications: Array.isArray(d.certifications) ? d.certifications : [],

        rating: {
            average: typeof d.rating === 'number' ? d.rating : 0,
            count: d.reviewCount || 0,
        },

        // Always return object — never undefined
        achievementSignals: d.achievementSignals || {},
        socialLinks: d.socialLinks || {},

        verificationStatus: d.verified === true ? 'verified' : 'unverified',
        status: 'published',

        fees: d.fees || '',
        ageGroups: d.ageGroups || '',
        gender: d.gender || '',
        batchCapacity: d.batchCapacity || 0,
        savedCount: d.savedCount || 0,

        createdAt: d.createdAt || null,
        updatedAt: d.updatedAt || null,
    };
};

module.exports = { mapAcademy };
