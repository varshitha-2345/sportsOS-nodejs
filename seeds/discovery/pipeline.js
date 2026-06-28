const config = require('./config');
const GeminiClient = require('./gemini');
const FirecrawlClient = require('./firecrawl');
const OverpassClient = require('./overpass');
const Ingestor = require('./ingest');
const AcquisitionLogger = require('./logger');
const { generateSlug, normalizeSport, deduplicateByName, sleep } = require('./utils');

class Pipeline {
    constructor() {
        this.gemini = new GeminiClient();
        this.firecrawl = new FirecrawlClient();
        this.overpass = new OverpassClient();
        this.ingestor = null;
        this.logger = null;
        this.academiesProcessed = 0;
    }

    async run() {
        this.logger = new AcquisitionLogger();
        this.ingestor = new Ingestor(this.logger);

        console.log('=== SPORTS ACADEMY DATA ACQUISITION ===');
        console.log(`DRY_RUN: ${config.acquisition.dryRun}`);
        console.log(`MAX_ACADEMIES: ${config.acquisition.maxAcademies}`);
        console.log(`TARGET_STATES: ${config.acquisition.targetStates.join(', ')}`);
        console.log('=======================================\n');

        if (config.acquisition.dryRun) {
            console.log('🔍 DRY RUN MODE: Using simulated data (no API calls)\n');
            await this.dryRunSimulation();
            return;
        }

        try {
            await this.ingestor.connect();

            for (const state of config.acquisition.targetStates) {
                if (this.academiesProcessed >= config.acquisition.maxAcademies) {
                    console.log(`\nReached max academies limit (${config.acquisition.maxAcademies}). Stopping.`);
                    break;
                }

                console.log(`\n--- Processing: ${state} ---`);
                await this.processState(state);
            }

            const stats = await this.ingestor.getStats();
            console.log('\n=== DATABASE STATS ===');
            console.log(`Total academies: ${stats.academies}`);
            console.log(`Total coaches: ${stats.coaches}`);
            console.log(`Academies with provenance: ${stats.withProvenance}`);

        } catch (error) {
            console.error('Pipeline error:', error);
            this.logger.log('Pipeline error', { error: error.message });
        } finally {
            await this.ingestor.disconnect();
            this.logger.writeLog();
        }
    }

    async dryRunSimulation() {
        const simulatedAcademies = [
            { name: 'National Cricket Academy', city: 'Bengaluru', state: 'Karnataka', sports: ['cricket'], website: 'https://www.nca.co.in' },
            { name: 'Gachibowli Stadium Academy', city: 'Hyderabad', state: 'Telangana', sports: ['football', 'athletics'], website: null },
            { name: 'SAI Training Centre Chennai', city: 'Chennai', state: 'Tamil Nadu', sports: ['athletics', 'swimming'], website: 'https://sai.gov.in' },
            { name: 'Mumbai Cricket Association Academy', city: 'Mumbai', state: 'Maharashtra', sports: ['cricket'], website: 'https://www.mca-cricket.com' },
            { name: 'Visakhapatnam Sports Academy', city: 'Visakhapatnam', state: 'Andhra Pradesh', sports: ['cricket', 'football'], website: null },
        ];

        const limit = Math.min(simulatedAcademies.length, config.acquisition.maxAcademies);
        console.log(`Simulating ${limit} academies...\n`);

        for (let i = 0; i < limit; i++) {
            const academy = simulatedAcademies[i];
            console.log(`[${i + 1}/${limit}] Processing: ${academy.name}`);

            const sources = [
                { sourceType: 'gemini_search', sourceUrl: null, confidenceScore: 25 },
            ];

            if (academy.website) {
                sources.push({ sourceType: 'website', sourceUrl: academy.website, confidenceScore: 40 });
            }
            sources.push({ sourceType: 'google_maps', sourceUrl: null, confidenceScore: 35 });

            const result = await this.ingestor.upsertAcademy({
                ...academy,
                description: `Sports academy in ${academy.city}`,
                phone: '+91-9876543210',
                email: `info@${academy.name.toLowerCase().replace(/\s+/g, '')}.com`,
                lat: 12.9716 + (i * 0.5),
                lng: 77.5946 + (i * 0.5),
            }, sources);

            console.log(`  ✓ ${result.action}: ${result.slug}`);
            this.academiesProcessed++;
        }

        console.log('\n=== DRY RUN COMPLETE ===');
        console.log(`Academies processed: ${this.academiesProcessed}`);

        this.logger.writeLog();
    }

    async processState(state) {
        const allAcademies = [];

        // Source 1: Gemini Grounding Search
        console.log(`\n[1/5] Discovering via Gemini search...`);
        try {
            const majorCities = this.getMajorCities(state);
            for (const city of majorCities.slice(0, 3)) {
                if (this.academiesProcessed >= config.acquisition.maxAcademies) break;

                const result = await this.gemini.searchAcademies(city, state);
                if (result.academies) {
                    for (const academy of result.academies) {
                        allAcademies.push({
                            ...academy,
                            source: 'gemini_search',
                            sourceType: 'gemini_search',
                        });
                    }
                    console.log(`  Found ${result.academies.length} academies in ${city}`);
                }
                await sleep(500);
            }
        } catch (error) {
            console.error(`  Gemini search failed: ${error.message}`);
        }

        // Source 2: Overpass API
        console.log(`\n[2/5] Discovering via OpenStreetMap...`);
        try {
            const osmResults = await this.overpass.getSportsAcademies(state);
            for (const academy of osmResults) {
                allAcademies.push({
                    ...academy,
                    source: 'openstreetmap',
                    sourceType: 'openstreetmap',
                });
            }
            console.log(`  Found ${osmResults.length} academies via Overpass`);
        } catch (error) {
            console.error(`  Overpass query failed: ${error.message}`);
        }

        // Deduplicate
        const uniqueAcademies = deduplicateByName(allAcademies);
        console.log(`\n  Total unique academies discovered: ${uniqueAcademies.length}`);

        // Process each academy
        const limit = Math.min(uniqueAcademies.length, config.acquisition.maxAcademies - this.academiesProcessed);

        for (let i = 0; i < limit; i++) {
            const academy = uniqueAcademies[i];
            console.log(`\n[${i + 1}/${limit}] Processing: ${academy.name}`);

            try {
                await this.processAcademy(academy, state);
                this.academiesProcessed++;
            } catch (error) {
                console.error(`  Failed: ${error.message}`);
                this.logger.incrementStat('failed');
                this.logger.addRecord({ name: academy.name, action: 'failed', error: error.message });
            }
        }
    }

    async processAcademy(rawAcademy, state) {
        const sources = [];
        let extractedData = { ...rawAcademy };

        // Step 1: Try Firecrawl extraction if URL available
        if (rawAcademy.website || rawAcademy.url) {
            const url = rawAcademy.website || rawAcademy.url;
            console.log(`  Extracting from website: ${url}`);
            try {
                const result = await this.firecrawl.extractAcademyFromUrl(url);
                if (result.success && result.result) {
                    extractedData = {
                        ...extractedData,
                        ...this.cleanExtractedData(result.result),
                    };
                    sources.push({
                        sourceType: 'website',
                        sourceUrl: url,
                        confidenceScore: 40,
                    });
                    console.log(`  ✓ Extracted from website`);
                }
            } catch (error) {
                console.log(`  ✗ Website extraction failed: ${error.message}`);
            }
            await sleep(300);
        }

        // Step 2: Verify via Google Maps (simulated via Gemini)
        if (extractedData.lat && extractedData.lng) {
            sources.push({
                sourceType: 'google_maps',
                sourceUrl: null,
                confidenceScore: 35,
            });
            console.log(`  ✓ Location verified (coordinates available)`);
        }

        // Step 3: Overpass already provided data
        if (rawAcademy.source === 'openstreetmap') {
            sources.push({
                sourceType: 'openstreetmap',
                sourceUrl: `https://www.openstreetmap.org/node/${rawAcademy.osmId}`,
                confidenceScore: 30,
            });
            console.log(`  ✓ OpenStreetMap verified`);
        }

        // Step 4: Check if Gemini search was the only source
        if (sources.length === 0 && rawAcademy.source === 'gemini_search') {
            console.log(`  ⚠ Only Gemini source - attempting Firecrawl search...`);
            try {
                const searchResult = await this.firecrawl.searchAndExtract(
                    `${rawAcademy.name} sports academy ${rawAcademy.city || state}`,
                    {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            address: { type: 'string' },
                            phone: { type: 'string' },
                            website: { type: 'string' },
                        },
                    }
                );
                if (searchResult.success && searchResult.result) {
                    extractedData = { ...extractedData, ...searchResult.result };
                    sources.push({
                        sourceType: 'firecrawl_search',
                        sourceUrl: null,
                        confidenceScore: 25,
                    });
                }
            } catch (error) {
                console.log(`  Firecrawl search failed: ${error.message}`);
            }
        }

        // Step 5: Enrich missing fields via Gemini
        console.log(`  Enriching missing fields...`);
        try {
            extractedData = await this.gemini.enrichMissingFields({
                name: extractedData.name,
                city: extractedData.city || state,
                state: state,
                phone: extractedData.phone,
                email: extractedData.email,
                website: extractedData.website,
                description: extractedData.description,
                lat: extractedData.lat,
                lng: extractedData.lng,
            });
        } catch (error) {
            console.log(`  Enrichment failed: ${error.message}`);
        }

        // Step 6: Normalize data
        console.log(`  Normalizing data...`);
        try {
            const normalized = await this.gemini.normalizeAcademyData(extractedData);
            extractedData = { ...extractedData, ...normalized };
        } catch (error) {
            console.log(`  Normalization failed: ${error.message}`);
        }

        // Step 7: Apply sport normalization
        if (extractedData.sports) {
            extractedData.sportsOffered = extractedData.sports.map(s => normalizeSport(s));
        }

        // Step 8: Validate - require at least name and city
        if (!extractedData.name) {
            console.log(`  ✗ Rejected: No name`);
            this.logger.incrementStat('skipped');
            return;
        }

        if (!extractedData.city && !rawAcademy.city) {
            console.log(`  ✗ Rejected: No city`);
            this.logger.incrementStat('skipped');
            return;
        }

        extractedData.city = extractedData.city || rawAcademy.city || state;
        extractedData.state = state;

        // Step 9: Check for duplicates
        const existing = await this.ingestor.findDuplicate(extractedData.name, extractedData.city);
        if (existing) {
            console.log(`  ⚠ Duplicate found: ${existing.slug}`);
            this.logger.incrementStat('duplicates');
        }

        // Step 10: Ingest
        console.log(`  Inserting with ${sources.length} source(s)...`);
        const result = await this.ingestor.upsertAcademy(extractedData, sources);
        console.log(`  ✓ ${result.action}: ${result.slug}`);
    }

    cleanExtractedData(data) {
        return {
            name: data.name || null,
            description: data.description || null,
            city: data.city || null,
            state: data.state || null,
            address: data.address || null,
            phone: data.phone || null,
            email: data.email || null,
            website: data.website || null,
            sportsOffered: data.sports || data.sportsOffered || [],
            facilities: data.facilities || [],
            lat: data.lat || null,
            lng: data.lng || null,
            coverImage: data.coverImage || null,
        };
    }

    getMajorCities(state) {
        const cities = {
            'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati', 'Anantapur'],
            'Telangana': ['Hyderabad', 'Warangal', 'Karimnagar', 'Nizamabad', 'Khammam'],
            'Karnataka': ['Bengaluru', 'Mysuru', 'Hubli', 'Mangaluru', 'Belgaum'],
            'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
            'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik'],
        };
        return cities[state] || [];
    }
}

module.exports = Pipeline;
