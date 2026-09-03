/**
 * City landing pages — one per service area named in the landing copy.
 *
 * Each city gets genuinely different content: its own trails, its own intro,
 * its own "who it suits" and its own FAQ. Cloning one template six times with
 * the place name swapped is duplicate content, and Google indexes one and drops
 * the rest — so every field below is written per city, not generated.
 */

import { trailsForCity, type Trail } from './trails';

export interface CityFaq {
  q: string;
  a: string;
}

export interface City {
  key: string;
  /** URL segment: /tours/[slug] */
  slug: string;
  name: string;
  /** Used in prose: "guided tours in {inPhrase}" */
  region: string;
  metaTitle: string;
  metaDescription: string;
  /** H1 on the city page. */
  heading: string;
  /** Opening paragraph — the differentiated part. */
  intro: string;
  /** Second paragraph: who this area suits and why. */
  suits: string;
  faqs: CityFaq[];
}

export const CITIES: City[] = [
  {
    key: 'orlando',
    slug: 'orlando',
    name: 'Orlando',
    region: 'Orange & Seminole County',
    metaTitle: 'Guided Mountain Bike Tours in Orlando, FL | Florida Mountain Bike Guides',
    metaDescription:
      'Guided mountain bike tours near Orlando for first-time and beginner riders. Bikes and helmets included, local guides, trails at Lake Druid, Soldiers Creek and Little Big Econ.',
    heading: 'Guided Mountain Bike Tours in Orlando, Florida',
    intro:
      'Orlando is where most riders start with us. The trails closest to the city are the gentlest we run — wide, open and forgiving — which makes this the right area if you have never ridden off-road, or if you are visiting and want a real Florida trail without committing to technical terrain.',
    suits:
      'Best for first-time riders, families staying near the theme parks, and visitors with a half-day free. Every tour here starts at the trailhead with a bike, a helmet and a guide already waiting, so there is nothing to arrange in advance and nothing to carry.',
    faqs: [
      {
        q: 'How far are the trails from the Orlando theme parks?',
        a: 'All three Orlando-area trailheads sit inside the greater Orlando metro, so they are a normal city drive rather than a day trip. Exact drive time depends on where you are staying — we send the meeting point and directions with your booking confirmation, and pickup can be arranged if you would rather not drive.',
      },
      {
        q: 'Is there a mountain bike tour in Orlando for someone who has never ridden a trail?',
        a: 'Yes — that is what the Orlando-area trails are for. Lake Druid Park and Soldiers Creek Park are both rated First Time: wide, open trail with no technical features. Your guide covers braking, body position and cornering before you roll out.',
      },
      {
        q: 'Do I need to bring a bike to Orlando?',
        a: 'No. Bikes and helmets are included and waiting at the trailhead. If you would rather ride your own setup, the Bring Your Own Bike option is available at a lower rate.',
      },
    ],
  },
  {
    key: 'sanford',
    slug: 'sanford',
    name: 'Sanford',
    region: 'Seminole County',
    metaTitle: 'Guided Bike Tours in Sanford, FL — Historic Riverfront & Trails',
    metaDescription:
      'Guided paved and mountain bike tours in Sanford, Florida. Ride the historic downtown riverfront from Bicikleta Bike Shop, or hit the dirt at Markham Woods. Bikes included.',
    heading: 'Guided Bike Tours in Sanford, Florida',
    intro:
      'Sanford is our home base. The paved riverfront tour starts from Bicikleta Bike Shop in the historic downtown and rolls out along Lake Monroe — no dirt, no technical riding, and no experience needed. It is the tour we point people to when the group has mixed ability or when riding singletrack is not the point of the day.',
    suits:
      'Best for mixed-ability groups, families, and anyone who wants the ride to be about the town and the water rather than the terrain. Riders who want dirt on the same trip can pair it with Markham Woods Trail, the closest beginner singletrack.',
    faqs: [
      {
        q: 'Where does the Sanford tour start?',
        a: 'At Bicikleta Bike Shop, 229 Magnolia Ave in downtown Sanford. It is our rental partner, so your bike is fitted at the shop before the ride rather than at a trailhead.',
      },
      {
        q: 'Is the Sanford riverfront tour suitable for kids?',
        a: 'Yes. The paved tours are the ones we recommend for families and younger riders — smooth surface, relaxed pace, and no off-road sections.',
      },
      {
        q: 'Can I rent an e-bike in Sanford?',
        a: 'Yes. Our rental partner in Sanford stocks full-suspension mountain bikes and e-bikes, and the electric upgrade can be added when you book.',
      },
    ],
  },
  {
    key: 'deland',
    slug: 'deland',
    name: 'DeLand',
    region: 'West Volusia County',
    metaTitle: 'Blue Spring Bike Tours & DeLand Trail Rides | Florida Mountain Bike Guides',
    metaDescription:
      'Guided bike tours in DeLand, FL. Ride the paved Spring to Spring Trail toward Blue Spring State Park with seasonal manatee stops, or ride singletrack at Chuck Lennon.',
    heading: 'Guided Bike Tours in DeLand & Blue Spring',
    intro:
      'DeLand is the springs ride. The paved Spring to Spring Trail runs from Lake Beresford Park toward Blue Spring State Park — shaded, flat, and pointed at some of the clearest water in Florida. In the colder months the spring run is a manatee refuge, which makes this the most seasonal tour we operate.',
    suits:
      'Best for riders who want scenery over difficulty, and for visitors combining a ride with the springs. Riders who want dirt in the same area can head to Chuck Lennon in DeLeon Springs, which is flowing intermediate singletrack rather than a relaxed paved route.',
    faqs: [
      {
        q: 'Will I see manatees on the Blue Spring ride?',
        a: 'Manatees gather in the Blue Spring run during the colder months, typically through the winter season, and are not present year-round. We cannot promise wildlife on any given day — what we can do is tell you honestly what the season looks like when you book.',
      },
      {
        q: 'Is the Spring to Spring Trail paved the whole way?',
        a: 'The section we ride is paved trail, which is why this tour works for mixed-ability groups and younger riders. It is not a mountain bike tour.',
      },
      {
        q: 'What is the difference between the DeLand and Sanford paved tours?',
        a: 'Sanford is a town-and-riverfront ride through a historic downtown. DeLand is a nature ride toward a spring. Same relaxed pace, very different scenery.',
      },
    ],
  },
  {
    key: 'mount-dora',
    slug: 'mount-dora',
    name: 'Mount Dora',
    region: 'Lake County',
    metaTitle: 'Mount Dora Mountain Bike Trail — Guided Tours | Florida Mountain Bike Guides',
    metaDescription:
      'Guided mountain bike tours on the Mount Dora Mountain Bike Trail. Technical intermediate singletrack with climbs, descents and optional features. Bikes and guide included.',
    heading: 'Guided Mountain Bike Tours in Mount Dora',
    intro:
      'Mount Dora is the step up. The trail system here is technical for Central Florida — real climbs, real descents and optional features you can ride around or hit, depending on the day. It is the tour riders book when the beginner trails no longer hold their attention.',
    suits:
      'Best for riders with trail miles behind them who want to be worked rather than shown around. If you have only ridden paved trail or a First Time route, start closer to Orlando and come here on the next trip.',
    faqs: [
      {
        q: 'Is the Mount Dora trail too hard for a beginner?',
        a: 'It is rated Intermediate, which means roots, climbs and faster sections that reward good control. A confident rider stepping up will enjoy it; a genuine first-timer will have a better day on a First Time trail.',
      },
      {
        q: 'Are the jumps mandatory?',
        a: 'No. The features on the Mount Dora system are optional, and your guide will show you the line around anything you would rather not ride.',
      },
      {
        q: 'Can I use my own bike at Mount Dora?',
        a: 'Yes. Bring Your Own Bike is available on every mountain bike tour. Make sure it is in good working order — this is not the trail to discover your brakes need attention.',
      },
    ],
  },
  {
    key: 'ocala',
    slug: 'ocala',
    name: 'Ocala',
    region: 'Marion County',
    metaTitle: 'Santos Trail Guided Mountain Bike Tours, Ocala FL | Florida Mountain Bike Guides',
    metaDescription:
      'Guided mountain bike tours at Santos Trailhead in Ocala, Florida — the state’s best-known trail system. Advanced technical terrain with a local guide who knows the lines.',
    heading: 'Guided Mountain Bike Tours at Santos, Ocala',
    intro:
      'Santos is the trail people travel to Florida to ride, and the one where a guide earns their keep. The system is large enough that riders arriving cold routinely spend their first hours finding the good sections instead of riding them. We skip that part.',
    suits:
      'Best for experienced riders and visiting mountain bikers who want the highlights without a map and a guess. This is the most demanding terrain we guide — technical features with real consequence, ridden at whatever pace the group can hold.',
    faqs: [
      {
        q: 'Do I need a guide to ride Santos?',
        a: 'No, and plenty of people do not. What a guide gets you is route selection — riding the sections worth riding, in an order that makes sense, without stopping to read a trail map at every junction.',
      },
      {
        q: 'How hard is Santos really?',
        a: 'The system spans a wide range, and we rate our Santos tour Advanced because that is what we guide there. Riders who want a gentler introduction to Florida singletrack are better served closer to Orlando.',
      },
      {
        q: 'Where do we meet in Ocala?',
        a: 'At Santos Trailhead & Campground, 3080 SE 80th St, Ocala FL 34480. Bikes and helmets are ready at the trailhead unless you are bringing your own.',
      },
    ],
  },
  {
    key: 'palm-coast',
    slug: 'palm-coast',
    name: 'Palm Coast',
    region: 'Flagler & Volusia County',
    metaTitle: 'Guided Mountain Bike Tours: Palm Coast, Ormond Beach & Port Orange',
    metaDescription:
      'Guided mountain bike tours on Florida’s Atlantic side — Graham Swamp in Palm Coast, River Bend in Ormond Beach and Doris Leeper Spruce Creek in Port Orange.',
    heading: 'Guided Mountain Bike Tours on the Flagler & Volusia Coast',
    intro:
      'The coastal cluster is the densest set of trails we guide, and the least like what people expect from Florida. Graham Swamp in Palm Coast is rugged and genuinely demanding; River Bend and Spruce Creek are tight, rooty and fast without being punishing.',
    suits:
      'Best for riders staying on the Atlantic side, and for anyone who wants two or three distinct trails in the same trip rather than one. The three sit at different difficulties, so a mixed group can be matched to terrain instead of compromising on one route.',
    faqs: [
      {
        q: 'Which coastal trail should I pick?',
        a: 'Graham Swamp East is the hardest of the three — steep climbs, fast descents, rugged terrain. River Bend and Doris Leeper Spruce Creek are both Intermediate: technical enough to be interesting, forgiving enough to enjoy.',
      },
      {
        q: 'Can we ride more than one trail in a day?',
        a: 'The three are close enough that it is worth asking. Contact us with your dates and group and we will tell you what actually fits without rushing the riding.',
      },
      {
        q: 'Is Graham Swamp suitable for a first mountain bike tour?',
        a: 'No. It is rated Advanced and we would rather say so than sell you a bad day. Start on a First Time or Beginner trail and come back to it.',
      },
    ],
  },
];

export function getCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

export function cityTrails(city: City): Trail[] {
  return trailsForCity(city.key);
}
