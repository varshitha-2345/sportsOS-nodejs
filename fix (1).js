const fs = require('fs');

if (!fs.existsSync('./seeds')) fs.mkdirSync('./seeds');

const seedAcademies = `require('dotenv').config();
const mongoose = require('mongoose');
const Academy = require('../models/Academy');

const academies = [
  { name: "Sri Sai Cricket Academy", sport: ["Cricket"], location: "Hyderabad", distanceKm: 3, verified: true, goalType: "long-term", rating: 4.5, reviewCount: 120, instagramId: "@srisaicricket" },
  { name: "Victory Cricket Club", sport: ["Cricket"], location: "Hyderabad", distanceKm: 7, verified: true, goalType: "both", rating: 4.2, reviewCount: 85, instagramId: "@victorycricket" },
  { name: "Elite Badminton Academy", sport: ["Badminton"], location: "Bangalore", distanceKm: 5, verified: true, goalType: "short-term", rating: 4.8, reviewCount: 200, instagramId: "@elitebadminton" },
  { name: "Champion Football Club", sport: ["Football"], location: "Chennai", distanceKm: 10, verified: false, goalType: "long-term", rating: 3.9, reviewCount: 60, instagramId: "" },
  { name: "Pro Sports Academy", sport: ["Cricket", "Football"], location: "Mumbai", distanceKm: 12, verified: true, goalType: "both", rating: 4.6, reviewCount: 150, instagramId: "@prosports" },
  { name: "Rising Stars Academy", sport: ["Basketball"], location: "Pune", distanceKm: 8, verified: true, goalType: "short-term", rating: 4.1, reviewCount: 45, instagramId: "@risingstars" },
  { name: "Tennis Pro Academy", sport: ["Tennis"], location: "Delhi", distanceKm: 6, verified: true, goalType: "long-term", rating: 4.7, reviewCount: 180, instagramId: "@tennispro" },
  { name: "Swim Fast Academy", sport: ["Swimming"], location: "Hyderabad", distanceKm: 4, verified: false, goalType: "short-term", rating: 3.5, reviewCount: 30, instagramId: "" },
  { name: "Gold Medal Sports", sport: ["Athletics"], location: "Bangalore", distanceKm: 15, verified: true, goalType: "long-term", rating: 4.3, reviewCount: 95, instagramId: "@goldmedal" },
  { name: "Kabaddi Warriors", sport: ["Kabaddi"], location: "Chennai", distanceKm: 9, verified: true, goalType: "both", rating: 4.0, reviewCount: 55, instagramId: "@kabaddiwarriors" },
  { name: "Smash Badminton Club", sport: ["Badminton"], location: "Hyderabad", distanceKm: 6, verified: true, goalType: "short-term", rating: 4.4, reviewCount: 110, instagramId: "@smashbadminton" },
  { name: "Future Champions", sport: ["Cricket", "Basketball"], location: "Mumbai", distanceKm: 11, verified: false, goalType: "long-term", rating: 3.8, reviewCount: 40, instagramId: "" }
];

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await Academy.deleteMany({});
    await Academy.insertMany(academies);
    console.log('12 academies seeded successfully!');
    process.exit();
  })
  .catch(err => { console.error(err); process.exit(1); });
`;

const seedCoaches = `require('dotenv').config();
const mongoose = require('mongoose');
const Coach = require('../models/Coach');
const Academy = require('../models/Academy');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const academies = await Academy.find();
    const getAcademyId = (name) => {
      const a = academies.find(a => a.name.includes(name));
      return a ? a._id : academies[0]._id;
    };

    const coaches = [
      { name: "Ramesh Kumar", sport: "Cricket", academyId: getAcademyId("Sri Sai") },
      { name: "Suresh Raina", sport: "Cricket", academyId: getAcademyId("Victory") },
      { name: "Anitha Reddy", sport: "Badminton", academyId: getAcademyId("Elite Badminton") },
      { name: "Vikram Singh", sport: "Football", academyId: getAcademyId("Champion") },
      { name: "Priya Sharma", sport: "Basketball", academyId: getAcademyId("Rising") },
      { name: "Rajesh Patel", sport: "Tennis", academyId: getAcademyId("Tennis") },
      { name: "Meena Kumari", sport: "Swimming", academyId: getAcademyId("Swim") },
      { name: "Arjun Nair", sport: "Athletics", academyId: getAcademyId("Gold") }
    ];

    await Coach.deleteMany({});
    await Coach.insertMany(coaches);
    console.log('8 coaches seeded successfully!');
    process.exit();
  })
  .catch(err => { console.error(err); process.exit(1); });
`;

fs.writeFileSync('./seeds/seedAcademies.js', seedAcademies);
fs.writeFileSync('./seeds/seedCoaches.js', seedCoaches);
console.log('Seed files created! Now run:');
console.log('node seeds/seedAcademies.js');
console.log('node seeds/seedCoaches.js');
