// タロット大アルカナ22枚のデータと抽選関数

export interface TarotCard {
  number: number;
  name: string;
  nameEn: string;
  upright: string;
  reversed: string;
  keywords: string[];
  element: string;
}

export interface TarotDraw {
  card: TarotCard;
  isReversed: boolean;
}

export const MAJOR_ARCANA: TarotCard[] = [
  {
    number: 0,
    name: "愚者",
    nameEn: "The Fool",
    upright: "新しい冒険の始まり。自由な精神で未知の世界へ飛び込む時。",
    reversed:
      "無計画さや軽率な行動が裏目に出る。立ち止まって考える必要がある。",
    keywords: ["自由", "冒険", "無邪気", "可能性"],
    element: "風",
  },
  {
    number: 1,
    name: "魔術師",
    nameEn: "The Magician",
    upright: "才能と意志の力で現実を創り出す時。必要な道具は全て揃っている。",
    reversed: "力の空回りや自信過剰。手段と目的を見失っている可能性。",
    keywords: ["創造", "意志", "才能", "実現"],
    element: "水星",
  },
  {
    number: 2,
    name: "女教皇",
    nameEn: "The High Priestess",
    upright: "直感と内なる声に耳を傾ける時。表面に見えない真実がある。",
    reversed: "直感を無視している、または秘密が明るみに出る暗示。",
    keywords: ["直感", "神秘", "内省", "知恵"],
    element: "月",
  },
  {
    number: 3,
    name: "女帝",
    nameEn: "The Empress",
    upright: "豊かさと創造性に満ちた時期。愛情深く周囲を育む力がある。",
    reversed:
      "過保護や依存、創造性の停滞。自分自身を大切にすることを忘れている。",
    keywords: ["豊穣", "母性", "創造", "愛情"],
    element: "金星",
  },
  {
    number: 4,
    name: "皇帝",
    nameEn: "The Emperor",
    upright: "秩序と安定をもたらすリーダーシップ。計画的に物事を進める力。",
    reversed: "支配的・権威的になりすぎている。柔軟性の欠如。",
    keywords: ["権威", "安定", "統率", "秩序"],
    element: "牡羊座",
  },
  {
    number: 5,
    name: "教皇",
    nameEn: "The Hierophant",
    upright: "伝統や教えから学ぶ時。信頼できる指導者や助言者の存在。",
    reversed: "形式主義への反発、または既存の枠組みに囚われすぎている。",
    keywords: ["教え", "伝統", "信仰", "導き"],
    element: "牡牛座",
  },
  {
    number: 6,
    name: "恋人",
    nameEn: "The Lovers",
    upright: "深い絆と調和。重要な選択の時。心に従う決断が幸運を呼ぶ。",
    reversed: "価値観の不一致や優柔不断。自分の本心と向き合う必要がある。",
    keywords: ["愛", "選択", "調和", "絆"],
    element: "双子座",
  },
  {
    number: 7,
    name: "戦車",
    nameEn: "The Chariot",
    upright: "強い意志で困難を突破する時。勝利と前進のエネルギーに満ちている。",
    reversed: "暴走や方向性の喪失。力任せでは解決できない状況。",
    keywords: ["勝利", "前進", "意志", "克服"],
    element: "蟹座",
  },
  {
    number: 8,
    name: "力",
    nameEn: "Strength",
    upright: "内なる強さと忍耐で困難を乗り越える。優しさこそが本当の力。",
    reversed: "自信の喪失や感情のコントロールが難しい時期。自分を信じて。",
    keywords: ["勇気", "忍耐", "内なる力", "克己"],
    element: "獅子座",
  },
  {
    number: 9,
    name: "隠者",
    nameEn: "The Hermit",
    upright: "内省と探求の時。孤独の中で本当に大切なものを見つける。",
    reversed: "孤立しすぎている、または内省を避けている。他者との交流も必要。",
    keywords: ["内省", "探求", "孤独", "智慧"],
    element: "乙女座",
  },
  {
    number: 10,
    name: "運命の輪",
    nameEn: "Wheel of Fortune",
    upright: "運命の転換期。チャンスの波が来ている。流れに乗る時。",
    reversed: "不運な流れや予想外の変化。しかしそれも一時的なもの。",
    keywords: ["転機", "運命", "循環", "チャンス"],
    element: "木星",
  },
  {
    number: 11,
    name: "正義",
    nameEn: "Justice",
    upright: "公正な判断と因果応報。誠実な行動が正しい結果を導く。",
    reversed: "不公平感や偏った判断。客観的に状況を見直す必要がある。",
    keywords: ["公正", "均衡", "真実", "因果"],
    element: "天秤座",
  },
  {
    number: 12,
    name: "吊るされた男",
    nameEn: "The Hanged Man",
    upright: "視点の転換が必要な時。手放すことで新しい理解が得られる。",
    reversed: "無意味な犠牲や停滞。執着を手放せずにいる状態。",
    keywords: ["試練", "犠牲", "転換", "悟り"],
    element: "水",
  },
  {
    number: 13,
    name: "死神",
    nameEn: "Death",
    upright: "終わりと再生。古いものを手放し、新たなステージへ進む時。",
    reversed: "変化への抵抗。終わらせるべきものにしがみついている。",
    keywords: ["終焉", "再生", "変容", "解放"],
    element: "蠍座",
  },
  {
    number: 14,
    name: "節制",
    nameEn: "Temperance",
    upright: "バランスと調和。焦らず穏やかに物事を進めることで成果が出る。",
    reversed: "バランスの崩れや極端な行動。中庸を心がけて。",
    keywords: ["調和", "節度", "融合", "忍耐"],
    element: "射手座",
  },
  {
    number: 15,
    name: "悪魔",
    nameEn: "The Devil",
    upright: "誘惑や執着に囚われている状態。自分を縛る鎖の存在に気づく時。",
    reversed: "束縛からの解放。依存や悪習慣を断ち切る力が芽生えている。",
    keywords: ["誘惑", "束縛", "執着", "欲望"],
    element: "山羊座",
  },
  {
    number: 16,
    name: "塔",
    nameEn: "The Tower",
    upright: "突然の崩壊と解放。偽りの構造が壊れ、真実が露わになる。",
    reversed: "崩壊を恐れて変化を避けている。小さな修正で大きな破綻を防げる。",
    keywords: ["崩壊", "解放", "覚醒", "真実"],
    element: "火星",
  },
  {
    number: 17,
    name: "星",
    nameEn: "The Star",
    upright: "希望と癒しの光。困難の後に訪れる平穏と再生の時。",
    reversed: "希望を見失っている状態。しかし星は雲の上で常に輝いている。",
    keywords: ["希望", "癒し", "インスピレーション", "再生"],
    element: "水瓶座",
  },
  {
    number: 18,
    name: "月",
    nameEn: "The Moon",
    upright: "不安や幻想に惑わされやすい時。直感を信じつつも冷静さを保って。",
    reversed: "混乱が晴れ始めている。恐れていたものの正体が見えてくる。",
    keywords: ["幻想", "不安", "潜在意識", "直感"],
    element: "魚座",
  },
  {
    number: 19,
    name: "太陽",
    nameEn: "The Sun",
    upright: "成功と喜びに満ちた時。生命力が溢れ、すべてが明るく照らされる。",
    reversed: "楽観しすぎている、または喜びを素直に受け取れない状態。",
    keywords: ["成功", "喜び", "活力", "明晰"],
    element: "太陽",
  },
  {
    number: 20,
    name: "審判",
    nameEn: "Judgement",
    upright: "覚醒と再評価の時。過去を振り返り、新たな使命に目覚める。",
    reversed: "過去に囚われている、または決断を先延ばしにしている。",
    keywords: ["覚醒", "復活", "使命", "決断"],
    element: "冥王星",
  },
  {
    number: 21,
    name: "世界",
    nameEn: "The World",
    upright: "完成と達成。一つのサイクルが円満に終わり、次のステージへ。",
    reversed: "完了への抵抗や未完成感。あと一歩の努力が必要。",
    keywords: ["完成", "統合", "達成", "旅の終わり"],
    element: "土星",
  },
];

// crypto.getRandomValues を使った安全な乱数（0 <= x < max）
function secureRandom(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

/**
 * カードをランダムに抽選する（重複なし、暗号学的安全乱数）
 * 各カードは70%の確率で正位置、30%の確率で逆位置
 */
export function drawCards(count: number): TarotDraw[] {
  if (count < 1 || count > MAJOR_ARCANA.length) {
    throw new Error(
      `count は 1〜${MAJOR_ARCANA.length} の範囲で指定してください`,
    );
  }

  // Fisher-Yates シャッフル（crypto乱数）
  const indices = Array.from({ length: MAJOR_ARCANA.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = secureRandom(i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices.slice(0, count).map((index) => ({
    card: MAJOR_ARCANA[index],
    isReversed: secureRandom(10) < 3,
  }));
}

/**
 * 抽選結果をAI向けプロンプトコンテキスト文字列に変換する
 */
export function tarotDrawToPromptContext(draws: TarotDraw[]): string {
  const lines = draws.map((draw, i) => {
    const position = draw.isReversed ? "逆位置" : "正位置";
    const meaning = draw.isReversed ? draw.card.reversed : draw.card.upright;
    const keywords = draw.card.keywords.join("、");
    return `${i + 1}枚目: ${position}「${draw.card.name}」(${draw.card.nameEn}) — ${keywords}\n  意味: ${meaning}`;
  });

  return `【タロット鑑定】\n${lines.join("\n")}`;
}
