export function StatCard({ title, text }) {
  return (
    <div className="rounded-3xl border border-white/50 bg-white/70 p-4 backdrop-blur-sm shadow-[0_10px_40px_rgba(16,38,29,0.06)]">
      <p className="text-sm font-semibold text-[#10261d]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[#5f6f69]">{text}</p>
    </div>
  );
}
