/**
 * Run once to create the first admin login:
 *   npm run seed
 *
 * Reads SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD from .env.
 * Safe to run again later — it won't duplicate an existing admin.
 */
require('dotenv').config();
const connectDB = require('./config/db');
const Admin = require('./models/Admin');
const mongoose = require('mongoose');

async function seed() {
  await connectDB();

  const username = (process.env.SEED_ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    console.error('Set SEED_ADMIN_PASSWORD in your .env before seeding.');
    process.exit(1);
  }

  const existing = await Admin.findOne({ username });
  if (existing) {
    console.log(`Admin "${username}" already exists — nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await Admin.hashPassword(password);
  await Admin.create({ username, passwordHash });
  console.log(`Admin account created — username: "${username}"`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
