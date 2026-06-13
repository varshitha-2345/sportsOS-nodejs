const config = {
    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-2.0-flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    },
    firecrawl: {
        apiKey: process.env.FIRECRAWL_API_KEY,
        baseUrl: 'https://api.firecrawl.dev/v1',
    },
    overpass: {
        baseUrl: 'https://overpass-api.de/api/interpreter',
    },
    mongo: {
        uri: process.env.MONGO_URI,
    },
    acquisition: {
        dryRun: process.env.DRY_RUN === 'true',
        maxAcademies: parseInt(process.env.MAX_ACADEMIES || '20', 10),
        maxCoaches: parseInt(process.env.MAX_COACHES || '10', 10),
        verbose: process.env.VERBOSE === 'true',
        targetStates: (process.env.TARGET_STATES || 'Andhra Pradesh,Telangana,Karnataka,Tamil Nadu,Maharashtra').split(','),
    },
    sources: {
        independent: ['website', 'google_maps', 'openstreetmap', 'khelo_india', 'sai'],
        fallback: ['instagram', 'facebook', 'justdial'],
        all: ['website', 'google_maps', 'openstreetmap', 'khelo_india', 'sai', 'instagram', 'facebook', 'justdial'],
    },
    confidence: {
        perSource: 30,
        max: 100,
        minForPublish: 60,
    },
    placeholders: {
        description: 'Information not available',
        sportsOffered: [],
        facilities: [],
        trainingLevels: [],
        certifications: [],
        contact: { phone: null, email: null, website: null },
        location: { lat: 0, lng: 0 },
        rating: { average: 0, count: 0 },
        coverImage: null,
        verificationStatus: 'unverified',
        status: 'published',
    },
    states: {
        'Andhra Pradesh': { code: 'AP', overpassId: '3049' },
        'Telangana': { code: 'TS', overpassId: '2085' },
        'Karnataka': { code: 'KA', overpassId: '2024' },
        'Tamil Nadu': { code: 'TN', overpassId: '2039' },
        'Maharashtra': { code: 'MH', overpassId: '2071' },
    },
};

module.exports = config;
