// A cat asleep in a patch of sun, at the end of the letter.
// Apricot fur — the same colour as Hinata's hair. Decorative only;
// a sleeping cat is not something you click.
export function NappingCat() {
  return (
    <span className="sunspot" aria-hidden="true">
      <svg className="cat" viewBox="0 0 120 64" width="120" height="64" focusable="false">
        {/* tail, tucked around the front */}
        <path d="M14 46 C 4 46, 4 30, 16 32 C 24 34, 22 44, 30 46" fill="none" stroke="var(--fur-line)" stroke-width="2.4" stroke-linecap="round" />
        {/* body */}
        <ellipse cx="62" cy="42" rx="44" ry="18" fill="var(--fur)" stroke="var(--fur-line)" stroke-width="2.4" />
        {/* head */}
        <circle cx="88" cy="32" r="16" fill="var(--fur)" stroke="var(--fur-line)" stroke-width="2.4" />
        {/* ears */}
        <path d="M76 22 L 78 8 L 88 17 Z" fill="var(--fur)" stroke="var(--fur-line)" stroke-width="2.4" stroke-linejoin="round" />
        <path d="M100 22 L 98 8 L 88 17 Z" fill="var(--fur)" stroke="var(--fur-line)" stroke-width="2.4" stroke-linejoin="round" />
        {/* closed eyes */}
        <path d="M80 33 q 3 3 6 0" fill="none" stroke="var(--fur-line)" stroke-width="2" stroke-linecap="round" />
        <path d="M91 33 q 3 3 6 0" fill="none" stroke="var(--fur-line)" stroke-width="2" stroke-linecap="round" />
        {/* nose + mouth */}
        <path d="M87 39 l 2 1.5 l 2 -1.5" fill="none" stroke="var(--fur-line)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        {/* stripes */}
        <path d="M40 28 q 3 6 0 12 M50 26 q 3 6 0 12" fill="none" stroke="var(--fur-line)" stroke-width="1.6" stroke-linecap="round" opacity=".55" />
        {/* breath */}
        <text className="zz zz-1" x="104" y="14" font-size="9" fill="var(--ink-soft)">z</text>
        <text className="zz zz-2" x="111" y="7" font-size="7" fill="var(--ink-soft)">z</text>
      </svg>
    </span>
  );
}
