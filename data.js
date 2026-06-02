const categories = [
    { id: 'all', name: 'All Deals' },
    { id: 'tech', name: 'Tech' },
    { id: 'tools', name: 'Tools' },
    { id: 'household', name: 'Household' },
    { id: 'groceries', name: 'Groceries' },
    { id: 'gifts-him', name: 'Gifts for Him' },
    { id: 'gifts-her', name: 'Gifts for Her' }
];

/* ==============================================================================
   HOW TO ADD A NEW DEAL
   ==============================================================================
   To add your own deal to the site, follow these steps:
   
   1. Find the `const deals = [` line just below this comment.
   2. Copy one of the existing deal blocks (from the `{` to the `},`).
   3. Paste it right under `const deals = [`.
   4. Change the "id" to a unique number (like 999).
   5. Update the "title", "price", "originalPrice", "discount", "image", "url", 
      and "description" to match your new product!
   
   It will instantly show up on the website as the newest deal!
============================================================================== */

const deals = [
{
    id: 1,
    title: "Multi-Function Screw Extractor Pliers",
    category: "household",
    price: 13.99,
    originalPrice: 15,
    image: "https://m.media-amazon.com/images/I/71QHf6Xjy1L._AC_SX679_.jpg",
    url: "https://amzn.to/4uN9Lns",
    featured: true,
    discount: 7,
    description: "Remove stripped screws and bolts easily"
},
];
