import { getLocations } from '@/lib/supabase';
import { Step3LocationClient } from './client';
import type { Location } from '@/types/booking';

export default async function Step3LocationPage() {
  // In development with no Supabase, use mock data
  let locations: Location[];
  try {
    const data = await getLocations();
    locations = data as unknown as Location[];
  } catch {
    locations = getMockLocations();
  }

  return <Step3LocationClient locations={locations} />;
}

function getMockLocations(): Location[] {
  return [
    { id: '1', name: 'Blue Springs', tour_type: 'paved', skill_levels: null, active: true },
    { id: '2', name: 'Sanford', tour_type: 'paved', skill_levels: null, active: true },
    { id: '3', name: 'Mount Dora', tour_type: 'paved', skill_levels: null, active: true },
    { id: '4', name: 'Spruce Creek', tour_type: 'paved', skill_levels: null, active: true },
    { id: '5', name: 'Orlando MTB Park', tour_type: 'mtb', skill_levels: ['beginner', 'intermediate', 'advanced'], active: true },
    { id: '6', name: 'Soldiers Creek', tour_type: 'mtb', skill_levels: ['first_time', 'beginner', 'intermediate'], active: true },
    { id: '7', name: 'Markham Woods', tour_type: 'mtb', skill_levels: ['intermediate', 'advanced'], active: true },
    { id: '8', name: 'Snow Hill', tour_type: 'mtb', skill_levels: ['beginner', 'intermediate'], active: true },
    { id: '9', name: 'Riverbend', tour_type: 'mtb', skill_levels: ['first_time', 'beginner'], active: true },
    { id: '10', name: 'Santos Trailhead', tour_type: 'mtb', skill_levels: ['intermediate', 'advanced'], active: true },
    { id: '11', name: 'Graham Swamp', tour_type: 'mtb', skill_levels: ['advanced'], active: true },
  ];
}
