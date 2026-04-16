import type { Metadata } from "next";
import BlogPageClient from "@/components/BlogPageClient";

export const metadata: Metadata = {
  title: "Leadgeneratie Blog Nederland | 65+ Expert Artikelen | WarmeLeads",
  description: "Ontdek 65+ diepgaande artikelen over leadgeneratie in Nederland. Van SEO tot AI, van B2B tot conversie optimalisatie. Wekelijks nieuwe inzichten van WarmeLeads experts.",
  keywords: "leadgeneratie blog, lead generation Nederland, marketing strategie, B2B leadgeneratie, conversie optimalisatie, digital marketing tips",
  openGraph: {
    title: "Leadgeneratie Blog | 65+ Expert Artikelen | WarmeLeads",
    description: "De meest complete leadgeneratie kennisbank van Nederland met 65+ expert artikelen",
    url: "https://www.warmeleads.eu/blog",
    siteName: "WarmeLeads",
    images: [{
      url: "https://www.warmeleads.eu/logo-1200x1200.png",
      width: 1200,
      height: 1200,
      alt: "WarmeLeads Blog",
      type: "image/png"
    }],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Leadgeneratie Blog | 65+ Expert Artikelen",
    description: "De meest complete leadgeneratie kennisbank van Nederland",
    images: ["https://www.warmeleads.eu/logo-1200x1200.png"],
  }
};

export default function BlogPage() {
  return <BlogPageClient />;
}
