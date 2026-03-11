'use client';

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { BookingState, TrailType, SkillLevel, BikeRental, Addons, DurationHours, Customer, PriceBreakdown } from '@/types/booking';

// =====================
// Actions
// =====================
type BookingAction =
  | { type: 'SET_TRAIL_TYPE'; payload: TrailType }
  | { type: 'SET_SKILL_LEVEL'; payload: SkillLevel }
  | { type: 'SET_LOCATION'; payload: { id: string; name: string } }
  | { type: 'SET_BIKE_RENTAL'; payload: BikeRental }
  | { type: 'SET_RIDER_HEIGHT'; payload: number }
  | { type: 'SET_DATE'; payload: string }
  | { type: 'SET_TIME_SLOT'; payload: string }
  | { type: 'SET_DURATION'; payload: DurationHours }
  | { type: 'SET_ADDONS'; payload: Addons }
  | { type: 'SET_WAIVER_ACCEPTED'; payload: boolean }
  | { type: 'SET_CUSTOMER'; payload: Customer }
  | { type: 'SET_PRICE_BREAKDOWN'; payload: PriceBreakdown }
  | { type: 'SET_BOOKING_ID'; payload: string }
  | { type: 'RESET' };

// =====================
// Reducer
// =====================
function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case 'SET_TRAIL_TYPE':
      // Reset downstream when trail type changes
      return {
        trail_type: action.payload,
        skill_level: undefined,
        location_id: undefined,
        location_name: undefined,
      };

    case 'SET_SKILL_LEVEL':
      return {
        ...state,
        skill_level: action.payload,
        location_id: undefined,
        location_name: undefined,
      };

    case 'SET_LOCATION':
      return {
        ...state,
        location_id: action.payload.id,
        location_name: action.payload.name,
      };

    case 'SET_BIKE_RENTAL':
      return {
        ...state,
        bike_rental: action.payload,
        rider_height_inches: action.payload === 'none' ? undefined : state.rider_height_inches,
      };

    case 'SET_RIDER_HEIGHT':
      return { ...state, rider_height_inches: action.payload };

    case 'SET_DATE':
      return { ...state, date: action.payload, time_slot: undefined };

    case 'SET_TIME_SLOT':
      return { ...state, time_slot: action.payload };

    case 'SET_DURATION':
      return { ...state, duration_hours: action.payload };

    case 'SET_ADDONS':
      return { ...state, addons: action.payload };

    case 'SET_WAIVER_ACCEPTED':
      return { ...state, waiver_accepted: action.payload };

    case 'SET_CUSTOMER':
      return { ...state, customer: action.payload };

    case 'SET_PRICE_BREAKDOWN':
      return { ...state, price_breakdown: action.payload };

    case 'SET_BOOKING_ID':
      return { ...state, booking_id: action.payload };

    case 'RESET':
      return {};

    default:
      return state;
  }
}

// =====================
// Context
// =====================
interface BookingContextValue {
  state: BookingState;
  setTrailType: (type: TrailType) => void;
  setSkillLevel: (level: SkillLevel) => void;
  setLocation: (id: string, name: string) => void;
  setBikeRental: (rental: BikeRental) => void;
  setRiderHeight: (inches: number) => void;
  setDate: (date: string) => void;
  setTimeSlot: (time: string) => void;
  setDuration: (hours: DurationHours) => void;
  setAddons: (addons: Addons) => void;
  setWaiverAccepted: (accepted: boolean) => void;
  setCustomer: (customer: Customer) => void;
  setPriceBreakdown: (breakdown: PriceBreakdown) => void;
  setBookingId: (id: string) => void;
  reset: () => void;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(bookingReducer, {});

  const setTrailType = useCallback((type: TrailType) => dispatch({ type: 'SET_TRAIL_TYPE', payload: type }), []);
  const setSkillLevel = useCallback((level: SkillLevel) => dispatch({ type: 'SET_SKILL_LEVEL', payload: level }), []);
  const setLocation = useCallback((id: string, name: string) => dispatch({ type: 'SET_LOCATION', payload: { id, name } }), []);
  const setBikeRental = useCallback((rental: BikeRental) => dispatch({ type: 'SET_BIKE_RENTAL', payload: rental }), []);
  const setRiderHeight = useCallback((inches: number) => dispatch({ type: 'SET_RIDER_HEIGHT', payload: inches }), []);
  const setDate = useCallback((date: string) => dispatch({ type: 'SET_DATE', payload: date }), []);
  const setTimeSlot = useCallback((time: string) => dispatch({ type: 'SET_TIME_SLOT', payload: time }), []);
  const setDuration = useCallback((hours: DurationHours) => dispatch({ type: 'SET_DURATION', payload: hours }), []);
  const setAddons = useCallback((addons: Addons) => dispatch({ type: 'SET_ADDONS', payload: addons }), []);
  const setWaiverAccepted = useCallback((accepted: boolean) => dispatch({ type: 'SET_WAIVER_ACCEPTED', payload: accepted }), []);
  const setCustomer = useCallback((customer: Customer) => dispatch({ type: 'SET_CUSTOMER', payload: customer }), []);
  const setPriceBreakdown = useCallback((breakdown: PriceBreakdown) => dispatch({ type: 'SET_PRICE_BREAKDOWN', payload: breakdown }), []);
  const setBookingId = useCallback((id: string) => dispatch({ type: 'SET_BOOKING_ID', payload: id }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return (
    <BookingContext.Provider
      value={{
        state,
        setTrailType,
        setSkillLevel,
        setLocation,
        setBikeRental,
        setRiderHeight,
        setDate,
        setTimeSlot,
        setDuration,
        setAddons,
        setWaiverAccepted,
        setCustomer,
        setPriceBreakdown,
        setBookingId,
        reset,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking(): BookingContextValue {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}
