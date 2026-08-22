/**
 * Treatment types offered when creating a service, grouped by sector.
 * Values are stable strings stored on `services.treatment_type`.
 */
export type TreatmentGroup = {
  /** Sector heading shown in the dropdown, e.g. "Barbering". */
  label: string;
  /** Individual treatments within the sector. */
  options: string[];
};

/**
 * Comprehensive treatment list covering the wellness, beauty, health and service
 * sectors a business might offer. Groups and their options are kept alphabetically
 * sorted so the dropdown is easy to scan from A to Z.
 */
export const TREATMENT_GROUPS: TreatmentGroup[] = [
  {
    label: "Ayurveda & holistic",
    options: [
      "Ayurvedic consultation",
      "Chakra balancing",
      "Crystal therapy",
      "Energy healing",
      "Herbal therapy",
      "Holistic massage",
      "Reiki",
      "Sound bath",
    ],
  },
  {
    label: "Barbering",
    options: [
      "Beard sculpting",
      "Beard trim",
      "Buzz cut",
      "Fade & taper",
      "Hair dye (barbering)",
      "Head shave",
      "Hot towel shave",
      "Kids barbering",
      "Line up & edge up",
      "Skin fade",
    ],
  },
  {
    label: "Beauty & makeup",
    options: [
      "Airbrush makeup",
      "Bridal makeup",
      "Editorial makeup",
      "Ear piercing",
      "Henna",
      "Makeup application",
      "Makeup lesson",
      "Permanent makeup",
    ],
  },
  {
    label: "Coaching & wellness",
    options: [
      "Career coaching",
      "Counselling & therapy",
      "Life coaching",
      "Meditation session",
      "Mindfulness coaching",
      "Nutrition coaching",
      "Sleep coaching",
      "Stress management",
    ],
  },
  {
    label: "Dental",
    options: [
      "Dental cleaning",
      "Dental consultation",
      "Orthodontics consultation",
      "Teeth whitening",
      "Wisdom teeth check",
    ],
  },
  {
    label: "Eyebrows & lashes",
    options: [
      "Brow lamination",
      "Classic lash extensions",
      "Eyebrow shaping",
      "Eyebrow tinting",
      "Lash lift",
      "Lash removal",
      "Lash tint",
      "Microblading",
      "Volume lash extensions",
    ],
  },
  {
    label: "Facials & skincare",
    options: [
      "Acne treatment",
      "Chemical peel",
      "Deep cleansing facial",
      "Dermaplaning",
      "Facial",
      "LED light therapy",
      "Microdermabrasion",
      "Microneedling",
      "Skin consultation",
    ],
  },
  {
    label: "Fitness & recovery",
    options: [
      "Fitness assessment",
      "Group class",
      "Nutrition coaching",
      "Personal training",
      "Pilates",
      "Sports recovery",
      "Stretch therapy",
      "Yoga",
    ],
  },
  {
    label: "Hair removal",
    options: [
      "Brazilian wax",
      "Electrolysis",
      "Sugaring",
      "Threading",
      "Waxing",
    ],
  },
  {
    label: "Hair salon",
    options: [
      "Blow dry & styling",
      "Braids & locs",
      "Hair colouring",
      "Hair treatment",
      "Haircut",
      "Highlights & balayage",
      "Keratin & smoothing",
      "Kids haircut",
      "Perm & relaxer",
      "Scalp treatment",
      "Weave & extensions",
      "Wig installation",
    ],
  },
  {
    label: "Health practice",
    options: [
      "Acupuncture",
      "Chiropractic adjustment",
      "Dietitian consultation",
      "General consultation",
      "Osteopathy",
      "Physical therapy",
      "Podiatry",
    ],
  },
  {
    label: "Injectables & IV therapy",
    options: [
      "Anti-wrinkle injections",
      "Dermal fillers",
      "IV drip therapy",
      "Lip fillers",
      "Vitamin injection",
    ],
  },
  {
    label: "Massage & bodywork",
    options: [
      "Aromatherapy massage",
      "Couples massage",
      "Deep tissue massage",
      "Hot stone massage",
      "Lymphatic drainage",
      "Prenatal massage",
      "Reflexology",
      "Sports massage",
      "Swedish massage",
    ],
  },
  {
    label: "Medspa & aesthetics",
    options: [
      "Aesthetics consultation",
      "Body contouring",
      "IPL photofacial",
      "Laser hair removal",
      "Laser skin resurfacing",
      "Skin tag & mole removal",
    ],
  },
  {
    label: "Nails",
    options: [
      "Acrylic extensions",
      "Builder gel & overlays",
      "Gel & acrylic removal",
      "Gel manicure",
      "Manicure",
      "Nail art",
      "Nail repair",
      "Paraffin treatment",
      "Pedicure",
    ],
  },
  {
    label: "Other",
    options: ["Add-on service", "Consultation", "Other"],
  },
  {
    label: "Pet grooming",
    options: [
      "De-shedding treatment",
      "Flea treatment",
      "Full groom",
      "Nail clipping (pet)",
      "Pet bath & brush",
      "Pet haircut",
      "Teeth cleaning (pet)",
    ],
  },
  {
    label: "Piercing & tattoo",
    options: [
      "Body piercing",
      "Cover-up tattoo",
      "Piercing aftercare",
      "Tattoo consultation",
      "Tattoo removal",
      "Tattoo session",
      "Tattoo touch-up",
    ],
  },
  {
    label: "Spa & sauna",
    options: [
      "Body scrub",
      "Body wrap",
      "Cryotherapy",
      "Float therapy",
      "Hammam ritual",
      "Hydrotherapy",
      "Sauna session",
      "Steam room session",
    ],
  },
  {
    label: "Tanning",
    options: [
      "Airbrush tan",
      "Contour tanning",
      "Express spray tan",
      "Spray tan",
      "Sunbed session",
      "Tan removal",
    ],
  },
];
