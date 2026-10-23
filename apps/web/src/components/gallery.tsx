export function Gallery({ photos, alt }: { photos: string[]; alt: string }) {
  if (photos.length === 0) return <div className="aspect-[16/9] rounded-2xl bg-navy-50" />;
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:grid-rows-2 md:overflow-visible md:px-0">
      {photos.slice(0, 5).map((src, i) => (
        <img
          key={src}
          src={src}
          alt={`${alt} — photo ${i + 1}`}
          loading={i === 0 ? 'eager' : 'lazy'}
          className={`aspect-[4/3] w-[85%] shrink-0 snap-center rounded-2xl object-cover md:aspect-auto md:size-full md:w-auto ${i === 0 ? 'md:col-span-2 md:row-span-2 md:aspect-[4/3]' : ''}`}
        />
      ))}
    </div>
  );
}
