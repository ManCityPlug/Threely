import type { Product } from "./types";

export const PRODUCTS: Product[] = [
  // ── FITNESS (3) ─────────────────────────────────────────────────────────────
  {
    id: "fitness_01",
    title: "Resistance Band Set (5-Level)",
    niches: ["fitness", "wellness"],
    supplier_cost: 4.5,
    suggested_retail: 22,
    why_it_sells:
      "Home workout staple that explodes every January and summer — TikTok fitness creators restock these constantly.",
    tags: ["trending", "home_gym", "gift"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1598289431512-b97b0917afb3?w=800&q=80",
        alt: "Woman using resistance bands for glute workout",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80",
        alt: "Man stretching with resistance band outdoors",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80",
        alt: "Five resistance bands laid flat on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=80",
        alt: "Close-up of resistance band texture and loop handle",
      },
    ],
    ad_prompt_templates: [
      "Bright gym lifestyle ad: athletic woman performing hip thrust with colorful resistance band, natural light, motivational energy",
      "Clean product flat-lay: five resistance bands arranged by color gradient on white marble surface, soft shadows",
      "Before/after split: tired couch person vs energized woman mid-workout with resistance bands, bold sans-serif text overlay",
    ],
  },
  {
    id: "fitness_02",
    title: "Adjustable Dumbbell (2-in-1 Dial)",
    niches: ["fitness"],
    supplier_cost: 12,
    suggested_retail: 55,
    why_it_sells:
      "Space-saving home gym hero — replaces a full rack at a fraction of the cost, consistently viral on TikTok Shop fitness.",
    tags: ["home_gym", "trending", "high_value"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
        alt: "Man curling adjustable dumbbell in modern apartment",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&q=80",
        alt: "Woman doing shoulder press with compact dumbbell",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1526401485004-46910ecc8e51?w=800&q=80",
        alt: "Adjustable dumbbell isolated on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1590487988256-9ed24133863e?w=800&q=80",
        alt: "Dial weight selector mechanism close-up",
      },
    ],
    ad_prompt_templates: [
      "Modern home gym lifestyle shot: person dialing weight on compact adjustable dumbbell, minimalist apartment, clean aesthetic",
      "Side-by-side comparison: bulky traditional dumbbell rack vs single compact adjustable dumbbell, crisp white background",
      "Aspirational fitness ad: confident man mid-curl with adjustable dumbbell, dramatic side lighting, bold motivational text",
    ],
  },
  {
    id: "fitness_03",
    title: "Ab Roller Wheel with Knee Pad",
    niches: ["fitness"],
    supplier_cost: 3.5,
    suggested_retail: 18,
    why_it_sells:
      "Sub-$20 impulse buy with massive perceived value — core workout tool that's been TikTok-viral for multiple cycles.",
    tags: ["impulse_buy", "trending", "under_20"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80",
        alt: "Fit person using ab roller on gym floor",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80",
        alt: "Woman performing ab rollout at home on yoga mat",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1585687433150-d57e2aad0f78?w=800&q=80",
        alt: "Ab roller wheel with foam knee pad on white surface",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=800&q=80",
        alt: "Close-up of wheel grip texture and rubber grip handles",
      },
    ],
    ad_prompt_templates: [
      "Core transformation ad: before/after abs with ab roller center frame, high contrast lighting, motivational tagline",
      "Home workout lifestyle: minimalist apartment, person using ab roller wheel on hardwood floor, morning light",
      "TikTok-style vertical video frame: hands gripping ab roller mid-rollout, intense focus, gym chalk aesthetic",
    ],
  },

  // ── BEAUTY (3) ──────────────────────────────────────────────────────────────
  {
    id: "beauty_01",
    title: "Jade Roller & Gua Sha Kit",
    niches: ["beauty", "wellness"],
    supplier_cost: 3,
    suggested_retail: 18,
    why_it_sells:
      "Evergreen skincare gift — high perceived value at low cost, beloved by beauty influencers year-round.",
    tags: ["gift", "skincare", "trending"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=800&q=80",
        alt: "Woman rolling jade roller across cheekbone in bathroom mirror",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80",
        alt: "Jade roller and gua sha stone arranged on marble with flowers",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800&q=80",
        alt: "Jade roller and gua sha tool on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=800&q=80",
        alt: "Close-up of jade stone texture and roller head",
      },
    ],
    ad_prompt_templates: [
      "Luxe skincare flat-lay: jade roller and gua sha stone on pink marble with rose petals and serum bottle, soft morning light",
      "Lifestyle beauty ad: radiant woman doing facial gua sha routine, dewy skin, pastel bathroom aesthetic",
      "Gift set presentation: jade roller kit wrapped in tissue inside minimalist white box, ribbon tied, gifting aesthetic",
    ],
  },
  {
    id: "beauty_02",
    title: "LED Face Mask (7-Color Therapy)",
    niches: ["beauty", "wellness"],
    supplier_cost: 9,
    suggested_retail: 45,
    why_it_sells:
      "Alien-aesthetic viral moment on TikTok — high perceived premium value, great for unboxing content.",
    tags: ["viral", "skincare", "high_value"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1552693673-1bf958298935?w=800&q=80",
        alt: "Woman wearing glowing LED light therapy face mask in dark room",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=800&q=80",
        alt: "Person relaxing with LED face mask and serum applied",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&q=80",
        alt: "LED face mask isolated on white background showing color modes",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=800&q=80",
        alt: "Close-up of LED panel showing individual light diodes",
      },
    ],
    ad_prompt_templates: [
      "Futuristic beauty ad: woman wearing glowing 7-color LED face mask in dark minimal room, purple and blue ambient light",
      "Skincare routine lifestyle: before/after LED treatment split showing glowing skin, clean white aesthetic",
      "Unboxing aesthetic: LED face mask pulled from sleek black box, luxury product reveal, soft studio lighting",
    ],
  },
  {
    id: "beauty_03",
    title: "Portable Mini Hair Straightener",
    niches: ["beauty"],
    supplier_cost: 7,
    suggested_retail: 32,
    why_it_sells:
      "Travel essential with impulse-buy pricing — consistently top-selling beauty gadget on TikTok Shop and Amazon.",
    tags: ["travel", "impulse_buy", "gifting"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80",
        alt: "Woman straightening hair with mini flat iron in hotel room",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
        alt: "Hair straightener in open travel bag alongside makeup",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1582095133179-bfd08e2fb6b8?w=800&q=80",
        alt: "Compact mini hair straightener on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=800&q=80",
        alt: "Close-up of ceramic plates and temperature control",
      },
    ],
    ad_prompt_templates: [
      "Travel lifestyle ad: woman styling hair with mini straightener in bright hotel bathroom, aspirational travel aesthetic",
      "Side-by-side: bulky traditional straightener vs sleek palm-sized mini version, crisp white background",
      "Gift guide aesthetic: mini hair straightener in pink gift box with ribbon, beauty products surrounding it",
    ],
  },

  // ── TECH ACCESSORIES (3) ────────────────────────────────────────────────────
  {
    id: "tech_accessories_01",
    title: "MagSafe 3-in-1 Wireless Charging Station",
    niches: ["tech_accessories"],
    supplier_cost: 8,
    suggested_retail: 38,
    why_it_sells:
      "Desk clean-up product that sells itself — WFH culture drives constant demand, easy gifting year-round.",
    tags: ["wfh", "gift", "desk_setup"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1616400619175-5beda3a17896?w=800&q=80",
        alt: "MagSafe charging station on minimalist desk with phone, watch, earbuds",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&q=80",
        alt: "Nightstand setup with 3-in-1 wireless charger beside lamp",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80",
        alt: "3-in-1 wireless charging pad isolated on white",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=80",
        alt: "Close-up of wireless charging pads with phone aligned",
      },
    ],
    ad_prompt_templates: [
      "Clean desk aesthetic: MagSafe 3-in-1 charging station on walnut desk with MacBook, plants, morning coffee cup",
      "Nightstand lifestyle shot: wireless charger with glowing indicators in dim warm bedroom, all devices charging",
      "Gift guide flat-lay: charging station in premium packaging surrounded by tech gadgets, neutral background",
    ],
  },
  {
    id: "tech_accessories_02",
    title: "Magnetic Phone Grip & Stand (MagSafe Compatible)",
    niches: ["tech_accessories"],
    supplier_cost: 2.5,
    suggested_retail: 14,
    why_it_sells:
      "Low-cost everyday carry accessory — people buy multiples for home, car, and office; massive repeat-purchase potential.",
    tags: ["impulse_buy", "everyday_carry", "trending"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1592890288564-76628a30a657?w=800&q=80",
        alt: "Magnetic phone grip attached to back of iPhone in use",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=800&q=80",
        alt: "Phone standing upright on magnetic desk stand while watching video",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1570101945621-945409a6370f?w=800&q=80",
        alt: "Magnetic phone grip ring on white surface showing magnet back",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80",
        alt: "Close-up of MagSafe alignment ring detail",
      },
    ],
    ad_prompt_templates: [
      "Everyday carry lifestyle: hand holding phone with sleek magnetic grip ring in urban setting, candid natural light",
      "Desk productivity shot: phone propped on magnetic stand showing notifications, laptop in background, minimal aesthetic",
      "Problem/solution ad: phone dropping vs phone secured with magnetic grip, split frame, bold color contrast",
    ],
  },
  {
    id: "tech_accessories_03",
    title: "USB-C 100W GaN Charger (4-Port)",
    niches: ["tech_accessories", "home_decor"],
    supplier_cost: 11,
    suggested_retail: 48,
    why_it_sells:
      "Universal pain point — everyone needs more ports; GaN tech is still a strong selling angle in 2026.",
    tags: ["wfh", "travel", "high_value"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&q=80",
        alt: "Four devices charging from single compact GaN charger on desk",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1615751072497-5f5169febe17?w=800&q=80",
        alt: "GaN charger in airport lounge with laptop and phone plugged in",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1601524909162-ae8725290836?w=800&q=80",
        alt: "Compact 4-port GaN charger on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1618410320928-25228d811631?w=800&q=80",
        alt: "Close-up of USB-C and USB-A ports on charger face",
      },
    ],
    ad_prompt_templates: [
      "Clean tech flat-lay: 4-port GaN charger with all cables plugged in and organized on white marble desk",
      "Travel essential ad: compact charger in open backpack alongside passport, AirPods, and MacBook",
      "Before/after cable chaos: messy multiple adapters vs single compact GaN charger, dramatic clean-up reveal",
    ],
  },

  // ── HOME DECOR (3) ──────────────────────────────────────────────────────────
  {
    id: "home_decor_01",
    title: "Dried Pampas Grass Bouquet",
    niches: ["home_decor"],
    supplier_cost: 4,
    suggested_retail: 22,
    why_it_sells:
      "Boho aesthetic staple that never goes out of style — interior design TikTok drives constant organic demand.",
    tags: ["boho", "trending", "home_gift"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1597466765924-f06c5a8db9a4?w=800&q=80",
        alt: "Tall pampas grass in ceramic vase by bright living room window",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1615184697985-c9bde1b07da7?w=800&q=80",
        alt: "Boho bedroom corner with pampas grass arrangement and rattan furniture",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80",
        alt: "Dried pampas grass bouquet on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1599598425947-5202edd56bdb?w=800&q=80",
        alt: "Close-up of fluffy pampas grass plume texture",
      },
    ],
    ad_prompt_templates: [
      "Boho home aesthetic: oversized pampas grass in speckled white ceramic vase, sunlit Scandinavian living room",
      "Interior styling flat-lay: pampas grass bouquet surrounded by candles, dried flowers, and neutral linen",
      "Room transformation: empty boring corner vs cozy styled corner with pampas grass and soft lighting",
    ],
  },
  {
    id: "home_decor_02",
    title: "LED Neon Sign (Customizable Glow)",
    niches: ["home_decor", "kids"],
    supplier_cost: 10,
    suggested_retail: 45,
    why_it_sells:
      "Bedroom and content-creator essential — TikTok/Instagram backgrounds drive enormous repeat demand.",
    tags: ["viral", "trending", "gift"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1493612276216-ee3925520721?w=800&q=80",
        alt: "Pink neon sign glowing on dark bedroom wall with aesthetic lighting",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1518481852452-9415b262eba4?w=800&q=80",
        alt: "LED neon sign above vanity mirror in influencer room setup",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1504386106331-3e4e71712b38?w=800&q=80",
        alt: "LED neon sign on white wall unlit showing shape",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
        alt: "Close-up of flexible neon LED tube detail",
      },
    ],
    ad_prompt_templates: [
      "Dreamy bedroom aesthetic: pink custom LED neon sign glowing on dark wall with fairy lights and cozy bedding",
      "Content creator setup: neon sign in background of ring-lit desk setup, aspirational creator vibe",
      "Gift reveal moment: LED neon sign being unwrapped, glowing for first time, reaction shot aesthetic",
    ],
  },
  {
    id: "home_decor_03",
    title: "Linen Throw Pillow Cover Set (4-Pack)",
    niches: ["home_decor"],
    supplier_cost: 5.5,
    suggested_retail: 28,
    why_it_sells:
      "Affordable room refresh that interior-design TikTok can't stop featuring — neutral tones appeal to every demographic.",
    tags: ["home_gift", "seasonal", "under_30"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
        alt: "Neutral linen throw pillows arranged on modern sofa",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=800&q=80",
        alt: "Cozy bedroom with linen pillow covers in earthy tones",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=800&q=80",
        alt: "Four linen pillow covers stacked on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=800&q=80",
        alt: "Close-up of linen fabric weave texture",
      },
    ],
    ad_prompt_templates: [
      "Cozy living room refresh: neutral linen throw pillows on cream sofa with warm afternoon light, Scandinavian aesthetic",
      "Before/after room transformation: dull sofa vs styled with linen pillow set and minimal decor items",
      "Fall home inspo flat-lay: linen pillow covers with candles, a book, and autumn foliage, warm earthy palette",
    ],
  },

  // ── PET (3) ─────────────────────────────────────────────────────────────────
  {
    id: "pet_01",
    title: "Slow Feeder Dog Bowl",
    niches: ["pet"],
    supplier_cost: 3,
    suggested_retail: 15,
    why_it_sells:
      "Vet-recommended product every dog owner eventually buys — solves a real problem with high repeat-gift potential.",
    tags: ["dog", "impulse_buy", "gift"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80",
        alt: "Golden retriever eating from colorful slow feeder bowl on kitchen floor",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?w=800&q=80",
        alt: "Happy dog with slow feeder bowl during mealtime",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1605897472359-85e4b94d685d?w=800&q=80",
        alt: "Colorful maze-pattern slow feeder bowl on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&q=80",
        alt: "Close-up of puzzle maze ridges inside slow feeder bowl",
      },
    ],
    ad_prompt_templates: [
      "Cute pet lifestyle: happy golden retriever enjoying meal from vibrant slow feeder bowl, warm kitchen background",
      "Vet-tip style ad: split showing dog gulping vs dog calmly eating from slow feeder, educational overlay text",
      "Gift packaging shot: slow feeder bowl in branded box with paw-print tissue paper, dog in background",
    ],
  },
  {
    id: "pet_02",
    title: "Self-Cleaning Slicker Brush for Dogs & Cats",
    niches: ["pet"],
    supplier_cost: 4,
    suggested_retail: 19,
    why_it_sells:
      "The retractable bristle trick makes every pet owner do a double-take — massive TikTok demo potential.",
    tags: ["cat", "dog", "impulse_buy"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&q=80",
        alt: "Person brushing fluffy cat with slicker brush, cat looking content",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80",
        alt: "Dog grooming session with self-cleaning brush outdoors",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1560807707-8cc77767d783?w=800&q=80",
        alt: "Self-cleaning slicker brush with button mechanism on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=800&q=80",
        alt: "Close-up of fine slicker bristles and ergonomic handle grip",
      },
    ],
    ad_prompt_templates: [
      "ASMR-style pet grooming: satisfying slow-motion brush stroke through fluffy cat fur, warm cozy lighting",
      "Self-cleaning demo: hand pressing button and fur ejecting from brush, clean product reveal, white background",
      "Before/after shedding ad: fur-covered sofa vs clean sofa, happy pet owner with brush, bold before/after text",
    ],
  },
  {
    id: "pet_03",
    title: "Interactive Feather Wand Cat Toy",
    niches: ["pet"],
    supplier_cost: 2,
    suggested_retail: 10,
    why_it_sells:
      "Irresistibly cute cat content drives itself — buyers tag friends, creating organic viral loops.",
    tags: ["cat", "impulse_buy", "under_15"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?w=800&q=80",
        alt: "Playful cat leaping for feather wand toy",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1574144611937-0df059b5ef3e?w=800&q=80",
        alt: "Kitten swatting at colorful feather toy on living room floor",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&q=80",
        alt: "Feather wand cat toy extended on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?w=800&q=80",
        alt: "Close-up of colorful feather attachment and wire end",
      },
    ],
    ad_prompt_templates: [
      "Adorable cat lifestyle: fluffy cat mid-air jumping for feather wand, living room setting, golden hour light",
      "Cat parent humor ad: exhausted owner waving wand vs energized cat endlessly playing, funny text overlay",
      "Product detail shot: feather wand extended showing all colorful feather attachment options, clean white setup",
    ],
  },

  // ── KIDS (3) ────────────────────────────────────────────────────────────────
  {
    id: "kids_01",
    title: "Sensory Fidget Toy Set (10-Pack)",
    niches: ["kids", "wellness"],
    supplier_cost: 4,
    suggested_retail: 20,
    why_it_sells:
      "Occupational therapy trend went mainstream — parents and teachers buy in bulk, huge gifting and back-to-school demand.",
    tags: ["gift", "back_to_school", "sensory"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1472289065668-ce650ac443d2?w=800&q=80",
        alt: "Child playing with colorful sensory fidget toy set at desk",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&q=80",
        alt: "Assorted sensory fidget toys laid out on classroom table",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&q=80",
        alt: "10-piece fidget toy set arranged on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?w=800&q=80",
        alt: "Close-up of pop-it, spinner, and cube fidget toys",
      },
    ],
    ad_prompt_templates: [
      "Bright kids lifestyle: child smiling while exploring sensory fidget toys at colorful play table",
      "Back-to-school flat-lay: fidget toy set alongside pencil case, notebooks, and backpack",
      "Parent recommendation style: parent showing fidget set to calm child, warm home setting, relatable text overlay",
    ],
  },
  {
    id: "kids_02",
    title: "Magnetic Drawing Board for Toddlers",
    niches: ["kids"],
    supplier_cost: 5,
    suggested_retail: 22,
    why_it_sells:
      "Screen-free toy that parents genuinely love — high repeat-gift purchase for birthdays and holidays.",
    tags: ["gift", "screen_free", "toddler"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&q=80",
        alt: "Toddler drawing on colorful magnetic drawing board",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=800&q=80",
        alt: "Parent and child playing together with magnetic drawing board",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=800&q=80",
        alt: "Colorful magnetic drawing board with pen stylus on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?w=800&q=80",
        alt: "Close-up of magnetic drawing surface with child's drawing",
      },
    ],
    ad_prompt_templates: [
      "Screen-free family moment: toddler proudly showing drawing on magnetic board to smiling parent, warm home",
      "Product benefit ad: phone being put away vs child happily using magnetic board, 'screen-free fun' text",
      "Holiday gift reveal: child unwrapping magnetic drawing board under Christmas tree, joyful reaction",
    ],
  },
  {
    id: "kids_03",
    title: "Glow-in-the-Dark Star Sticker Set",
    niches: ["kids", "home_decor"],
    supplier_cost: 1.5,
    suggested_retail: 9,
    why_it_sells:
      "Childhood classic with endless viral content potential — bedroom transformation videos drive massive organic reach.",
    tags: ["impulse_buy", "under_10", "bedroom"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&q=80",
        alt: "Child's bedroom ceiling covered in glowing star stickers in the dark",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=800&q=80",
        alt: "Parent and child applying glow star stickers to bedroom wall",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=800&q=80",
        alt: "Sheet of glow-in-the-dark star stickers on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
        alt: "Close-up of glowing star constellation sticker cluster",
      },
    ],
    ad_prompt_templates: [
      "Magical bedroom transformation: split day/night showing plain ceiling vs glowing starfield of stickers",
      "Adorable parent/child moment: applying star stickers together, pure joy, warm bedroom lighting",
      "Viral TikTok-style: timelapse of empty ceiling to full galaxy, hands placing stars, satisfying reveal",
    ],
  },

  // ── ECO (3) ─────────────────────────────────────────────────────────────────
  {
    id: "eco_01",
    title: "Beeswax Reusable Food Wraps (Set of 6)",
    niches: ["eco", "home_decor"],
    supplier_cost: 4.5,
    suggested_retail: 22,
    why_it_sells:
      "Zero-waste kitchen swap that photos beautifully — eco-conscious shoppers gift this to everyone they know.",
    tags: ["eco_gift", "zero_waste", "kitchen"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1611735341450-74d61e660ad2?w=800&q=80",
        alt: "Beeswax wrap covering a bowl of fruit on wooden kitchen counter",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=800&q=80",
        alt: "Six colorful beeswax food wraps wrapped around cheese and produce",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&q=80",
        alt: "Folded beeswax wraps in various patterns on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d2e?w=800&q=80",
        alt: "Close-up of beeswax wrap texture and natural fabric weave",
      },
    ],
    ad_prompt_templates: [
      "Eco kitchen aesthetic: beeswax wraps covering glass bowls and sandwiches on butcher-block counter, natural light",
      "Zero-waste swap ad: single-use plastic wrap vs beautiful beeswax wrap, bold eco-friendly message",
      "Gift set presentation: 6 folded beeswax wraps with different patterns tied with twine in kraft box",
    ],
  },
  {
    id: "eco_02",
    title: "Bamboo Toothbrush Set (8-Pack)",
    niches: ["eco", "wellness"],
    supplier_cost: 3,
    suggested_retail: 14,
    why_it_sells:
      "Sub-$15 eco swap with massive subscription potential — dentists, eco influencers, and zero-waste accounts all promote these.",
    tags: ["zero_waste", "under_15", "subscription"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=800&q=80",
        alt: "Bamboo toothbrushes in ceramic cup on bathroom sink",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1559181567-c3190ca9d5db?w=800&q=80",
        alt: "Family bamboo toothbrush set hanging in modern bathroom",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80",
        alt: "8 bamboo toothbrushes fanned out on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&q=80",
        alt: "Close-up of bamboo handle grain and soft bristle tips",
      },
    ],
    ad_prompt_templates: [
      "Clean bathroom aesthetic: bamboo toothbrushes in clay holder on white marble sink, morning light, fresh greenery",
      "Eco comparison: pile of plastic toothbrushes in landfill vs single bamboo set, powerful environmental message",
      "Family lifestyle: parents and two kids each holding their bamboo toothbrush, bathroom setting, bright and happy",
    ],
  },
  {
    id: "eco_03",
    title: "Collapsible Silicone Water Bottle",
    niches: ["eco", "fitness"],
    supplier_cost: 4,
    suggested_retail: 20,
    why_it_sells:
      "Space-saving travel hack that goes viral every travel season — eco angle + practicality is a powerful combo.",
    tags: ["travel", "eco_gift", "trending"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800&q=80",
        alt: "Person carrying collapsed silicone water bottle in jacket pocket during hike",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80",
        alt: "Collapsible water bottle expanded and filled at outdoor festival",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1530026405186-ed1f139313f3?w=800&q=80",
        alt: "Silicone collapsible bottle showing collapsed and expanded states",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1564419320461-6870880221ad?w=800&q=80",
        alt: "Close-up of food-grade silicone texture and leakproof lid",
      },
    ],
    ad_prompt_templates: [
      "Travel hack ad: collapsible bottle flat in bag vs expanded full-size, airport setting, 'pack smarter' text",
      "Eco adventure lifestyle: hiker drinking from silicone bottle on mountain trail, golden hour light",
      "Size comparison satisfying shot: deflated bottle vs plastic bottle, hand holding both, eco message overlay",
    ],
  },

  // ── WELLNESS (3) ────────────────────────────────────────────────────────────
  {
    id: "wellness_01",
    title: "Acupressure Mat & Pillow Set",
    niches: ["wellness", "fitness"],
    supplier_cost: 8,
    suggested_retail: 38,
    why_it_sells:
      "Recovery and stress-relief product that sells itself through first-use testimonial videos — huge gift appeal.",
    tags: ["recovery", "gift", "self_care"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&q=80",
        alt: "Woman lying on acupressure mat with eyes closed, relaxed expression",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80",
        alt: "Acupressure mat and pillow set on yoga mat beside candles",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80",
        alt: "Acupressure mat and neck pillow set on white background showing spike detail",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1601925228008-172b0cbc2f8c?w=800&q=80",
        alt: "Close-up of plastic acupressure spike pattern on mat surface",
      },
    ],
    ad_prompt_templates: [
      "Relaxation lifestyle: woman lying on acupressure mat in serene minimal bedroom, candles lit, pure calm",
      "Back pain relief ad: stressed office worker vs relaxed person on acupressure mat, 'melt the tension' tagline",
      "Gift set unboxing: acupressure mat and pillow in premium eco box with care card, self-care gift aesthetic",
    ],
  },
  {
    id: "wellness_02",
    title: "Portable Red Light Therapy Wand",
    niches: ["wellness", "beauty"],
    supplier_cost: 9,
    suggested_retail: 44,
    why_it_sells:
      "Biohacking trend crossed into mainstream beauty — strong scientific-credibility angle meets premium gift positioning.",
    tags: ["biohacking", "skincare", "high_value"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1552693673-1bf958298935?w=800&q=80",
        alt: "Person using red light therapy wand on face in dark room",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800&q=80",
        alt: "Red light therapy wand on spa-style tray with skincare products",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&q=80",
        alt: "Portable red light therapy wand isolated on white background",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1559181567-c3190ca9d5db?w=800&q=80",
        alt: "Close-up of red LED panel on therapy wand face",
      },
    ],
    ad_prompt_templates: [
      "Clinical-meets-luxury aesthetic: red light therapy wand glowing red held to face, dark moody background, premium feel",
      "Science-backed beauty ad: split of cellular repair diagram vs radiant skin after treatment, credibility tone",
      "Influencer shelfie: red light wand on white marble shelf with serums and clean beauty products, soft pink tones",
    ],
  },
  {
    id: "wellness_03",
    title: "Sleep Eye Mask with Bluetooth Headphones",
    niches: ["wellness"],
    supplier_cost: 7,
    suggested_retail: 32,
    why_it_sells:
      "Solves two problems at once for terrible sleepers — travel and insomnia markets overlap perfectly here.",
    tags: ["sleep", "travel", "gift"],
    image_variants: [
      {
        variant: "lifestyle_1",
        url: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=800&q=80",
        alt: "Person sleeping peacefully wearing bluetooth sleep eye mask",
      },
      {
        variant: "lifestyle_2",
        url: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=800&q=80",
        alt: "Sleep eye mask with headphones on airplane pillow during flight",
      },
      {
        variant: "product_white",
        url: "https://images.unsplash.com/photo-1586015555751-63bb77f4322a?w=800&q=80",
        alt: "Bluetooth sleep eye mask on white background showing speaker placement",
      },
      {
        variant: "close_up",
        url: "https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=800&q=80",
        alt: "Close-up of ultra-soft eye mask fabric and thin speaker profile",
      },
    ],
    ad_prompt_templates: [
      "Dreamy sleep lifestyle: person in soft white bedding wearing bluetooth eye mask, moonlit minimal bedroom",
      "Travel essential ad: sleep mask on airplane with window seat view, 'sleep anywhere' aspirational tagline",
      "Gift unboxing: sleep eye mask in velvet pouch inside premium box, cozy self-care gift aesthetic",
    ],
  },
];
