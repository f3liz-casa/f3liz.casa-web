// Base languages carry every string. Dialect entries carry only the
// sentences their speakers wrote; anything missing falls back to the base
// language through locale().
export const i18n = {
  en: {
    eyebrow: "a little playground",
    felis: "Latin for cat",
    wish: "Hope today is a happy one!",
    langAria: "Read in",
    making: "things I'm making",
    rooms: "rooms in this house",
    connect: "find me",
    zulipNote: "for zulip, just ask by email",
    milktea: "share a milk tea!",
    milkteaAria: "Share a milk tea — support the author (opens external page)",
    voices: "the people who lent their dialects",
    thanks: "Thanks for stopping by!",
  },
  ja: {
    eyebrow: "ちいさな、あそびば",
    felis: "ラテン語で、ねこ",
    wish: "きょうも、たのしい一日になりますように！",
    langAria: "読む言葉",
    making: "つくっているもの",
    rooms: "この家の部屋",
    connect: "つながる",
    zulipNote: "zulip は、メールで聞いてね",
    milktea: "ミルクティ一杯ぶん！",
    milkteaAria: "ミルクティ一杯ぶん、応援する（外部ページが開きます）",
    voices: "方言をくれた人たち",
    voicesNote: "敬称略",
    thanks: "読んでくれて、ありがとう！",
  },
  "ja-x-morioka": {
    eyebrow: "ちいさなあそびば、みたいな",
    wish: "きょうも、たのしい一日になればええんだべ！",
    thanks: "読んでくれて、ありがとうがんす！",
    milktea: "ミルクティ一杯、もらえるとうれしいんだべ！",
  },
  "ja-x-kansai": {
    eyebrow: "ちいさなあそびば、やで",
    wish: "きょうも、たのしい一日でありますように、ほんま！",
    thanks: "読んでくれて、おおきに！",
    milktea: "ミルクティ一杯、おおきに！",
  },
  "ja-x-okayama": {
    eyebrow: "ちいさなあそびば、みたいな",
    wish: "きょうも、たのしい一日になったら、ええなぁ！",
    thanks: "読んでくれて、ありがとうなんよ！",
    milktea: "ミルクティ一杯、ありがたいんよ！",
  },
  "ja-x-oita": {
    eyebrow: "ちいさなあそびば",
    wish: "きょうも、たのしい一日でありますように！",
    thanks: "読んでくれて、ありがとうなぁ！",
    milktea: "ミルクティ一杯、うれしいなぁ！",
  },
  ko: {
    eyebrow: "작은, 놀이터",
    felis: "라틴어로, 고양이",
    wish: "오늘도, 즐거운 하루이기를!",
    langAria: "읽을 말",
    making: "만들고 있는 것",
    rooms: "이 집의 방",
    connect: "닿는 곳",
    zulipNote: "zulip은 메일로 물어봐 주세요",
    milktea: "밀크티 한 잔, 고마워요!",
    milkteaAria: "밀크티 한 잔으로 응원하기 (외부 페이지가 열립니다)",
    voices: "사투리를 빌려준 사람들",
    voicesNote: "경칭 생략",
    thanks: "읽어줘서, 고마워요!",
  },
  "ko-x-busan": {
    eyebrow: "작은 놀이터",
    wish: "오늘도, 즐거운 하루 되이소!",
    thanks: "읽어줘서, 고맙데이!",
    milktea: "밀크티 한 잔, 고맙데이!",
  },
  "ko-x-chungcheong": {
    eyebrow: "작은 놀이터유",
    wish: "오늘도, 즐거운 하루 되셨으면 좋겠어유!",
    thanks: "읽어줘서, 고마워유!",
    milktea: "밀크티 한 잔, 고마워유!",
  },
};

export const LANGS = [
  { key: "en",                label: "en" },
  { key: "ja",                label: "ja" },
  { key: "ja-x-morioka",      label: "盛岡" },
  { key: "ja-x-kansai",       label: "関西" },
  { key: "ja-x-okayama",      label: "岡山" },
  { key: "ja-x-oita",         label: "大分" },
  { key: "ko",                label: "ko" },
  { key: "ko-x-busan",        label: "부산" },
  { key: "ko-x-chungcheong",  label: "충청" },
];

/** BCP47 tag for the <html lang> attribute. Strips private-use subtags. */
export function htmlLang(key) {
  return key.split("-x-")[0];
}

/** Field-level string lookup with fallback: "ja-x-oita" → "ja" → "en" */
export function t(obj, lang) {
  return obj[lang] ?? obj[lang.split("-")[0]] ?? obj["en"];
}

/** Locale object, merging primary → dialect so missing fields fall back */
export function locale(lang) {
  const primary = i18n[lang.split("-")[0]] ?? {};
  const dialect = i18n[lang] ?? {};
  return { ...primary, ...dialect };
}
