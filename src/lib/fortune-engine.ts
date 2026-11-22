// 占術エンジン — 西洋占星術・数秘術・タロット

// ========================================
// 共通型
// ========================================

export type FortuneResult = {
  zodiac: ZodiacResult;
  numerology: NumerologyResult;
  tarot: TarotResult;
};

export type ParsedBirthday = {
  year: number;
  month: number;
  day: number;
};

export type ExtractedBirthday = {
  raw: string;
  parsed: ParsedBirthday;
};

// ========================================
// 西洋占星術（太陽星座）
// ========================================

type ZodiacResult = {
  sign: string;
  signEnglish: string;
  element: string;
  quality: string;
  ruler: string;
  description: string;
  strengths: string;
  weaknesses: string;
};

const ZODIAC_SIGNS: ZodiacResult[] = [
  {
    sign: "牡羊座",
    signEnglish: "Aries",
    element: "火",
    quality: "活動宮",
    ruler: "火星",
    description: "開拓者。情熱的で行動力に溢れる。新しいことを始める天才",
    strengths: "行動力・勇気・リーダーシップ・率直さ",
    weaknesses: "短気・飽きやすい・自分勝手・計画性の欠如",
  },
  {
    sign: "牡牛座",
    signEnglish: "Taurus",
    element: "地",
    quality: "不動宮",
    ruler: "金星",
    description: "堅実家。五感に優れ、美と快楽を愛する。粘り強い現実主義者",
    strengths: "忍耐力・安定感・美的センス・信頼性",
    weaknesses: "頑固・所有欲・変化を嫌う・怠惰な一面",
  },
  {
    sign: "双子座",
    signEnglish: "Gemini",
    element: "風",
    quality: "柔軟宮",
    ruler: "水星",
    description: "知識の探求者。好奇心旺盛で多才。コミュニケーションの達人",
    strengths: "知性・適応力・社交性・多芸多才",
    weaknesses: "移り気・表面的・二面性・集中力の欠如",
  },
  {
    sign: "蟹座",
    signEnglish: "Cancer",
    element: "水",
    quality: "活動宮",
    ruler: "月",
    description: "守護者。深い感情と強い直感を持つ。家庭と仲間を大切にする",
    strengths: "共感力・直感・保護本能・記憶力",
    weaknesses: "過敏・過保護・被害妄想・過去への執着",
  },
  {
    sign: "獅子座",
    signEnglish: "Leo",
    element: "火",
    quality: "不動宮",
    ruler: "太陽",
    description: "王者。自信と創造性に溢れる。人を惹きつける華やかさを持つ",
    strengths: "カリスマ性・創造力・寛大さ・自信",
    weaknesses: "傲慢・承認欲求・支配的・プライドの高さ",
  },
  {
    sign: "乙女座",
    signEnglish: "Virgo",
    element: "地",
    quality: "柔軟宮",
    ruler: "水星",
    description: "分析家。細部に目が行き届く完璧主義者。実務能力が極めて高い",
    strengths: "分析力・正確さ・勤勉さ・奉仕精神",
    weaknesses: "批判的・神経質・心配性・自己犠牲過多",
  },
  {
    sign: "天秤座",
    signEnglish: "Libra",
    element: "風",
    quality: "活動宮",
    ruler: "金星",
    description: "調和の使者。美と公平を愛する外交官。人間関係のバランサー",
    strengths: "公平さ・外交力・美的センス・協調性",
    weaknesses: "優柔不断・八方美人・対立回避・依存的",
  },
  {
    sign: "蠍座",
    signEnglish: "Scorpio",
    element: "水",
    quality: "不動宮",
    ruler: "冥王星",
    description: "変容者。深い洞察力と強烈な意志を持つ。本質を見抜く目を持つ",
    strengths: "洞察力・集中力・意志力・変容力",
    weaknesses: "嫉妬・執念深い・秘密主義・極端な思考",
  },
  {
    sign: "射手座",
    signEnglish: "Sagittarius",
    element: "火",
    quality: "柔軟宮",
    ruler: "木星",
    description: "冒険者。自由と真理を求めて旅する哲学者。楽観的で大胆",
    strengths: "楽観性・冒険心・哲学的思考・寛容さ",
    weaknesses: "無責任・大雑把・約束を守らない・配慮不足",
  },
  {
    sign: "山羊座",
    signEnglish: "Capricorn",
    element: "地",
    quality: "活動宮",
    ruler: "土星",
    description: "建設者。野心と忍耐で高みを目指す。社会的成功への強い意志",
    strengths: "野心・忍耐力・責任感・戦略的思考",
    weaknesses: "冷酷・仕事中毒・悲観的・感情の抑圧",
  },
  {
    sign: "水瓶座",
    signEnglish: "Aquarius",
    element: "風",
    quality: "不動宮",
    ruler: "天王星",
    description: "革命家。独自の視点で未来を見る。人類全体の幸福を考える知性派",
    strengths: "独創性・人道主義・知性・先見性",
    weaknesses: "変わり者・冷淡・反抗的・感情的な距離",
  },
  {
    sign: "魚座",
    signEnglish: "Pisces",
    element: "水",
    quality: "柔軟宮",
    ruler: "海王星",
    description: "夢見る者。深い共感力と想像力を持つ。境界を超えて人と繋がる",
    strengths: "共感力・想像力・直感・芸術的才能",
    weaknesses: "現実逃避・優柔不断・依存的・自己犠牲",
  },
];

const ZODIAC_RANGES: [number, number, number][] = [
  [1, 20, 10],
  [2, 19, 11],
  [3, 21, 0],
  [4, 20, 1],
  [5, 21, 2],
  [6, 21, 3],
  [7, 23, 4],
  [8, 23, 5],
  [9, 23, 6],
  [10, 23, 7],
  [11, 22, 8],
  [12, 22, 9],
];

function calculateZodiac(month: number, day: number): ZodiacResult {
  for (let i = ZODIAC_RANGES.length - 1; i >= 0; i--) {
    const [m, d, idx] = ZODIAC_RANGES[i];
    if (month > m || (month === m && day >= d)) {
      return ZODIAC_SIGNS[idx];
    }
  }
  return ZODIAC_SIGNS[9];
}

// ========================================
// 数秘術
// ========================================

type NumerologyResult = {
  lifePath: number;
  personalYear: number;
  description: string;
  personalYearDescription: string;
};

function reduceToSingleDigit(n: number): number {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n)
      .split("")
      .reduce((sum, d) => sum + parseInt(d), 0);
  }
  return n;
}

const LIFE_PATH_DESCRIPTIONS: Record<number, string> = {
  1: "独立と創造の数。リーダーシップが強く、自分の道を切り開く。依存を嫌い、先駆者として新しいものを生み出す使命",
  2: "調和と協力の数。繊細で直感的。人と人を結ぶ架け橋。パートナーシップの中で真価を発揮する",
  3: "表現と創造の数。コミュニケーション能力が高く、芸術的才能がある。楽観的で人を楽しませる天才",
  4: "安定と建設の数。実務能力が極めて高い。コツコツと積み上げる力。土台を作る人。計画と実行のプロ",
  5: "自由と変化の数。冒険心が強く、束縛を嫌う。多才で適応力がある。経験から学ぶ人生",
  6: "愛と責任の数。家庭と調和を大切にする。面倒見がよく、教育者・カウンセラーの素質。美的センスも高い",
  7: "探究と内省の数。深い知性と精神性。分析力が鋭く、真理を追求する。一人の時間が必要な人",
  8: "力と成功の数。ビジネスセンスが抜群。物質世界での成功を掴む力。権威と影響力を持つ運命",
  9: "完成と奉仕の数。広い視野と深い共感力。人道主義的で、世界をより良くしたい理想家。手放す力",
  11: "マスターナンバー。高い直感力と霊的感受性。インスピレーションで人を導く使命。繊細すぎる面も",
  22: "マスターナンバー。壮大なビジョンを現実にする力。安定と直感を併せ持つ。偉大な建設者",
  33: "マスターナンバー。愛と奉仕の最高形。愛情と霊性を統合。人類への深い慈悲を持つ",
};

const PERSONAL_YEAR_DESCRIPTIONS: Record<number, string> = {
  1: "始まりの年。新しいことを始める絶好のタイミング。種を蒔く時期。自己主張を強めて",
  2: "忍耐の年。前年に蒔いた種を育てる時期。協力と調整。焦らず信頼関係を深めて",
  3: "開花の年。自己表現と社交が花開く。クリエイティブな活動が成果を生む。人脈拡大",
  4: "建設の年。土台固め。地道な努力が試される。健康管理と計画性が大切。焦り禁物",
  5: "変化の年。予想外の転機が来る。自由と冒険。新しい経験に飛び込む勇気を",
  6: "責任の年。家庭と人間関係が中心テーマ。愛と奉仕。他者のために動く年",
  7: "内省の年。一人の時間が必要。学びと精神的成長。表面的なものから離れて深く潜る",
  8: "収穫の年。これまでの努力が実を結ぶ。財運・地位向上。ビジネスの大きな飛躍",
  9: "完了の年。手放しと浄化。終わるべきものを終わらせる。次のサイクルへの準備",
};

function calculateNumerology(
  year: number,
  month: number,
  day: number,
): NumerologyResult {
  const lifePath = reduceToSingleDigit(
    reduceToSingleDigit(year) +
      reduceToSingleDigit(month) +
      reduceToSingleDigit(day),
  );

  const currentYear = new Date().getFullYear();
  const personalYear = reduceToSingleDigit(
    reduceToSingleDigit(currentYear) +
      reduceToSingleDigit(month) +
      reduceToSingleDigit(day),
  );
  const pyReduced = reduceToSingleDigit(personalYear);

  return {
    lifePath,
    personalYear: pyReduced,
    description:
      LIFE_PATH_DESCRIPTIONS[lifePath] ||
      LIFE_PATH_DESCRIPTIONS[reduceToSingleDigit(lifePath)] ||
      "",
    personalYearDescription: PERSONAL_YEAR_DESCRIPTIONS[pyReduced] || "",
  };
}

// ========================================
// タロット（大アルカナ）
// ========================================

type TarotCard = {
  number: number;
  name: string;
  nameEnglish: string;
  upright: string;
  reversed: string;
  description: string;
};

export type TarotResult = {
  past: { card: TarotCard; isReversed: boolean };
  present: { card: TarotCard; isReversed: boolean };
  future: { card: TarotCard; isReversed: boolean };
};

const MAJOR_ARCANA: TarotCard[] = [
  {
    number: 0,
    name: "愚者",
    nameEnglish: "The Fool",
    upright: "自由・冒険・無限の可能性・純粋さ",
    reversed: "無謀・無計画・現実逃避",
    description: "すべての始まり。何も持たず、崖の先へ一歩踏み出す勇気",
  },
  {
    number: 1,
    name: "魔術師",
    nameEnglish: "The Magician",
    upright: "創造力・意志・スキル・自信",
    reversed: "技術の悪用・自信過剰・詐欺",
    description: "天と地を繋ぐ者。あなたの中にある力を使いこなす時",
  },
  {
    number: 2,
    name: "女教皇",
    nameEnglish: "The High Priestess",
    upright: "直感・神秘・内なる声・静寂",
    reversed: "直感の無視・秘密・表面的",
    description: "ヴェールの向こう側を見る目。静けさの中に答えがある",
  },
  {
    number: 3,
    name: "女帝",
    nameEnglish: "The Empress",
    upright: "豊穣・母性・創造・美",
    reversed: "過保護・依存・創造の停滞",
    description: "生命を育む力。あなたの中の創造性が花開く時",
  },
  {
    number: 4,
    name: "皇帝",
    nameEnglish: "The Emperor",
    upright: "権威・構造・安定・リーダーシップ",
    reversed: "支配・頑固・柔軟性の欠如",
    description: "秩序と構造の力。基盤を築き、守る者",
  },
  {
    number: 5,
    name: "教皇",
    nameEnglish: "The Hierophant",
    upright: "伝統・教え・信仰・導き",
    reversed: "型破り・自由思考・権威への反発",
    description: "知恵の伝承者。先人の教えの中に今の答えがある",
  },
  {
    number: 6,
    name: "恋人たち",
    nameEnglish: "The Lovers",
    upright: "愛・選択・調和・価値観の一致",
    reversed: "不調和・誤った選択・価値観の衝突",
    description: "二つの道の前に立つ。心が本当に求めるものを選ぶ時",
  },
  {
    number: 7,
    name: "戦車",
    nameEnglish: "The Chariot",
    upright: "勝利・意志・前進・克服",
    reversed: "暴走・方向喪失・自制の欠如",
    description: "相反する力を御して進む。困難を乗り越える強い意志",
  },
  {
    number: 8,
    name: "力",
    nameEnglish: "Strength",
    upright: "内なる力・忍耐・勇気・優しさ",
    reversed: "自己不信・弱さ・暴力的",
    description: "獅子を撫でる乙女。本当の強さは穏やかさの中にある",
  },
  {
    number: 9,
    name: "隠者",
    nameEnglish: "The Hermit",
    upright: "内省・探求・孤独・知恵",
    reversed: "孤立・引きこもり・偏屈",
    description: "灯りを持つ老人。一人の時間が真実を照らす",
  },
  {
    number: 10,
    name: "運命の輪",
    nameEnglish: "Wheel of Fortune",
    upright: "転機・幸運・循環・運命の変化",
    reversed: "不運・停滞・悪い循環",
    description: "すべては巡る。上がれば下がり、下がればまた上がる",
  },
  {
    number: 11,
    name: "正義",
    nameEnglish: "Justice",
    upright: "公正・真実・因果・バランス",
    reversed: "不公正・偏見・責任回避",
    description: "天秤を持つ者。行いは必ず返ってくる",
  },
  {
    number: 12,
    name: "吊るされた男",
    nameEnglish: "The Hanged Man",
    upright: "視点の転換・犠牲・手放し・悟り",
    reversed: "執着・犠牲の拒否・停滞",
    description: "逆さまの世界。手放すことで見える新しい景色",
  },
  {
    number: 13,
    name: "死神",
    nameEnglish: "Death",
    upright: "終わりと始まり・変容・再生",
    reversed: "変化への抵抗・停滞・恐れ",
    description: "終わりは始まり。古いものが去り、新しいものが来る",
  },
  {
    number: 14,
    name: "節制",
    nameEnglish: "Temperance",
    upright: "調和・バランス・忍耐・癒し",
    reversed: "不均衡・焦り・過剰",
    description: "二つの器の間を流れる水。調和とバランスの天使",
  },
  {
    number: 15,
    name: "悪魔",
    nameEnglish: "The Devil",
    upright: "束縛・誘惑・執着・影の自分",
    reversed: "解放・覚醒・鎖を断ち切る",
    description: "鎖は自分で外せる。あなたを縛っているものは何か",
  },
  {
    number: 16,
    name: "塔",
    nameEnglish: "The Tower",
    upright: "崩壊・衝撃・目覚め・解放",
    reversed: "崩壊の回避・変化への恐れ",
    description: "雷に打たれる塔。崩れた後にこそ真実の土台が見える",
  },
  {
    number: 17,
    name: "星",
    nameEnglish: "The Star",
    upright: "希望・インスピレーション・癒し・導き",
    reversed: "絶望・信仰の喪失・失望",
    description: "嵐の後の星空。希望の光は必ずある",
  },
  {
    number: 18,
    name: "月",
    nameEnglish: "The Moon",
    upright: "幻想・不安・直感・潜在意識",
    reversed: "幻想からの覚醒・恐れの克服",
    description: "月明かりの道。不安の中にも直感が導いてくれる",
  },
  {
    number: 19,
    name: "太陽",
    nameEnglish: "The Sun",
    upright: "成功・喜び・活力・明晰さ",
    reversed: "自信過剰・楽観しすぎ",
    description: "すべてを照らす太陽。あなたの中の光が輝く時",
  },
  {
    number: 20,
    name: "審判",
    nameEnglish: "Judgement",
    upright: "再生・覚醒・赦し・天命",
    reversed: "後悔・自己批判・判断の先延ばし",
    description: "天使のラッパが鳴る。過去を赦し、本来の使命に目覚める",
  },
  {
    number: 21,
    name: "世界",
    nameEnglish: "The World",
    upright: "完成・達成・統合・新たな旅立ち",
    reversed: "未完成・中途半端・達成感の欠如",
    description: "すべてが一つに繋がる。一つの旅の完成と次の始まり",
  },
];

// セッションIDベースの擬似ランダム（同じセッションでは同じカード）
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b) + 0x1) | 0;
    h = (Math.imul(h ^ (h >>> 13), 0x45d9f3b) + 0x1) | 0;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 0xffffffff;
  };
}

function drawTarot(sessionSeed: string): TarotResult {
  const rng = seededRandom(sessionSeed);

  // 22枚からランダムに3枚（重複なし）
  const deck = [...Array(22).keys()];
  const drawn: number[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(rng() * deck.length);
    drawn.push(deck[idx]);
    deck.splice(idx, 1);
  }

  return {
    past: { card: MAJOR_ARCANA[drawn[0]], isReversed: rng() < 0.5 },
    present: { card: MAJOR_ARCANA[drawn[1]], isReversed: rng() < 0.5 },
    future: { card: MAJOR_ARCANA[drawn[2]], isReversed: rng() < 0.5 },
  };
}

// ========================================
// 統合: 生年月日から全占術結果を生成
// ========================================

export function calculateAllFortunes(
  birthday: string,
  sessionId?: string,
): FortuneResult | null;
export function calculateAllFortunes(
  birthday: ParsedBirthday,
  sessionId?: string,
): FortuneResult | null;
export function calculateAllFortunes(
  birthday: string | ParsedBirthday,
  sessionId?: string,
): FortuneResult | null {
  const parsed =
    typeof birthday === "string" ? parseBirthday(birthday) : birthday;
  if (!parsed) return null;

  const { year, month, day } = parsed;
  if (!isValidDate(year, month, day)) return null;

  return {
    zodiac: calculateZodiac(month, day),
    numerology: calculateNumerology(year, month, day),
    tarot: drawTarot(sessionId || `${year}-${month}-${day}`),
  };
}

// 全角数字・全角記号を半角に正規化
function normalizeInput(input: string): string {
  return input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[／－]/g, (c) => (c === "／" ? "/" : "-"))
    .replace(/[、，]/g, " ");
}

// 生年月日のパース（様々な形式に対応）
function parseBirthday(input: string): ParsedBirthday | null {
  const s = normalizeInput(input);

  // 口語パターン1: 月日が先・年が後（例: 5月15日生まれ、1990年）
  const oral1 = s.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日[^\d]*(\d{4})\s*年/);
  if (oral1) {
    const year = parseInt(oral1[3]);
    const month = parseInt(oral1[1]);
    const day = parseInt(oral1[2]);
    if (isValidDate(year, month, day)) return { year, month, day };
  }

  // 口語パターン2: 年が先・月日が後（例: 1990年生まれ、5月15日）
  const oral2 = s.match(/(\d{4})\s*年[^\d]*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (oral2) {
    const year = parseInt(oral2[1]);
    const month = parseInt(oral2[2]);
    const day = parseInt(oral2[3]);
    if (isValidDate(year, month, day)) return { year, month, day };
  }

  // 口語パターン3: スラッシュ月日＋年が後（例: 5/15、1990年生まれ）
  const oral3 = s.match(/(\d{1,2})\/(\d{1,2})[^\d]*(\d{4})\s*年/);
  if (oral3) {
    const year = parseInt(oral3[3]);
    const month = parseInt(oral3[1]);
    const day = parseInt(oral3[2]);
    if (isValidDate(year, month, day)) return { year, month, day };
  }

  let match = s.match(
    /(\d{4})\s*[年\/\-\.]\s*(\d{1,2})\s*[月\/\-\.]\s*(\d{1,2})/,
  );
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    if (!isValidDate(year, month, day)) return null;
    return { year, month, day };
  }

  match = s.match(/(\d{4})(\d{2})(\d{2})/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    if (!isValidDate(year, month, day)) return null;
    return { year, month, day };
  }

  match = s.match(
    /([MTSHR]|明治|大正|昭和|平成|令和)\s*(\d{1,2}|元)\s*[年\.\/]\s*(\d{1,2})\s*[月\.\/]\s*(\d{1,2})/i,
  );
  if (match) {
    const eraOffsets: Record<string, number> = {
      M: 1867,
      明治: 1867,
      T: 1911,
      大正: 1911,
      S: 1925,
      昭和: 1925,
      H: 1988,
      平成: 1988,
      R: 2018,
      令和: 2018,
    };
    const offset = eraOffsets[match[1].toUpperCase()] || eraOffsets[match[1]];
    if (offset) {
      const eraYear = match[2] === "元" ? 1 : parseInt(match[2]);
      const year = offset + eraYear;
      const month = parseInt(match[3]);
      const day = parseInt(match[4]);
      if (!isValidDate(year, month, day)) return null;
      return { year, month, day };
    }
  }

  return null;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

// 占術結果をプロンプト注入用テキストに変換
/**
 * 占術結果をプロンプト用の文字列にする。
 *
 * includeTarot: 本エンジンが sessionId から独自に引いた三枚引きを含めるか。
 * 相談者が画面で実際に見るカードは tarot.ts の drawCards で引かれた別の 3 枚なので、
 * 鑑定プロンプトへ載せる時は false にする。両方載せると「画面で見たカード」と
 * 「鑑定の根拠になるカード」が食い違う (2026-07-28 にプロンプトを実出力して発見)。
 * 既定は true (エンジン単体の出力仕様を変えないため)。
 */
export function fortuneResultToPromptContext(
  result: FortuneResult,
  options: { includeTarot?: boolean } = {},
): string {
  const { includeTarot = true } = options;
  const { zodiac: z, numerology: n, tarot: t } = result;

  const formatCard = (
    pos: string,
    draw: { card: TarotCard; isReversed: boolean },
  ) => {
    const dir = draw.isReversed ? "逆位置" : "正位置";
    const meaning = draw.isReversed ? draw.card.reversed : draw.card.upright;
    return `${pos}: ${draw.card.name}（${draw.card.nameEnglish}）— ${dir}\n  意味: ${meaning}\n  象徴: ${draw.card.description}`;
  };

  const tarotSection = includeTarot
    ? `
【タロット — 三枚引き】
${formatCard("過去", t.past)}
${formatCard("現在", t.present)}
${formatCard("未来", t.future)}
`
    : "";

  return `
=== 占術計算結果（サーバー側で実計算済み。これを根拠として使うこと） ===

【西洋占星術】
太陽星座: ${z.sign}（${z.signEnglish}）
エレメント: ${z.element} / ${z.quality}
守護星: ${z.ruler}
性質: ${z.description}
強み: ${z.strengths}
弱み: ${z.weaknesses}

【数秘術】
ライフパスナンバー: ${n.lifePath}
意味: ${n.description}
パーソナルイヤー（今年）: ${n.personalYear}
今年の流れ: ${n.personalYearDescription}
${tarotSection}
=== 注意: 上記は実計算結果。鑑定ではこのデータを正確に引用し、相談者の状況と組み合わせて解釈すること ===
`.trim();
}

// メッセージ履歴から生年月日を抽出
function extractBirthdayFromMessage(content: string): ExtractedBirthday | null {
  const parsed = parseBirthday(content);
  if (!parsed) return null;

  const match = content.match(
    /(\d{4}\s*[年\/\-]\s*\d{1,2}\s*[月\/\-]\s*\d{1,2})\s*日?/,
  );
  if (match) return { raw: match[0], parsed };

  const match2 = content.match(/(\d{8})/);
  if (match2) return { raw: match2[0], parsed };

  const match3 = content.match(
    /([MTSHR]|明治|大正|昭和|平成|令和)\s*\d{1,2}\s*[年\.\/]\s*\d{1,2}\s*[月\.\/]\s*\d{1,2}/i,
  );
  if (match3) return { raw: match3[0], parsed };

  return {
    raw: `${parsed.year}年${parsed.month}月${parsed.day}日`,
    parsed,
  };
}

export function extractBirthdayInfoFromMessages(
  messages: { role: string; content: string }[],
): ExtractedBirthday | null {
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const extracted = extractBirthdayFromMessage(msg.content);
    if (extracted) return extracted;
  }
  return null;
}

export function extractBirthdayFromMessages(
  messages: { role: string; content: string }[],
): string | null {
  return extractBirthdayInfoFromMessages(messages)?.raw ?? null;
}
