import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Amazon PA-API 5.0 config
const accessKey = process.env.AMAZON_ACCESS_KEY;
const secretKey = process.env.AMAZON_SECRET_KEY;
const partnerTag = process.env.AMAZON_PARTNER_TAG;
const region = 'us-east-1';
const host = 'webservices.amazon.com';
const uri = '/paapi5/searchitems';

if (!accessKey || !secretKey || !partnerTag) {
  console.error('Missing Amazon API credentials. Check GitHub Secrets.');
  process.exit(1);
}

// Keywords to search for deals - customize these
const keywords = [
  'tech deals',
  'tools under 100',
  'household essentials',
  'gifts for him',
  'gifts for her'
];

// Helper: AWS V4 signing for PA-API
function sign(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = sign('AWS4' + key, dateStamp);
  const kRegion = sign(kDate, regionName);
  const kService = sign(kRegion, serviceName);
  const kSigning = sign(kService, 'aws4_request');
  return kSigning;
}

async function searchItems(keyword) {
  const payload = {
    Keywords: keyword,
    Resources: [
      'Images.Primary.Large',
      'ItemInfo.Title',
      'Offers.Listings.Price',
      'Offers.Listings.SavingBasis',
      'CustomerReviews.Count',
      'CustomerReviews.StarRating'
    ],
    PartnerTag: partnerTag,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
    ItemCount: 3,
    MinSavingPercent: 20
  };

  const payloadStr = JSON.stringify(payload);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);
  
  const canonicalHeaders = `content-encoding:amz-1.0\ncontent-type:application/json; charset=utf-8\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems\n`;
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');
  const canonicalRequest = `POST\n${uri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/ProductAdvertisingAPI/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
  
  const signingKey = getSignatureKey(secretKey, dateStamp, region, 'ProductAdvertisingAPI');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  
  const authorizationHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}${uri}`, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'amz-1.0',
      'Content-Type': 'application/json; charset=utf-8',
      'Host': host,
      'X-Amz-Date': amzDate,
      'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
      'Authorization': authorizationHeader
    },
    body: payloadStr
  });

  if (!response.ok) {
    console.error(`API error for "${keyword}": ${response.status} ${await response.text()}`);
    return [];
  }

  const data = await response.json();
  return data.SearchResult?.Items || [];
}

function formatDeal(item, idStart) {
  const listing = item.Offers?.Listings?.[0];
  const price = listing?.Price?.Amount || 0;
  const savings = listing?.SavingBasis?.Amount || price;
  const discount = savings > price ? Math.round(((savings - price) / savings) * 100) : 0;
  
  return {
    id: idStart,
    title: item.ItemInfo?.Title?.DisplayValue || 'Unknown Product',
    category: 'tech', // You can map keywords to categories
    price: price,
    originalPrice: savings,
    discount: discount,
    rating: item.CustomerReviews?.StarRating?.Value || 4.5,
    reviews: item.CustomerReviews?.Count || 0,
    image: item.Images?.Primary?.Large?.URL || '',
    url: item.DetailPageURL + `?tag=${partnerTag}`,
    description: item.ItemInfo?.Title?.DisplayValue || '',
    dateAdded: new Date().toISOString().split('T')[0]
  };
}

async function main() {
  console.log('Fetching deals from Amazon PA-API...');
  let allDeals = [];
  let idCounter = 1000;

  for (const keyword of keywords) {
    console.log(`Searching: ${keyword}`);
    try {
      const items = await searchItems(keyword);
      const deals = items.map(item => formatDeal(item, idCounter++));
      allDeals.push(...deals);
      await new Promise(r => setTimeout(r, 1000)); // Rate limit
    } catch (e) {
      console.error(`Failed for ${keyword}:`, e.message);
    }
  }

  if (allDeals.length === 0) {
    console.error('No deals found. Check API credentials or keywords.');
    process.exit(1);
  }

  const dataJsContent = `// Auto-generated by GitHub Actions - ${new Date().toISOString()}
const deals = ${JSON.stringify(allDeals, null, 2)};

if (typeof module !== 'undefined') {
  module.exports = deals;
}
`;

  const outputPath = path.join(__dirname, '..', 'data.js');
  fs.writeFileSync(outputPath, dataJsContent);
  console.log(`Successfully wrote ${allDeals.length} deals to data.js`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
