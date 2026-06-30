// utils/sportMapper.js
// The Sport model is already close to frontend-ready; this mapper only
// normalizes _id -> id and guards against null docs, so /sports responses
// are consistent with the id convention used by academies and coaches.

const DEFAULT_ICON  = '/images/sports/default-sport.svg';
const DEFAULT_COVER = '/images/sports/default-sport-cover.jpg';

const mapSport = (doc) => {
    if (!doc) return null;

    const d = doc.toObject ? doc.toObject() : doc;

    return {
        ...d,
        id: d._id?.toString(),
        icon: d.icon || DEFAULT_ICON,
        coverImage: d.coverImage || DEFAULT_COVER,
        _id: undefined,
        __v: undefined,
    };
};

module.exports = { mapSport };
