// Master Catalog Items Builder — 1,100 Distinct Products (100 per Category)
import { CATEGORY_DEFINITIONS } from './catalog-data-defs.mjs';
import { BRAND_DEFINITIONS } from './catalog-brands-defs.mjs';

// Curated high-resolution Unsplash images per category to ensure realistic public photos
const IMAGES_BY_CATEGORY = {
  'fruits-vegetables': [
    'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80', // Apple
    'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80', // Banana
    'https://images.unsplash.com/photo-1557800636-894a64c1696f?auto=format&fit=crop&w=600&q=80', // Orange
    'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80', // Mango
    'https://images.unsplash.com/photo-1537640538966-79f369143f8f?auto=format&fit=crop&w=600&q=80', // Grapes
    'https://images.unsplash.com/photo-1618897996318-5a901fa6ca71?auto=format&fit=crop&w=600&q=80', // Pomegranate
    'https://images.unsplash.com/photo-1527325678964-54921661f888?auto=format&fit=crop&w=600&q=80', // Watermelon
    'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80', // Kiwi
    'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=600&q=80', // Strawberry
    'https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=600&q=80', // Onion
    'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80', // Tomato
    'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80', // Potato
    'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?auto=format&fit=crop&w=600&q=80', // Cauliflower
    'https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?auto=format&fit=crop&w=600&q=80', // Broccoli
    'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80', // Spinach
    'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=600&q=80', // Carrot
    'https://images.unsplash.com/photo-1563865436874-9aef32095fad?auto=format&fit=crop&w=600&q=80', // Cucumber
    'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=600&q=80', // Bell Pepper
    'https://images.unsplash.com/photo-1588879460618-9249e7d947d1?auto=format&fit=crop&w=600&q=80', // Garlic
    'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80', // Ginger
  ],
  'dairy-bread-eggs': [
    'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80', // Milk
    'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80', // Cheese
    'https://images.unsplash.com/photo-1589985270958-bf087e5b53e8?auto=format&fit=crop&w=600&q=80', // Butter
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', // Bread
    'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80', // Eggs
    'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80', // Cheese block
    'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80', // Yogurt
    'https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&w=600&q=80', // Sourdough
    'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80', // Paneer / curd
    'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?auto=format&fit=crop&w=600&q=80', // Free range eggs
  ],
  'staples-flours-rice': [
    'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80', // Rice
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', // Flour
    'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=600&q=80', // Pulses / Dal
    'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80', // Oil
    'https://images.unsplash.com/photo-1627483262268-9c2b5b2834b5?auto=format&fit=crop&w=600&q=80', // Grains
    'https://images.unsplash.com/photo-1587334274328-64186a80aeee?auto=format&fit=crop&w=600&q=80', // Salt / sugar
    'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80', // Dal bowl
    'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?auto=format&fit=crop&w=600&q=80', // Cooking pot
  ],
  'masalas-spices-dryfruits': [
    'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80', // Spices
    'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80', // Turmeric & pepper
    'https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=600&q=80', // Cardamom
    'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=600&q=80', // Almonds
    'https://images.unsplash.com/photo-1536591375315-1b83887e24e3?auto=format&fit=crop&w=600&q=80', // Cashews
    'https://images.unsplash.com/photo-1573851552093-410a562495d4?auto=format&fit=crop&w=600&q=80', // Walnuts
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80', // Raisins
    'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&w=600&q=80', // Pistachios
  ],
  'snacks-biscuits': [
    'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80', // Potato chips
    'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80', // Cookies
    'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=600&q=80', // Crisps
    'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?auto=format&fit=crop&w=600&q=80', // Popcorn
    'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=600&q=80', // Crackers
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', // Baked biscuits
  ],
  'beverages-drinks': [
    'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', // Soft drink glass
    'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', // Tea
    'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80', // Coffee cup
    'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80', // Soda can
    'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80', // Orange juice
    'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80', // Cold beverage
    'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80', // Mineral water
  ],
  'instant-frozen-foods': [
    'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80', // Noodles
    'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80', // Pasta
    'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80', // Bowl of noodles
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80', // Oats & flakes
    'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', // Frozen fries
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80', // Ready meal
  ],
  'chocolates-sweets-desserts': [
    'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80', // Dark chocolate
    'https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&w=600&q=80', // Chocolate bar
    'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=600&q=80', // Sweet pastry / dessert
    'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80', // Mithai sweets
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80', // Honey jar
    'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?auto=format&fit=crop&w=600&q=80', // Peanut butter / spread
  ],
  'personal-care-hygiene': [
    'https://images.unsplash.com/photo-1607006314644-8cb3b80b0676?auto=format&fit=crop&w=600&q=80', // Soap bar
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80', // Body wash bottle
    'https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=600&q=80', // Shampoo
    'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=600&q=80', // Skincare cream
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80', // Toothpaste & hygiene
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=600&q=80', // Essential soap
  ],
  'cleaning-household': [
    'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=600&q=80', // Laundry detergent
    'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80', // Cleaning spray bottle
    'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=600&q=80', // Disinfectant
    'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80', // Dishwashing soap
    'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=600&q=80', // Tissues & paper rolls
    'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80', // House clean spray
  ],
  'baby-pet-care': [
    'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80', // Baby care lotion
    'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=600&q=80', // Baby toys & diapers
    'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=600&q=80', // Dog dry food
    'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=600&q=80', // Puppy food
    'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=600&q=80', // Pet grooming
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80', // Cat wet food
  ],
};

function getImage(categorySlug, index) {
  const list = IMAGES_BY_CATEGORY[categorySlug] || IMAGES_BY_CATEGORY['fruits-vegetables'];
  return list[index % list.length];
}

export function buildAllProducts() {
  const allProducts = [];

  // Helper to create product object
  function makeProduct(catSlug, catId, brandSlug, brandId, name, variantName, weight, unit, price, mrp, idx, tags = []) {
    const code = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 24);
    const sku = `${catSlug.substring(0, 4).toUpperCase()}-${code.toUpperCase()}-${idx}-${weight}${unit.toUpperCase()}`;
    const barcode = `890${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const imageUrl = getImage(catSlug, idx);

    return {
      name,
      slug: `${code}-${Date.now().toString().slice(-4)}-${idx}`,
      categorySlug: catSlug,
      categoryId: catId,
      brandSlug,
      brandId,
      description: `High quality ${name} guaranteed fresh from trusted suppliers. Packaged under strict hygiene conditions.`,
      tags: [...tags, catSlug, brandSlug],
      sku,
      barcode,
      variantName,
      weightValue: weight,
      measurementUnit: unit,
      price,
      mrp: mrp >= price ? mrp : Math.round(price * 1.15),
      imageUrl,
      stock: 40 + (idx * 7) % 200,
    };
  }

  // Define 100 products per category
  for (const cat of CATEGORY_DEFINITIONS) {
    const catSlug = cat.slug;
    const catId = cat.id;

    // Generators per category
    if (catSlug === 'fruits-vegetables') {
      const items = [
        ['Royal Gala Apple', 1, 'kg', 180, 210, 'FreshFarm Produce', 'freshfarm'],
        ['Shimla Golden Apple', 1, 'kg', 160, 190, 'FreshFarm Produce', 'freshfarm'],
        ['Granny Smith Green Apple', 4, 'each', 190, 220, 'FreshFarm Produce', 'freshfarm'],
        ['Cavendish Robusta Banana', 1, 'kg', 50, 60, 'FreshFarm Produce', 'freshfarm'],
        ['Yellaki Mini Banana', 500, 'g', 48, 55, 'FreshFarm Produce', 'freshfarm'],
        ['Red Banana Organic', 500, 'g', 65, 75, 'FreshFarm Produce', 'freshfarm'],
        ['Nagpur Sweet Orange', 1, 'kg', 85, 100, 'FreshFarm Produce', 'freshfarm'],
        ['Kinnow Mandarins', 1, 'kg', 75, 90, 'FreshFarm Produce', 'freshfarm'],
        ['Mosambi Sweet Lime', 1, 'kg', 70, 85, 'FreshFarm Produce', 'freshfarm'],
        ['Ratnagiri Alphonso Mango', 1, 'kg', 450, 520, 'FreshFarm Produce', 'freshfarm'],
        ['Kesar Mango', 1, 'kg', 280, 330, 'FreshFarm Produce', 'freshfarm'],
        ['Banganapalli Sweet Mango', 1, 'kg', 140, 170, 'FreshFarm Produce', 'freshfarm'],
        ['Dasheri Mango', 1, 'kg', 130, 160, 'FreshFarm Produce', 'freshfarm'],
        ['Sonaka Seedless Green Grapes', 500, 'g', 80, 95, 'FreshFarm Produce', 'freshfarm'],
        ['Sharad Seedless Black Grapes', 500, 'g', 95, 115, 'FreshFarm Produce', 'freshfarm'],
        ['Red Globe Seeded Grapes', 500, 'g', 120, 140, 'FreshFarm Produce', 'freshfarm'],
        ['Arawali Ruby Pomegranate', 1, 'kg', 190, 230, 'FreshFarm Produce', 'freshfarm'],
        ['Taiwan Pink Guava', 1, 'kg', 90, 110, 'FreshFarm Produce', 'freshfarm'],
        ['Red Lady Sweet Papaya', 1, 'each', 65, 80, 'FreshFarm Produce', 'freshfarm'],
        ['Kiran Striped Watermelon', 1, 'each', 75, 95, 'FreshFarm Produce', 'freshfarm'],
        ['Honey Dew Muskmelon', 1, 'each', 60, 75, 'FreshFarm Produce', 'freshfarm'],
        ['Sun Melon Yellow', 1, 'each', 65, 80, 'FreshFarm Produce', 'freshfarm'],
        ['Zespri Green Kiwi', 3, 'each', 99, 120, 'FreshFarm Produce', 'freshfarm'],
        ['Zespri SunGold Kiwi', 3, 'each', 145, 175, 'FreshFarm Produce', 'freshfarm'],
        ['Mahabaleshwar Strawberry Box', 200, 'g', 90, 110, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Imported Blueberries', 125, 'g', 220, 260, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Sweet Cherries', 250, 'g', 280, 340, 'FreshFarm Produce', 'freshfarm'],
        ['Nagpur Sweet Sapota / Chikoo', 500, 'g', 45, 55, 'FreshFarm Produce', 'freshfarm'],
        ['Custard Apple / Sitaphal', 500, 'g', 95, 120, 'FreshFarm Produce', 'freshfarm'],
        ['Hass Avocado Imported', 2, 'each', 199, 240, 'FreshFarm Produce', 'freshfarm'],
        ['Dragon Fruit Pink', 1, 'each', 85, 110, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Red Plums', 500, 'g', 130, 160, 'FreshFarm Produce', 'freshfarm'],
        ['Kashmiri Sweet Peaches', 500, 'g', 140, 170, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Figs / Anjeer', 250, 'g', 110, 135, 'FreshFarm Produce', 'freshfarm'],
        ['Pineapple Queen Sliced', 1, 'each', 79, 99, 'FreshFarm Produce', 'freshfarm'],
        ['Hybrid Salad Tomato', 1, 'kg', 34, 42, 'FreshFarm Produce', 'freshfarm'],
        ['Desi Country Tomato', 1, 'kg', 38, 48, 'FreshFarm Produce', 'freshfarm'],
        ['Sweet Cherry Tomatoes', 250, 'g', 45, 60, 'FreshFarm Produce', 'freshfarm'],
        ['Nashik Red Onion', 1, 'kg', 42, 52, 'FreshFarm Produce', 'freshfarm'],
        ['Sambhar Small Shallots', 500, 'g', 55, 70, 'FreshFarm Produce', 'freshfarm'],
        ['White Spring Onions', 1, 'pack', 25, 32, 'FreshFarm Produce', 'freshfarm'],
        ['Agra Jyoti Potato', 1, 'kg', 32, 40, 'FreshFarm Produce', 'freshfarm'],
        ['Pahadi Chipsona Potato', 1, 'kg', 36, 45, 'FreshFarm Produce', 'freshfarm'],
        ['Baby Potatoes Dum Aloo', 500, 'g', 28, 35, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh White Cauliflower', 1, 'each', 40, 50, 'FreshFarm Produce', 'freshfarm'],
        ['Crisp Green Cabbage', 1, 'each', 30, 38, 'FreshFarm Produce', 'freshfarm'],
        ['Red Purple Cabbage', 500, 'g', 45, 58, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Green Broccoli', 1, 'each', 65, 80, 'FreshFarm Produce', 'freshfarm'],
        ['Hydroponic Baby Spinach / Palak', 250, 'g', 30, 40, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Green Methi Leaves', 250, 'g', 25, 32, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Coriander / Dhaniya Bunch', 100, 'g', 15, 20, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Mint / Pudina Leaves', 100, 'g', 15, 20, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Curry Leaves / Kadi Patta', 50, 'g', 10, 15, 'FreshFarm Produce', 'freshfarm'],
        ['Spicy Green Chillies', 200, 'g', 22, 28, 'FreshFarm Produce', 'freshfarm'],
        ['Mild Bhavnagri Green Chilli', 250, 'g', 30, 40, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Ginger / Adrak', 250, 'g', 38, 48, 'FreshFarm Produce', 'freshfarm'],
        ['Ooty Clean Garlic / Lahsun', 250, 'g', 75, 95, 'FreshFarm Produce', 'freshfarm'],
        ['Red Delhi Carrots', 500, 'g', 35, 45, 'FreshFarm Produce', 'freshfarm'],
        ['English Orange Carrots', 500, 'g', 40, 50, 'FreshFarm Produce', 'freshfarm'],
        ['Deep Red Beetroot', 500, 'g', 30, 38, 'FreshFarm Produce', 'freshfarm'],
        ['Crisp Green Capsicum', 500, 'g', 45, 55, 'FreshFarm Produce', 'freshfarm'],
        ['Sweet Yellow Bell Pepper', 2, 'each', 85, 110, 'FreshFarm Produce', 'freshfarm'],
        ['Sweet Red Bell Pepper', 2, 'each', 85, 110, 'FreshFarm Produce', 'freshfarm'],
        ['English Long Cucumber', 500, 'g', 30, 38, 'FreshFarm Produce', 'freshfarm'],
        ['Desi Green Kheera', 500, 'g', 25, 32, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Bottle Gourd / Lauki', 1, 'each', 32, 40, 'FreshFarm Produce', 'freshfarm'],
        ['Bitter Gourd / Karela', 500, 'g', 35, 45, 'FreshFarm Produce', 'freshfarm'],
        ['Ridge Gourd / Turai', 500, 'g', 38, 48, 'FreshFarm Produce', 'freshfarm'],
        ['Sponge Gourd / Gilki', 500, 'g', 35, 45, 'FreshFarm Produce', 'freshfarm'],
        ['Tender Lady Finger / Bhindi', 500, 'g', 38, 48, 'FreshFarm Produce', 'freshfarm'],
        ['French Green Beans', 250, 'g', 32, 40, 'FreshFarm Produce', 'freshfarm'],
        ['Cluster Beans / Gawar', 250, 'g', 28, 35, 'FreshFarm Produce', 'freshfarm'],
        ['Green Peas / Matar in Pods', 500, 'g', 60, 75, 'FreshFarm Produce', 'freshfarm'],
        ['American Sweet Corn on Cob', 2, 'each', 35, 45, 'FreshFarm Produce', 'freshfarm'],
        ['Tender Baby Corn Pack', 200, 'g', 42, 55, 'FreshFarm Produce', 'freshfarm'],
        ['White Button Mushrooms', 200, 'g', 50, 65, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Juicy Lemons / Nimbu', 6, 'each', 28, 36, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Water Coconut', 1, 'each', 55, 65, 'FreshFarm Produce', 'freshfarm'],
        ['Raw Cooking Banana', 3, 'each', 28, 35, 'FreshFarm Produce', 'freshfarm'],
        ['Ash Gourd / Petha Slices', 500, 'g', 28, 35, 'FreshFarm Produce', 'freshfarm'],
        ['Sweet Pumpkin / Kaddu', 500, 'g', 25, 32, 'FreshFarm Produce', 'freshfarm'],
        ['Moringa Drumsticks', 250, 'g', 35, 45, 'FreshFarm Produce', 'freshfarm'],
        ['White Radish / Mooli', 500, 'g', 22, 28, 'FreshFarm Produce', 'freshfarm'],
        ['Purple Turnip / Shalgam', 500, 'g', 30, 40, 'FreshFarm Produce', 'freshfarm'],
        ['Sweet Potatoes / Shakarkandi', 500, 'g', 35, 45, 'FreshFarm Produce', 'freshfarm'],
        ['Colocasia / Arbi Roots', 500, 'g', 40, 50, 'FreshFarm Produce', 'freshfarm'],
        ['Elephant Foot Yam / Suran', 500, 'g', 45, 55, 'FreshFarm Produce', 'freshfarm'],
        ['Green Zucchini Squash', 500, 'g', 60, 75, 'FreshFarm Produce', 'freshfarm'],
        ['Yellow Zucchini Squash', 500, 'g', 65, 80, 'FreshFarm Produce', 'freshfarm'],
        ['Iceberg Salad Lettuce', 1, 'each', 48, 60, 'FreshFarm Produce', 'freshfarm'],
        ['Red Romaine Lettuce', 1, 'pack', 55, 70, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Basil Leaves Bunch', 50, 'g', 25, 35, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Celery Stalks', 250, 'g', 45, 60, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Parsley Bunch', 100, 'g', 30, 40, 'FreshFarm Produce', 'freshfarm'],
        ['Lemongrass Stems', 100, 'g', 25, 35, 'FreshFarm Produce', 'freshfarm'],
        ['Raw Mango / Kairi', 500, 'g', 55, 70, 'FreshFarm Produce', 'freshfarm'],
        ['Fresh Amla / Indian Gooseberry', 250, 'g', 35, 45, 'FreshFarm Produce', 'freshfarm'],
        ['Baby Spinach Hydroponic Box', 125, 'g', 49, 65, 'FreshFarm Produce', 'freshfarm'],
        ['Portobello Flat Mushrooms', 150, 'g', 95, 120, 'FreshFarm Produce', 'freshfarm'],
        ['Exotic Asparagus Spears', 200, 'g', 180, 220, 'FreshFarm Produce', 'freshfarm'],
      ];

      items.forEach((it, idx) => {
        allProducts.push(makeProduct(catSlug, catId, it[6], '21000000-0000-0000-0000-000000000001', it[0], `${it[1]} ${it[2]}`, it[1], it[2], it[3], it[4], idx, ['farm fresh', 'organic']));
      });
    }

    else if (catSlug === 'dairy-bread-eggs') {
      const items = [
        ['Amul Taaza Homogenised Milk', 500, 'ml', 27, 28, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Amul Taaza Homogenised Milk 1L', 1, 'l', 54, 56, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Amul Gold Full Cream Milk', 500, 'ml', 33, 34, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Amul Gold Full Cream Milk 1L', 1, 'l', 66, 68, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Amul Cow Milk Pasteurized', 500, 'ml', 28, 29, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Mother Dairy Full Cream Milk', 1, 'l', 66, 68, 'Mother Dairy', '21000000-0000-0000-0000-000000000003'],
        ['Mother Dairy Toned Fresh Milk', 500, 'ml', 27, 28, 'Mother Dairy', '21000000-0000-0000-0000-000000000003'],
        ['Nestle A+ Nourish Toned Milk', 1, 'l', 92, 98, 'Nestle', '21000000-0000-0000-0000-000000000007'],
        ['Amul Fresh Malai Paneer Block', 200, 'g', 90, 95, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Mother Dairy Classic Paneer', 200, 'g', 92, 98, 'Mother Dairy', '21000000-0000-0000-0000-000000000003'],
        ['Amul Salted Table Butter 100g', 100, 'g', 56, 58, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Amul Salted Table Butter 500g', 500, 'g', 275, 285, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Amul Unsalted White Butter', 500, 'g', 285, 300, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Amul Garlic & Herbs Butter', 100, 'g', 62, 65, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Amul Processed Cheese Block', 200, 'g', 135, 145, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Amul Cheese Slices 10 Pack', 200, 'g', 140, 150, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Amul Cheese Cubes Box', 200, 'g', 138, 148, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Britannia Cheezza Mozzarella Block', 200, 'g', 155, 170, 'Britannia', '21000000-0000-0000-0000-000000000004'],
        ['Britannia Processed Cheese Slices', 200, 'g', 145, 160, 'Britannia', '21000000-0000-0000-0000-000000000004'],
        ['Amul Masti Dahi Tub', 400, 'g', 35, 40, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Mother Dairy Classic Dahi Pouch', 400, 'g', 35, 40, 'Mother Dairy', '21000000-0000-0000-0000-000000000003'],
        ['Amul Fresh Cream 250ml', 250, 'ml', 65, 70, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Amul Whipping Cream 1L', 1, 'l', 250, 275, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Nestle Milkmaid Sweetened Milk', 400, 'g', 140, 150, 'Nestle', '21000000-0000-0000-0000-000000000007'],
        ['Britannia Daily Fresh White Bread', 400, 'g', 35, 40, 'Britannia', '21000000-0000-0000-0000-000000000004'],
        ['Harvest Gold Classic White Bread', 400, 'g', 35, 40, 'Harvest Gold', '21000000-0000-0000-0000-000000000005'],
        ['Harvest Gold 100% Atta Brown Bread', 400, 'g', 45, 50, 'Harvest Gold', '21000000-0000-0000-0000-000000000005'],
        ['English Oven 100% Whole Wheat Bread', 400, 'g', 50, 55, 'English Oven', '21000000-0000-0000-0000-000000000006'],
        ['English Oven Multigrain Bread Loaf', 400, 'g', 55, 60, 'English Oven', '21000000-0000-0000-0000-000000000006'],
        ['English Oven Garlic & Herb Loaf', 200, 'g', 60, 70, 'English Oven', '21000000-0000-0000-0000-000000000006'],
        ['Britannia Bombay Pav 6 Pack', 250, 'g', 28, 35, 'Britannia', '21000000-0000-0000-0000-000000000004'],
        ['English Oven Soft Burger Buns 4pk', 200, 'g', 38, 45, 'English Oven', '21000000-0000-0000-0000-000000000006'],
        ['English Oven Hot Dog Buns 4pk', 200, 'g', 40, 48, 'English Oven', '21000000-0000-0000-0000-000000000006'],
        ['English Oven Thin Crust Pizza Base', 2, 'each', 45, 55, 'English Oven', '21000000-0000-0000-0000-000000000006'],
        ['Farm Fresh White Eggs 6 Pack', 6, 'each', 48, 55, 'FreshFarm Produce', '21000000-0000-0000-0000-000000000001'],
        ['Farm Fresh White Eggs 12 Pack', 12, 'each', 92, 105, 'FreshFarm Produce', '21000000-0000-0000-0000-000000000001'],
        ['Farm Fresh White Eggs 30 Tray', 30, 'each', 215, 245, 'FreshFarm Produce', '21000000-0000-0000-0000-000000000001'],
        ['Organic Brown Eggs Free Range 6pk', 6, 'each', 78, 90, 'FreshFarm Produce', '21000000-0000-0000-0000-000000000001'],
        ['Country Desi Hen Brown Eggs 6pk', 6, 'each', 95, 110, 'FreshFarm Produce', '21000000-0000-0000-0000-000000000001'],
        ['Amul Masti Spiced Buttermilk', 200, 'ml', 15, 16, 'Amul', '21000000-0000-0000-0000-000000000002'],
      ];

      // Add 60 more items to reach 100 in category
      for (let i = 1; i <= 60; i++) {
        items.push([
          `Artisanal Dairy Reserve Variety #${i}`,
          200 + (i * 10),
          i % 2 === 0 ? 'g' : 'ml',
          45 + (i * 3),
          55 + (i * 3),
          i % 3 === 0 ? 'Amul' : i % 3 === 1 ? 'Britannia' : 'Mother Dairy',
          i % 3 === 0 ? '21000000-0000-0000-0000-000000000002' : i % 3 === 1 ? '21000000-0000-0000-0000-000000000004' : '21000000-0000-0000-0000-000000000003'
        ]);
      }

      items.forEach((it, idx) => {
        allProducts.push(makeProduct(catSlug, catId, it[5].toLowerCase().replace(/\s+/g, '-'), it[6], it[0], `${it[1]} ${it[2]}`, it[1], it[2], it[3], it[4], idx, ['dairy', 'milk', 'cheese']));
      });
    }

    else if (catSlug === 'staples-flours-rice') {
      const items = [
        ['Aashirvaad Superior Sharbati Atta', 5, 'kg', 295, 330, 'Aashirvaad', '21000000-0000-0000-0000-000000000008'],
        ['Aashirvaad Superior Sharbati Atta 10kg', 10, 'kg', 545, 595, 'Aashirvaad', '21000000-0000-0000-0000-000000000008'],
        ['Aashirvaad Select Sharbati Wheat', 5, 'kg', 345, 385, 'Aashirvaad', '21000000-0000-0000-0000-000000000008'],
        ['Fortune Chakki Fresh Pure Wheat Atta', 5, 'kg', 245, 280, 'Fortune', '21000000-0000-0000-0000-000000000009'],
        ['Fortune Chakki Fresh Atta 10kg', 10, 'kg', 465, 520, 'Fortune', '21000000-0000-0000-0000-000000000009'],
        ['Daawat Rozana Gold Basmati Rice', 5, 'kg', 425, 490, 'Daawat', '21000000-0000-0000-0000-000000000012'],
        ['Daawat Super Basmati Rice Aged', 1, 'kg', 185, 215, 'Daawat', '21000000-0000-0000-0000-000000000012'],
        ['India Gate Feast Rozana Basmati', 5, 'kg', 460, 525, 'India Gate', '21000000-0000-0000-0000-000000000011'],
        ['India Gate Classic Aged Basmati', 1, 'kg', 215, 245, 'India Gate', '21000000-0000-0000-0000-000000000011'],
        ['Fortune Everyday Basmati Rice', 5, 'kg', 375, 430, 'Fortune', '21000000-0000-0000-0000-000000000009'],
        ['Tata Sampann Unpolished Toor Dal', 1, 'kg', 175, 195, 'Tata Sampann', '21000000-0000-0000-0000-000000000010'],
        ['Tata Sampann Moong Dal Yellow', 1, 'kg', 165, 185, 'Tata Sampann', '21000000-0000-0000-0000-000000000010'],
        ['Tata Sampann Chana Dal Unpolished', 1, 'kg', 115, 130, 'Tata Sampann', '21000000-0000-0000-0000-000000000010'],
        ['Tata Sampann Urad Whole Black', 1, 'kg', 180, 205, 'Tata Sampann', '21000000-0000-0000-0000-000000000010'],
        ['Tata Sampann Masoor Dal Red', 1, 'kg', 125, 145, 'Tata Sampann', '21000000-0000-0000-0000-000000000010'],
        ['Tata Sampann Rajma Chitra', 1, 'kg', 195, 220, 'Tata Sampann', '21000000-0000-0000-0000-000000000010'],
        ['Tata Sampann White Kabuli Chana', 1, 'kg', 185, 210, 'Tata Sampann', '21000000-0000-0000-0000-000000000010'],
        ['Fortune Sunlite Refined Sunflower Oil', 1, 'l', 135, 155, 'Fortune', '21000000-0000-0000-0000-000000000009'],
        ['Fortune Sunlite Sunflower Oil 5L', 5, 'l', 655, 745, 'Fortune', '21000000-0000-0000-0000-000000000009'],
        ['Fortune Kachi Ghani Mustard Oil', 1, 'l', 150, 175, 'Fortune', '21000000-0000-0000-0000-000000000009'],
        ['Saffola Gold Pro Healthy Lifestyle Oil', 1, 'l', 170, 195, 'Saffola', '21000000-0000-0000-0000-000000000013'],
        ['Saffola Total Multisource Edible Oil', 5, 'l', 890, 995, 'Saffola', '21000000-0000-0000-0000-000000000013'],
        ['Amul Pure Cow Ghee Tin', 1, 'l', 615, 660, 'Amul', '21000000-0000-0000-0000-000000000002'],
        ['Mother Dairy Pure Buffalo Ghee', 1, 'l', 635, 680, 'Mother Dairy', '21000000-0000-0000-0000-000000000003'],
        ['Aashirvaad Svasti Pure Cow Ghee', 1, 'l', 645, 695, 'Aashirvaad', '21000000-0000-0000-0000-000000000008'],
        ['Tata Salt Vacuum Evaporated Iodized', 1, 'kg', 28, 30, 'Tata Sampann', '21000000-0000-0000-0000-000000000010'],
        ['Tata Salt Lite Low Sodium Salt', 1, 'kg', 45, 50, 'Tata Sampann', '21000000-0000-0000-0000-000000000010'],
        ['Aashirvaad Himalayan Pink Salt', 1, 'kg', 85, 100, 'Aashirvaad', '21000000-0000-0000-0000-000000000008'],
        ['Trust Pure Sulphurless White Sugar', 1, 'kg', 54, 60, 'Fortune', '21000000-0000-0000-0000-000000000009'],
        ['Trust Pure White Sugar 5kg Bag', 5, 'kg', 260, 290, 'Fortune', '21000000-0000-0000-0000-000000000009'],
      ];

      // Add 70 more items to reach 100
      for (let i = 1; i <= 70; i++) {
        items.push([
          `Staples Essential Grain Harvest #${i}`,
          1 + (i % 5),
          i % 4 === 0 ? 'l' : 'kg',
          60 + (i * 4),
          75 + (i * 4),
          i % 3 === 0 ? 'Tata Sampann' : i % 3 === 1 ? 'Fortune' : 'Aashirvaad',
          i % 3 === 0 ? '21000000-0000-0000-0000-000000000010' : i % 3 === 1 ? '21000000-0000-0000-0000-000000000009' : '21000000-0000-0000-0000-000000000008'
        ]);
      }

      items.forEach((it, idx) => {
        allProducts.push(makeProduct(catSlug, catId, it[5].toLowerCase().replace(/\s+/g, '-'), it[6], it[0], `${it[1]} ${it[2]}`, it[1], it[2], it[3], it[4], idx, ['staples', 'grains', 'kitchen essentials']));
      });
    }

    else {
      // For all other categories: generate 100 specific items
      const prefixMap = {
        'masalas-spices-dryfruits': ['Everest', 'MDH', 'Catch', 'Happilo', 'Nutraj'],
        'snacks-biscuits': ["Lay's", 'Kurkure', "Haldiram's", 'Parle', 'Oreo'],
        'beverages-drinks': ['Brooke Bond Red Label', 'Tata Tea', 'Nescafe', 'Real Fruit Power', 'Coca-Cola'],
        'instant-frozen-foods': ['Maggi', 'Knorr', 'MTR', "Kellogg's", 'McCain'],
        'chocolates-sweets-desserts': ['Cadbury', 'Ferrero Rocher', 'Nutella', 'Dabur Honey', 'Pintola'],
        'personal-care-hygiene': ['Dettol', 'Dove', 'Lifebuoy', 'Colgate', 'Head & Shoulders'],
        'cleaning-household': ['Surf Excel', 'Ariel', 'Vim', 'Harpic', 'Lizol'],
        'baby-pet-care': ['Pampers', 'Huggies', 'Pedigree', 'Whiskas', 'Drools'],
      };

      const brandsList = prefixMap[catSlug] || ['FreshCart', 'Generic'];
      const nounsMap = {
        'masalas-spices-dryfruits': ['Turmeric Powder', 'Chilli Flakes', 'Garam Masala', 'California Almonds', 'Cashew W320', 'Kashmiri Walnuts', 'Cardamom Pods', 'Black Pepper Whole', 'Cumin Seeds / Jeera', 'Mustard Seeds / Rai', 'Cinnamon Bark', 'Cloves / Laung', 'Golden Raisins', 'Roasted Salted Pistachios', 'Fox Nuts / Makhana', 'Chia Seeds', 'Flax Seeds', 'Pumpkin Seeds', 'Biryani Masala', 'Meat Masala'],
        'snacks-biscuits': ['Classic Salted Chips', 'Masala Magic Wafers', 'Cream & Onion Crisps', 'Aloo Bhujia Namkeen', 'Butter Cookies', 'Digestive Biscuits', 'Bourbon Chocolate Biscuits', 'Vanilla Cream Sandwich', 'Salted Peanuts Pack', 'Roasted Makhana Herbs', 'Moong Dal Crispy Namkeen', 'Khatta Meetha Mixture', 'Gourmet Cheese Popcorn', 'Tortilla Nachos Jalapeno', 'Spicy Sev', 'Cashew Delight Biscuits', 'Coconut Crunch Biscuits', 'Choco Chip Cookies', 'Salted Thin Crackers', 'Bikaneri Bhujia Gold'],
        'beverages-drinks': ['Assam Strong Leaf Tea', 'Premium Gold Tea Granules', 'Classic Instant Coffee', 'Rich Roasted Coffee Powder', 'Pure Mixed Fruit Juice', 'Valencia Orange Juice', 'Sparkling Cola Can', 'Lemon Soda Fizz', 'Energy Drink Citrus', 'Tender Coconut Water', 'Green Tea Lemon Honey', 'Cardamom Spiced Tea', 'Mango Nectar Juice', 'Diet Zero Sugar Soda', 'Sparkling Tonic Water', 'Alkaline Mineral Water', 'Chocolate Malt Milk Drink', 'Strawberry Milk Shake', 'Cold Brew Iced Coffee', 'Ginger Ale Drink'],
        'instant-frozen-foods': ['2-Minute Masala Noodles', 'Spicy Schezwan Noodles', 'Italian Durum Wheat Pasta', 'Macaroni Elbow Pasta', 'Ready Paneer Butter Masala', 'Dal Makhani Home Style', 'Crispy Golden French Fries', 'Veg Burger Patty 4pk', 'Frozen Sweet Green Peas', 'Malabar Layered Paratha', 'Rolled Whole Oats', 'Crunchy Corn Flakes', 'Choco Cereal Pops', 'Mixed Vegetable Soup Mix', 'Tomato Ketchup Squeezy', 'Hot & Sweet Chilli Sauce', 'Eggless Salad Mayonnaise', 'Schezwan Fried Rice Chutney', 'Instant Poha Breakfast', 'Upma Ready Mix'],
        'chocolates-sweets-desserts': ['Silk Smooth Milk Chocolate', '70% Intense Dark Chocolate', 'Hazelnut Praline Box', 'Fruit & Nut Chocolate Bar', 'Crispy Wafer Chocolate Bar', 'Traditional Gulab Jamun Tin', 'Spongy Bengali Rasgulla Tin', 'Royal Kaju Katli Sweet', 'Ghee Soan Papdi Box', '100% Pure Forest Honey', 'Organic Raw Wild Honey', 'All Natural Crunchy Peanut Butter', 'Chocolate Whey Peanut Butter', 'Creamy Hazelnut Cocoa Spread', 'Classic Strawberry Fruit Jam', 'Mixed Fruit Jelly Jam', 'Caramel Dessert Topping', 'Rich Chocolate Syrup Bottle', 'Moist Chocolate Cake Mix', 'Vanilla Custard Dessert Powder'],
        'personal-care-hygiene': ['Antibacterial Bathing Soap', 'Moisturizing Cream Beauty Bar', 'Refreshing Lemon Body Wash', 'Anti-Dandruff Active Shampoo', 'Smooth Keratin Hair Conditioner', 'Strong Teeth Whitening Toothpaste', 'Spicy Fresh Gel Toothpaste', 'Pure Coconut Nourishing Hair Oil', 'Almond Vitamin Hair Oil', 'Hydrating Aloe Face Wash', 'Neem Purifying Face Cleanser', 'Deep Moisture Body Lotion', 'Soft Light Moisturizing Cream', 'Fresh Active Deodorant Spray', 'Antibacterial Handwash Pump Refill', 'Glycerine Gentle Bath Bar', 'Triple Blade Men Razor', 'Cotton Soft Sanitary Pads', 'Beard Nourishing Oil', 'Daily Care Sunscreen SPF50'],
        'cleaning-household': ['Stain Defense Washing Powder', 'Matic Front Load Liquid Detergent', 'Matic Top Load Detergent Liquid', 'Fabric Softener & Conditioner', 'Stain Lifter Detergent Bar', 'Lemon Antibacterial Dishwash Bar', 'Concentrated Dishwash Gel Lemon', 'Tough Grease Scrub Pad 3pk', 'Absorbent Kitchen Sponge Wipes', 'Power Plus Toilet Cleaner Acid Free', 'Disinfectant Floor Cleaner Citrus', 'Antiseptic Surface Disinfectant', 'Glass & Mirror Sparkle Cleaner', 'Mosquito Vaporizer Machine & Refill', 'Instant Flying Insect Spray', 'Heavy Duty Garbage Bags Large 30pk', 'Ultra Soft Face Tissues 200 pulls', '2-Ply Kitchen Paper Towel Rolls', 'Bathroom Fragrance Pocket Block', 'Room Fresh Air Deodorizer Spray'],
        'baby-pet-care': ['Baby Diaper Pants Size S 44pk', 'Baby Diaper Pants Size M 60pk', 'Baby Diaper Pants Size L 54pk', 'Baby Diaper Pants Size XL 42pk', '99% Pure Water Baby Wipes 72pk', 'Gentle Tear-Free Baby Shampoo', 'No-Tears Moisturizing Baby Wash', 'Calming Baby Massage Oil', 'Nourishing Daily Baby Lotion', 'Gentle Baby Powder Cornstarch', 'Wheat Apple Infant Cereal Stage 1', 'Rice Mixed Fruit Cereal Stage 2', 'Adult Dry Dog Food Meat & Rice', 'Puppy Nutrition Chicken & Milk', 'Maxi Adult Premium Dog Food Kibble', 'Dry Dog Food Real Chicken & Egg', 'Tuna in Jelly Adult Wet Cat Food', 'Ocean Fish Dry Cat Food Kibble', 'Creamy Lickable Cat Treat Purée', 'Odor Control Bentonite Cat Litter 5kg'],
      };

      const nouns = nounsMap[catSlug] || ['Specialty Grocery Pack', 'Premium Kitchen Selection'];

      for (let i = 0; i < 100; i++) {
        const noun = nouns[i % nouns.length];
        const brand = brandsList[i % brandsList.length];
        const brandObj = BRAND_DEFINITIONS.find(b => b.name === brand) || BRAND_DEFINITIONS[0];
        const grade = i < 20 ? 'Classic' : i < 40 ? 'Premium' : i < 60 ? 'Gold' : i < 80 ? 'Special' : 'Select';
        const name = `${brand} ${grade} ${noun}`;
        const weight = 100 + ((i * 15) % 900);
        const unit = catSlug.includes('beverage') ? 'ml' : catSlug.includes('staple') ? 'kg' : 'g';
        const price = 25 + ((i * 9) % 450);
        const mrp = Math.round(price * 1.18);

        allProducts.push(makeProduct(
          catSlug,
          catId,
          brandObj.slug,
          brandObj.id,
          name,
          `${weight}${unit} Pack`,
          weight,
          unit,
          price,
          mrp,
          i,
          [catSlug, noun.toLowerCase()]
        ));
      }
    }
  }

  return allProducts;
}
