// ---- 3D moving map: satellite globe with day/night, atmosphere, route arc and a 3D airliner (three.js, offline) ----
// Textures: NASA Blue Marble / Black Marble (public domain, via three-globe examples, MIT).

function Globe3D(box){
  const T = THREE, R = 1, rad = Math.PI / 180;
  const W = () => box.clientWidth, H = () => box.clientHeight;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W(), H());
  renderer.outputColorSpace = T.SRGBColorSpace;
  box.appendChild(renderer.domElement);
  const labels = document.createElement('div'); labels.className = 'g3-labels'; box.appendChild(labels);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(42, W() / H(), 0.001, 100);

  // lat/lon → point on the sphere (matches three's SphereGeometry UVs for an equirectangular map)
  const vec = (lat, lon, r) => { const p = (lon + 180) * rad, la = lat * rad, c = Math.cos(la);
    return new T.Vector3(-Math.cos(p) * c * r, Math.sin(la) * r, Math.sin(p) * c * r); };

  // sun direction from the date (good enough for the terminator)
  function sunDir(ms){
    const d = new Date(ms), start = Date.UTC(d.getUTCFullYear(), 0, 0), n = (ms - start) / 864e5;
    const decl = 23.44 * Math.sin(2 * Math.PI * (284 + n) / 365);
    const h = d.getUTCHours() + d.getUTCMinutes() / 60;
    return vec(decl, -15 * (h - 12), 1).normalize();
  }

  // stars
  { const g = new T.BufferGeometry(), n = 1500, p = new Float32Array(n * 3);
    for(let i = 0; i < n; i++){ const v = new T.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 20); p.set([v.x, v.y, v.z], i * 3); }
    g.setAttribute('position', new T.BufferAttribute(p, 3));
    scene.add(new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 0.06, sizeAttenuation: true, transparent: true, opacity: .8 }))); }

  // earth: day/night blend by the sun, relief from the topography map
  const load = u => { const t = new T.TextureLoader().load(u); t.colorSpace = T.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
  const bump = new T.TextureLoader().load('img/earth-bump.jpg');
  const earthMat = new T.ShaderMaterial({
    uniforms: { day: { value: load('img/earth-day.jpg') }, night: { value: load('img/earth-night.jpg') }, bump: { value: bump }, sun: { value: sunDir(Date.now()) } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D day, night, bump; uniform vec3 sun; varying vec2 vUv; varying vec3 vN;
      void main(){
        vec2 e = vec2(1.0/2048.0, 1.0/1024.0);
        float h = texture2D(bump, vUv).r, hx = texture2D(bump, vUv + vec2(e.x,0.)).r, hy = texture2D(bump, vUv + vec2(0.,e.y)).r;
        float relief = 1.0 + (h - hx) * 4.0 + (hy - h) * 4.0;
        float d = dot(vN, sun);
        vec3 dc = texture2D(day, vUv).rgb * (0.30 + 0.85 * max(d, 0.0)) * relief;
        vec3 nc = texture2D(night, vUv).rgb * 1.6 + vec3(0.02,0.03,0.06);
        gl_FragColor = vec4(mix(nc, dc, smoothstep(-0.12, 0.18, d)), 1.0);
        #include <colorspace_fragment>
      }`
  });
  const earth = new T.Mesh(new T.SphereGeometry(R, 160, 120), earthMat); scene.add(earth);
  // atmosphere glow
  scene.add(new T.Mesh(new T.SphereGeometry(R * 1.018, 96, 64), new T.ShaderMaterial({
    side: T.BackSide, transparent: true, blending: T.AdditiveBlending, depthWrite: false,
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float i = pow(max(0.0, 0.68 - dot(vN, vV)), 3.0); gl_FragColor = vec4(0.38, 0.64, 1.0, 1.0) * clamp(i * 1.7, 0.0, 0.85); }`
  })));

  // lights for the plane
  const sunLight = new T.DirectionalLight(0xffffff, 2.2); scene.add(sunLight);
  scene.add(new T.AmbientLight(0xb8c4dd, 0.9));

  // airliner (twin-engine narrow body), nose along +z, up along +y, ~1 unit long
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6d83ff';
  const white = new T.MeshStandardMaterial({ color: 0xf4f6fa, metalness: 0.25, roughness: 0.35 });
  const grey = new T.MeshStandardMaterial({ color: 0xa9b2c2, metalness: 0.5, roughness: 0.3 });
  const tailM = new T.MeshStandardMaterial({ color: new T.Color(accent), metalness: 0.2, roughness: 0.4 });
  const plane = new T.Group();
  { const body = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.78, 24), white); body.rotation.x = Math.PI / 2; plane.add(body);
    const nose = new T.Mesh(new T.SphereGeometry(0.055, 24, 16), white); nose.scale.set(1, 1, 2.1); nose.position.z = 0.39; plane.add(nose);
    const tailc = new T.Mesh(new T.ConeGeometry(0.055, 0.2, 24), white); tailc.rotation.x = -Math.PI / 2; tailc.position.z = -0.49; plane.add(tailc);
    const wingShape = new T.Shape(); wingShape.moveTo(0, 0.13); wingShape.lineTo(0.5, -0.12); wingShape.lineTo(0.5, -0.2); wingShape.lineTo(0, -0.06); wingShape.closePath();
    const wingG = new T.ExtrudeGeometry(wingShape, { depth: 0.012, bevelEnabled: false });
    for(const s of [1, -1]){
      const w = new T.Mesh(wingG, white); w.rotation.x = Math.PI / 2; w.scale.x = s; w.position.set(0, -0.02, 0.02); plane.add(w);
      const eng = new T.Mesh(new T.CylinderGeometry(0.032, 0.028, 0.14, 16), grey); eng.rotation.x = Math.PI / 2; eng.position.set(s * 0.17, -0.06, 0.05); plane.add(eng);
      const hs = new T.Shape(); hs.moveTo(0, 0.05); hs.lineTo(0.18, -0.04); hs.lineTo(0.18, -0.08); hs.lineTo(0, -0.04); hs.closePath();
      const h = new T.Mesh(new T.ExtrudeGeometry(hs, { depth: 0.008, bevelEnabled: false }), white); h.rotation.x = Math.PI / 2; h.scale.x = s; h.position.set(0, 0.01, -0.46); plane.add(h);
    }
    const fs = new T.Shape(); fs.moveTo(0, 0); fs.lineTo(-0.2, 0); fs.lineTo(-0.27, 0.2); fs.lineTo(-0.2, 0.2); fs.lineTo(0, 0.02); fs.closePath();
    const fin = new T.Mesh(new T.ExtrudeGeometry(fs, { depth: 0.01, bevelEnabled: false }), tailM); fin.rotation.y = -Math.PI / 2; fin.position.set(-0.005, 0.04, -0.33); plane.add(fin);
  }
  const planeHolder = new T.Group(); planeHolder.add(plane); scene.add(planeHolder);

  // route: flown part (warm) and the rest (white, faint)
  let routeDone = null, routeTodo = null, arcPts = [], aps = [];
  const doneMat = new T.MeshBasicMaterial({ color: 0xf2b84b }), todoMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  function tube(pts, mat, r){ if(pts.length < 2) return null; const m = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), Math.max(8, pts.length * 2), r, 8, false), mat); scene.add(m); return m; }
  function setRoute(dep, arr, depLL, arrLL, depName, arrName){
    arcPts = [];
    const a = vec(depLL[0], depLL[1], 1), b = vec(arrLL[0], arrLL[1], 1), ang = a.angleTo(b);
    for(let i = 0; i <= 96; i++){ const f = i / 96; const p = new T.Vector3().copy(a).multiplyScalar(Math.sin((1-f)*ang)).add(new T.Vector3().copy(b).multiplyScalar(Math.sin(f*ang))).divideScalar(Math.sin(ang) || 1).normalize();
      arcPts.push(p.multiplyScalar(R * 1.0012)); }
    aps = [{ code: dep, name: depName, p: vec(depLL[0], depLL[1], R * 1.002) }, { code: arr, name: arrName, p: vec(arrLL[0], arrLL[1], R * 1.002) }];
    labels.innerHTML = aps.map((x, i) => `<div class="g3-pin" data-i="${i}"><span class="g3-dot"></span>${esc(x.name || x.code)} <b>(${x.code})</b></div>`).join('');
    lastDone = -1;
  }
  let lastDone = -1, curDone = 0;
  function setDone(f){
    curDone = f;
    const k = Math.round(Math.max(0, Math.min(1, f)) * 96); if(k === lastDone) return; lastDone = k;
    [routeDone, routeTodo].forEach(m => { if(m){ scene.remove(m); m.geometry.dispose(); } });
    const w = view === 'near' ? 0.055 : 1;     // thinner line when the camera is close
    routeDone = tube(arcPts.slice(0, k + 1), doneMat, 0.0045 * w);
    routeTodo = tube(arcPts.slice(k), todoMat, 0.0028 * w);
  }

  // camera views: 'globe' (whole earth around the plane) and 'near' (chase camera)
  let view = 'globe', yaw = 0, zoom = 1, cur = null, target = null, planeState = null, ov = false;
  const tmp = new T.Vector3();
  function frame(){
    if(!planeState) return;
    const { lat, lon, hdg, alt } = planeState;
    const up = vec(lat, lon, 1).normalize();
    const north = new T.Vector3(0, 1, 0).sub(up.clone().multiplyScalar(up.y)).normalize();
    const east = new T.Vector3().crossVectors(north, up).normalize();
    const h = (hdg || 0) * rad, fwd = north.clone().multiplyScalar(Math.cos(h)).add(east.clone().multiplyScalar(Math.sin(h))).normalize();
    const altR = R * (view === 'near' ? 1.0016 : 1.004);
    const pos = up.clone().multiplyScalar(altR);
    planeHolder.position.copy(pos);
    const m = new T.Matrix4().makeBasis(new T.Vector3().crossVectors(up, fwd).normalize(), up, fwd);
    planeHolder.quaternion.setFromRotationMatrix(m);
    const near = view === 'near';
    plane.scale.setScalar(near ? 0.0075 : 0.065 * zoom);
    // camera: behind and above the plane, turned by the user's drag (yaw)
    const back = fwd.clone().applyAxisAngle(up, yaw).multiplyScalar(-1);
    let cp, look;
    if(near){ cp = pos.clone().add(back.multiplyScalar(0.028 * zoom)).add(up.clone().multiplyScalar(0.016 * zoom)); look = pos.clone().add(fwd.clone().multiplyScalar(0.01)); }
    else if(ov){ cp = up.clone().multiplyScalar(R + 0.95 * zoom).add(back.multiplyScalar(0.6 * zoom)); look = pos.clone().add(fwd.clone().multiplyScalar(0.05 * zoom)); }   // overview: higher, looking at the middle of the routes
    else { cp = up.clone().multiplyScalar(R + 0.55 * zoom).add(back.multiplyScalar(0.75 * zoom)); look = pos.clone().add(fwd.clone().multiplyScalar(0.12)); }
    target = { cp, look };
    if(!cur) cur = { cp: cp.clone(), look: look.clone() };
  }
  let raf = 0, dead = false;
  function loop(){
    if(dead) return;
    raf = requestAnimationFrame(loop);
    if(target){ cur.cp.lerp(target.cp, 0.08); cur.look.lerp(target.look, 0.08); camera.position.copy(cur.cp); camera.up.copy(cur.cp.clone().normalize()); camera.lookAt(cur.look); }
    const s = earthMat.uniforms.sun.value; sunLight.position.copy(s).multiplyScalar(10);
    renderer.render(scene, camera);
    // airport pins
    const wv = W(), hv = H(), camDir = camera.position.clone().normalize();
    labels.querySelectorAll('.g3-pin').forEach(el => { const a = aps[+el.dataset.i]; if(!a) return;
      const vis = a.p.clone().normalize().dot(camDir) > 0.12; tmp.copy(a.p).project(camera);
      el.style.display = vis && tmp.z < 1 ? '' : 'none';
      el.style.transform = `translate(${((tmp.x + 1) / 2 * wv).toFixed(1)}px, ${((1 - tmp.y) / 2 * hv).toFixed(1)}px)`; });
  }
  loop();

  // drag to turn the camera around the plane, pinch / wheel to zoom
  let drag = null, pinch = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { drag = { x: e.clientX, yaw }; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if(drag && !pinch){ yaw = drag.yaw - (e.clientX - drag.x) * 0.01; frame(); } });
  el.addEventListener('pointerup', () => { drag = null; });
  el.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.min(2.5, Math.max(0.4, zoom * (e.deltaY > 0 ? 1.1 : 0.9))); frame(); }, { passive: false });
  el.addEventListener('touchstart', e => { if(e.touches.length === 2){ pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), z: zoom }; } }, { passive: true });
  el.addEventListener('touchmove', e => { if(pinch && e.touches.length === 2){ const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); zoom = Math.min(2.5, Math.max(0.4, pinch.z * pinch.d / d)); frame(); } }, { passive: true });
  el.addEventListener('touchend', () => { pinch = null; });
  const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); }); ro.observe(box);

  // overview: all the routes of a month (or of all time) at once, with GPS traces, no plane
  let ovMeshes = [];
  function arcOf(A, B){
    const a = vec(A[0], A[1], 1), b = vec(B[0], B[1], 1), ang = a.angleTo(b), n = Math.max(16, Math.round(ang / rad * 2)), out = [];
    const lift = 0.02 * Math.min(1, ang * 4);   // longer routes arch a little higher above the ground
    for(let i = 0; i <= n; i++){ const f = i / n;
      const p = a.clone().multiplyScalar(Math.sin((1-f)*ang)).add(b.clone().multiplyScalar(Math.sin(f*ang))).divideScalar(Math.sin(ang) || 1).normalize();
      out.push(p.multiplyScalar(R * (1.0015 + lift * Math.sin(Math.PI * f)))); }
    return out;
  }
  function setRoutes(legs, tracks){
    ovMeshes.forEach(m => { scene.remove(m); m.geometry.dispose(); }); ovMeshes = [];
    plane.visible = false; ov = true;
    const max = Math.max(1, ...legs.map(l => l.n || 1));
    const routeMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const dhMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
    const trkMat = new T.MeshBasicMaterial({ color: 0xf2b84b });
    const codes = new Set();
    for(const l of legs){ const A = AP[l.dep], B = AP[l.arr]; if(!A || !B) continue; codes.add(l.dep); codes.add(l.arr);
      const m = tube(arcOf([A.lat, A.lon], [B.lat, B.lon]), l.dh ? dhMat : routeMat, 0.0016 + 0.0024 * (l.n || 1) / max); if(m) ovMeshes.push(m); }
    for(const tr of tracks || []){ const m = tube(tr.map(q => vec(q[0], q[1], R * 1.003)), trkMat, 0.0026); if(m) ovMeshes.push(m); }
    aps = [...codes].map(c => ({ code: c, name: AP[c].city, p: vec(AP[c].lat, AP[c].lon, R * 1.002) }));
    const many = aps.length > 4;   // with many airports only the codes, so the pins don't cover each other
    labels.innerHTML = aps.map((x, i) => `<div class="g3-pin${many ? ' sm' : ''}" data-i="${i}"><span class="g3-dot"></span>${many ? '' : esc(x.name || x.code) + ' '}<b>${many ? x.code : '(' + x.code + ')'}</b></div>`).join('');
    // look at the middle of the routes, from far enough to see them all
    const c = new T.Vector3(); aps.forEach(a => c.add(a.p.clone().normalize())); if(!aps.length) c.copy(vec(39.5, 2.7, 1)); c.normalize();
    const lat = Math.asin(c.y) / rad, lon = Math.atan2(c.z, -c.x) / rad - 180;
    const spread = Math.max(0.06, ...aps.map(a => a.p.clone().normalize().angleTo(c)));
    view = 'globe'; yaw = 0; zoom = Math.min(2.5, Math.max(0.3, spread / rad / 16)); cur = null;
    planeState = { lat, lon: ((lon + 540) % 360) - 180, hdg: 0 };
    frame();
  }

  return {
    setRoute, setRoutes,
    update(st, done, nowMs){ planeState = st; earthMat.uniforms.sun.value.copy(sunDir(nowMs || Date.now())); setDone(done); frame(); },
    setView(v){ view = v; zoom = 1; yaw = 0; lastDone = -1; setDone(curDone); frame(); },
    get view(){ return view; },
    snapshot(){ if(target){ camera.position.copy(target.cp); camera.up.copy(target.cp.clone().normalize()); camera.lookAt(target.look); } renderer.render(scene, camera); return renderer.domElement.toDataURL('image/jpeg', .85); },
    stop(){ dead = true; cancelAnimationFrame(raf); },
    dispose(){ dead = true; cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); box.innerHTML = ''; }
  };
}
