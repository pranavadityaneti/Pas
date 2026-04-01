const axios = require('axios');
require('dotenv').config();

async function run() {
    const APIFY_TOKEN = process.env.APIFY_TOKEN;
    const url = `https://api.apify.com/v2/acts/krazee_kaushik~zepto-scraper/runs?token=${APIFY_TOKEN}`;
    const input = {
        searchQueries: ["Milk"],
        locations: ["Mumbai"],
        maxItems: 50,
        limit: 50,
        maxResults: 50,
        productsLimit: 50
    };
    try {
        const res = await axios.post(url, input);
        console.log(res.data.data.id);
    } catch (e) { console.error(e.message); }
}
run();
