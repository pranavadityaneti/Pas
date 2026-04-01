const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

async function run() {
    const APIFY_TOKEN = process.env.APIFY_TOKEN;
    const url = `https://api.apify.com/v2/acts/krazee_kaushik~zepto-scraper/runs?token=${APIFY_TOKEN}`;
    
    const queries = ["Dolo", "Paracetamol", "Vicks", "Band Aid", "Digene", "Eno", "Volini", "Saridon", "Revital", "ORSL"];
    
    const input = {
        searchQueries: queries,
        locations: ["Mumbai"],
        productsLimit: 20
    };
    try {
        console.log("Triggering Apify with bulk queries...");
        const res = await axios.post(url, input);
        const runId = res.data.data.id;
        console.log("Started Run ID:", runId);
        
        while(true) {
            await new Promise(r => setTimeout(r, 5000));
            const statusRes = await axios.get(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
            const status = statusRes.data.data.status;
            process.stdout.write(`Status: ${status}\n`);
            if (status === 'SUCCEEDED') {
                const datasetId = statusRes.data.data.defaultDatasetId;
                const itemsRes = await axios.get(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
                console.log(`\nSuccess! Extracted ${itemsRes.data.length} items from ${queries.length} queries.`);
                fs.writeFileSync('medicines.json', JSON.stringify(itemsRes.data.map(i => i.name), null, 2));
                break;
            } else if (status === 'FAILED' || status === 'ABORTED') {
                console.log("\nRun failed.");
                break;
            }
        }
    } catch (e) {
        if(e.response && e.response.data) {
            console.error("\nError:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error("\nError:", e.message);
        }
    }
}
run();
