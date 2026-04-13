export interface BookingLocationMeta {
  meetingPointName: string;
  meetingPointAddress: string;
  meetingPointUrl: string;
}

const FALLBACK_LOCATION_META: BookingLocationMeta = {
  meetingPointName: 'Florida Mountain Bike Guides',
  meetingPointAddress: 'Central Florida meeting point details provided after booking.',
  meetingPointUrl: 'https://maps.google.com',
};

const LOCATION_META: Record<string, BookingLocationMeta> = {
  'Sanford Historic Riverfront Tour': {
    meetingPointName: 'Fort Mellon Park',
    meetingPointAddress: '600 E 1st St, Sanford, FL 32771',
    meetingPointUrl: 'https://maps.app.goo.gl/UQL4WTkzoXVSG4Ti8',
  },
  'Spring to Spring Trail Tour - Blue Spring State Park': {
    meetingPointName: 'Blue Spring State Park',
    meetingPointAddress: '2100 W French Ave, Orange City, FL 32763',
    meetingPointUrl: 'https://maps.app.goo.gl/imgUh7LBef9cLj2d7',
  },
  'Lake Druid Park, Orlando': {
    meetingPointName: 'Lake Druid Park',
    meetingPointAddress: '899 Coy Dr, Orlando, FL 32803',
    meetingPointUrl: 'https://maps.app.goo.gl/WjApuDjQubbBJJBQ6',
  },
  'Soldiers Creek Park, Longwood (First Time)': {
    meetingPointName: 'Soldiers Creek Park',
    meetingPointAddress: '2400 FL-419, Longwood, FL 32750',
    meetingPointUrl: 'https://maps.app.goo.gl/Xq7WKPN9pFJuGZGw8',
  },
  'Markham Woods Trail, Lake Mary': {
    meetingPointName: 'Markham Woods Trail',
    meetingPointAddress: '8515 Markham Rd, Lake Mary, FL 32746',
    meetingPointUrl: 'https://maps.app.goo.gl/u7hqJcQw9RGL16PaA',
  },
  'Little Big Econ Jones East - Snow Hill Rd, Chuluota': {
    meetingPointName: 'Jones East Trailhead',
    meetingPointAddress: 'Snow Hill Rd, Chuluota, FL 32766',
    meetingPointUrl: 'https://maps.app.goo.gl/KiEEaaJXGJbDHo7r7',
  },
  'Soldiers Creek Park, Longwood': {
    meetingPointName: 'Soldiers Creek Park',
    meetingPointAddress: '2400 FL-419, Longwood, FL 32750',
    meetingPointUrl: 'https://maps.app.goo.gl/Xq7WKPN9pFJuGZGw8',
  },
  'Mount Dora Mountain Bike Trail, Mount Dora': {
    meetingPointName: 'Mount Dora MTB Trailhead',
    meetingPointAddress: '1550 E 11th Ave, Mount Dora, FL 32757',
    meetingPointUrl: 'https://maps.app.goo.gl/FQtUAx8ZS2zwpQpZ7',
  },
  'Chuck Lennon Mountain Bike Trailhead, DeLeon Springs': {
    meetingPointName: 'Chuck Lennon Park',
    meetingPointAddress: '5000 Greenfield Dairy Rd, DeLeon Springs, FL 32130',
    meetingPointUrl: 'https://maps.app.goo.gl/Q9oC3jfyLHGtddkZ8',
  },
  'River Bend, Ormond Beach': {
    meetingPointName: 'River Bend Nature Park',
    meetingPointAddress: '755 Airport Rd, Ormond Beach, FL 32174',
    meetingPointUrl: 'https://maps.app.goo.gl/m9wLtSRAV9dNCuhR6',
  },
  'Doris Leeper Spruce Creek MTB Trailhead, Port Orange': {
    meetingPointName: 'Doris Leeper Spruce Creek MTB Trailhead',
    meetingPointAddress: "1755 Martin's Dairy Rd, Port Orange, FL 32127",
    meetingPointUrl: 'https://maps.app.goo.gl/F1qUgb47Yj5K4MZn7',
  },
  'Santos Trailhead, Ocala': {
    meetingPointName: 'Santos Trailhead & Campground',
    meetingPointAddress: '3080 SE 80th St, Ocala, FL 34480',
    meetingPointUrl: 'https://maps.app.goo.gl/YVVXwnwXZiTaJ4tT6',
  },
  'Graham Swamp East Trailhead MTB, Palm Coast': {
    meetingPointName: 'Graham Swamp East Trailhead',
    meetingPointAddress: '5140 Colbert Ln, Palm Coast, FL 32137',
    meetingPointUrl: 'https://maps.app.goo.gl/3cZ8NEZ4eJFjD8bo6',
  },
};

export function getBookingLocationMeta(locationName?: string | null): BookingLocationMeta {
  if (!locationName) return FALLBACK_LOCATION_META;
  return LOCATION_META[locationName] ?? {
    meetingPointName: locationName,
    meetingPointAddress: locationName,
    meetingPointUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName)}`,
  };
}

