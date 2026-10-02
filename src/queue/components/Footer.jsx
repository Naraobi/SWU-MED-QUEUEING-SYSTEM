/*
 * SWUMed system footer
 *
 * Carries the College of IT attribution on every page of the system.
 *
 * ---------------------------------------------------------------------------
 * TWO THINGS TO FILL IN
 * ---------------------------------------------------------------------------
 *
 * 1. THE LOGO
 *    Save the Southwestern University PHINMA College of IT logo as:
 *
 *        public/cit-logo.png
 *
 *    It is read from `public/` rather than `src/assets/` on purpose: a file
 *    under public/ is served as-is, so a missing file just hides the image
 *    instead of failing the Vite build the way a missing import would. A
 *    transparent PNG or an SVG both work; rename CIT_LOGO below if you use
 *    a different extension.
 *
 * 2. THE TEAM
 *    Put the team's names in TEAM_MEMBERS, in the order they should read.
 *    The list below is a placeholder - replace it before the dean sees this.
 * ---------------------------------------------------------------------------
 */

const CIT_LOGO = '/cit-logo.png';

const COLLEGE = 'Southwestern University PHINMA College of IT';

// PLACEHOLDER - replace with the real team, full names.
const TEAM_MEMBERS = [
  'Rodney',
  'Nara',
  'Faith',
  'JP',
];

/*
 * `variant` picks how much room the footer takes:
 *
 *   'full'    - logo, attribution and the team list. Used at the bottom of
 *               every signed-in page through Layout.
 *   'compact' - one quiet line. Used inside the login and recovery cards,
 *               where a three-line footer would crowd the form.
 *   'tv'      - light-on-dark, for the public display board.
 */
export default function Footer({ variant = 'full', className = '' }) {
  const tv = variant === 'tv';

  if (variant === 'compact') {
    return (
      <p
        className={`flex flex-wrap items-center justify-center gap-1.5 text-center text-xs leading-5 text-[#9CA3AF] ${className}`}
      >
        <CollegeMark className="h-4" />
        <span>Powered by {COLLEGE}</span>
      </p>
    );
  }

  return (
    <footer
      className={`${
        tv
          ? 'border-white/15 text-white/60'
          : 'border-[#E5E7EB] bg-white text-[#4B5563]'
      } border-t px-6 py-4 ${className}`}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2.5">
          <CollegeMark className={tv ? 'h-7' : 'h-6'} />

          <p
            className={`text-xs font-semibold ${
              tv ? 'text-white/80' : 'text-[#1F2937]'
            }`}
          >
            Powered by {COLLEGE}
          </p>
        </div>

        {TEAM_MEMBERS.length > 0 && (
          <p
            className={`text-xs leading-5 ${
              tv ? 'text-white/55' : 'text-[#9CA3AF]'
            }`}
          >
            {TEAM_MEMBERS.join(' · ')}
          </p>
        )}
      </div>
    </footer>
  );
}

/*
 * The mark hides itself if the file is not there yet, so the attribution
 * still reads correctly instead of showing a broken-image icon.
 */
function CollegeMark({ className = 'h-6' }) {
  return (
    <img
      src={CIT_LOGO}
      alt={COLLEGE}
      onError={(event) => {
        event.currentTarget.style.display = 'none';
      }}
      className={`${className} w-auto shrink-0 object-contain`}
    />
  );
}

export { COLLEGE, TEAM_MEMBERS };
