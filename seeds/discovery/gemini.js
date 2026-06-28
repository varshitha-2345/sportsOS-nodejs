const config = require('./config');

class GeminiClient {
    constructor() {
        this.apiKey = config.gemini.apiKey;
        this.model = config.gemini.model;
        this.baseUrl = config.gemini.baseUrl;
    }

    async generateStructured(prompt, schema) {
        const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Gemini API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error('No content in Gemini response');

            return JSON.parse(text);
        } catch (error) {
            console.error('Gemini generateStructured error:', error.message);
            throw error;
        }
    }

    async searchAcademies(city, state) {
        const prompt = `List sports academies and training centers in ${city}, ${state}, India. For each academy, provide:
- name: Full name of the academy
- city: City name
- state: State name
- sports: Array of sports offered (e.g., cricket, badminton)
- address: Full address if known
- phone: Contact phone if known
- website: Official website URL if known

Return a JSON array of academy objects. Only include academies you are confident exist. Do not fabricate information.`;

        const schema = {
            type: 'object',
            properties: {
                academies: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            city: { type: 'string' },
                            state: { type: 'string' },
                            sports: { type: 'array', items: { type: 'string' } },
                            address: { type: 'string' },
                            phone: { type: ['string', 'null'] },
                            website: { type: ['string', 'null'] },
                        },
                        required: ['name', 'city', 'state'],
                    },
                },
            },
            required: ['academies'],
        };

        return this.generateStructured(prompt, schema);
    }

    async extractAcademyData(content, sourceUrl) {
        const prompt = `Extract academy information from this content. Source URL: ${sourceUrl}

Content:
${content}

Extract all available fields. If a field is not found, use null.`;

        const schema = {
            type: 'object',
            properties: {
                name: { type: ['string', 'null'] },
                description: { type: ['string', 'null'] },
                city: { type: ['string', 'null'] },
                state: { type: ['string', 'null'] },
                address: { type: ['string', 'null'] },
                phone: { type: ['string', 'null'] },
                email: { type: ['string', 'null'] },
                website: { type: ['string', 'null'] },
                sports: { type: 'array', items: { type: 'string' } },
                facilities: { type: 'array', items: { type: 'string' } },
                trainingLevels: { type: 'array', items: { type: 'string' } },
                lat: { type: ['number', 'null'] },
                lng: { type: ['number', 'null'] },
                coverImage: { type: ['string', 'null'] },
            },
            required: ['name'],
        };

        return this.generateStructured(prompt, schema);
    }

    async normalizeAcademyData(rawData) {
        const prompt = `Normalize this academy data to match the SportsOS schema. Clean and standardize all fields.

Raw data:
${JSON.stringify(rawData, null, 2)}

Normalize:
- sports: Convert to lowercase slugs (e.g., "Table Tennis" -> "table-tennis")
- facilities: Map to standard values (indoor, outdoor, ground, court, equipment, changing_room, parking, physio, gym)
- trainingLevels: Map to standard values (beginner, intermediate, advanced, elite)
- phone: Clean to digits only
- email: Validate format
- name: Title case
- city: Title case
- state: Full state name`;

        const schema = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                description: { type: ['string', 'null'] },
                city: { type: 'string' },
                state: { type: 'string' },
                address: { type: ['string', 'null'] },
                phone: { type: ['string', 'null'] },
                email: { type: ['string', 'null'] },
                website: { type: ['string', 'null'] },
                sportsOffered: { type: 'array', items: { type: 'string' } },
                facilities: { type: 'array', items: { type: 'string' } },
                trainingLevels: { type: 'array', items: { type: 'string' } },
                lat: { type: ['number', 'null'] },
                lng: { type: ['number', 'null'] },
                coverImage: { type: ['string', 'null'] },
            },
            required: ['name', 'city', 'state'],
        };

        return this.generateStructured(prompt, schema);
    }

    async enrichMissingFields(academyData) {
        const missingFields = [];
        if (!academyData.phone) missingFields.push('phone number');
        if (!academyData.email) missingFields.push('email');
        if (!academyData.website) missingFields.push('website');
        if (!academyData.description) missingFields.push('description');
        if (!academyData.lat || !academyData.lng) missingFields.push('coordinates');

        if (missingFields.length === 0) return academyData;

        const prompt = `Find the following information for "${academyData.name}" in ${academyData.city}, ${academyData.state}:
${missingFields.map(f => `- ${f}`).join('\n')}

Return only the information you can verify exists. Do not guess or fabricate.`;

        const schema = {
            type: 'object',
            properties: {
                phone: { type: ['string', 'null'] },
                email: { type: ['string', 'null'] },
                website: { type: ['string', 'null'] },
                description: { type: ['string', 'null'] },
                lat: { type: ['number', 'null'] },
                lng: { type: ['number', 'null'] },
            },
        };

        const enriched = await this.generateStructured(prompt, schema);

        return {
            ...academyData,
            phone: academyData.phone || enriched.phone,
            email: academyData.email || enriched.email,
            website: academyData.website || enriched.website,
            description: academyData.description || enriched.description,
            lat: academyData.lat || enriched.lat,
            lng: academyData.lng || enriched.lng,
        };
    }

    async searchCoaches(academyName, city, state) {
        const prompt = `List coaches and trainers at "${academyName}" in ${city}, ${state}, India. For each coach, provide:
- name: Full name
- sports: Array of sports they coach
- experienceYears: Years of experience if known
- certifications: Array of certification names if known

Return a JSON array. Only include coaches you are confident exist.`;

        const schema = {
            type: 'object',
            properties: {
                coaches: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            sports: { type: 'array', items: { type: 'string' } },
                            experienceYears: { type: ['number', 'null'] },
                            certifications: { type: 'array', items: { type: 'string' } },
                        },
                        required: ['name'],
                    },
                },
            },
            required: ['coaches'],
        };

        return this.generateStructured(prompt, schema);
    }
}

module.exports = GeminiClient;
