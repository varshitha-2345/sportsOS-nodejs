const config = require('./config');

class OverpassClient {
    constructor() {
        this.baseUrl = config.overpass.baseUrl;
    }

    async query(queryString) {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `data=${encodeURIComponent(queryString)}`,
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Overpass API error: ${response.status} - ${error}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Overpass query error:', error.message);
            throw error;
        }
    }

    async getSportsAcademies(stateName) {
        const stateConfig = config.states[stateName];
        if (!stateConfig) {
            throw new Error(`Unknown state: ${stateName}`);
        }

        const query = `
            [out:json][timeout:60];
            area["name"="${stateName}"]["admin_level"="4"]->.searchArea;
            (
                node["leisure"="sports_centre"]["sport"](area.searchArea);
                way["leisure"="sports_centre"]["sport"](area.searchArea);
                node["amenity"="school"]["sport"](area.searchArea);
                way["amenity"="school"]["sport"](area.searchArea);
                node["sport"](area.searchArea);
                way["sport"](area.searchArea);
            );
            out center body;
        `;

        const data = await this.query(query);
        return this.parseResults(data);
    }

    async getSportsAcademiesInArea(lat, lon, radiusKm = 10) {
        const radiusM = radiusKm * 1000;

        const query = `
            [out:json][timeout:60];
            (
                node["leisure"="sports_centre"]["sport"](around:${radiusM},${lat},${lon});
                way["leisure"="sports_centre"]["sport"](around:${radiusM},${lat},${lon});
                node["sport"](around:${radiusM},${lat},${lon});
                way["sport"](around:${radiusM},${lat},${lon});
            );
            out center body;
        `;

        const data = await this.query(query);
        return this.parseResults(data);
    }

    parseResults(data) {
        if (!data || !data.elements) return [];

        return data.elements
            .filter(el => el.tags && el.tags.name)
            .map(el => {
                const tags = el.tags;
                const lat = el.lat || el.center?.lat || 0;
                const lng = el.lon || el.center?.lon || 0;

                const sports = [];
                if (tags.sport) {
                    const sportValues = Array.isArray(tags.sport) ? tags.sport : [tags.sport];
                    sports.push(...sportValues);
                }

                return {
                    name: tags.name,
                    lat,
                    lng,
                    sports,
                    address: [tags['addr:street'], tags['addr:housename'], tags['addr:city']]
                        .filter(Boolean)
                        .join(', '),
                    city: tags['addr:city'] || '',
                    state: tags['addr:state'] || '',
                    phone: tags.phone || tags['contact:phone'] || null,
                    email: tags.email || tags['contact:email'] || null,
                    website: tags.website || tags['contact:website'] || null,
                    source: 'openstreetmap',
                    osmId: el.id,
                    osmType: el.type,
                };
            });
    }
}

module.exports = OverpassClient;
