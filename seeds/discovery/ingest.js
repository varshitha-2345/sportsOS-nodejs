const mongoose = require('mongoose');
const config = require('./config');
const Academy = require('../../models/Academy');
const Coach = require('../../models/Coach');
const { generateSlug, calculateConfidence, isIndependentSource } = require('./utils');

class Ingestor {
    constructor(logger) {
        this.logger = logger;
    }

    async connect() {
        await mongoose.connect(config.mongo.uri);
        console.log('Connected to MongoDB for ingestion');
    }

    async disconnect() {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }

    async upsertAcademy(data, sources) {
        const slug = generateSlug(data.name);

        const provenance = sources.map(s => ({
            sourceType: s.sourceType,
            sourceUrl: s.sourceUrl || null,
            confidenceScore: s.confidenceScore || 30,
            lastVerifiedAt: new Date(),
        }));

        const sourceCount = sources.length;
        const confidence = calculateConfidence(sources);
        const hasIndependentSource = sources.some(s => isIndependentSource(s.sourceType));

        const status = hasIndependentSource && confidence >= config.confidence.minForPublish
            ? 'published'
            : 'draft';

        const verificationStatus = hasIndependentSource ? 'unverified' : 'unverified';

        const academyData = {
            slug,
            name: data.name,
            description: data.description || config.placeholders.description,
            location: {
                city: data.city,
                state: data.state,
                address: data.address || null,
                country: 'IN',
                lat: data.lat || 0,
                lng: data.lng || 0,
            },
            contact: {
                phone: data.phone || null,
                email: data.email || null,
                website: data.website || null,
            },
            sportsOffered: data.sportsOffered || data.sports || [],
            facilities: data.facilities || [],
            trainingLevels: data.trainingLevels || [],
            certifications: data.certifications || [],
            verificationStatus,
            rating: data.rating || config.placeholders.rating,
            coverImage: data.coverImage || null,
            gallery: data.gallery || [],
            sourceCount,
            dataProvenance: provenance,
            status,
        };

        if (config.acquisition.dryRun) {
            console.log(`[DRY RUN] Would upsert academy: ${slug}`);
            this.logger.incrementStat('discovered');
            return { action: 'dry_run', slug };
        }

        const existing = await Academy.findOne({ slug });

        if (existing) {
            const updates = {};
            if (!existing.description && data.description) updates.description = data.description;
            if (!existing.contact.phone && data.phone) updates['contact.phone'] = data.phone;
            if (!existing.contact.email && data.email) updates['contact.email'] = data.email;
            if (!existing.contact.website && data.website) updates['contact.website'] = data.website;
            if (existing.location.lat === 0 && data.lat) updates['location.lat'] = data.lat;
            if (existing.location.lng === 0 && data.lng) updates['location.lng'] = data.lng;
            if (!existing.coverImage && data.coverImage) updates.coverImage = data.coverImage;
            if (existing.sportsOffered.length === 0 && data.sportsOffered?.length) {
                updates.sportsOffered = data.sportsOffered;
            }
            if (existing.facilities.length === 0 && data.facilities?.length) {
                updates.facilities = data.facilities;
            }

            updates.sourceCount = existing.sourceCount + sourceCount;

            await Academy.updateOne(
                { slug },
                {
                    $set: updates,
                    $push: { dataProvenance: { $each: provenance } },
                }
            );

            this.logger.incrementStat('updated');
            this.logger.addRecord({ name: data.name, slug, action: 'updated', sources: sources.map(s => s.sourceType) });
            return { action: 'updated', slug };
        } else {
            const academy = new Academy(academyData);
            await academy.save();

            this.logger.incrementStat('inserted');
            this.logger.addRecord({ name: data.name, slug, action: 'inserted', sources: sources.map(s => s.sourceType) });
            return { action: 'inserted', slug };
        }
    }

    async upsertCoach(data, academySlug, sources) {
        const slug = generateSlug(data.name);

        const provenance = sources.map(s => ({
            sourceType: s.sourceType,
            sourceUrl: s.sourceUrl || null,
            confidenceScore: s.confidenceScore || 30,
            lastVerifiedAt: new Date(),
        }));

        const sourceCount = sources.length;
        const confidence = calculateConfidence(sources);
        const hasIndependentSource = sources.some(s => isIndependentSource(s.sourceType));

        let academyId = null;
        if (academySlug) {
            const academy = await Academy.findOne({ slug: academySlug });
            if (!academy) {
                console.warn(`Coach ${data.name}: academy ${academySlug} not found, inserting without academy link`);
                this.logger.addRecord({ name: data.name, slug, action: 'skipped_academy_not_found' });
            } else {
                academyId = academy._id;
            }
        }

        const status = hasIndependentSource && confidence >= config.confidence.minForPublish
            ? 'published'
            : 'draft';

        const coachData = {
            slug,
            name: data.name,
            avatar: data.avatar || null,
            certifications: data.certifications || [],
            experienceYears: data.experienceYears || 0,
            sportsCoached: data.sportsCoached || data.sports || [],
            specialization: data.specialization || [],
            academyId,
            location: {
                city: data.city || 'Unknown',
                state: data.state || 'Unknown',
                country: 'IN',
                lat: data.lat || 0,
                lng: data.lng || 0,
            },
            contact: {
                phone: data.phone || null,
                email: data.email || null,
            },
            verificationStatus: hasIndependentSource ? 'unverified' : 'unverified',
            rating: data.rating || config.placeholders.rating,
            sourceCount,
            dataProvenance: provenance,
            status,
        };

        if (config.acquisition.dryRun) {
            console.log(`[DRY RUN] Would upsert coach: ${slug}`);
            this.logger.incrementStat('discovered');
            return { action: 'dry_run', slug };
        }

        const existing = await Coach.findOne({ slug });

        if (existing) {
            const updates = {};
            if (!existing.experienceYears && data.experienceYears) updates.experienceYears = data.experienceYears;
            if (existing.sportsCoached.length === 0 && data.sportsCoached?.length) {
                updates.sportsCoached = data.sportsCoached;
            }
            if (!existing.contact.phone && data.phone) updates['contact.phone'] = data.phone;
            if (!existing.contact.email && data.email) updates['contact.email'] = data.email;

            updates.sourceCount = existing.sourceCount + sourceCount;

            await Coach.updateOne(
                { slug },
                {
                    $set: updates,
                    $push: { dataProvenance: { $each: provenance } },
                }
            );

            this.logger.incrementStat('updated');
            this.logger.addRecord({ name: data.name, slug, action: 'updated', sources: sources.map(s => s.sourceType) });
            return { action: 'updated', slug };
        } else {
            const coach = new Coach(coachData);
            await coach.save();

            this.logger.incrementStat('inserted');
            this.logger.addRecord({ name: data.name, slug, action: 'inserted', sources: sources.map(s => s.sourceType) });
            return { action: 'inserted', slug };
        }
    }

    async findDuplicate(name, city) {
        const slug = generateSlug(name);
        const existing = await Academy.findOne({
            $or: [
                { slug },
                { name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, 'location.city': city },
            ],
        });
        return existing;
    }

    async getStats() {
        const academies = await Academy.countDocuments();
        const coaches = await Coach.countDocuments();
        const withProvenance = await Academy.countDocuments({ sourceCount: { $gt: 0 } });
        return { academies, coaches, withProvenance };
    }
}

module.exports = Ingestor;
