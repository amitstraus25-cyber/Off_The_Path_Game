/*
 * The music, as data.
 *
 * Everything in this file is pure: it turns a bar number into the notes that sound in that bar,
 * and nothing here touches Web Audio, the DOM or a clock. The player in `player.ts` is the only
 * thing that makes a sound, which keeps the part worth testing testable.
 *
 * WHERE THE BRIEF COMES FROM. Cyera has no sonic identity -- no sound logo, no sting, no
 * standardised library -- but it does have written audio guidance, in the "Music & Tone" section
 * of the Video Guidelines page in the Design Studio wiki. Marked In Progress rather than Current,
 * so it is guidance and not ratified, but it is Cyera's own words and it is specific:
 *
 *   "Cyera doesn't look or sound like a typical cyber company."
 *   "Cyera should feel human first, technology second."
 *   Avoid "overly futuristic, sterile, or cyber music".
 *   Aim for "light, playful, and modern. Often built around hip-hop inspired rhythms with
 *   subtle electronic textures."
 *
 * That last line rules out the obvious choice. A pixel game says chiptune, and chiptune is
 * exactly the retro-electronic register the brand asks us to avoid -- square waves and arpeggios
 * would be the sterile, technology-first sound, in a game whose whole subject is that the
 * dangerous thing arrives sounding friendly. So: warm keys, a soft swung pulse, air underneath.
 *
 * HOW THE VISUAL BRAND RULES CARRY OVER. The brand kit's framing is "restraint is the whole game:
 * lots of neutral space, one or two purples, accent colour used like seasoning, not paint."
 * Applied here, literally:
 *
 *   "Never approximate, tint or invent a colour"  -> a closed pitch set. Nothing outside it, ever.
 *   "Lots of neutral space"                       -> silence is the ground, not the gap.
 *   "Deep Purple and Black do most of the work"   -> two mid voices carry it, low and sparse.
 *   "Lime appears at most once per section"       -> exactly ONE high accent note per phrase.
 *
 * The last one is the rule that stops this sounding generated. One bright note every four bars,
 * left to ring, and never two.
 */

/** A note to sound: MIDI number, when in the bar (in beats), how long, and how loud. */
export interface Note {
  midi: number;
  /** Beats from the start of the bar. */
  beat: number;
  /** Length in beats. */
  length: number;
  /** 0 to 1, before the master gain. */
  gain: number;
  voice: Voice;
}

export type Voice = 'keys' | 'bass' | 'accent' | 'kick' | 'rim';

export const BEATS_PER_BAR = 4;
/** Unhurried. The walk takes about five minutes and the music should never chase it. */
export const BPM = 72;
/** Bars before the progression comes round again. */
export const PHRASE_BARS = 4;

/*
 * F major with a flattened seventh in the air of it: warm, modern, and unresolved, which is the
 * right posture for a forest with something in it. The closed set is the whole palette, and it is
 * deliberately small -- six pitch classes, no leading tone, so nothing can sound urgent.
 */
const ROOT = 53; // F3
const SCALE = [0, 2, 4, 5, 7, 9] as const;

/*
 * Four bars of seventh chords, voiced close -- every interval inside one octave rather than
 * spread across two. Close voicings keep the keys in a narrow band, which does two things: it
 * leaves the register above them empty for the accent to land in, and it stops the chords
 * reaching up and competing with it. An earlier spread voicing put a chord tone above the accent,
 * which is the musical equivalent of two Limes on one slide.
 */
const PROGRESSION: readonly (readonly number[])[] = [
  [0, 4, 7, 11], // Fmaj7
  [0, 4, 7, 9], // Dm7
  [0, 4, 5, 9], // Bbmaj7
  [2, 5, 7, 11], // C7, left hanging
];

const BASS: readonly number[] = [0, 9, 5, 7];

/** Deterministic and seedless: the same bar always sounds the same, so nothing drifts. */
const wobble = (bar: number, salt: number): number => {
  const h = Math.imul(bar + salt * 977, 2246822519) >>> 0;
  return (h % 1000) / 1000;
};

/**
 * The pulse. Hip-hop inflected, as the brief asks, but at a volume where it reads as a heartbeat
 * rather than a beat: the kick is barely there and the rim is a brush. The swing on the second
 * kick is what keeps it human rather than programmed, which is the whole of "human first".
 */
function pulse(bar: number, carriesAccent: boolean): Note[] {
  const notes: Note[] = [
    { midi: 36, beat: 0, length: 0.5, gain: 0.5, voice: 'kick' },
    { midi: 36, beat: 2.52, length: 0.5, gain: 0.34, voice: 'kick' },
    { midi: 60, beat: 1, length: 0.2, gain: 0.3, voice: 'rim' },
    { midi: 60, beat: 3, length: 0.2, gain: 0.3, voice: 'rim' },
  ];
  /*
   * A ghost note most bars, missing in some -- the gap is what you notice. Never in the bar that
   * carries the accent, though: the one bright note in the phrase should land in space, and a
   * brush under it is the clutter the brief asks us to leave out.
   */
  if (!carriesAccent && wobble(bar, 3) > 0.45)
    notes.push({ midi: 60, beat: 3.75, length: 0.15, gain: 0.16, voice: 'rim' });
  return notes;
}

/**
 * The keys. One chord a bar, struck softly and left alone -- the neutral ground everything else
 * sits on. Two of the four chord tones sound, not all four, because a full voicing fills the
 * space the brief wants left empty.
 */
function keys(bar: number): Note[] {
  const chord = PROGRESSION[bar % PHRASE_BARS]!;
  const pick = wobble(bar, 7) > 0.5 ? [0, 2] : [1, 3];
  return pick.map((i) => ({
    midi: ROOT + 12 + chord[i]!,
    beat: 0,
    length: 3.4,
    gain: 0.16,
    voice: 'keys' as const,
  }));
}

/** One low note a bar, on the beat. It is the floor, and it does not move. */
function bass(bar: number): Note[] {
  return [
    {
      midi: ROOT - 12 + BASS[bar % PHRASE_BARS]!,
      beat: 0,
      length: 2.6,
      gain: 0.3,
      voice: 'bass',
    },
  ];
}

/**
 * The Lime rule, as music. Exactly one bright note per four-bar phrase, high above everything
 * else, left to ring out -- and never two. Which bar of the phrase it lands in moves, so it is
 * not a metronome, but the count per phrase never changes.
 */
function accent(bar: number): Note[] {
  const phrase = Math.floor(bar / PHRASE_BARS);
  const whichBar = Math.floor(wobble(phrase, 11) * PHRASE_BARS);
  if (bar % PHRASE_BARS !== whichBar) return [];
  const degree = SCALE[Math.floor(wobble(phrase, 13) * SCALE.length)]!;
  return [
    {
      midi: ROOT + 24 + degree,
      beat: wobble(phrase, 17) > 0.5 ? 2 : 1.5,
      length: 2.2,
      gain: 0.13,
      voice: 'accent',
    },
  ];
}

/** Every note that sounds in a given bar. Pure, deterministic, and the whole composition. */
export function barNotes(bar: number): Note[] {
  const bright = accent(bar);
  return [...bass(bar), ...keys(bar), ...pulse(bar, bright.length > 0), ...bright];
}

/** Seconds per beat at the fixed tempo. */
export const beatSeconds = (): number => 60 / BPM;
