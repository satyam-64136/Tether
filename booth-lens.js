/* ═════════════════════════════════════════════════════════════════
   booth-lens.js: live lenses and animated overlays for the Photo Booth.

   Two kinds of effect, and they combine:
   - LENSES are WebGL fragment shaders (fisheye, swirl, kaleidoscope, glitch, thermal, sketch...).
     They reshape or recolour the live camera picture. The same shader renders the preview and, at
     full resolution, the photo that is actually saved, so what you see is what you get.
   - OVERLAYS are animated particles (hearts, sparkles, snow, confetti, bubbles, fireflies) drawn on
     top. They are described in 0..1 coordinates, so they can be drawn at any size.

   Nothing here touches the camera or the page. The booth hands it a <video>, a <canvas> and a time.
   If WebGL is missing, createEngine() returns null and the booth simply hides the shader lenses.
   ═════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ───────────── the lens shader ───────────── */
  const VERT = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v;
uniform sampler2D T;   // the camera picture
uniform vec2 R;        // output size in pixels
uniform vec2 K;        // centre-square crop: scale
uniform vec2 O;        // centre-square crop: offset
uniform float t;       // seconds
uniform int L;         // which lens

float hash(float n){return fract(sin(n*91.345)*47453.5453);}
vec3 samp(vec2 uv){return texture2D(T,O+clamp(uv,0.0,1.0)*K).rgb;}
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 heat(float x){
  vec3 c=mix(vec3(0.0,0.0,0.15),vec3(0.35,0.0,0.6),smoothstep(0.0,0.25,x));
  c=mix(c,vec3(0.9,0.1,0.2),smoothstep(0.25,0.5,x));
  c=mix(c,vec3(1.0,0.6,0.0),smoothstep(0.5,0.75,x));
  return mix(c,vec3(1.0,1.0,0.7),smoothstep(0.75,1.0,x));
}
void main(){
  vec2 uv=v; vec2 q=uv-.5; float d=length(q); vec3 col;
  if(L==1){            // fisheye: the middle swells
    q*=1.-.62*(1.-smoothstep(0.,.5,d)); col=samp(q+.5);
  }else if(L==2){      // tiny: the middle shrinks
    q*=1.+.9*(1.-smoothstep(0.,.5,d)); col=samp(q+.5);
  }else if(L==3){      // swirl: twists back and forth
    float a=(1.-smoothstep(0.,.55,d))*2.6*sin(t*.9); float s=sin(a),c=cos(a);
    q=mat2(c,-s,s,c)*q; col=samp(q+.5);
  }else if(L==4){      // mirror: the left half, reflected
    vec2 u2=uv; if(u2.x>.5)u2.x=1.-u2.x; col=samp(u2);
  }else if(L==5){      // kaleidoscope
    float a=atan(q.y,q.x)+t*.25; float seg=6.28318/6.; a=mod(a,seg); a=abs(a-seg*.5);
    col=samp(vec2(cos(a),sin(a))*d*1.25+.5);
  }else if(L==6){      // pixel
    float n=44.; col=samp((floor(uv*n)+.5)/n);
  }else if(L==7){      // glitch: torn rows and split colours
    float row=floor(uv.y*38.); float tt=floor(t*7.); float h=hash(row+tt*13.);
    float sh=h>.88?(h-.88)*.9*(hash(tt)>.5?1.:-1.):0.;
    vec2 u2=vec2(uv.x+sh,uv.y); float sp=.006+.02*step(.88,hash(tt+3.));
    col=vec3(samp(u2+vec2(sp,0.)).r,samp(u2).g,samp(u2-vec2(sp,0.)).b);
    col*=.92+.08*sin(uv.y*R.y*1.2);
  }else if(L==8){      // thermal camera
    col=heat(lum(samp(uv)));
  }else if(L==9||L==10){   // 9 = pencil sketch, 10 = comic
    vec2 px=1.5/R;
    float tl=lum(samp(uv+vec2(-px.x,px.y))),tc=lum(samp(uv+vec2(0.,px.y))),tr=lum(samp(uv+px));
    float ml=lum(samp(uv+vec2(-px.x,0.))),mr=lum(samp(uv+vec2(px.x,0.)));
    float bl=lum(samp(uv-px)),bc=lum(samp(uv-vec2(0.,px.y))),br=lum(samp(uv+vec2(px.x,-px.y)));
    float gx=-tl-2.*ml-bl+tr+2.*mr+br, gy=-tl-2.*tc-tr+bl+2.*bc+br; float e=length(vec2(gx,gy));
    vec3 base=samp(uv);
    if(L==9){ float ink=smoothstep(.12,.5,e); vec3 paper=vec3(.97,.95,.9);
      col=mix(paper*(.78+.22*lum(base)),vec3(.15,.12,.2),ink); }
    else { vec3 post=floor(base*4.+.5)/4.; float ink=smoothstep(.2,.55,e);
      col=mix(post*1.08,vec3(.08,.05,.12),ink); }
  }else if(L==11){     // wavy
    vec2 u2=uv; u2.x+=.022*sin(uv.y*16.+t*3.); u2.y+=.022*sin(uv.x*13.+t*2.4); col=samp(u2);
  }else if(L==12){     // heartbeat zoom
    float z=1.-.14*pow(abs(sin(t*2.2)),5.); col=samp(q*z+.5);
  }else if(L==13){     // dreamy glow
    vec3 s=samp(uv); vec3 b=vec3(0.); float r=.012;
    for(int i=-2;i<=2;i++){for(int j=-2;j<=2;j++){b+=samp(uv+vec2(float(i),float(j))*r);}}
    b/=25.; col=1.-(1.-s)*(1.-b*.9); col=mix(col,col*vec3(1.06,.98,1.08),.5)+.03;
  }else if(L==14){     // pop art duotone
    float l=lum(samp(uv)); vec3 a=vec3(.12,.02,.35),b=vec3(.95,.2,.55),c=vec3(1.,.9,.45);
    col=l<.5?mix(a,b,l*2.):mix(b,c,(l-.5)*2.);
  }else if(L==15){     // VHS tape
    float j=.002*sin(uv.y*140.+t*9.)+.004*step(.97,hash(floor(t*10.)+floor(uv.y*60.)));
    vec2 u2=vec2(uv.x+j,uv.y);
    col=vec3(samp(u2+vec2(.006,0.)).r,samp(u2).g,samp(u2-vec2(.006,0.)).b);
    col*=.9+.1*sin(uv.y*R.y*1.4); col+=(hash(dot(uv,vec2(12.9,78.2))+t)-.5)*.08; col=mix(vec3(lum(col)),col,.85);
  }else{ col=samp(uv); }
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

  // The lenses, in the order they appear. `id` is what the shader's L switch expects.
  const LENSES = [
    { key: 'none',    label: 'None',     id: 0 },
    { key: 'fisheye', label: 'Fisheye',  id: 1 },
    { key: 'tiny',    label: 'Tiny',     id: 2 },
    { key: 'swirl',   label: 'Swirl',    id: 3 },
    { key: 'mirror',  label: 'Mirror',   id: 4 },
    { key: 'kaleido', label: 'Kaleido',  id: 5 },
    { key: 'pixel',   label: 'Pixel',    id: 6 },
    { key: 'glitch',  label: 'Glitch',   id: 7 },
    { key: 'thermal', label: 'Thermal',  id: 8 },
    { key: 'sketch',  label: 'Sketch',   id: 9 },
    { key: 'comic',   label: 'Comic',    id: 10 },
    { key: 'wavy',    label: 'Wavy',     id: 11 },
    { key: 'pulse',   label: 'Pulse',    id: 12 },
    { key: 'dreamy',  label: 'Dreamy',   id: 13 },
    { key: 'pop',     label: 'Pop art',  id: 14 },
    { key: 'vhs',     label: 'VHS',      id: 15 },
  ];
  const lensId = (key) => { const l = LENSES.find((x) => x.key === key); return l ? l.id : 0; };

  /* A WebGL renderer bound to one canvas. render(source, lensKey, seconds) draws the lens into it.
     `source` can be a <video>, a <canvas> or an <img>. Returns false when it could not draw. */
  function createEngine(canvas) {
    let gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false }) ||
           canvas.getContext('experimental-webgl');
    } catch (e) { /* no WebGL */ }
    if (!gl) return null;
    const compile = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(log); }
      return s;
    };
    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { console.warn('[lens] shader failed:', e.message); return null; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const U = {};
    ['T', 'R', 'K', 'O', 't', 'L'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

    const eng = {
      canvas, lost: false,
      render(src, key, t) {
        if (eng.lost) return false;
        const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
        if (!sw || !sh || !canvas.width || !canvas.height) return false;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (e) { return false; }
        const a = sw / sh, kx = a > 1 ? 1 / a : 1, ky = a > 1 ? 1 : a;       // the centre square, like object-fit: cover
        gl.uniform1i(U.T, 0);
        gl.uniform2f(U.R, canvas.width, canvas.height);
        gl.uniform2f(U.K, kx, ky);
        gl.uniform2f(U.O, (1 - kx) / 2, (1 - ky) / 2);
        gl.uniform1f(U.t, t || 0);
        gl.uniform1i(U.L, lensId(key));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return true;
      },
    };
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); eng.lost = true; });
    return eng;
  }

  /* ───────────── overlays: animated particles in 0..1 space ───────────── */
  const HEART = new Path2D('M0 15C-27-2-15-21 0-8C15-21 27-2 0 15Z');
  const TAU = Math.PI * 2, rnd = Math.random;
  const pick = (a) => a[(rnd() * a.length) | 0];
  const PINKS = ['#ff9cc0', '#ff6f9c', '#ffc4d9', '#ff8aa8', '#ffffff'];
  const CONFETTI = ['#ff9cc0', '#8ccfff', '#ffe27a', '#a6ebc9', '#cdbbff', '#ffc7a1'];

  function star4(c, r) {                       // a four-pointed twinkle
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .28 : r; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath();
  }

  // Each kind: how many appear per second (rate) or at once (count), how a new one starts, how it moves, how it is drawn.
  const KINDS = {
    hearts: {
      rate: 5,
      spawn: (burst) => ({ x: rnd(), y: burst ? .5 + rnd() * .5 : 1.08, vy: .14 + rnd() * .14, ph: rnd() * TAU, s: .03 + rnd() * .045, c: pick(PINKS), rot: (rnd() - .5) * .5, age: 0 }),
      step: (p, dt) => { p.y -= p.vy * dt; p.age += dt; p.x += Math.sin(p.age * 2 + p.ph) * .06 * dt; return p.y > -.12; },
      draw: (c, p, S) => { c.globalAlpha = Math.min(1, p.y * 3 + .25) * .95; c.translate(p.x * S, p.y * S); c.rotate(p.rot + Math.sin(p.age * 2 + p.ph) * .2);
        const k = p.s * S / 20; c.scale(k, k); c.fillStyle = p.c; c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.6; c.fill(HEART); c.stroke(HEART); },
    },
    sparkle: {
      count: 22,
      spawn: () => ({ x: rnd(), y: rnd(), life: .8 + rnd() * 1.1, age: 0, s: .018 + rnd() * .03, rot: rnd() * 1.5, c: pick(['#fff6c2', '#ffffff', '#ffe27a', '#ffd1ec']) }),
      step: (p, dt) => { p.age += dt; p.rot += dt * .6; return p.age < p.life; },
      draw: (c, p, S) => { c.globalAlpha = Math.sin(Math.PI * p.age / p.life); c.translate(p.x * S, p.y * S); c.rotate(p.rot);
        c.fillStyle = p.c; c.shadowColor = '#fff'; c.shadowBlur = S * .02; star4(c, p.s * S); c.fill(); },
    },
    snow: {
      rate: 26,
      spawn: (burst) => ({ x: rnd(), y: burst ? rnd() : -.04, vy: .05 + rnd() * .1, r: .004 + rnd() * .009, ph: rnd() * TAU, age: 0 }),
      step: (p, dt) => { p.y += p.vy * dt; p.age += dt; p.x += Math.sin(p.age * 1.4 + p.ph) * .035 * dt; return p.y < 1.05; },
      draw: (c, p, S) => { c.globalAlpha = .88; c.fillStyle = '#fff'; c.beginPath(); c.arc(p.x * S, p.y * S, p.r * S, 0, TAU); c.fill(); },
    },
    confetti: {
      rate: 14,
      spawn: (burst) => burst
        ? { x: .5, y: .55, vx: (rnd() - .5) * 1.1, vy: -(.5 + rnd() * .7), g: 1.1, s: .018 + rnd() * .02, rot: rnd() * TAU, vr: (rnd() - .5) * 10, c: pick(CONFETTI), age: 0 }
        : { x: rnd(), y: -.04, vx: (rnd() - .5) * .08, vy: .12 + rnd() * .1, g: 0, s: .018 + rnd() * .02, rot: rnd() * TAU, vr: (rnd() - .5) * 6, c: pick(CONFETTI), age: 0 },
      step: (p, dt) => { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.age += dt; return p.y < 1.08; },
      draw: (c, p, S) => { c.translate(p.x * S, p.y * S); c.rotate(p.rot); c.scale(1, Math.abs(Math.cos(p.age * 5 + p.rot)) * .8 + .2); c.fillStyle = p.c; c.fillRect(-p.s * S / 2, -p.s * S / 4, p.s * S, p.s * S / 2); },
    },
    bubbles: {
      rate: 6,
      spawn: (burst) => ({ x: rnd(), y: burst ? .4 + rnd() * .6 : 1.1, vy: .08 + rnd() * .1, r: .02 + rnd() * .055, ph: rnd() * TAU, age: 0 }),
      step: (p, dt) => { p.y -= p.vy * dt; p.age += dt; p.x += Math.sin(p.age * 1.7 + p.ph) * .03 * dt; return p.y > -.12; },
      draw: (c, p, S) => { const x = p.x * S, y = p.y * S, r = p.r * S; c.globalAlpha = .9;
        const g = c.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(160,220,255,.24)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = Math.max(1.5, S * .004); c.stroke();
        c.beginPath(); c.arc(x, y, r * .72, Math.PI * 1.1, Math.PI * 1.45); c.stroke(); },
    },
    fireflies: {
      count: 16,
      spawn: () => ({ x: rnd(), y: rnd(), a: rnd() * TAU, sp: .02 + rnd() * .04, ph: rnd() * TAU, s: .02 + rnd() * .025, age: 0, life: 6 + rnd() * 6 }),
      step: (p, dt) => { p.age += dt; p.a += (rnd() - .5) * 2.4 * dt; p.x += Math.cos(p.a) * p.sp * dt; p.y += Math.sin(p.a) * p.sp * dt; return p.age < p.life && p.x > -.1 && p.x < 1.1 && p.y > -.1 && p.y < 1.1; },
      draw: (c, p, S) => { const x = p.x * S, y = p.y * S, r = p.s * S * (1.2 + .5 * Math.sin(p.age * 3 + p.ph));
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, p.age) * Math.min(1, (p.life - p.age)) * .95;
        const g = c.createRadialGradient(x, y, 0, x, y, r * 2.4); g.addColorStop(0, 'rgba(255,250,170,1)'); g.addColorStop(.35, 'rgba(255,225,90,.5)'); g.addColorStop(1, 'rgba(255,225,90,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.4, 0, TAU); c.fill(); },
    },
  };
  const OVERLAYS = [
    { key: 'hearts', label: 'Hearts' }, { key: 'sparkle', label: 'Sparkle' }, { key: 'snow', label: 'Snow' },
    { key: 'confetti', label: 'Confetti' }, { key: 'bubbles', label: 'Bubbles' }, { key: 'fireflies', label: 'Fireflies' },
  ];

  /* overlay('hearts') -> { step(dt), draw(ctx, size), burst(), warm(seconds) } */
  function overlay(kind) {
    const K = KINDS[kind]; if (!K) return null;
    let list = [], acc = 0;
    const api = {
      step(dt) {
        dt = Math.min(dt, .1);
        if (K.rate) { acc += dt * K.rate; while (acc >= 1) { list.push(K.spawn(false)); acc -= 1; } }
        if (K.count) while (list.length < K.count) list.push(K.spawn(false));
        list = list.filter((p) => K.step(p, dt));
      },
      draw(ctx, size) {
        ctx.save();
        for (const p of list) { ctx.save(); K.draw(ctx, p, size); ctx.restore(); }
        ctx.restore();
      },
      burst() { const n = kind === 'confetti' ? 70 : kind === 'hearts' ? 14 : 10; for (let i = 0; i < n; i++) list.push(K.spawn(true)); },
      warm(seconds) { for (let i = 0; i < seconds * 30; i++) api.step(1 / 30); },      // so thumbnails show a lively frame, not an empty one
      get size() { return list.length; },
    };
    return api;
  }

  /* A colourful little scene, used for the filter and lens thumbnails before the camera is on. */
  function sampleScene(size) {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
    const sky = x.createLinearGradient(0, 0, 0, size); sky.addColorStop(0, '#6fb6ff'); sky.addColorStop(.62, '#ffd9a8'); sky.addColorStop(1, '#ffb3a1');
    x.fillStyle = sky; x.fillRect(0, 0, size, size);
    x.fillStyle = '#fff3b0'; x.beginPath(); x.arc(size * .76, size * .26, size * .13, 0, TAU); x.fill();
    x.fillStyle = '#5aa86b'; x.beginPath(); x.moveTo(0, size * .78); x.quadraticCurveTo(size * .3, size * .52, size * .62, size * .76); x.quadraticCurveTo(size * .82, size * .62, size, size * .72); x.lineTo(size, size); x.lineTo(0, size); x.fill();
    x.fillStyle = '#3b2a45'; x.beginPath(); x.arc(size * .36, size * .52, size * .13, 0, TAU); x.fill();          // a head and shoulders
    x.beginPath(); x.ellipse(size * .36, size * .98, size * .24, size * .26, 0, Math.PI, TAU); x.fill();
    x.fillStyle = '#ff7aa8'; x.beginPath(); x.arc(size * .31, size * .5, size * .018, 0, TAU); x.arc(size * .41, size * .5, size * .018, 0, TAU); x.fill();
    return c;
  }

  global.BoothLens = { LENSES, OVERLAYS, createEngine, overlay, sampleScene, lensId };
})(window);
