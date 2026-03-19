import axios from 'axios';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = process.env.APIFY_ACTOR_ID || process.env.APIFY_ZEPTO_ACTOR_ID || 'krazee_kaushik/zepto-scraper';

export class ApifyService {
    /**
     * Triggers a new live scraper run via Apify
     * @param queries Array of search keywords
     * @param location Optional location context (e.g., "Mumbai")
     * @param limit Max products per query
     */
    async triggerLiveSync(queries: string[], location: string = 'Mumbai', limit: number = 20) {
        if (!APIFY_TOKEN) {
            throw new Error('APIFY_TOKEN is not configured in environment variables');
        }

        // Apify expects the username/actor handle to use a tilde `~` instead of a slash `/` in REST API URLs
        const encodedActorId = ACTOR_ID.replace('/', '~');
        let url = `https://api.apify.com/v2/acts/${encodedActorId}/runs?token=${APIFY_TOKEN}`;
        
        const publicUrl = process.env.PUBLIC_API_URL;
        if (publicUrl) {
            const webhooks = [{
                eventTypes: ['ACTOR.RUN.SUCCEEDED'],
                requestUrl: `${publicUrl}/catalog/sync/webhook`
            }];
            // Webhooks must be passed as base64-encoded JSON array string in the querystring
            url += `&webhooks=${encodeURIComponent(Buffer.from(JSON.stringify(webhooks)).toString('base64'))}`;
        }
        
        const input = {
            searchQueries: queries,
            locations: [location],
            productsLimit: limit,
            // Add any other specific scraper actor inputs if identified in research
        };

        try {
            const response = await axios.post(url, input);
            return response.data;
        } catch (error: any) {
            console.error('Apify Trigger Error:', error.response?.data || error.message);
            throw new Error(`Failed to trigger Apify actor: ${error.message}`);
        }
    }

    /**
     * Checks the status of a specific actor run
     */
    async getRunStatus(runId: string) {
        const url = `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`;
        const response = await axios.get(url);
        return response.data;
    }

    /**
     * Fetches the results from an Apify dataset
     */
    async getDatasetItems(datasetId: string) {
        const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`;
        const response = await axios.get(url);
        return response.data; // Array of product items
    }
}

export const apifyService = new ApifyService();
