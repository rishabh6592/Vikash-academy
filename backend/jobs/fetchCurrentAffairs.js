const axios = require('axios');
const CurrentAffair = require('../models/CurrentAffair');

// Fetches a mix of general + India-focused headlines from NewsData.io and
// stores them. Runs once daily via cron (see server.js), and also once at
// server startup so the list isn't empty on a fresh deploy.
async function fetchCurrentAffairs() {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    console.error('NEWSDATA_API_KEY is not set — skipping current affairs fetch.');
    return;
  }

  try {
    const res = await axios.get('https://newsdata.io/api/1/latest', {
      params: {
        apikey: apiKey,
        country: 'in',       // India-focused
        language: 'en',
        category: 'top'      // general/top headlines — the "mix" the user wanted
      }
    });

    const articles = res.data && res.data.results ? res.data.results : [];

    for (const article of articles) {
      if (!article.article_id || !article.title) continue;

      // upsert: insert if new, skip if we already have this article_id
      await CurrentAffair.updateOne(
        { externalId: article.article_id },
        {
          $setOnInsert: {
            title: article.title,
            sourceName: article.source_name || article.source_id || '',
            link: article.link || '',
            imageUrl: article.image_url || '',
            publishedAt: article.pubDate ? new Date(article.pubDate) : new Date(),
            externalId: article.article_id
          }
        },
        { upsert: true }
      );
    }

    // Rolling 30-day window — delete anything older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await CurrentAffair.deleteMany({ publishedAt: { $lt: thirtyDaysAgo } });

    console.log(`Current affairs: fetched ${articles.length} articles, cleaned up entries older than 30 days.`);
  } catch (err) {
    console.error('Failed to fetch current affairs:', err.message);
  }
}

module.exports = fetchCurrentAffairs;