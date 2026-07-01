export default function sitemap() {
  return [
    {
      url: "https://qais-trading-academy.vercel.app",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://qais-trading-academy.vercel.app/payment",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
