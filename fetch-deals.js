const fs = require('fs');
const amazonPaapi = require('amazon-paapi');

const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY;
const SECRET_KEY = process.env.AMAZON_SECRET_KEY;
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG;

if (!ACCESS_KEY || !SECRET_KEY || !PARTNER_TAG) {
  console.error("--- DEBUG INFO ---");
  if (!ACCESS_KEY) console.error("Missing: AMAZON_ACCESS_KEY");
  if (!SECRET_KEY) console.error("Missing: AMAZON_SECRET_KEY");
  if (!PARTNER_TAG) console.error("Missing: AMAZON_PARTNER_TAG");
  console.error("------------------");
  process.exit(1);
}

const commonParameters = {
  AccessKey: ACCESS_KEY,
  SecretKey: SECRET_KEY,
  PartnerTag: PARTNER_TAG,
  PartnerType: 'Associates',
  Marketplace: 'www.amazon.com'
};

// We will fetch items from a few categories
const searchQueries = [
  { keywords: 'Laptop deals', category: 'tech' },
  { keywords: 'Power tools deals', category: 'tools' },
  { keywords: 'Smart home deals', category: 'household' }
];

async function fetchDeals() {
  let allDeals = [];
  let dealId = 1;

  for (const query of searchQueries) {
    const requestParameters = {
      Keywords: query.keywords,
      SearchIndex: 'All',
      ItemCount: 4,
      Resources: [
        'ItemInfo.Title',
        'ItemInfo.Features',
        'Offers.Listings.Price',
        'Offers.Listings.SavingBasis',
        'Images.Primary.Large',
        'ItemInfo.Classifications'
      ]
    };

    try {
      console.log(`Searching Amazon for: ${query.keywords}`);
      const data = await amazonPaapi.SearchItems(commonParameters, requestParameters);
      
      if (data.SearchResult && data.SearchResult.Items) {
        for (const item of data.SearchResult.Items) {
          const title = item.ItemInfo?.Title?.DisplayValue || "Amazon Deal";
          const url = item.DetailPageURL;
          const image = item.Images?.Primary?.Large?.URL || "/images/placeholder.png";
          
          let price = 0;
          let originalPrice = 0;
          let discount = "";

          const offers = item.Offers?.Listings;
          if (offers && offers.length > 0) {
            price = offers[0].Price?.Amount || 0;
            originalPrice = offers[0].SavingBasis?.Amount || price;
            
            if (originalPrice > price) {
              const savings = originalPrice - price;
              const percentage = Math.round((savings / originalPrice) * 100);
              discount = `${percentage}% OFF`;
            }
          }

          if (price === 0) continue; // Skip items without a price

          const description = item.ItemInfo?.Features?.DisplayValues?.[0] || "Check out this great deal on Amazon today!";

          allDeals.push({
            id: dealId++,
            title: title.length > 60 ? title.substring(0, 57) + "..." : title,
            price: price,
            originalPrice: originalPrice,
            discount: discount,
            image: image,
            category: query.category,
            votes: { up: 0, down: 0 },
            url: url,
            description: description.length > 150 ? description.substring(0, 147) + "..." : description
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching for ${query.keywords}:`, error);
    }
    
    // Add a small delay between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return allDeals;
}

async function updateDataJs() {
  const deals = await fetchDeals();
  
  if (deals.length === 0) {
    console.warn("No deals fetched. data.js will not be updated.");
    return;
  }

  const fileContent = `const categories = [
    { id: 'all', name: 'All Deals' },
    { id: 'tech', name: 'Tech' },
    { id: 'tools', name: 'Tools' },
    { id: 'household', name: 'Household' },
    { id: 'groceries', name: 'Groceries' },
    { id: 'credit-cards', name: 'Credit Cards' }
];

const deals = ${JSON.stringify(deals, null, 4)};
`;

  fs.writeFileSync('data.js', fileContent);
  console.log("Successfully updated data.js with new Amazon deals!");
}

updateDataJs();


