const mongoose = require('mongoose');

// Each document is one news headline fetched from the NewsData.io API.
// We keep a rolling 30-day window — see jobs/fetchCurrentAffairs.js, which
// both adds today's fresh headlines and deletes anything older than 30 days
// every time it runs, so this collection never grows unbounded.
const currentAffairSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    sourceName: { type: String, trim: true, default: '' },
    link: { type: String, trim: true, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    publishedAt: { type: Date, required: true }, // when the article was published (from the API)

    // NewsData.io's own article_id — used to avoid inserting the same
    // headline twice if the fetch job runs more than once in a day.
    externalId: { type: String, required: true, unique: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('CurrentAffair', currentAffairSchema);