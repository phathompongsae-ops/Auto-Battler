// Rebuilds the two Warrior skill icons that read poorly at hotbar size, from approved in-repo art (no generation):
//   node tools/ui-art/buildSkillIcons.mjs
// - Charge: the approved Charge sword (art-source/ui/skills/original/charge.png) turned level and pointing right,
//   driven by long blue speed streaks and two fading afterimages: one strong left-to-right lunge. The old diagonal
//   sword read as a twin of Power Slash / Whirlwind.
// - Provoke (the Warrior's battle cry): the hero's own head and shoulders (warrior_chibi_front_master_v3) shouting,
//   with a warm burst and orange shockwave arcs rolling outward. The old horn did not read as a war cry.
// - Iron Guard: the approved steel shield lifted off the dark face by a cool defensive glow and rim (it sank into it).
// Both are composed inside the circle the hotbar shows (radius ~42 of 96 px), on a transparent ground: the medallion
// face, rim, key hint and cooldown sweep stay HUD layers. Writes public/assets/ui/skills/{charge,provoke,iron_guard}.png (96 px).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser } from '../../tests/browser/cdp.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const b64 = (p) => readFileSync(join(root, p)).toString('base64');
const inputs = {
  charge: b64('art-source/ui/skills/original/charge.png'),
  hero: b64('public/assets/characters/warrior/warrior_chibi_front_master_v3.png'),
  ironGuard: b64('art-source/ui/skills/original/iron_guard.png'),
};

const b = await Browser.launch({ port: 9349 });
try {
  await b.goto('about:blank');
  const out = await b.eval(`(async () => {
    const IN = ${JSON.stringify(inputs)};
    const bitmap = async (k) => createImageBitmap(await (await fetch('data:image/png;base64,' + IN[k])).blob());
    const S = 96, SS = 4; // composed at 4x, then downsampled once (smooth edges without blur)
    const canvas = (w, h) => { const c = new OffscreenCanvas(w, h); return [c, c.getContext('2d')]; };
    const toUrl = async (c) => { const [o, g] = canvas(S, S); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, S, S);
      const blob = await o.convertToBlob({ type: 'image/png' }); return new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); }); };

    // ---- Charge -------------------------------------------------------------------------------------------
    // Sword only: drop the cyan / pale streak pixels and anything away from the hilt-tip axis.
    const chargeSrc = await bitmap('charge');
    const [sc, sg] = canvas(S, S); sg.drawImage(chargeSrc, 0, 0);
    const sd = sg.getImageData(0, 0, S, S);
    const A = [38, 68], B = [84, 28];
    const dist = (x, y) => { const vx = B[0] - A[0], vy = B[1] - A[1], t = Math.max(-0.1, Math.min(1.05, ((x - A[0]) * vx + (y - A[1]) * vy) / (vx * vx + vy * vy)));
      return Math.hypot(x - (A[0] + t * vx), y - (A[1] + t * vy)); };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const o = (y * S + x) * 4, r = sd.data[o], g = sd.data[o + 1], bl = sd.data[o + 2];
      const cyan = bl - r > 60 && g > 120;
      if (cyan || dist(x, y) > 10) sd.data[o + 3] = 0;
    }
    sg.putImageData(sd, 0, 0);
    const swordAngle = Math.atan2(B[1] - A[1], B[0] - A[0]); // ~ -41°
    const [cc, cg] = canvas(S * SS, S * SS);
    cg.scale(SS, SS);
    // Speed streaks: long tapered blue lines behind the blade, brightest near it.
    const streak = (y, x0, x1, w, a) => {
      const grad = cg.createLinearGradient(x0, 0, x1, 0);
      grad.addColorStop(0, 'rgba(40,140,255,0)'); grad.addColorStop(0.55, 'rgba(50,170,255,' + a + ')'); grad.addColorStop(1, 'rgba(235,250,255,' + a + ')');
      cg.fillStyle = grad; cg.beginPath(); cg.moveTo(x0, y); cg.lineTo(x1, y - w / 2); cg.lineTo(x1 + 4, y); cg.lineTo(x1, y + w / 2); cg.closePath(); cg.fill();
    };
    streak(34, 4, 46, 6, 1); streak(41, 0, 30, 4.5, 0.95); streak(58, 2, 42, 6.5, 1); streak(65, 12, 46, 4.5, 0.9);
    // The lunge: the sword level (a touch upward), two blue afterimages trailing to the left, then the sword itself.
    const lift = -5 * Math.PI / 180;
    const drawSword = (cx, cy, alpha, tint) => {
      cg.save(); cg.globalAlpha = alpha; cg.translate(cx, cy); cg.rotate(lift - swordAngle);
      const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      if (tint) {
        const [tc, tg] = canvas(S, S); tg.drawImage(sc, 0, 0); tg.globalCompositeOperation = 'source-atop'; tg.fillStyle = tint; tg.fillRect(0, 0, S, S);
        cg.drawImage(tc, -mid[0], -mid[1]);
      } else cg.drawImage(sc, -mid[0], -mid[1]);
      cg.restore();
    };
    drawSword(26, 49, 0.32, '#2f8fff');
    drawSword(40, 49, 0.55, '#7cc8ff');
    // A dark under-shadow so the steel separates from the dark medallion face.
    cg.save(); cg.filter = 'blur(1.2px) brightness(0)'; cg.globalAlpha = 0.55; cg.translate(1, 1.5); drawSword(56, 49, 1); cg.restore();
    drawSword(56, 49, 1);
    const charge = await toUrl(cc);

    // ---- Provoke (battle cry) -----------------------------------------------------------------------------
    const hero = await bitmap('hero');
    const [pc, pg] = canvas(S * SS, S * SS);
    pg.scale(SS, SS);
    const C = [48, 50];
    // Warm burst behind the head.
    const glow = pg.createRadialGradient(C[0], C[1] - 2, 4, C[0], C[1] - 2, 40);
    glow.addColorStop(0, 'rgba(255,214,120,0.95)'); glow.addColorStop(0.45, 'rgba(255,140,50,0.65)'); glow.addColorStop(1, 'rgba(220,60,30,0)');
    pg.fillStyle = glow; pg.beginPath(); pg.arc(C[0], C[1] - 2, 40, 0, Math.PI * 2); pg.fill();
    // Burst rays.
    pg.save(); pg.translate(C[0], C[1] - 2);
    for (let i = 0; i < 12; i++) { pg.rotate(Math.PI / 6); pg.fillStyle = i % 2 ? 'rgba(255,190,90,0.55)' : 'rgba(255,120,40,0.45)'; pg.beginPath(); pg.moveTo(-2.2, -14); pg.lineTo(0, -39); pg.lineTo(2.2, -14); pg.closePath(); pg.fill(); }
    pg.restore();
    // Shockwave arcs on both sides (dark outline under each so they read on the medallion).
    const wave = (r, w, a) => {
      for (const side of [0, Math.PI]) {
        for (const [col, lw] of [['rgba(60,16,8,' + a * 0.8 + ')', w + 2], ['rgba(255,' + (150 + r) + ',60,' + a + ')', w]]) {
          pg.strokeStyle = col; pg.lineWidth = lw; pg.lineCap = 'round';
          pg.beginPath(); pg.arc(C[0], C[1] + 6, r, side - 0.55, side + 0.55); pg.stroke();
        }
      }
    };
    wave(30, 3.6, 1); wave(36.5, 3, 0.85); wave(42, 2.4, 0.65);
    // Head and shoulders, shouting: crop of the approved front master, open mouth painted over the closed one.
    const [hc, hg] = canvas(192, 192); hg.drawImage(hero, 0, 0);
    hg.fillStyle = '#3a0f12'; hg.beginPath(); hg.ellipse(97, 87, 5, 4.6, 0, 0, Math.PI * 2); hg.fill();
    hg.fillStyle = '#c4343a'; hg.beginPath(); hg.ellipse(97, 89.2, 3.4, 2, 0, 0, Math.PI * 2); hg.fill();
    hg.fillStyle = '#fff4ea'; hg.fillRect(93.5, 83, 7, 1.3);
    // Angry brows over the eyes.
    hg.strokeStyle = '#5a1a14'; hg.lineWidth = 2.4; hg.lineCap = 'round';
    hg.beginPath(); hg.moveTo(84, 70.5); hg.lineTo(93, 73.5); hg.moveTo(110, 70.5); hg.lineTo(101, 73.5); hg.stroke();
    const crop = [64, 32, 66, 82], k = 0.8; // x, y, w, h in the master; scale into the icon
    pg.save(); pg.filter = 'blur(1.4px) brightness(0)'; pg.globalAlpha = 0.5;
    pg.drawImage(hc, crop[0], crop[1], crop[2], crop[3], C[0] - crop[2] * k / 2 + 1, C[1] - 33 + 1.5, crop[2] * k, crop[3] * k); pg.restore();
    pg.drawImage(hc, crop[0], crop[1], crop[2], crop[3], C[0] - crop[2] * k / 2, C[1] - 33, crop[2] * k, crop[3] * k);
    const provoke = await toUrl(pc);

    // ---- Iron Guard ----------------------------------------------------------------------------------------
    // The approved steel shield, slightly larger, lifted off the dark medallion face by a cool defensive glow and rim.
    const shield = await bitmap('ironGuard');
    const [gc, gg] = canvas(S * SS, S * SS);
    gg.scale(SS, SS);
    const halo = gg.createRadialGradient(48, 48, 10, 48, 48, 44);
    halo.addColorStop(0, 'rgba(170,215,255,0.75)'); halo.addColorStop(0.55, 'rgba(90,160,235,0.45)'); halo.addColorStop(1, 'rgba(60,120,220,0)');
    gg.fillStyle = halo; gg.beginPath(); gg.arc(48, 48, 44, 0, Math.PI * 2); gg.fill();
    // Rim light: the shield silhouette, blurred and tinted, under the art.
    const [rc, rg] = canvas(S, S); rg.drawImage(shield, 0, 0); rg.globalCompositeOperation = 'source-in'; rg.fillStyle = '#dff1ff'; rg.fillRect(0, 0, S, S);
    const grow = 1.08, off = (S - S * grow) / 2;
    gg.save(); gg.filter = 'blur(2px)'; gg.globalAlpha = 0.9; gg.drawImage(rc, off, off, S * grow, S * grow); gg.restore();
    gg.drawImage(shield, off, off, S * grow, S * grow);
    const ironGuard = await toUrl(gc);
    return { 'charge.png': charge, 'provoke.png': provoke, 'iron_guard.png': ironGuard };
  })()`);
  for (const [name, url] of Object.entries(out)) writeFileSync(join(root, 'public/assets/ui/skills', name), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', Object.keys(out).join(', '));
} finally {
  await b.close();
}
process.exit(0);
