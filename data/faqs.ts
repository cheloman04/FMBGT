/**
 * Landing-page FAQ content.
 *
 * Lives here rather than inside the landing component so the same eight
 * question/answer pairs feed both the rendered accordion and the FAQPage
 * structured data. Two copies would drift, and structured data that disagrees
 * with the visible page is a spam signal, not a rich result.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export const faqItems: FaqItem[] = [
  {
    q: "Do I need to bring my own bike?",
    a: "You can, but you don't have to. We offer a Bring Your Own Bike (BYOB) option if you prefer riding your own setup. For the best experience, many riders choose our ready-to-ride fleet, including high-quality mountain bikes and e-bikes. It's a convenient way to enjoy the trail without worrying about setup or transport.",
  },
  {
    q: "Are the tours beginner-friendly?",
    a: "Absolutely. Tours are designed for all skill levels, from complete beginners to experienced riders. Your guide shapes the pace and trail choice around your comfort level.",
  },
  {
    q: "How long are the tours?",
    a: "Most mountain bike tours run approximately 2 hours. Scenic paved trail tours may run 2–3 hours depending on the route and group pace.",
  },
  {
    q: "What should I wear or bring?",
    a: "Wear comfortable athletic clothing and closed-toe shoes suitable for biking. We recommend bringing water to stay hydrated, a light snack for energy, and sunscreen for Florida's sun. If you choose a rental, your bike and helmet will be provided and ready at the trailhead. If you're bringing your own bike (BYOB), just make sure it's in good working condition and ready to ride.",
  },
  {
    q: "What happens if it rains or weather turns bad?",
    a: "Light rain is usually fine for trail riding. For the safety of the group, tours may be rescheduled in the event of lightning or severe weather. We'll reach out in advance if conditions require a change.",
  },
  {
    q: "Can you arrange pickup from my hotel or Airbnb?",
    a: "Yes. Pickup and drop-off can be arranged for select locations. Contact us when booking to confirm availability and any additional logistics.",
  },
  {
    q: "Are tours suitable for families and kids?",
    a: "Yes. Our scenic paved trail tours are especially popular with families and younger riders. Mountain bike tours can also be adapted for younger participants depending on fitness and comfort level.",
  },
  {
    q: "How do I book, and what is the cancellation policy?",
    a: "Book online in just a few minutes. Free cancellation is available up to 24 hours before your scheduled tour. Contact us directly for any last-minute adjustments.",
  },
];
