let __started = false;
function initLab(){
  if (__started) return;
  __started = true;
/* shared helpers for the geomorphology lab */
'use strict';

function $(id){ return document.getElementById(id); }

/* Simple per-sim animation runner. Only the active sim is driven by app.js. */
function makeSim(ctx){
  return {
    ctx: ctx,
    t: 0,            // simulation clock in seconds (scaled by speed)
    speed: 1,
    playing: false,
    step: function(){},       // override: one manual step
    update: function(dt){ this.t += dt; },  // override
    draw: function(){},       // override
    speedLabel: function(){ return 'מהירות ×' + this.speed; }
  };
}

function cycleSpeed(sim, btn, speeds){
  speeds = speeds || [1,2,4];
  var i = speeds.indexOf(sim.speed);
  sim.speed = speeds[(i+1) % speeds.length];
  btn.textContent = sim.speedLabel();
}

function setPlay(sim, btn, on){
  sim.playing = on;
  btn.textContent = on ? '⏸ השהיה' : '▶ הפעלה';
  btn.classList.toggle('on', on);
}

/* canvas helpers */
function rr(c,x,y,w,h,r){ // rounded rect path
  c.beginPath();
  c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r);
  c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);
  c.arcTo(x,y,x+w,y,r);
  c.closePath();
}
function label(c, text, x, y, opts){
  opts = opts || {};
  c.save();
  c.direction = 'rtl';
  c.textAlign = opts.align || 'right';
  c.textBaseline = opts.baseline || 'top';
  c.font = (opts.bold ? '700 ' : '') + (opts.size||14) + 'px "Assistant","Rubik","Segoe UI",Arial,sans-serif';
  if (opts.bg){
    var w = c.measureText(text).width;
    var px = opts.align === 'left' ? x : x - w;
    c.fillStyle = opts.bg;
    rr(c, px-7, y-4, w+14, (opts.size||14)+11, 7);
    c.fill();
  }
  c.fillStyle = opts.color || '#1f2a33';
  c.fillText(text, x, y);
  c.restore();
}
function legend(el, items){
  el.innerHTML = items.map(function(it){
    return '<span class="li"><span class="sw" style="background:'+it[1]+'"></span>'+it[0]+'</span>';
  }).join('');
}
function fmt(n){ return n.toLocaleString('he-IL'); }
/* photo-based geomorphology lab: tabs + crossfade simulation engine */
'use strict';

(function(){
function IMG(name){
  return (window.__LAB_IMGS && window.__LAB_IMGS[name]) || ('img/' + name + '.jpg');
}
// wire image sources
Array.prototype.forEach.call(document.querySelectorAll('img[data-img]'), function(im){
  im.src = IMG(im.dataset.img);
});

/* ---------- shared bits ---------- */
function wirePlay(sim){
  var pb = $(sim.ids.play);
  pb.onclick = function(){ setPlay(sim, this, !sim.playing); };
  if (sim.ids.reset) $(sim.ids.reset).onclick = function(){
    setPlay(sim, pb, false); sim.t = 0; sim.parts = []; sim.draw();
  };
  if (sim.ids.speed) $(sim.ids.speed).onclick = function(){ cycleSpeed(sim, this); };
}
function makePhoto(ids){
  var cv = $(ids.fx), ctx = cv.getContext('2d');
  var stage = cv.parentElement;
  var sim = makeSim(ctx);
  sim.ids = ids;
  sim.cv = cv; sim.W = cv.width; sim.H = cv.height;
  sim.stage = stage;
  sim.imgs = {};
  Array.prototype.forEach.call(stage.querySelectorAll('img[data-img]'), function(im){
    sim.imgs[im.dataset.img] = im;
  });
  sim.parts = [];
  return sim;
}
function drop(sim, x, y){ // water droplet particle
  sim.parts.push({x: x, y: y, vy: 240 + Math.random()*160, life: 1, kind: 'w'});
}
function dust(sim, x, y){
  sim.parts.push({x: x, y: y, vx: (Math.random()*2-1)*46, vy: -20, life: 1, kind: 'd'});
}
function drawParts(sim){
  var ctx = sim.ctx;
  sim.parts.forEach(function(pt){
    if (pt.kind === 'w'){
      pt.y += pt.vy * 0.016; pt.life -= 0.011;
      ctx.strokeStyle = 'rgba(220,240,250,' + pt.life*0.85 + ')'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x, pt.y + 12); ctx.stroke();
    } else if (pt.kind === 's'){ // water flow streak
      pt.x += pt.vx * 0.016; pt.life -= 0.008;
      ctx.strokeStyle = 'rgba(255,255,255,' + pt.life*0.4 + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x + 26, pt.y + 3); ctx.stroke();
    } else {
      pt.x += pt.vx * 0.016; pt.y += pt.vy * 0.016; pt.vy += 90 * 0.016; pt.life -= 0.03;
      ctx.fillStyle = 'rgba(190,170,140,' + pt.life*0.8 + ')';
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.2, 0, 7); ctx.fill();
    }
  });
  sim.parts = sim.parts.filter(function(pt){ return pt.life > 0 && pt.y < sim.H && pt.x < sim.W + 40; });
}
function setW(sim, weights){ // image opacity weights
  for (var k in sim.imgs) sim.imgs[k].style.opacity = String(weights[k] || 0);
}
function clamp01(v){ return Math.max(0, Math.min(1, v)); }

/* ---------- SIM 1: freeze-thaw ---------- */
(function(){
  var sim = makePhoto({fx: 'fr-fx', play: 'fr-play', reset: 'fr-reset', speed: 'fr-speed'});
  var LOOP = 14, CRACK_X = 0.496 * sim.W;
  function phase(p){
    if (p < 0.30){ var k = p/0.30; return { wet: k, ice: 0, label: 'חלחול מים לסדק', T: 8 - k*10 }; }
    if (p < 0.55){ var k2 = (p-0.30)/0.25; return { wet: 1, ice: k2, label: 'קפיאה והתרחבות — הקרח לוחץ על דפנות הסדק', T: -2 - k2*8 }; }
    if (p < 0.70) return { wet: 1, ice: 1, label: 'הסדק קפוא ורחב מעט יותר', T: -10 };
    var k3 = (p-0.70)/0.30; return { wet: 1-k3, ice: clamp01(1-k3/0.7), label: 'הפשרה — המחזור חוזר', T: -10 + k3*18 };
  }
  sim.draw = function(){
    var p = (this.t % LOOP) / LOOP, s = phase(p);
    setW(this, {'freeze-base': 1, 'freeze-wet': clamp01(s.wet), 'freeze-frozen': clamp01(s.ice)});
    $('fr-chip').textContent = s.label;
    $('fr-temp').textContent = 'טמפרטורה: ' + s.T.toFixed(0) + '°';
    $('fr-cycle').textContent = (Math.floor(this.t / LOOP) + 1) + ' (חוזר)';
    var ctx = this.ctx; ctx.clearRect(0, 0, this.W, this.H);
    if (this.playing){
      if (s.wet > 0.05 && s.ice < 0.3 && Math.random() < 0.35) drop(this, CRACK_X + (Math.random()*14-7), this.H*0.16);
      if (s.ice > 0.15 && s.ice < 0.95 && Math.random() < 0.12) dust(this, CRACK_X + (Math.random()*2-1)*26, this.H*(0.2 + Math.random()*0.6));
    }
    drawParts(this);
  };
  sim.update = function(dt){ this.t += dt; };
  wirePlay(sim);
  sim.stageLabel = $('fr-stage-label');
  sim.stageLabel.textContent = 'מחזור קפיאה־הפשרה אחד; בטבע התהליך חוזר אלפי פעמים.';
  window.SIMS = window.SIMS || {};
  window.SIMS.freeze = { sim: sim, playBtn: $(sim.ids.play), init: function(){ sim.draw(); } };
})();

/* ---------- SIM 2: karst ---------- */
(function(){
  var sim = makePhoto({fx: 'ka-fx', play: 'ka-play', reset: 'ka-reset', speed: 'ka-speed'});
  var LOOP = 16;
  function phase(p){
    if (p < 0.22) return { a: 1, b: 0, c: 0, label: 'גשם על משטח הגיר — מים חומציים חלחולים לסדקים' };
    if (p < 0.5){ var k = (p-0.22)/0.28; return { a: 1-k, b: k, c: 0, label: 'המסה: הגיר נמס, הסדקים מתרחבים ונוצר חלל' }; }
    if (p < 0.78){ var k2 = (p-0.5)/0.28; return { a: 0, b: 1-k2, c: k2, label: 'שקיעה: קלציט נשקע ובונה נטיפים וזקיפים' }; }
    if (p < 0.94) return { a: 0, b: 0, c: 1, label: 'מערה בוגרת עם נטיפים, זקיפים ועמודים' };
    var k3 = (p-0.94)/0.06; return { a: k3, b: 0, c: 1-k3, label: 'והמחזור נמשך אלפי שנים...' };
  }
  sim.draw = function(){
    var p = (this.t % LOOP) / LOOP, s = phase(p);
    setW(this, {'karst-surface': s.a, 'karst-early': s.b, 'karst-late': s.c});
    $('ka-chip').textContent = s.label;
    var ctx = this.ctx; ctx.clearRect(0, 0, this.W, this.H);
    if (this.playing){
      if (s.a > 0.5){ // rain streaks on the surface scene
        ctx.strokeStyle = 'rgba(210,228,238,.45)';
        ctx.beginPath();
        for (var i = 0; i < 30; i++){
          var rx = (i*137 + this.t*300) % this.W, ry = (i*89 + this.t*620) % (this.H*0.7);
          ctx.moveTo(rx, ry); ctx.lineTo(rx-3, ry+10);
        }
        ctx.stroke();
      }
      if ((s.b > 0.5 || s.c > 0.5) && Math.random() < 0.2)
        drop(this, this.W*(0.25 + Math.random()*0.5), this.H*0.12); // cave drips
    }
    drawParts(this);
  };
  sim.update = function(dt){ this.t += dt; };
  wirePlay(sim);
  $('ka-stage-label').textContent = 'מהמסה של סלע הגיר ועד בניית נטיפים וזקיפים.';
  window.SIMS = window.SIMS || {};
  window.SIMS.karst = { sim: sim, playBtn: $(sim.ids.play), init: function(){ sim.draw(); } };
})();

/* ---------- SIM 3: river ---------- */
(function(){
  var sim = makePhoto({fx: 'rv-fx', play: 'rv-play', speed: 'rv-speed'});
  sim.q = 0.35; // discharge 0..1
  sim.view = 'flow'; // 'flow' | 'meander'
  var MEANDER_LOOP = 14;
  function setView(v){
    sim.view = v;
    $('rv-mode').textContent = v === 'flow' ? 'מעבר לתצוגת מיאנדר' : 'מעבר לתצוגת ספיקה';
    $('rv-qrow').hidden = (v !== 'flow');
    $('rv-epochrow').hidden = (v !== 'meander');
    sim.imgs['meander-early'].style.display = v === 'meander' ? '' : 'none';
    sim.imgs['meander-late'].style.display = v === 'meander' ? '' : 'none';
    sim.parts = [];
    sim.draw();
  }
  $('rv-mode').onclick = function(){ setView(sim.view === 'flow' ? 'meander' : 'flow'); };
  $('rv-q').oninput = function(){
    sim.q = this.value / 100;
    $('rv-qlabel').textContent = sim.q < 0.33 ? 'נמוכה' : (sim.q < 0.66 ? 'רגילה' : 'גבוהה — שיטפון');
    sim.draw();
  };
  sim.draw = function(){
    if (this.view === 'meander'){
      var p = (this.t % MEANDER_LOOP) / MEANDER_LOOP;
      var e = clamp01(p / 0.8); // migration progress, then hold
      setW(this, {'river-low': 0, 'river-high': 0, 'meander-early': 1, 'meander-late': e});
      $('rv-epoch').textContent = Math.round(e * 100) + '%';
      $('rv-chip').textContent = e < 0.25 ? 'סחיפה בקשת החיצונית ושקיעה בפנימית — המיאנדר מתחיל לנדוד' :
        (e < 0.7 ? 'המיאנדר נודד ומתרחב; צוואר המיאנדר מצטמצם' :
        (e < 1 ? 'ניתוק הצוואר: האפיק מתיישר והלולאה הנטושה נותרת' :
        'אגם סוס (אוקסבו) — שריד למיאנדר שניתק'));
      this.ctx.clearRect(0, 0, this.W, this.H);
      return;
    }
    var q = this.q;
    setW(this, {'river-low': 1, 'river-high': clamp01((q - 0.2) / 0.6), 'meander-early': 0, 'meander-late': 0});
    $('rv-chip').textContent = q < 0.33 ? 'ספיקה נמוכה — טרסות חצץ חשופות, הסעה חלשה' :
      (q < 0.66 ? 'ספיקה רגילה — הסעה מתמדת של חלקיקים' : 'ספיקה גבוהה — זרימה עזה סוחפת חומר גס');
    var ctx = this.ctx; ctx.clearRect(0, 0, this.W, this.H);
    if (this.playing){
      var n = 2 + Math.round(q * 5);
      for (var i = 0; i < n; i++)
        if (Math.random() < 0.5)
          this.parts.push({ x: -30, y: this.H*(0.35 + Math.random()*0.55), vx: (140 + q*420), life: 1, kind: 's' });
    }
    drawParts(this);
  };
  sim.update = function(dt){ this.t += dt; };
  wirePlay(sim);
  window.SIMS = window.SIMS || {};
  window.SIMS.river = { sim: sim, playBtn: $(sim.ids.play), init: function(){ sim.draw(); } };
})();

/* ---------- SIM 4: colorado ---------- */
(function(){
  var sim = makePhoto({fx: 'cc-fx'});
  sim.compare = 0.5; sim.march = false; sim.showData = false;
  var range = $('cc-range');
  range.oninput = function(){ sim.compare = this.value / 100; sim.marchOff(); sim.draw(); };
  sim.marchOff = function(){
    if (sim.march){ sim.march = false; $('cc-march').textContent = 'הצג את מרץ 2005'; $('cc-march').classList.remove('on'); }
  };
  $('cc-data').onclick = function(){
    sim.showData = !sim.showData;
    this.textContent = sim.showData ? 'הסתר נתונים' : 'הצג נתוני זרימה ומדידות';
    this.classList.toggle('on', sim.showData);
    sim.draw();
  };
  $('cc-march').onclick = function(){
    sim.march = !sim.march;
    this.textContent = sim.march ? 'חזרה להשוואת נובמבר–דצמבר' : 'הצג את מרץ 2005';
    this.classList.toggle('on', sim.march);
    sim.draw();
  };
  function hydro(sim){
    var ctx = sim.ctx, W = sim.W, H = sim.H;
    var bw = W*0.82, bh = H*0.58, bx = (W-bw)/2, by = H*0.16;
    ctx.fillStyle = 'rgba(255,255,255,.96)'; rr(ctx, bx, by, bw, bh, 22); ctx.fill();
    ctx.strokeStyle = '#c8d3d8'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
    label(ctx, 'ספיקת הנהר — שחרור מבוקר מסכר גלן קניון, נובמבר 2004', bx+bw-28, by+26, {size: 34, bold: true});
    var gx = bx+110, gy = by+bh-90, gw = bw-240, gh = bh*0.52;
    ctx.strokeStyle = '#8a98a0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx+gw, gy); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy-gh); ctx.stroke();
    ctx.strokeStyle = '#2f6f8f'; ctx.lineWidth = 6; ctx.beginPath();
    ctx.moveTo(gx, gy-gh*0.25);
    ctx.lineTo(gx+gw*0.28, gy-gh*0.25);
    ctx.lineTo(gx+gw*0.36, gy-gh*0.92);
    ctx.lineTo(gx+gw*0.62, gy-gh*0.92);
    ctx.lineTo(gx+gw*0.7, gy-gh*0.25);
    ctx.lineTo(gx+gw, gy-gh*0.25);
    ctx.stroke(); ctx.lineWidth = 1;
    label(ctx, 'כ־60 שעות של זרימה חזקה', gx+gw*0.49, gy-gh*0.8, {size: 26, color: '#2f6f8f', align: 'center'});
    label(ctx, 'ספיקה', gx-18, gy-gh+10, {size: 22, color: '#8a98a0'});
    label(ctx, 'זמן', gx+gw-30, gy+38, {size: 22, color: '#8a98a0'});
    label(ctx, 'ספיקה דומה בשני מועדי הצילום', gx+gw, gy-40, {size: 24, color: '#8a98a0'});
    label(ctx, 'מדידה שדווחה במסמך המקור: שכבת חול חדשה בעובי כשני מטרים (לא נבדק עצמאית)', bx+bw-28, by+bh-48, {size: 26, bold: true, color: '#7a5b23'});
  }
  sim.draw = function(){
    var ctx = this.ctx, W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);
    var b = this.imgs['col-before'], a = this.imgs['col-after'], m = this.imgs['col-march'];
    if (this.march){
      b.style.opacity = 0; a.style.opacity = 0; m.style.display = ''; m.style.opacity = 1;
      $('cc-chip').textContent = 'מרץ 2005 — הנהר סחף חלק מהחול, הסלעים נחשפו מחדש';
      if (this.showData) hydro(this);
      return;
    }
    m.style.display = 'none';
    // wipe compare: before on the right side, after on the left (RTL slider)
    var split = this.compare;
    b.style.opacity = 1; a.style.opacity = 1;
    a.style.clipPath = 'inset(0 ' + ((1-split)*100) + '% 0 0)'; // after visible on left portion
    b.style.clipPath = 'inset(0 0 0 ' + (split*100) + '%)';   // before visible on right portion
    // divider
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillRect(split*W - 2, 0, 4, H);
    ctx.beginPath(); ctx.arc(split*W, H/2, 16, 0, 7); ctx.fill();
    ctx.fillStyle = '#1f5f6b';
    ctx.beginPath(); ctx.moveTo(split*W-7, H/2); ctx.lineTo(split*W-1, H/2-6); ctx.lineTo(split*W-1, H/2+6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(split*W+7, H/2); ctx.lineTo(split*W+1, H/2-6); ctx.lineTo(split*W+1, H/2+6); ctx.closePath(); ctx.fill();
    label(ctx, 'דצמבר 2004', 18, 14, {size: 15, bold: true, bg: 'rgba(255,255,255,.9)', align: 'left'});
    label(ctx, 'נובמבר 2004', W-18, 14, {size: 15, bold: true, bg: 'rgba(255,255,255,.9)'});
    if (this.showData) hydro(this);
  };
  sim.update = function(dt){};
  window.SIMS = window.SIMS || {};
  window.SIMS.colorado = { sim: sim, playBtn: null, init: function(){ sim.draw(); } };
})();

/* ---------- tabs + loop ---------- */
var order = [
  ['freeze',   '01', 'בליה מכנית',  'קפיאה והפשרה'],
  ['karst',    '02', 'בליה כימית',  'המסה ושקיעת קלציט'],
  ['river',    '03', 'תהליכי נהר',  'סחיפה, הסעה והשקעה'],
  ['colorado', '04', 'נהר הקולורדו', 'לפני ואחרי שחרור מבוקר']
];
var tabsEl = $('tabs');
var active = null;

order.forEach(function(def, i){
  var b = document.createElement('button');
  b.innerHTML = '<span class="num">' + def[1] + '</span><b>' + def[2] + '</b><br><span style="font-size:12.5px;color:var(--muted)">' + def[3] + '</span>';
  b.onclick = function(){ activate(i); };
  tabsEl.appendChild(b);
});

function activate(i){
  active = order[i][0];
  order.forEach(function(def, j){
    $('sim-' + def[0]).hidden = (j !== i);
    tabsEl.children[j].classList.toggle('on', j === i);
  });
  var entry = window.SIMS[active];
  if (entry && !entry.initialized){ entry.init(); entry.initialized = true; }
  if (entry) entry.sim.draw();
}

var last = performance.now();
function frame(now){
  var dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (active){
    var entry = window.SIMS[active];
    if (entry && entry.initialized && entry.sim.playing){
      entry.sim.update(dt * entry.sim.speed);
      entry.sim.draw();
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
var initial = 0;
var h = (location.hash || '').replace('#', '');
var auto = /!$/.test(h); h = h.replace('!', '');
var meander = /-m$/.test(h); h = h.replace('-m', '');
var dataOn = /-d$/.test(h); h = h.replace('-d', '');
order.forEach(function(def, j){ if (def[0] === h) initial = j; });
activate(initial);
if (meander && window.SIMS.river){ var mb = $('rv-mode'); if (mb) mb.click(); }
if (dataOn && window.SIMS.colorado){ var db = $('cc-data'); if (db) db.click(); }
if (auto){ var e0 = window.SIMS[active]; if (e0 && e0.playBtn) e0.playBtn.click(); }
})();

}

initLab();
