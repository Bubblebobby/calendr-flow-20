import {
  Armchair,
  Barbell,
  Bed,
  Dog,
  Drop,
  Eye,
  FirstAid,
  FlowerLotus,
  Hand,
  HandSoap,
  PenNib,
  PersonSimpleRun,
  Scissors,
  Sparkle,
  SquaresFour,
  Sunglasses,
  type Icon,
} from "@phosphor-icons/react";

export type BusinessCategory = {
  id: string;
  label: string;
  icon: Icon;
};

/** Service categories offered during business setup. `other` unlocks a free-text field. */
export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  { id: "hair_salon", label: "Hair salon", icon: Scissors },
  { id: "nails", label: "Nails", icon: Hand },
  { id: "eyebrows_lashes", label: "Eyebrows & lashes", icon: Eye },
  { id: "beauty_salon", label: "Beauty salon", icon: HandSoap },
  { id: "medspa", label: "Medspa", icon: Sparkle },
  { id: "barber", label: "Barber", icon: Armchair },
  { id: "massage", label: "Massage", icon: Bed },
  { id: "spa_sauna", label: "Spa & sauna", icon: FlowerLotus },
  { id: "waxing_salon", label: "Waxing salon", icon: Drop },
  { id: "tattoo_piercing", label: "Tattooing & piercing", icon: PenNib },
  { id: "tanning_studio", label: "Tanning studio", icon: Sunglasses },
  { id: "fitness_recovery", label: "Fitness & recovery", icon: Barbell },
  { id: "physical_therapy", label: "Physical therapy", icon: PersonSimpleRun },
  { id: "health_practice", label: "Health practice", icon: FirstAid },
  { id: "pet_grooming", label: "Pet grooming", icon: Dog },
  { id: "other", label: "Other", icon: SquaresFour },
];

export const MAX_CATEGORIES = 4;

export const CATEGORY_RANK_LABELS = ["Primary", "Second", "Third", "Fourth"] as const;
