function generateSlug(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function normalizeSport(sport) {
    const map = {
        'cricket': 'cricket',
        'football': 'football',
        'soccer': 'football',
        'badminton': 'badminton',
        'tennis': 'tennis',
        'table tennis': 'table-tennis',
        'table-tennis': 'table-tennis',
        'swimming': 'swimming',
        'hockey': 'hockey',
        'kabaddi': 'kabaddi',
        'chess': 'chess',
        'archery': 'archery',
        'athletics': 'athletics',
        'boxing': 'boxing',
        'wrestling': 'wrestling',
        'yoga': 'yoga',
        'gymnastics': 'gymnastics',
        'karate': 'karate',
        'judo': 'judo',
        'skating': 'skating',
        'basketball': 'basketball',
        'volleyball': 'volleyball',
        'weightlifting': 'weightlifting',
        'shooting': 'shooting',
        'cycling': 'cycling',
        'fencing': 'fencing',
        'rowing': 'rowing',
        'kayaking': 'kayaking',
        'canoeing': 'canoeing',
        'billiards': 'billiards',
        'snooker': 'billiards',
    };
    const lower = sport.toLowerCase().trim();
    return map[lower] || lower.replace(/\s+/g, '-');
}

function normalizeFacility(facility) {
    const map = {
        'indoor': 'indoor',
        'outdoor': 'outdoor',
        'ground': 'ground',
        'court': 'court',
        'equipment': 'equipment',
        'changing room': 'changing_room',
        'changing_room': 'changing_room',
        'parking': 'parking',
        'physio': 'physio',
        'gym': 'gym',
        'pool': 'indoor',
        'swimming pool': 'indoor',
    };
    const lower = facility.toLowerCase().trim();
    return map[lower] || null;
}

function normalizeLevel(level) {
    const map = {
        'beginner': 'beginner',
        'intermediate': 'intermediate',
        'advanced': 'advanced',
        'elite': 'elite',
        'professional': 'elite',
        'national': 'elite',
        'state': 'advanced',
        'district': 'intermediate',
        'local': 'beginner',
    };
    const lower = level.toLowerCase().trim();
    return map[lower] || null;
}

function calculateConfidence(sources) {
    const independentSources = sources.filter(s =>
        ['website', 'google_maps', 'openstreetmap', 'khelo_india', 'sai'].includes(s.sourceType)
    );
    const score = Math.min(independentSources.length * 30, 100);
    return score;
}

function isIndependentSource(sourceType) {
    return ['website', 'google_maps', 'openstreetmap', 'khelo_india', 'sai'].includes(sourceType);
}

function deduplicateByName(records) {
    const seen = new Map();
    return records.filter(r => {
        const slug = generateSlug(r.name);
        if (seen.has(slug)) return false;
        seen.set(slug, true);
        return true;
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    generateSlug,
    normalizeSport,
    normalizeFacility,
    normalizeLevel,
    calculateConfidence,
    isIndependentSource,
    deduplicateByName,
    sleep,
};
