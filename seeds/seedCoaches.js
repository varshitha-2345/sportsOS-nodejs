require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();
const mongoose = require('mongoose');
const Coach = require('../models/Coach');
const Academy = require('../models/Academy');

const coaches = [
  {
    slug: 'rahul-dravid-cricket-bengaluru',
    name: 'Rahul Dravid',
    avatar: '/images/coaches/rahul-dravid-cricket-bengaluru.svg',
    certifications: [
      { name: 'BCCI Level 3 Coach', issuer: 'BCCI', year: 2014 },
      { name: 'ICC Level 2 Coach', issuer: 'International Cricket Council', year: 2017 },
    ],
    experienceYears: 18,
    sportsCoached: ['cricket'],
    specialization: ['batting', 'red-ball technique', 'youth development'],
    location: {
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'IN',
      lat: 12.9789,
      lng: 77.5996,
    },
    contact: {
      phone: '+91 98 6012 9001',
      email: 'coach.dravid@nationalcricketacademy.in',
    },
    verificationStatus: 'verified',
    rating: { average: 4.9, count: 184 },
    status: 'published',
  },
  {
    slug: 'anil-kumble-spin-bengaluru',
    name: 'Anil Kumble',
    avatar: '/images/coaches/anil-kumble-spin-bengaluru.svg',
    certifications: [
      { name: 'BCCI Level 2 Coach', issuer: 'BCCI', year: 2013 },
    ],
    experienceYears: 22,
    sportsCoached: ['cricket'],
    specialization: ['spin bowling', 'match strategy', 'mentorship'],
    location: {
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'IN',
      lat: 12.9789,
      lng: 77.5996,
    },
    contact: {
      email: 'coach.kumble@nationalcricketacademy.in',
    },
    verificationStatus: 'verified',
    rating: { average: 4.9, count: 142 },
    status: 'published',
  },
  {
    slug: 'saina-nehwal-badminton-hyderabad',
    name: 'Saina Nehwal',
    avatar: '/images/coaches/saina-nehwal-badminton-hyderabad.svg',
    certifications: [
      { name: 'BWF Coach Education Level 2', issuer: 'Badminton World Federation', year: 2018 },
    ],
    experienceYears: 9,
    sportsCoached: ['badminton'],
    specialization: ['singles', 'footwork', 'rally endurance'],
    location: {
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'IN',
      lat: 17.4399,
      lng: 78.3569,
    },
    contact: {
      phone: '+91 99 4900 1850',
      email: 'saina@pgbadminton.in',
    },
    verificationStatus: 'verified',
    rating: { average: 4.8, count: 211 },
    status: 'published',
  },
  {
    slug: 'pankaj-advani-billiards-bengaluru',
    name: 'Pankaj Advani',
    avatar: '/images/coaches/pankaj-advani-billiards-bengaluru.svg',
    certifications: [
      { name: 'World Billiards Cert. Coach', issuer: 'World Billiards & Snooker Federation', year: 2019 },
    ],
    experienceYears: 14,
    sportsCoached: ['chess'],
    specialization: ['cue sports', 'mental focus', 'long-format endurance'],
    location: {
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'IN',
      lat: 12.9789,
      lng: 77.5996,
    },
    contact: {
      email: 'pankaj@chessgurukul.in',
    },
    verificationStatus: 'verified',
    rating: { average: 4.7, count: 78 },
    status: 'published',
  },
  {
    slug: 'viren-raquib-athletics-bengaluru',
    name: 'Viren Raquib',
    avatar: '/images/coaches/viren-raquib-athletics-bengaluru.svg',
    certifications: [
      { name: 'IAAF Level 2 Sprints Coach', issuer: 'World Athletics', year: 2017 },
      { name: 'NSNIS Diploma in Sports Coaching', issuer: 'NSNIS Patiala', year: 2015 },
    ],
    experienceYears: 12,
    sportsCoached: ['athletics'],
    specialization: ['sprints', 'relay handoffs', 'speed endurance'],
    location: {
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'IN',
      lat: 12.9789,
      lng: 77.5996,
    },
    contact: {
      phone: '+91 99 1650 2200',
      email: 'viren.athletics@gmail.com',
    },
    verificationStatus: 'verified',
    rating: { average: 4.6, count: 64 },
    status: 'published',
  },
  {
    slug: 'sushil-kumar-wrestling-delhi',
    name: 'Sushil Kumar',
    avatar: '/images/coaches/sushil-kumar-wrestling-delhi.svg',
    certifications: [
      { name: 'WFI National Coaching Cert.', issuer: 'Wrestling Federation of India', year: 2014 },
    ],
    experienceYears: 16,
    sportsCoached: ['wrestling'],
    specialization: ['freestyle wrestling', 'olympic lifting fundamentals', 'competition prep'],
    location: {
      city: 'New Delhi',
      state: 'Delhi',
      country: 'IN',
      lat: 28.6139,
      lng: 77.209,
    },
    contact: {
      phone: '+91 98 1810 4500',
      email: 'coach.sushil@delhiwrestling.in',
    },
    verificationStatus: 'verified',
    rating: { average: 4.7, count: 92 },
    status: 'published',
  },
  {
    slug: 'mary-komar-boxing-rohtak',
    name: 'Mary Kom',
    avatar: '/images/coaches/mary-komar-boxing-rohtak.svg',
    certifications: [
      { name: 'AIBA 3-Star Coach', issuer: 'International Boxing Association', year: 2016 },
    ],
    experienceYears: 13,
    sportsCoached: ['boxing'],
    specialization: ['flyweight', 'footwork', 'mental conditioning'],
    location: {
      city: 'Rohtak',
      state: 'Haryana',
      country: 'IN',
      lat: 28.8955,
      lng: 76.6066,
    },
    contact: {
      email: 'coach.marykom@rohtakboxing.in',
    },
    verificationStatus: 'verified',
    rating: { average: 4.8, count: 109 },
    status: 'published',
  },
  {
    slug: 'arjun-jadhav-table-tennis-pune',
    name: 'Arjun Jadhav',
    avatar: '/images/coaches/arjun-jadhav-table-tennis-pune.svg',
    certifications: [
      { name: 'ITTF Level 1 Coach', issuer: 'International Table Tennis Federation', year: 2019 },
    ],
    experienceYears: 8,
    sportsCoached: ['table-tennis'],
    specialization: ['defensive play', 'serve variation', 'junior development'],
    location: {
      city: 'Pune',
      state: 'Maharashtra',
      country: 'IN',
      lat: 18.5204,
      lng: 73.8567,
    },
    contact: {
      phone: '+91 98 6011 0099',
      email: 'arjun.tt@puneacademy.in',
    },
    verificationStatus: 'pending',
    rating: { average: 4.4, count: 38 },
    status: 'published',
  },
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Link coaches to academies by slug
        const academyMap = {};
        const academies = await Academy.find({});
        academies.forEach(a => { academyMap[a.slug] = a._id; });

        const slugToAcademy = {
            'rahul-dravid-cricket-bengaluru': 'national-cricket-academy-bengaluru',
            'anil-kumble-spin-bengaluru': 'national-cricket-academy-bengaluru',
            'saina-nehwal-badminton-hyderabad': 'pullela-gopichand-badminton-academy-hyderabad',
            'pankaj-advani-billiards-bengaluru': 'chess-gurukul-kolkata',
            'viren-raquib-athletics-bengaluru': null,
            'sushil-kumar-wrestling-delhi': null,
            'mary-komar-boxing-rohtak': null,
            'arjun-jadhav-table-tennis-pune': null,
        };

        const coachesWithAcademy = coaches.map(c => {
            const academySlug = slugToAcademy[c.slug];
            if (academySlug && academyMap[academySlug]) {
                return { ...c, academyId: academyMap[academySlug] };
            }
            return c;
        });

        await Coach.deleteMany({});
        console.log('Cleared existing coaches');

        const result = await Coach.insertMany(coachesWithAcademy);
        console.log(`Seeded ${result.length} coaches`);

        await mongoose.disconnect();
        console.log('Done');
    } catch (err) {
        console.error('Seed failed:', err.message);
        process.exit(1);
    }
}

seed();
