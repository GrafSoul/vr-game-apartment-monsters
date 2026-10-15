import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const THUMBS = join(ROOT, 'thumbs');
const img = (key) => 'data:image/jpeg;base64,' + readFileSync(join(THUMBS, key + '.jpg')).toString('base64');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sf = (uid) => `https://sketchfab.com/3d-models/${uid}`;

// style keys: A = тёмный реализм, B = неон-тех, C = мультяшный
const STYLE_NAME = { A: 'Стиль A', B: 'Стиль B', C: 'Стиль C', AB: 'Стиль A / B', BC: 'Стиль B / C' };

const groups = [
  {
    id: 'blasters', title: 'Бластеры', hint: 'Бластер всегда у тебя перед глазами, поэтому ему можно больше полигонов и деталей, чем тварям.',
    items: [
      { key: '863482cf4d384e49a403b2963c7e7f8f', name: 'Prototype Pistol', by: 'vaportrash', src: 'Sketchfab', lic: 'by', faces: 26695, anims: 0, style: 'A', url: sf('863482cf4d384e49a403b2963c7e7f8f'),
        note: 'Самый «дорогой» вид из найденного: детальный, в духе киберпанка, с проводами и наклейками. Полигоны в норме для оружия в руке.' },
      { key: 'bf6f4924beeb434ca5c88fe5c8e10612', name: 'Blaster concept', by: 'futaba_blender', src: 'Sketchfab', lic: 'by', faces: 11155, anims: 0, style: 'AB', url: sf('bf6f4924beeb434ca5c88fe5c8e10612'),
        note: 'Чистые формы, почти настоящий пистолет в sci-fi окраске. Легко перекрасить под общую палитру и добавить светящийся эмиттер.' },
      { key: 'aa779b2389014dd7a7e930742b3e07ea', name: 'Cyberpunk Handblaster', by: 'leoskateman', src: 'Sketchfab', lic: 'by', faces: 1382, anims: 0, style: 'B', url: sf('aa779b2389014dd7a7e930742b3e07ea'),
        note: 'Почти ничего не весит. У глаз может показаться простоватым: проверим в шлеме, если понравится силуэт.' },
      { key: '2a0fff244c494c8e895046afeba4077b', name: 'Sci-fi LaserGun (GameReady)', by: 'alihaghshenas821', src: 'Sketchfab', lic: 'by', faces: 3799, anims: 0, style: 'B', url: sf('2a0fff244c494c8e895046afeba4077b'),
        note: 'Длинный, ближе к винтовке. Одной рукой его держать неестественно. Годится как тяжёлое оружие, которое открывается позже.' },
      { key: '648847589fec4ecc9b91d7cdcc9c4d84', name: 'Sci-fi rifle M13-Gaus', by: 'irons', src: 'Sketchfab', lic: 'by', faces: 13318, anims: 1, style: 'A', url: sf('648847589fec4ecc9b91d7cdcc9c4d84'),
        note: 'Рельсотрон на две руки. Вариант для второго оружия: левая рука подхватывает ствол, и это отдельное удовольствие в VR.' },
      { key: 'kenney_blaster', name: 'Blaster Kit 2.1 (40 файлов)', by: 'Kenney', src: 'kenney.nl', lic: 'cc0', faces: null, anims: null, style: 'C', url: 'https://kenney.nl/assets/blaster-kit',
        note: 'Набор бластеров, мишеней и гранат в одном игрушечном стиле. Есть анимации и варианты расцветки. Выглядит как Nerf, а не как оружие охотника.' },
      { key: 'q_modularscifiguns', name: 'Sci-Fi Modular Gun Pack (78 моделей)', by: 'Quaternius', src: 'quaternius.com', lic: 'cc0', faces: null, anims: null, style: 'BC', url: 'https://quaternius.com/packs/scifimodularguns.html',
        note: 'Оружие из модулей: ствол, корпус, прицел собираются отдельно. Пригодится для апгрейдов, которые видно на самом бластере. Есть glTF.' },
    ]
  },
  {
    id: 'drones', title: 'Дроны и роботы', hint: 'Летающим врагам почти не нужна скелетная анимация: полёт, рывки и развороты я задаю кодом.',
    items: [
      { key: '294e79652f494130ad2ab00a13fdbafd', name: 'Buster Drone', by: 'lavadragon', src: 'Sketchfab', lic: 'by', faces: 16780, anims: 1, style: 'A', url: sf('294e79652f494130ad2ab00a13fdbafd'),
        note: 'Один из самых популярных дронов на Sketchfab: больше 2 600 лайков. Летает на роторах и садится на лапы. Эталон качества для элитного врага.' },
      { key: '3dbf07385d1b471a96dce6de6cba97d6', name: 'Sci-Fi Camera Drone', by: '3dsofsan', src: 'Sketchfab', lic: 'by', faces: 5370, anims: 1, style: 'B', url: sf('3dbf07385d1b471a96dce6de6cba97d6'),
        note: 'Кольцо со светящимся глазом. Силуэт читается с любого угла, и свечение работает на фоне комнаты. Хороший рядовой враг.' },
      { key: 'dd21953e81a24bd385d16eaf0c6a8ae7', name: 'Scifi Drone 1.1', by: 'Jj.Mmhh', src: 'Sketchfab', lic: 'by', faces: 8512, anims: 5, style: 'B', url: sf('dd21953e81a24bd385d16eaf0c6a8ae7'),
        note: 'Шар-разведчик с пятью анимациями, редкость среди бесплатных. Подходит для стаи, которая окружает игрока.' },
      { key: 'c7e12dcc8f4d417f92c46767eb13a27a', name: 'Free Stylized Sci-Fi Scout Bot', by: 'polyone', src: 'Sketchfab', lic: 'by', faces: 4557, anims: 1, style: 'C', url: sf('c7e12dcc8f4d417f92c46767eb13a27a'),
        note: 'Милый и чистый, но скорее помощник, чем враг. Подойдёт, если в игре будет дрон-напарник.' },
      { key: 'q_animatedmech', name: 'Animated Mech Pack (4 меха)', by: 'Quaternius', src: 'quaternius.com', lic: 'cc0', faces: null, anims: null, style: 'BC', url: 'https://quaternius.com/packs/animatedmech.html',
        note: 'Шагающие мехи с анимациями, CC0 и glTF. В комнате они будут ростом с кошку: тяжёлые наземные враги.' },
      { key: 'q_scifiessentialskit', name: 'Sci-Fi Essentials Kit (65 моделей)', by: 'Quaternius', src: 'quaternius.com', lic: 'cc0', faces: null, anims: null, style: 'BC', url: 'https://quaternius.com/packs/scifiessentialskit.html',
        note: 'Роботы-враги с анимациями, оружие, экраны, ящики. Бесплатно примерно 60–70% набора, остальное за Patreon.' },
    ]
  },
  {
    id: 'creatures', title: 'Твари', hint: 'Самая трудная категория: органике нужно много анимаций. Тени из шейдеров, как в сцене наверху, закрывают её без моделей.',
    items: [
      { key: 'a812fc8bcd294e2392115b61868a0f15', name: 'Subject 7', by: 'legitbanana', src: 'Sketchfab', lic: 'by', faces: 20635, anims: 1, style: 'A', url: sf('a812fc8bcd294e2392115b61868a0f15'),
        note: 'Крупная хищная тварь, выглядит серьёзно. Анимация одна, остальные четыре придётся добирать. Кандидат в босса, который пролезает сквозь стену.' },
      { key: 'b458af2e4e6f4c61849ad4e1d69e89b1', name: 'Eyebeast — Animated', by: 'nodoxi', src: 'Sketchfab', lic: 'by', faces: 9298, anims: 1, style: 'A', url: sf('b458af2e4e6f4c61849ad4e1d69e89b1'),
        note: 'Летающая голова-нарост, жутковатая и лёгкая. Раз она летает, движение задаю кодом, а смерть закрывает растворение.' },
      { key: 'd332cac883f54a2c98492e85f41455b2', name: 'Alien Ninja Creature', by: 'jungle_jim', src: 'Sketchfab', lic: 'by', faces: 49976, anims: 40, style: 'A', url: sf('d332cac883f54a2c98492e85f41455b2'),
        note: '40 анимаций, что для бесплатной модели очень много. Но 50 тысяч полигонов, упрощать вдвое. И проверить, не слишком ли похож на Чужого из кино.' },
      { key: '987f25f88e814853ad0e8b28141d9fc9', name: 'Hexapod Robot', by: 'dartuchiwa', src: 'Sketchfab', lic: 'by', faces: 4124, anims: 2, style: 'B', url: sf('987f25f88e814853ad0e8b28141d9fc9'),
        note: 'Шестиногий робот с оранжевым свечением, лучший кандидат для неон-теха. Ползает по полу и стенам комнаты, лёгкий.' },
      { key: '7ea58c2e0e7e48f281d7a840f02aa7b1', name: 'Spider Robot', by: 'muhmdhsn313', src: 'Sketchfab', lic: 'by', faces: 7848, anims: 5, style: 'B', url: sf('7ea58c2e0e7e48f281d7a840f02aa7b1'),
        note: 'Маленький паук с пятью анимациями. Мелочь, которая выскакивает из-под дивана стаями.' },
      { key: '6774448b48f1482bbbc8b089a6421a56', name: 'Qu-Inspired Flying Creature', by: 'yadrielpitu', src: 'Sketchfab', lic: 'by', faces: 5079, anims: 6, style: 'A', url: sf('6774448b48f1482bbbc8b089a6421a56'),
        note: 'Тонкое летающее насекомое, шесть анимаций. В названии «inspired», значит дизайн чужой: перед использованием проверить источник.' },
      { key: 'e861b61c5b60451fbfed9422df8124e7', name: 'Azure Leviathan', by: 'Alx_Olotl', src: 'Sketchfab', lic: 'by', faces: 624, anims: 1, style: 'B', url: sf('e861b61c5b60451fbfed9422df8124e7'),
        note: 'Светящийся летающий змей из 600 полигонов. Как фоновая тварь, что плавает под потолком, пока ты занят дронами.' },
      { key: 'q_ultimatemonsters', name: 'Ultimate Monsters (50 моделей)', by: 'Quaternius', src: 'quaternius.com', lic: 'cc0', faces: null, anims: null, style: 'C', url: 'https://quaternius.com/packs/ultimatemonsters.html',
        note: '50 анимированных монстров, CC0, glTF. Цельный набор, но мультяшный: в твоей комнате они будут выглядеть как игрушки.' },
      { key: 'q_animatedalien', name: 'Animated Alien Pack (2 модели)', by: 'Quaternius', src: 'quaternius.com', lic: 'cc0', faces: null, anims: null, style: 'C', url: 'https://quaternius.com/packs/animatedalien.html',
        note: 'Два мультяшных пришельца с анимациями. Показываю для полноты: для охоты слишком добрые.' },
    ]
  },
  {
    id: 'gear', title: 'Гранаты', hint: 'Гранату ты держишь в руке и бросаешь, поэтому её разглядываешь вблизи, как бластер.',
    items: [
      { key: 'c71439ebd823432683e5b125d5c24840', name: 'Set of grenades (Plasma, Flame, AP)', by: 'curichenkow', src: 'Sketchfab', lic: 'by', faces: 16120, anims: 0, style: 'A', url: sf('c71439ebd823432683e5b125d5c24840'),
        note: 'Три гранаты в одном наборе: плазменная, огненная, бронебойная. Готовые три типа гранат для арсенала, со светящимися капсулами.' },
    ]
  },
];

function budget(f) {
  if (f == null) return '';
  if (f <= 10000) return `<span class="chip light">лёгкая</span>`;
  if (f <= 30000) return `<span class="chip mid">в бюджете</span>`;
  return `<span class="chip heavy">упростить ×${Math.ceil(f / 25000)}</span>`;
}
const k = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + ' тыс.' : String(n));
const animWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'анимация' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'анимации' : 'анимаций');

function card(it) {
  const chips = [
    it.lic === 'cc0' ? '<span class="chip cc0">CC0</span>' : '<span class="chip ccby">CC-BY</span>',
    it.faces != null ? `<span class="chip">${k(it.faces)} треуг.</span>` : '<span class="chip">пак</span>',
    it.anims != null ? `<span class="chip">${it.anims ? it.anims + ' ' + animWord(it.anims) : 'без анимаций'}</span>` : '',
    budget(it.faces),
  ].filter(Boolean).join('');
  return `<article class="card" data-id="${esc(it.key)}" data-label="${esc(it.name + ' (' + it.by + ')')}" data-url="${esc(it.url)}">
  <div class="thumb"><img src="${img(it.key)}" alt="${esc(it.name)}" loading="lazy" decoding="async" width="480" height="270"><span class="st">${STYLE_NAME[it.style]}</span></div>
  <div class="card-body">
    <h4>${esc(it.name)}</h4>
    <p class="by">${esc(it.by)} · ${esc(it.src)}</p>
    <div class="chips">${chips}</div>
    <p class="note">${esc(it.note)}</p>
    <div class="card-foot"><button type="button" class="fav-btn" aria-pressed="false">нравится</button><a href="${esc(it.url)}" target="_blank" rel="noopener">Открыть ↗</a></div>
  </div>
</article>`;
}

const cards = groups.map((g) => `<div class="group" id="${g.id}">
  <div class="group-head"><h3>${esc(g.title)}</h3><p>${esc(g.hint)}</p></div>
  <div class="cards">${g.items.map(card).join('\n')}</div>
</div>`).join('\n');

const styles = [
  { cls: '', title: 'A. Тёмный реализм', imgs: ['863482cf4d384e49a403b2963c7e7f8f', '294e79652f494130ad2ab00a13fdbafd', 'a812fc8bcd294e2392115b61868a0f15'],
    sum: 'Модели с PBR-текстурами со Sketchfab: детальный металл, мясо, грязь.',
    plus: ['Вблизи выглядит дороже всего, особенно бластер в руке.', 'Самая взрослая и жуткая атмосфера.'],
    minus: ['Модели разных авторов не совпадают по манере, и сильнее всего это видно в этом стиле.', 'У тварей по одной анимации, а нужно пять.', 'Тяжелее для Quest и требует титров (CC-BY).'] },
  { cls: 'pick', badge: 'рекомендую', title: 'B. Неон-тех', imgs: ['987f25f88e814853ad0e8b28141d9fc9', '3dbf07385d1b471a96dce6de6cba97d6', 'e861b61c5b60451fbfed9422df8124e7'],
    sum: 'Тёмные формы и свечение, тени-твари из шейдеров. Сцена наверху сделана в этом стиле.',
    plus: ['Свечение лучше всего читается поверх реальной комнаты.', 'Разнобой авторов прячется: я перекрашиваю всё в одну палитру.', 'Модели лёгкие, тени не требуют моделей вообще.'],
    minus: ['Меньше органики и «мяса».', 'Материалы и эффекты приходится делать самому, но это код, а не рисование.'] },
  { cls: '', title: 'C. Мультяшный', imgs: ['q_ultimatemonsters', 'kenney_blaster', 'q_animatedmech'],
    sum: 'Паки Kenney и Quaternius под CC0: всё в одном стиле, с анимациями.',
    plus: ['Единый стиль из коробки, без титров.', 'Много готовых анимаций, очень лёгкие модели.'],
    minus: ['Выглядит детски, атмосферы охоты нет.', 'В твоей комнате мультяшные монстры смотрятся игрушками на полу.'] },
];
const styleHtml = styles.map((s) => `<article class="style ${s.cls}">
  <div class="collage">${s.imgs.map((i) => `<img src="${img(i)}" alt="" loading="lazy" decoding="async">`).join('')}</div>
  <div class="style-title"><h3>${esc(s.title)}</h3>${s.badge ? `<span class="badge">${esc(s.badge)}</span>` : ''}</div>
  <p class="sum">${esc(s.sum)}</p>
  <div class="pc"><span class="k">плюсы</span><ul>${s.plus.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><span class="k">минусы</span><ul>${s.minus.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
</article>`).join('\n');

let html = readFileSync(join(ROOT, 'src/template.html'), 'utf8');
html = html.replace('<!--STYLES-->', styleHtml).replace('<!--CARDS-->', cards).replace('/*SCENE*/', () => readFileSync(join(ROOT, 'src/scene.js'), 'utf8'));
mkdirSync(join(ROOT, 'out'), { recursive: true });
writeFileSync(join(ROOT, 'out/hunter-moodboard.html'), html);
console.log('ok', (html.length / 1024).toFixed(0) + ' KB');
