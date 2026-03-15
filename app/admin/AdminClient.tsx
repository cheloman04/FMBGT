'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Booking {
  id: string;
  trail_type: string;
  date: string;
  time_slot: string;
  duration_hours: number;
  bike_rental: string;
  total_price: number;
  status: string;
  created_at: string;
  location_name: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  zip_code: string | null;
  marketing_source: string | null;
}

interface Stats {
  total: number;
  confirmed: number;
  pending: number;
  revenue: number;
}

interface Props {
  bookings: Booking[];
  stats: Stats;
  currentStatus: string;
}

const STATUS_OPTIONS = ['all', 'pending', 'confirmed', 'cancelled', 'refunded'];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  refunded: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AdminClient({ bookings, stats, currentStatus }: Props) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [localBookings, setLocalBookings] = useState(bookings);

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    setUpdating(bookingId);
    try {
      const res = await fetch('/api/admin/update-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, status: newStatus }),
      });
      if (res.ok) {
        setLocalBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
        );
      }
    } finally {
      setUpdating(null);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    window.location.href = '/admin/login';
  };

  const filterUrl = (status: string) => `/admin?status=${status}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Image
              src="https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png"
              alt="Florida MTB Guided Tours"
              width={52}
              height={52}
              className="rounded-lg"
            />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Florida Mountain Bike Trail Guided Tours</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Bookings', value: stats.total },
            { label: 'Confirmed', value: stats.confirmed },
            { label: 'Pending', value: stats.pending },
            { label: 'Revenue', value: formatPrice(stats.revenue) },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <a
              key={s}
              href={filterUrl(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors capitalize ${
                currentStatus === s
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-card text-muted-foreground border-border hover:border-foreground/30'
              }`}
            >
              {s}
            </a>
          ))}
        </div>

        {/* Bookings table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {localBookings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No bookings found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    {['Customer', 'Location', 'Date', 'Tour', 'Total', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {localBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{booking.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{booking.customer_email}</div>
                        {booking.customer_phone && (
                          <div className="text-xs text-muted-foreground mt-0.5">{booking.customer_phone}</div>
                        )}
                        {(booking.zip_code || booking.marketing_source) && (
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {booking.zip_code && (
                              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                ZIP {booking.zip_code}
                              </span>
                            )}
                            {booking.marketing_source && (
                              <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                {booking.marketing_source}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground/80">{booking.location_name}</td>
                      <td className="px-4 py-3 text-foreground/80">
                        <div>{formatDate(booking.date)}</div>
                        <div className="text-xs text-muted-foreground">{booking.time_slot}</div>
                      </td>
                      <td className="px-4 py-3 text-foreground/80">
                        <div className="capitalize">{booking.trail_type === 'mtb' ? 'MTB' : 'Paved'}</div>
                        <div className="text-xs text-muted-foreground">{booking.duration_hours}h · {booking.bike_rental}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {formatPrice(booking.total_price)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[booking.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={booking.status}
                          disabled={updating === booking.id}
                          onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                          className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground disabled:opacity-50"
                        >
                          <option value="pending">pending</option>
                          <option value="confirmed">confirmed</option>
                          <option value="cancelled">cancelled</option>
                          <option value="refunded">refunded</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Showing up to 100 most recent bookings
        </p>
      </div>
    </div>
  );
}
