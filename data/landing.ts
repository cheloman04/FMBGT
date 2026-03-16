// Extracted data constants from FloridaMountainBikeGuidesLanding.
// Use these when splitting the landing into individual section components.

import { Bike, Calendar, Route, ShieldCheck, Mountain, Waves } from 'lucide-react';

export const valueProps = [
  {
    title: 'Everything at the trailhead',
    text: 'Quality bikes, essential gear, and a friendly local guide waiting for you when you arrive.',
    icon: Bike,
  },
  {
    title: 'For every skill level',
    text: 'From first-time riders to seasoned riders, every tour is designed to feel approachable and memorable.',
    icon: ShieldCheck,
  },
  {
    title: 'Simple booking experience',
    text: 'Choose your location and date, show up ready to ride, and let the adventure begin.',
    icon: Calendar,
  },
  {
    title: 'Optional rider pickup',
    text: 'Short on time or can\'t get the car? Pickup and drop-off can be arranged for added convenience.',
    icon: Route,
  },
];

export const tours = [
  {
    title: 'Mountain Bike Tours',
    badge: 'Signature Experience',
    description:
      'Guided mountain bike tours designed for riders of every skill level, focused on making Florida\'s best trails easy, fun, and unforgettable.',
    icon: Mountain,
    points: ['Guided singletrack', 'Bikes & gear included', 'Beginner to advanced'],
    cta: 'Book a Guide',
  },
  {
    title: 'Scenic Paved Trail Tours',
    badge: 'Relaxed Adventure',
    description:
      'A laid-back way to explore Central Florida through smooth scenic paved trails, historic Sanford, riverfront views, Blue Spring, and seasonal manatee stops.',
    icon: Waves,
    points: ['Historic Sanford', 'Blue Spring rides', 'All ages & levels'],
    cta: 'Learn More',
  },
];

export const mapLocations = [
  {
    name: 'Sanford Riverwalk',
    type: 'Paved Tour',
    difficulty: 'Easy',
    x: '18%',
    y: '58%',
    desc: 'Historic downtown Sanford, waterfront views, and a relaxed city-to-nature ride.',
  },
  {
    name: 'Blue Spring State Park',
    type: 'Nature Tour',
    difficulty: 'Easy–Moderate',
    x: '64%',
    y: '24%',
    desc: 'Crystal-clear spring water, seasonal manatees, and one of Central Florida\'s most iconic stops.',
  },
  {
    name: 'Bearford Lake',
    type: 'Scenic Ride',
    difficulty: 'Easy',
    x: '34%',
    y: '38%',
    desc: 'A scenic stop that connects the Florida outdoor vibe with a relaxed two-wheel experience.',
  },
  {
    name: 'Central Florida Trail Network',
    type: 'MTB Trails',
    difficulty: 'Moderate–Advanced',
    x: '46%',
    y: '72%',
    desc: 'A visual placeholder for the trail system your client offers through guided off-road tours.',
  },
  {
    name: 'Bicikleta Bike Shop',
    type: 'Rental Hub',
    difficulty: 'All Riders',
    x: '24%',
    y: '48%',
    desc: 'Sanford-based rental partner offering full-suspension Specialized Stumpjumpers and local hospitality.',
  },
];

export const guides = [
  {
    title: 'Friendly professionals',
    subtitle: 'Local knowledge, smoother rides',
    text: 'Florida Mountain Bike Guides is built around a team of friendly and professional experts dedicated to making each ride safe, enjoyable, and easy to navigate.',
  },
  {
    title: 'Confidence for every rider',
    subtitle: 'A better experience from the start',
    text: 'Whether someone is brand new to riding or looking for a better local trail experience, the guides help shape the day around skill level and pace.',
  },
  {
    title: 'Sunshine State trail insight',
    subtitle: 'More than just navigation',
    text: 'Their local expertise turns a basic ride into a curated Florida adventure with better flow, less friction, and more memorable moments.',
  },
];

export const trailHighlights = [
  {
    title: 'Central Florida Trails',
    text: 'Explore the Central Florida mountain bike trails proudly offered through guided tours.',
  },
  {
    title: 'Sunshine State scenery',
    text: 'Riverfront views, springs, local landmarks, and hidden Florida beauty all become part of the experience.',
  },
  {
    title: 'Ride-ready logistics',
    text: 'The site should make the process feel simple: pick the ride, show up, and enjoy the adventure.',
  },
];

export const fleetFeatures = [
  'Specialized Mountain Bikes',
  'Rental Bikes & Electric Bikes',
  'Full-suspension options',
  'Ride-ready setup for visitors',
];

export const galleryItems = [
  { title: 'Mountain Bike Tours', category: 'Singletrack' },
  { title: 'Scenic Paved Trails', category: 'Riverfront' },
  { title: 'Blue Spring Adventure', category: 'Nature' },
  { title: 'Guided Ride Moments', category: 'Experience' },
  { title: 'Rental Fleet', category: 'Specialized Bikes' },
  { title: 'Florida Trail Views', category: 'Photo Gallery' },
];
