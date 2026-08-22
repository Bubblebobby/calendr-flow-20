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

export const TREATMENT_GROUPS: TreatmentGroup[] = [
  {
    label: "Hair salon",
    options: [
      "Haircut",
      "Blow dry & styling",
      "Hair colouring",
      "Highlights & balayage",
      "Keratin & smoothing",
      "Perm & relaxer",
      "Braids & locs",
      "Weave & extensions",
      "Wig installation",
      "Hair treatment",
      "Scalp treatment",
      "Kids haircut",
    ],
  },
  {
    label: "Barbering",
    options: [
      "Buzz cut",
      "Fade & taper",
      "Skin fade",
      "Line up & edge up",
      "Beard trim",
      "Beard sculpting",
      "Hot towel shave",
      "Head shave",
      "Hair dye (barbering)",
      "Kids barbering",
    ],
  },
  {
    label: "Nails",
    options: [
      "Manicure",
      "Pedicure",
      "Gel manicure",
      "Acrylic extensions",
      "Builder gel & overlays",
      "Nail art",
      "Nail repair",
      "Gel & acrylic removal",
      "Paraffin treatment",
    ],
  },
  {
    label: "Eyebrows & lashes",
    options: [
      "Eyebrow shaping",
      "Eyebrow tinting",
      "Brow lamination",
      "Microblading",
      "Lash lift",
      "Lash tint",
      "Classic lash extensions",
      "Volume lash extensions",
      "Lash removal",
    ],
  },
  {
    label: "Beauty & makeup",
    options: [
      "Makeup application",
      "Bridal makeup",
      "Editorial makeup",
      "Makeup lesson",
      "Ear piercing",
      "Henna",
    ],
  },
  {
    label: "Skincare & facials",
    options: [
      "Facial",
      "Deep cleansing facial",
      "Chemical peel",
      "Microdermabrasion",
      "Dermaplaning",
      "Microneedling",
      "LED light therapy",
      "Acne treatment",
      "Skin consultation",
    ],
  },
  {
    label: "Medspa & aesthetics",
    options: [
      "Anti-wrinkle injections",
      "Dermal fillers",
      "Laser hair removal",
      "Laser skin resurfacing",
      "IPL photofacial",
      "Body contouring",
      "IV drip therapy",
      "Skin tag & mole removal",
      "Aesthetics consultation",
    ],
  },
  {
    label: "Hair removal",
    options: [
      "Waxing",
      "Brazilian wax",
      "Threading",
      "Sugaring",
      "Electrolysis",
    ],
  },
  {
    label: "Massage & bodywork",
    options: [
      "Swedish massage",
      "Deep tissue massage",
      "Sports massage",
      "Hot stone massage",
      "Aromatherapy massage",
      "Prenatal massage",
      "Reflexology",
      "Lymphatic drainage",
      "Couples massage",
    ],
  },
  {
    label: "Spa & sauna",
    options: [
      "Body scrub",
      "Body wrap",
      "Sauna session",
      "Steam room session",
      "Hammam ritual",
      "Hydrotherapy",
      "Float therapy",
      "Cryotherapy",
    ],
  },
  {
    label: "Tanning",
    options: [
      "Spray tan",
      "Sunbed session",
      "Tan removal",
    ],
  },
  {
    label: "Tattoo & piercing",
    options: [
      "Tattoo session",
      "Tattoo touch-up",
      "Tattoo removal",
      "Cover-up tattoo",
      "Permanent makeup",
      "Body piercing",
      "Piercing aftercare",
      "Tattoo consultation",
    ],
  },
  {
    label: "Fitness & recovery",
    options: [
      "Personal training",
      "Group class",
      "Yoga",
      "Pilates",
      "Stretch therapy",
      "Fitness assessment",
      "Nutrition coaching",
    ],
  },
  {
    label: "Health practice",
    options: [
      "Physical therapy",
      "Chiropractic adjustment",
      "Osteopathy",
      "Acupuncture",
      "Podiatry",
      "Dental cleaning",
      "Optometry exam",
      "Dietitian consultation",
      "Counselling & therapy",
      "General consultation",
    ],
  },
  {
    label: "Pet grooming",
    options: [
      "Pet bath & brush",
      "Full groom",
      "Pet haircut",
      "Nail clipping (pet)",
      "De-shedding treatment",
      "Teeth cleaning (pet)",
      "Flea treatment",
    ],
  },
  {
    label: "Other",
    options: ["Consultation", "Add-on service", "Other"],
  },
];
