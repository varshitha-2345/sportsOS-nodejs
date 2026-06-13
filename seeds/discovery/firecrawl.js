const config = require('./config');

class FirecrawlClient {
    constructor() {
        this.apiKey = config.firecrawl.apiKey;
        this.baseUrl = config.firecrawl.baseUrl;
    }

    async scrape(url, options = {}) {
        const endpoint = `${this.baseUrl}/scrape`;

        const body = {
            url,
            formats: ['markdown'],
            ...options,
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Firecrawl scrape error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return {
                markdown: data.data?.markdown || '',
                metadata: data.data?.metadata || {},
                success: true,
            };
        } catch (error) {
            console.error('Firecrawl scrape error:', error.message);
            return { markdown: '', metadata: {}, success: false, error: error.message };
        }
    }

    async extract(urls, schema, prompt = '') {
        const endpoint = `${this.baseUrl}/extract`;

        const body = {
            urls,
            prompt: prompt || 'Extract academy information from this page',
            schema,
            formats: [{ type: 'json', schema }],
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Firecrawl extract error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return {
                result: data.data?.result || null,
                success: true,
            };
        } catch (error) {
            console.error('Firecrawl extract error:', error.message);
            return { result: null, success: false, error: error.message };
        }
    }

    async searchAndExtract(query, schema) {
        const endpoint = `${this.baseUrl}/extract`;

        const body = {
            urls: [],
            prompt: `Search for and extract: ${query}`,
            schema,
            search: true,
            formats: [{ type: 'json', schema }],
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Firecrawl search error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return {
                result: data.data?.result || null,
                success: true,
            };
        } catch (error) {
            console.error('Firecrawl search error:', error.message);
            return { result: null, success: false, error: error.message };
        }
    }

    async extractAcademyFromUrl(url) {
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
                sports: { type: 'array', items: { type: 'string' } },
                facilities: { type: 'array', items: { type: 'string' } },
                lat: { type: ['number', 'null'] },
                lng: { type: ['number', 'null'] },
                coverImage: { type: ['string', 'null'] },
            },
            required: ['name'],
        };

        return this.extract([url], schema, 'Extract sports academy information from this website');
    }
}

module.exports = FirecrawlClient;
