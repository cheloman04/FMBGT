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

const SANFORD_PAVED_META: BookingLocationMeta = {
  meetingPointName: 'Downtown Sanford, Bicikleta Bike Shop',
  meetingPointAddress: '229 Magnolia Ave, Sanford, FL 32771',
  meetingPointUrl:
    'https://www.google.com/maps/search/?api=1&query=Downtown+Sanford%2C+Bicikleta+Bike+Shop%2C+229+Magnolia+Ave%2C+Sanford%2C+FL+32771',
};

const SPRING_TO_SPRING_PAVED_META: BookingLocationMeta = {
  meetingPointName: 'Spring to Spring, Blue Springs State Park - Lake Beresford Park',
  meetingPointAddress: '2100 Fatio Rd, DeLand, FL 32720',
  meetingPointUrl:
    'https://www.google.com/maps/search/?api=1&query=Spring+to+Spring%2C+Blue+Springs+State+Park+-+Lake+Beresford+Park%2C+2100+Fatio+Rd%2C+DeLand%2C+FL+32720',
};

const LOCATION_META: Record<string, BookingLocationMeta> = {
  'Sanford Historic Riverfront Tour': SANFORD_PAVED_META,
  'Spring to Spring Trail Tour - Blue Spring State Park': SPRING_TO_SPRING_PAVED_META,
  ['Spring to Spring Trail Tour \u2013 Blue Spring State Park']: SPRING_TO_SPRING_PAVED_META,
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
    meetingPointName: 'Markham Woods Park',
    meetingPointAddress: '8515 Markham Rd, Lake Mary, FL 32746',
    meetingPointUrl:
      'https://www.google.com/maps/search/?api=1&query=Markham+Woods+Park%2C+8515+Markham+Rd%2C+Lake+Mary%2C+FL+32746',
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
    meetingPointName: 'Spruce Creek',
    meetingPointAddress: '2317 Creek Shore Trail, New Smyrna Beach, FL 32168',
    meetingPointUrl:
      'https://www.google.com/maps/search/?api=1&query=Spruce+Creek%2C+2317+Creek+Shore+Trail%2C+New+Smyrna+Beach%2C+FL+32168',
  },
  'Santos Trailhead, Ocala': {
    meetingPointName: 'Santos Trailhead & Campground',
    meetingPointAddress: '3080 SE 80th St, Ocala, FL 34480',
    meetingPointUrl: 'https://maps.app.goo.gl/YVVXwnwXZiTaJ4tT6',
  },
  'Graham Swamp East Trailhead MTB, Palm Coast': {
    meetingPointName: 'Graham Swamp East TrailHead',
    meetingPointAddress: 'Lehigh Trail Trailhead, Palm Coast, FL 32137',
    meetingPointUrl:
      'https://www.google.com/maps/search/?api=1&query=Graham+Swamp+East+TrailHead%2C+Lehigh+Trail+Trailhead%2C+Palm+Coast%2C+FL+32137',
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
