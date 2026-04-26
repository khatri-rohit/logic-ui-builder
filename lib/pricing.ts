export type PricingFeature = {
  label: string;
  included: boolean;
};

export type PricingTier = {
  name: "FREE" | "STANDARD" | "PRO";
  price: string;
  description: string;
  ctaLabel: string;
  featured?: boolean;
  features: PricingFeature[];
};

export const PRICING_TIERS: PricingTier[] = [
  {
    name: "FREE",
    price: "\u20b90",
    description: "Perfect for exploring the capabilities.",
    ctaLabel: "Start Free",
    features: [
      { label: "10 Generations / month", included: true },
      { label: "3 Projects", included: true },
      { label: "Frame regeneration", included: false },
      { label: "Team seats", included: false },
    ],
  },
  {
    name: "STANDARD",
    price: "\u20b91,499",
    description: "For dedicated designers and solo devs.",
    ctaLabel: "Upgrade to Standard",
    featured: true,
    features: [
      { label: "100 Generations / month", included: true },
      { label: "Unlimited Projects", included: true },
      { label: "Frame regeneration", included: true },
      { label: "Team seats", included: false },
    ],
  },
  {
    name: "PRO",
    price: "\u20b93,999",
    description: "For scaling teams and agencies.",
    ctaLabel: "Go Pro",
    features: [
      { label: "Unlimited Generations", included: true },
      { label: "Unlimited Projects", included: true },
      { label: "Frame regeneration", included: true },
      { label: "Up to 5 Team seats", included: true },
    ],
  },
];
