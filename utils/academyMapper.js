// utils/academyMapper.js
// utils/academyMapper.js
const mapAcademy = (doc) => {
    if (!doc) return null;

    const d = doc.toObject ? doc.toObject() : doc;

    // socialLinks is stored as a String in the DB (sometimes a JSON string,
    // sometimes empty). Always return a real object to the frontend so
    // code like socialLinks.instagram never breaks.
    let parsedSocialLinks = {};
    if (d.socialLinks) {
        if (typeof d.socialLinks === 'string') {
            try {
                parsedSocialLinks = JSON.parse(d.socialLinks);
            } catch (e) {
                parsedSocialLinks = {};
            }
        } else if (typeof d.socialLinks === 'object') {
            parsedSocialLinks = d.socialLinks;
        }
    }

    return {
        id: d._id?.toString(),
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
            email: '',
            website: '',
            googleMaps: d.googleMapsLink || '',
        },

        // Always return array — never undefined
        sportsOffered: d.sport
            ? (Array.isArray(d.sport) ? d.sport : [d.sport])
            : [],

        coverImage: d.academyImage || '',

        // ALL of these must be arrays — never undefined or null
        gallery: Array.isArray(d.gallery) ? d.gallery : [],

        facilities: (() => {
            if (!d.facilities) return [];
            const raw = Array.isArray(d.facilities) ? d.facilities[0] : d.facilities;
            if (typeof raw === 'string') {
                return raw.split(',').map(item => item.trim()).filter(Boolean);
            }
            return Array.isArray(d.facilities) ? d.facilities : [];
        })(),

        trainingLevels: Array.isArray(d.trainingLevels) ? d.trainingLevels : [],
        certifications: Array.isArray(d.certifications) ? d.certifications : [],

        rating: {
            average: typeof d.rating === 'number' ? d.rating : 0,
            count: d.reviewCount || 0,
        },

        // Always return object — never undefined
        achievementSignals: d.achievementSignals || {},
        socialLinks: parsedSocialLinks,

        verificationStatus: d.verified === true ? 'verified' : 'unverified',
        status: d.status || 'published',

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

// ─── unmapAcademyInput ─────────────────────────────────────────────
// Converts an admin-submitted, frontend-shaped payload (nested location,
// contact, sportsOffered array, rating object) into the flat fields the
// Academy schema actually stores. Without this, create/update silently
// drop those nested objects because Mongoose ignores unknown paths.
function unmapAcademyInput(body = {}) {
    const out = {};

    if (body.name !== undefined) out.name = body.name;
    if (body.slug !== undefined) out.slug = body.slug;
    if (body.description !== undefined) out.description = body.description;

    if (body.location && typeof body.location === 'object') {
        if (body.location.address !== undefined) out.address = body.location.address;
        if (body.location.city !== undefined) out.city = body.location.city;
        if (body.location.state !== undefined) out.state = body.location.state;
        if (body.location.lat !== undefined) out.latitude = body.location.lat;
        if (body.location.lng !== undefined) out.longitude = body.location.lng;
    }

    if (body.contact && typeof body.contact === 'object') {
        if (body.contact.phone !== undefined) out.contactNumber = body.contact.phone;
        if (body.contact.googleMaps !== undefined) out.googleMapsLink = body.contact.googleMaps;
    }

    if (body.sportsOffered !== undefined) {
        out.sport = Array.isArray(body.sportsOffered)
            ? body.sportsOffered[0]
            : body.sportsOffered;
    }

    if (body.facilities !== undefined) {
        out.facilities = Array.isArray(body.facilities)
            ? body.facilities
            : typeof body.facilities === 'string'
                ? body.facilities.split(',').map(f => f.trim())
                : [];
    }

    if (body.trainingLevels !== undefined) out.trainingLevels = body.trainingLevels;
    if (body.certifications !== undefined) out.certifications = body.certifications;
    if (body.achievementSignals !== undefined) out.achievementSignals = body.achievementSignals;

    if (body.rating && typeof body.rating === 'object') {
        if (body.rating.average !== undefined) out.rating = body.rating.average;
        if (body.rating.count !== undefined) out.reviewCount = body.rating.count;
    }

    // socialLinks: frontend may send an object; store it as a JSON string
    // to match the current schema (socialLinks: String)
    if (body.socialLinks !== undefined) {
        out.socialLinks = typeof body.socialLinks === 'string'
            ? body.socialLinks
            : JSON.stringify(body.socialLinks);
    }

    if (body.coverImage !== undefined) out.academyImage = body.coverImage;
    if (body.gallery !== undefined) out.gallery = body.gallery;
    if (body.verificationStatus !== undefined) out.verified = body.verificationStatus === 'verified';
    if (body.status !== undefined) out.status = body.status;
    if (body.fees !== undefined) out.fees = body.fees;
    if (body.ageGroups !== undefined) out.ageGroups = body.ageGroups;
    if (body.gender !== undefined) out.gender = body.gender;
    if (body.batchCapacity !== undefined) out.batchCapacity = body.batchCapacity;

    return out;
}

module.exports.unmapAcademyInput = unmapAcademyInput;