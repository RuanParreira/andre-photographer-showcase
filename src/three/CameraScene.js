import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { gsap } from "../lib/gsap";

// Model: "Camera CANON EOS 400D" by santy (https://sketchfab.com/Santy),
// via https://sketchfab.com/3d-models/camera-canon-eos-400d-c8c3f307e93f4c829d579d1b369e6b02
// Licensed CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) — credit
// is also surfaced on-page in the Contact/footer section per license terms.
const MODEL_URL = `${import.meta.env.BASE_URL}models/camera.glb`;
const TAU = Math.PI * 2;

// Idle "alive" layer, v2: earlier this was six independently-clocked sine
// waves (yaw/pitch/bob/drift/dolly). Individually subtle, but with six
// different periods running at once something was always at non-zero
// velocity — there was never a moment of real stillness, which reads as
// "the object has several little movements" rather than a deliberate
// camera move. This version is built around ONE slow, shaped signal
// (`cameraPhrase`) that actually holds at each end of its cycle instead of
// just touching it for an instant — yaw/dolly/pitch all read off that same
// signal (pitch lagged slightly, so the reframe feels like one continuous
// gesture rather than three axes ticking in lockstep). Light reuses the
// exact same phrase value too, scaled down, so it reads as a consequence of
// that one camera move rather than its own animation. The only thing left
// truly independent is a single, tiny sine on vertical bob — the bare
// minimum "breathing" so the long hold segments don't read as a frozen
// photo. Tested and dropped: the secondary yaw/bob harmonics and the
// horizontal drift term — they added texture but were the main source of
// "too much happening at once".
const PHRASE_PERIOD = 54; // one full hold->reframe->hold->reframe-back cycle
const PHRASE_HOLD = 0.38; // fraction of the cycle spent genuinely still
const PHRASE_MOVE = 0.12; // fraction spent easing between poses (~6.5s)
const PITCH_LAG = 1.8; // seconds pitch trails yaw/dolly

const IDLE = {
  envelopeStart: 3,
  envelopeEnd: 6,
  yawAmp: 0.035, // ~2°
  pitchAmp: 0.012,
  dollyAmp: 0.09,
  bobPeriod: 12,
  bobAmp: 0.018,
  lightSweep: 0.1, // radians the key light swings around Y
  keyPulse: 0.15, // key light intensity swing — the "highlight" moment as the reframe brings the body closer
  rimPulse: 0.12, // rim light intensity swing
};

// Scroll narrative: turning the camera around to reveal its LCD screen.
// Confirmed by direct visual testing against the model (see git history /
// PR notes) — a straight 180° yaw off the existing base pose (continuing
// the same direction the idle/pointer sway already turns, not reversing)
// lands on a clean 3/4 back view with the screen large, unobstructed and
// well lit by the same static lights that light the front, no relighting
// needed. rotationT and dollyT are each a single smoothstep over a wide
// range — that alone gives an ease-in -> accelerate -> ease-out shape
// (anticipation / turn / settle) without a multi-keyframe timeline.
// dollyT starts later than rotationT: approaching while still mid-turn
// crowds the frame at the ~90° profile pose (the object's widest silhouette),
// so the approach is held back until the turn is mostly resolved.
const TURN_ANGLE = Math.PI;
const TURN_PITCH = 0.08; // slight downward tilt onto the screen at full turn
const TURN_POS_X = 0.9; // drifts clear of the hero text as it turns
const TURN_POS_Y = -0.05;
const TURN_POS_Z = 0.5; // the approach — see dollyT
const TURN_KEY_BOOST = 0.3; // key light brightens slightly as the screen becomes the hero shot

// LCD screen: the model now has a dedicated LCD_Screen mesh (separated out
// in Blender specifically so this can be measured instead of guessed — the
// original model only had the screen baked into the body's one material,
// with no mesh/UV island of its own, which is what made the old hand-
// clicked calibration below imprecise in the first place). A second plane,
// positioned/sized to match LCD_Screen's own geometry, still stands in for
// the actual display (its own material/UVs aren't touched, and are likely
// not laid out for a clean full-bleed photo anyway) — see
// deriveScreenLocalFromMesh and its call site in _loadCameraModel.
const LCD_SCREEN_NODE_NAME = "LCD_Screen";

// Lens barrel: a dedicated Group node in the GLB ("cilindro_low1") holding
// the four material sub-meshes that make up the lens (housing, glass,
// inner ring) — confirmed via its own geometry, not guessed from how it
// looks on screen: all four sub-meshes are radially symmetric in X/Y
// (equal extents) and extruded along Z, i.e. Z is the barrel's true
// rotation axis. No rotation is baked onto this node in the export (only a
// translation), and nothing else in _tick ever touches it, so spinning its
// local Z is fully isolated from the turn/idle/pointer motion applied to
// the outer group above it.
const CYLINDER_NODE_NAME = "cilindro_low1";

// The two lens elements inside that barrel group. Both ship from the GLB in
// states that stop the lens reading as glass, and both are fixed here rather
// than in the model (every alternate .glb in Modelo3D/ carries identical
// values, so re-exporting would not help and the fix would be lost again).
//
// What the lens has to look like head-on is a DARK TUNNEL WITH A SHEEN ON IT:
// the barrel interior visible and receding, with the front element reading
// only as reflected light laid over it. Both halves of that were broken.
//
// lambert4 — the small element deep in the barrel — shipped as metalness 1
// over a grey-green base, and rendered as a bright tan facet fan: the scene's
// warm key light specularly reflected off its 20 flat triangles, blown out
// enough to flatten the whole lens into "a shiny cap with no glass".
//
// The warm core itself is wanted, though — it is how the model is authored and
// how it reads in Blender, and it is what stops the lens looking like a black
// hole. So this dims it rather than removing it, and the trick is which knob:
//
//   * as a DIELECTRIC (metalness 0) the specular is white and independent of
//     baseColor, so darkening the colour does nothing at all — measured at
//     near-black with roughness 0.7 it still came back RGB 108,74,52.
//   * as a METAL the specular *is* tinted by baseColor, so a dark warm base
//     dims the reflection and keeps its colour in one move.
//
// Hence: still metalness 1, just a much darker gold. That gives a contained
// golden glint deep in the barrel instead of a flat tan disc across it.
//
// lambert3 — the front element — declares KHR_materials_transmission (0.968)
// and so looks set up for glass, but drew nothing at all: metalness ships as 1
// (metals do not transmit, so the factor is inert), and the GLB's alphaMode
// BLEND leaves depthWrite false, so the barrel interior drawn afterwards
// painted straight over it. Measured by hiding the mesh and diffing the frame:
// as shipped, deleting the glass entirely changed the render by 0.6/255.
//
// Restoring depthWrite fixes the invisibility but overshoots — the element
// then occludes the barrel interior and the lens goes back to reading as a
// capped disc, only a black one. It cannot transmit that interior back either:
// the blanket `transparent = true` this file applies for the body fade keeps
// the whole camera out of three's opaque pass, and therefore out of the
// transmission render target the glass would sample. So the front element is
// instead treated as pure reflection, additively blended: it never occludes
// (depthWrite stays false) and never darkens, it only adds its own highlight
// over whatever shows through. That is physically the right half of the model
// for a coated element over a black interior, and it is what finally reads as
// glass rather than as a lid.
const LENS_GLASS_MATERIAL = "lambert3";
// Blurrier than real glass on purpose: the disc is 96 flat facets, and a
// mirror-sharp reflection turns each into a separate hard wedge that reads as
// a polygon fan. Spreading the lobe lets the highlight sweep across them as
// one gradient. (Smoothing the mesh normals was tried first and changes
// nothing — the wedges share no vertices, so there is nothing to average.)
const LENS_GLASS_ROUGHNESS = 0.16;
const LENS_GLASS_ENV_INTENSITY = 4;
const LENS_INNER_MATERIAL = "lambert4";
const LENS_INNER_COLOR = 0x7d5a2c;
const LENS_INNER_ROUGHNESS = 0.3;
// lambert1 is the funnel those two sit in — the cone of the barrel interior.
// It ships as a near-metal (metalness 0.95) over a mid GREY, so its 440 facets
// mirror the key light as a bright silver cone: the lens loses its interior
// entirely and reads as a solid disc from the front, whatever the glass in
// front of it does. Same fix as the core — keep it metallic so the tint
// carries, but take the base far down and warm, which both gives the front
// element a dark surround to be seen against and lets the barrel share the
// core's amber cast the way the model is authored. Unlike the core this one
// cannot simply go dark: the same material also forms the bright ring around
// the front of the barrel, which does need to catch the light.
const LENS_BARREL_MATERIAL = "lambert1";
const LENS_BARREL_COLOR = 0x241a10;
const LENS_BARREL_ROUGHNESS = 0.65;
const CYLINDER_SPIN_DURATION = 1.7; // one full turn, ease-in -> spin -> ease-out
const CYLINDER_SPIN_EASE = "sine.inOut"; // gentler accel/decel than power2 — a soft twist, not a snap

// Mode dial (top plate, has an OFF position among its icons — reads as
// power on/off). A small physical dial with click-stops in real life, not a
// barrel that spins freely like the lens — so it's a two-state toggle
// (rest <-> swung a small arc) rather than a full turn. Node name matches
// the mesh's own name in the GLB (no renaming needed to identify it). Its
// mesh is a flat disc modeled with its face in the local X-Z plane and
// normal along local Y (confirmed the same way as the lens: X/Z extents
// match, Y is far smaller, in the mesh's own un-rotated bounding box) —
// but unlike the lens, this node already carries a baked resting rotation
// in the export (however far it needed tilting to sit correctly on the
// body), so spinning it can't just tween .rotation directly (see
// _spinDialToggle for why, and how the base orientation is preserved).
//
// The small ridged switch ring ("pCylinder8") that used to sit alongside
// this one had the same click-to-toggle treatment, but its geometry has an
// open/cut-away interior that shows through once it's rotated off its
// resting pose — a model problem, not fixable from code — so that
// interaction was removed. The mesh itself is still in the GLB and still
// renders (as an inert body part, like the rest of the shell); it's just
// no longer clickable/spinnable.
const MODE_DIAL_NODE_NAME = "pCylinder9";
const DIAL_LOCAL_AXIS = new THREE.Vector3(0, 1, 0);
const MODE_DIAL_SWING = THREE.MathUtils.degToRad(28);
const DIAL_SWING_DURATION = 0.5;
const DIAL_SWING_EASE = "sine.inOut";
// How much bigger than the dial's own real footprint its invisible
// click-comfort proxy is — see _addComfortHitProxy.
const DIAL_HIT_MARGIN = 1.4;

// Shutter button: the GLB's own "Botao" mesh (separated out in Blender to
// mark where it goes) came through as a degenerate flat triangle — not
// worth trying to shade/light as a real button — so it's hidden on load
// (see _loadCameraModel) and replaced with a small procedural button built
// straight from Three.js primitives instead, attached at the same spot.
// BUTTON_LOCAL_POSITION is that spot: the center of "Botao"'s own bounding
// box, converted into group2-local space (the same space
// cilindro_low1/pCylinder8/pCylinder9/Mid_2 all live in as siblings) by
// hand — Botao has no transform of its own, only geometry, sitting
// directly in its parent Mid_2's local space, so this is Mid_2's own
// translation/scale applied to that bounding-box center. Recorded as a
// constant (rather than derived at load time like the lens/screen) since,
// unlike those, there's no usable geometry left on the real node to derive
// it from.
const BUTTON_NODE_NAME = "Botao";
const BUTTON_LOCAL_POSITION = new THREE.Vector3(-1.605, 0.758, 0.421);
// The body panel at that spot slopes forward toward the lens rather than
// sitting flat like the mode dial's top-down surface, so the button is
// pitched forward (tilted around local X, toward +Z where the lens points)
// to lean with it instead of standing straight up — tuned by eye against
// that panel line, not measured.
const BUTTON_TILT_X = THREE.MathUtils.degToRad(50);
const BUTTON_RADIUS = 0.12;
const BUTTON_COLLAR_HEIGHT = 0.016;
const BUTTON_PRESS_DEPTH = 0.02;
const BUTTON_PRESS_DURATION = 0.09; // quick, snappy — a shutter click, not a slow toggle
// How much bigger than the button's own visible radius its invisible
// click-comfort proxy is — see _addComfortHitProxy.
const BUTTON_HIT_MARGIN = 1.5;

// Shutter release: pressing the button now actually "takes a photo" —
// sound + flash + a physical kick of the body — all fired together from
// _fireShutter at the exact bottom of the press (the tween's yoyo turn, see
// handleShutterButtonClick), so the click, the clarão and the jolt land on
// the same instant rather than trailing each other.
//
// The three parts are deliberately split by ownership: the recoil and the
// scene-light burst live here (they're 3D state), while the fullscreen flash
// overlay is a DOM/GSAP layer owned by Hero.jsx and triggered through the
// onShutterFire callback — same shape as the existing onScreenEnter/Exit
// handoff.
const SHUTTER_SOUND_URL = `${import.meta.env.BASE_URL}effect/camera.mp3`;
const SHUTTER_SOUND_VOLUME = 0.45;

// Scene-side half of the flash: a short additive spike on the key light, so
// the model itself is momentarily lit by its own flash instead of just
// sitting behind a white DOM overlay. Additive on top of whatever the idle/
// reveal layers computed that frame (see _tick), never a replacement, so it
// can't strand the light at a wrong intensity if a second click interrupts.
const FLASH_KEY_BOOST = 5.5; // added to the key light's ~4.2 base at peak
const FLASH_ATTACK = 0.035; // near-instant ignition
const FLASH_DECAY = 0.26; // and a fast falloff — a burst, not a lamp

// Recoil: the mirror-slap jolt. Deliberately tiny (KICK_PITCH is ~1.3°) —
// this should register as the body having been physically knocked, not as
// the model being animated. Applied additively to the composed pose in
// _tick, so it lands identically at any point of the turn/idle narrative,
// whatever angle the camera happens to be sitting at.
const KICK_PITCH = -0.023; // nose lifts
const KICK_YAW = 0.009; // and twists slightly — a hand-held camera never kicks on one clean axis
const KICK_Y = 0.017;
const KICK_ATTACK = 0.05; // the hit itself
const KICK_SETTLE = 0.7; // and the damped wobble back to rest
const KICK_SETTLE_EASE = "elastic.out(1, 0.4)";

// Used only if a loaded model doesn't have an LCD_SCREEN_NODE_NAME mesh
// (e.g. an older/alternate .glb) — hand-calibrated by raycasting the
// rendered LCD's corners at the settled hero-shot pose and solving for the
// plane's orthonormal basis in modelGroup-local space, and known to be
// slightly off in that case (see SCREEN_INSET_FALLBACK below).
const SCREEN_LOCAL_FALLBACK = {
  position: new THREE.Vector3(0.3286, -0.1838, -1.3178),
  right: new THREE.Vector3(-0.99957, 0.02868, -0.00669),
  up: new THREE.Vector3(0.0287, 0.99958, -0.00299),
  normal: new THREE.Vector3(0.0066, -0.00318, -0.99997),
  width: 1.4615,
  height: 1.2162,
};

// modelGroup-local position/orientation/size of `node`, in the same
// convention SCREEN_LOCAL_FALLBACK uses (position = center; right/up/normal
// = orthonormal basis; width/height = real-world size) — read directly off
// its geometry and world matrix rather than eyeballed. Must be called
// before modelGroup's own normalize scale/position is applied (see
// _loadCameraModel) — matrixWorld is relative to `node`'s ancestors only,
// not modelGroup's later adjustment, exactly the space these values need to
// be in. Assumes the mesh is a roughly flat quad lying in its own local XY
// plane (true of a screen face separated straight out of the body mesh),
// so local X/Y/Z map directly to right/up/normal.
function deriveScreenLocalFromMesh(node) {
  node.geometry.computeBoundingBox();
  const box = node.geometry.boundingBox;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  node.updateMatrixWorld(true);
  const matrix = node.matrixWorld;

  const origin = new THREE.Vector3(0, 0, 0).applyMatrix4(matrix);
  const xAxis = new THREE.Vector3(1, 0, 0).applyMatrix4(matrix).sub(origin);
  const yAxis = new THREE.Vector3(0, 1, 0).applyMatrix4(matrix).sub(origin);
  const zAxis = new THREE.Vector3(0, 0, 1).applyMatrix4(matrix).sub(origin);

  return {
    position: center.applyMatrix4(matrix),
    right: xAxis.clone().normalize(),
    up: yAxis.clone().normalize(),
    normal: zAxis.clone().normalize(),
    width: size.x * xAxis.length(),
    height: size.y * yAxis.length(),
  };
}

// Only meaningful as a margin against SCREEN_LOCAL_FALLBACK's imprecision —
// a much smaller SCREEN_INSET_MEASURED applies once a model with a real
// LCD_SCREEN_NODE_NAME mesh is loaded, since that calibration is measured,
// not guessed. See _loadCameraModel.
const SCREEN_INSET_FALLBACK = 0.72;
// The measured calibration is exact for the flat rectangle itself, but the
// physical LCD bezel opening has slightly rounded corners while the plane's
// corners are sharp — without any margin, each sharp corner pokes a sliver
// past the bezel's curve and gets clipped. Just enough inset to clear that
// curve, not to compensate for a wrong calibration.
const SCREEN_INSET_MEASURED = 0.97;

// How far the photo plane floats off the LCD_Screen backing it would
// otherwise be exactly coplanar with, as a fraction of the plane's own width
// (so it scales with the model instead of being a magic world-space number).
// See the lift in _updateScreenPlane for why polygonOffset could not carry
// this on its own.
const SCREEN_SURFACE_LIFT = 0.006;

// The screen no longer grows on scroll — scrolling only turns the camera to
// reveal the LCD and settles there. Filling the frame is now a deliberate
// action: click the LCD once it's turned into view and the Three.js CAMERA
// itself travels toward the screen's fixed physical position (see
// _dollyTarget/_tick below) until real perspective makes it fill the frame —
// like walking up to a TV, not the photo inflating in place — independent
// of however far/fast the user happens to be scrolling at that moment.
//
// That approach runs in TWO legs, because a single move could not be both.
// The scroll narrative deliberately leaves the camera at a 3/4 pose — the
// LCD sits ~23° off the view axis at the settled hero shot, and as much as
// ~42° at the earliest point the click is allowed (measured, not estimated).
// Pushing straight in from there put the viewpoint close to a plane it was
// never square to, so at the end of the move the photo was severely
// foreshortened and swung off to one side: it read as sliding past the
// camera at an angle rather than going into it. The old x/y pan tried to
// paper over this by recentring early in the move, which is what produced
// the diagonal drift.
//
// So: leg one straightens and centres (the model eases to a pose where the
// LCD is dead centre and square to the viewport, nothing else changes — same
// depth, same apparent size), then a beat of genuine stillness, then leg two
// pushes the camera straight down the view axis with no lateral component at
// all. entryT (0 = resting, 1 = arrived) is the single parameter both legs
// read off, in exactly the same style as the scroll narrative's
// rotationT/dollyT/revealT: one signal, shaped into overlapping phases by
// smoothstep windows. The gap between ENTRY_ALIGN_END and
// ENTRY_APPROACH_START is the hold, and because the windows are ordered, a
// reversal (see _tick's auto-close) unwinds them in the correct reverse
// order for free — the camera retreats first, and only then does the model
// swing back to its scroll pose.
const ENTRY_DURATION = 2.5;
const ENTRY_ALIGN_END = 0.34; // straighten + centre: the first ~0.85s
const ENTRY_APPROACH_START = 0.44; // ~0.25s of stillness, then ~1.4s of straight push
const SLIDE_HOLD_DURATION = 3.2; // seconds each LCD slideshow photo stays fully visible
const SLIDE_FADE_DURATION = 0.8; // seconds to dip to transparent and back (texture swaps at the midpoint) between slides
const CLICK_MIN_PROGRESS = 0.55; // scroll progress by which the turn (rotationT = smoothstep(0.15, 0.75, progress), ~74% done here) has resolved enough for the LCD to read clearly, without waiting for the full settle/approach/light-boost tail
const CLICK_EXIT_BUFFER = 0.15; // scrolling back below CLICK_MIN_PROGRESS - this re-closes an open/opening screen, so returning to Hero shows the camera normally instead of stuck fullscreen

function smoothstep(edge0, edge1, x) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

// Walks up from a raycast hit's object through its ancestors to check
// whether `root` is one of them — used by the hitTest* methods below to
// ask "does the nearest surface at this pixel belong to me?" against a
// single shared raycast, instead of each part testing its own geometry in
// isolation (see _pickNearest).
function isDescendantOf(object, root) {
  for (let node = object; node; node = node.parent) {
    if (node === root) return true;
  }
  return false;
}

// Like isDescendantOf, but also recognizes a hit-comfort proxy that was
// deliberately placed as a SIBLING of `root` rather than a child of it (see
// _addComfortHitProxy) — necessary for the mode dial specifically, since a
// proxy nested under a node with both rotation and non-uniform scale gets
// sheared into the wrong size/position, so its proxy lives one level up
// instead, tagged with userData.owner pointing back at the part it belongs
// to.
function hitBelongsTo(hit, root) {
  if (!hit) return false;
  return isDescendantOf(hit.object, root) || hit.object.userData.owner === root;
}

// Gentler in/out than smoothstep — used so the phrase's hold->move
// transitions accelerate and decelerate rather than starting/stopping on a
// dime.
function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// A slow ping-pong between two poses (-1 and 1) that spends most of the
// cycle actually holding at each end — not just passing through it — with a
// short eased reframe in between. This is the one signal the whole idle
// layer reads from.
function cameraPhrase(elapsed, lag = 0) {
  const t = elapsed - lag;
  const cycle = ((t % PHRASE_PERIOD) + PHRASE_PERIOD) % PHRASE_PERIOD;
  const p = cycle / PHRASE_PERIOD;
  if (p < PHRASE_HOLD) return 1;
  if (p < PHRASE_HOLD + PHRASE_MOVE) {
    return 1 - 2 * smootherstep((p - PHRASE_HOLD) / PHRASE_MOVE);
  }
  if (p < 2 * PHRASE_HOLD + PHRASE_MOVE) return -1;
  return (
    -1 + 2 * smootherstep((p - (2 * PHRASE_HOLD + PHRASE_MOVE)) / PHRASE_MOVE)
  );
}

export class CameraScene {
  constructor(
    canvas,
    {
      getScrollProgress,
      screenImages,
      onScreenEnter,
      onScreenExit,
      onShutterFire,
    } = {},
  ) {
    this.canvas = canvas;
    this.getScrollProgress = getScrollProgress ?? (() => 0);
    this.screenImages = screenImages ?? [];
    this.onScreenEnter = onScreenEnter;
    this.onScreenExit = onScreenExit;
    this.onShutterFire = onShutterFire;
    this.startTime = performance.now();
    this.pointer = { x: 0, y: 0 };
    this.active = true;
    this.disposed = false;
    this.modelLoaded = false;
    this.raycaster = new THREE.Raycaster();
    // Every mesh a click could legitimately be blocked by — populated once
    // the whole model (body + lens + dial + shutter button, including
    // their invisible comfort-margin hit proxies) is assembled — see
    // _pickNearest and the comment where this is built in _loadCameraModel.
    this._occluders = [];
    // Overwritten in _loadCameraModel if the loaded model has an
    // LCD_SCREEN_NODE_NAME mesh — see deriveScreenLocalFromMesh. Falls back
    // to the hand-calibrated (imprecise) constants otherwise.
    this.screenLocal = SCREEN_LOCAL_FALLBACK;
    this.screenInset = SCREEN_INSET_FALLBACK;
    // Set once the model loads, if it has a CYLINDER_NODE_NAME group — see
    // hitTestCylinder/handleCylinderClick.
    this.lensCylinder = null;
    // Alternates each click: 1 = spin left (CCW as seen on screen), -1 =
    // spin right (CW) — see handleCylinderClick.
    this._cylinderSpinDir = 1;
    // Set once the model loads, if it has the matching node — see
    // _makeDialState/_spinDialToggle.
    this.modeDial = null;
    // Built in _loadCameraModel regardless of the GLB's own (broken) Botao
    // mesh — see BUTTON_LOCAL_POSITION above and _buildShutterButton.
    this.shutterButton = null;
    this._shutterButtonBasePosition = null;
    this._shutterButtonPressAxis = null;
    this._shutterPressT = 0;
    this._shutterPressed = false;
    // Shutter-release state, all composed additively in _tick (see
    // _fireShutter): _flashT is the key light's burst envelope, _kick the
    // body's recoil offsets. Both rest at 0, so a scene that never fires the
    // shutter behaves exactly as before.
    this._flashT = 0;
    this._kick = { pitch: 0, yaw: 0, y: 0 };
    this._shutterAudio = this._createShutterAudio();
    // Slideshow: the LCD cycles through screenImages while idle (see
    // _updateSlideshow). _lastTickTime feeds a per-frame delta rather than
    // an absolute clock so progress pauses while inactive (off-screen)
    // instead of jumping several slides on reactivation.
    this._lastTickTime = performance.now();
    this._slideTextures = [];
    this._slideIndex = 0;
    this._slideElapsed = 0;
    this._slideSwapped = false;
    // entryT eases toward entryTarget every frame (see _tick) — the single
    // parameter the align and approach legs are both shaped from. Continuous
    // + reversible by construction, rather than a one-shot timer, so
    // scrolling back out mid- or post-transition can ease it back to 0
    // instead of leaving it stuck open (see handleScreenClick/_tick).
    this.entryT = 0;
    this.entryTarget = 0;
    this._entryAnimFrom = 0;
    this._entryAnimStart = 0;
    this._entryAnimDuration = ENTRY_DURATION;
    // The straight-on pose the align leg eases the model into, recomputed at
    // each click from wherever the scroll narrative currently has it — see
    // _computeEntryPose.
    this._entryPose = null;
    // modelGroup-local -> screen-plane orientation, derived once on load —
    // see _screenBasisQuaternion.
    this._screenBasisQuat = null;
    this._screenEntered = false; // guards onScreenEnter firing once per open

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Without tone mapping, NoToneMapping clips any highlight past 1.0
    // straight to white — once the env/glass lighting was added, that
    // clipping is what read as "washed out" instead of a dark, moody
    // camera body. ACES compresses highlights instead of clipping them.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.cameraBaseZ = 6; // resting distance; dollies toward the screen as entryT -> 1 (see _tick)
    this.camera.position.set(0, 0, this.cameraBaseZ);

    // The lens glass uses KHR_materials_transmission (real glass refraction),
    // which needs something to refract — with no scene.environment it reads
    // as a near-invisible hole instead of glass. This lights it without
    // touching scene.background, so the canvas stays transparent.
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;

    this._buildLights();
    this._loadCameraModel();

    this._handleResize = this._handleResize.bind(this);
    this._tick = this._tick.bind(this);

    this._handleResize();
    window.addEventListener("resize", this._handleResize);
    this._frameId = requestAnimationFrame(this._tick);
  }

  // Neutral-leaning setup: a saturated blue hemisphere/fill previously
  // painted the black plastic body navy — plastic that's really neutral
  // black should read as black, not tinted, so the room light stays close
  // to white/grey and only the rim keeps a warm accent.
  _buildLights() {
    const key = new THREE.DirectionalLight(0xfff2d9, 4.2);
    key.position.set(4, 5.5, 6);

    const fillFront = new THREE.DirectionalLight(0x8fa0b8, 0.9);
    fillFront.position.set(-5, 1.5, 4);

    const rim = new THREE.DirectionalLight(0xc9a25c, 1.8);
    rim.position.set(-3, -1.5, -6);

    const hemi = new THREE.HemisphereLight(0x6c7686, 0x171310, 1.1);

    // Kept for the idle light layer in _tick: the key light orbits its base
    // position by a few degrees and pulses intensity, the rim pulses too —
    // both driven by the same `cameraPhrase` value as the model's idle
    // reframe, so the light reads as a consequence of that movement (closer
    // to the light during the "in" pose) rather than its own animation.
    this.keyLight = key;
    this.rimLight = rim;
    this._keyBasePos = key.position.clone();
    this._keyBaseIntensity = key.intensity;
    this._rimBaseIntensity = rim.intensity;

    this.scene.add(key, fillFront, rim, hemi);
  }

  // The GLB's own scale/pivot/orientation are whatever the source file
  // shipped with — normalize to a unit-ish footprint centered on the
  // pivot, then face the lens toward the viewer (+Z, matching the camera
  // at z=6) so baseRotation/pointer/scroll follow behave the same way
  // they did for the old hand-built model.
  _loadCameraModel() {
    this.group = new THREE.Group();
    this.group.name = "camera";

    this.baseRotation = { x: 0.12, y: -0.35 };
    // Entrance pose: turned further away and scaled down, then _tick eases
    // both back to baseRotation/scale-1 with the same lerp it already uses
    // for pointer/scroll follow — so the model swings and grows into place
    // on load instead of popping in at full size mid-rotation.
    // `driven` is the lerped accumulator for pointer/scroll/entrance motion;
    // _tick composes the actual group transform from driven + the stateless
    // idle layer each frame, so the two never compound into each other.
    this.driven = {
      x: this.baseRotation.x + 0.22,
      y: this.baseRotation.y - 0.9,
      scale: 0.01,
      posX: 0,
      posY: 0,
      posZ: 0,
    };
    this.group.rotation.set(this.driven.x, this.driven.y, 0);
    this.group.scale.setScalar(this.driven.scale);
    this.scene.add(this.group);

    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (this.disposed) return;
        const model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 2.2 / maxDim;

        // Must run before model.scale/position are normalized below —
        // deriveScreenLocalFromMesh needs LCD_Screen's matrixWorld relative
        // to modelGroup's own (still-raw) transform, not the normalized one.
        // Guarded on .geometry too: an object merely named LCD_SCREEN_NODE_NAME
        // isn't enough — an Empty (or a mesh that lost its geometry on
        // export/re-export) has no bounding box to derive anything from.
        const lcdScreenNode = model.getObjectByName(LCD_SCREEN_NODE_NAME);
        if (lcdScreenNode?.geometry) {
          this.screenLocal = deriveScreenLocalFromMesh(lcdScreenNode);
          this.screenInset = SCREEN_INSET_MEASURED;
        } else {
          console.warn(
            lcdScreenNode
              ? `[CameraScene] "${LCD_SCREEN_NODE_NAME}" exists but has no geometry (likely an ` +
                  "Empty, or the mesh detached on export) — falling back to the hand-calibrated " +
                  "(imprecise) screen position."
              : `[CameraScene] No "${LCD_SCREEN_NODE_NAME}" object in the loaded model — ` +
                  "falling back to the hand-calibrated (imprecise) screen position.",
          );
        }

        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));
        // Lens faces the model's own +Z after export, matching the old
        // model's forward axis, so no extra flip is needed here.

        // The RoomEnvironment is bright by design (it's meant to be seen,
        // not just felt) — at full intensity it washes the body out past
        // the site's dark, warm tone. Keep it faint everywhere except the
        // glass, which still needs a strong enough env to read as glass
        // rather than a flat disc.
        this._bodyMaterials = [];
        model.traverse((child) => {
          if (!child.isMesh) return;
          // LCD_Screen is mainly a geometric reference now (for
          // deriveScreenLocalFromMesh above) — the actual photo is the
          // separate screenPlane (see _buildScreenPlane) floating just in
          // front of it, so this mesh's own material/UVs (whatever it kept
          // from being part of the body) are never actually seen... except
          // during _updateSlideshow's brief dip to fully transparent between
          // slides, when the plane in front of it goes see-through. Hiding
          // it outright left that instant showing straight through the LCD
          // opening into the hollow camera body behind — swapping in a
          // plain opaque backing instead means that flicker reads as "the
          // screen went blank for a frame", not "you can see inside the
          // camera". Skipped from the body-opacity fade list on purpose: it
          // should stay solid regardless, since by the time the body has
          // faded away in the click-to-enter transition the foreground
          // screenPlane already fills the frame and this is occluded anyway.
          if (child.name === LCD_SCREEN_NODE_NAME) {
            child.material = new THREE.MeshBasicMaterial({
              color: 0x030303,
              toneMapped: false,
            });
            return;
          }
          // The GLB's own shutter-button mesh came through as a degenerate
          // flat triangle (see BUTTON_NODE_NAME above) — hidden rather than
          // shaded/lit like a real part, and replaced with a procedural
          // stand-in built after this traversal (see _buildShutterButton).
          if (child.name === BUTTON_NODE_NAME) {
            child.visible = false;
            return;
          }
          // The old switch ring (see POWER_RING removal above) sits almost
          // exactly where the new procedural shutter button now lives —
          // left visible as an inert body part at first, but the two
          // visually crowd/overlap in that corner, so it's hidden now that
          // the button has taken over that spot.
          if (child.parent?.name === "pCylinder8") {
            child.visible = false;
            return;
          }
          if (child.material?.name === LENS_GLASS_MATERIAL) {
            this._setUpLensGlass(child.material);
          } else if (child.material?.name === LENS_INNER_MATERIAL) {
            this._setUpLensInner(child.material);
          } else if (child.material?.name === LENS_BARREL_MATERIAL) {
            child.material.color.setHex(LENS_BARREL_COLOR);
            child.material.roughness = LENS_BARREL_ROUGHNESS;
            child.material.envMapIntensity = 0.18;
          } else {
            child.material.envMapIntensity = 0.18;
          }
          // transparent is set up front (rather than toggled later) since
          // enabling it on the fly after the material's first compile can
          // require a shader recompile/flash — cheap to always have it on
          // for a body that's opaque 99% of the time anyway.
          child.material.transparent = true;
          this._bodyMaterials.push(child.material);
        });

        this.lensCylinder = model.getObjectByName(CYLINDER_NODE_NAME) ?? null;
        if (!this.lensCylinder) {
          console.warn(
            `[CameraScene] No "${CYLINDER_NODE_NAME}" object in the loaded model — click-to-spin disabled.`,
          );
        }
        this.modeDial = this._makeDialState(model, MODE_DIAL_NODE_NAME);

        this._buildShutterButton(model);

        // Every mesh a click could legitimately be blocked by — the whole
        // body plus the lens/dial/button and their invisible comfort-margin
        // proxies (all already attached above) — used by _pickNearest so a
        // hit-test asks "what's actually the frontmost surface here?"
        // instead of testing each part's geometry in isolation, which is
        // what let clicks register through parts that were really occluded
        // (e.g. the lens, from an angle where the body panel is genuinely
        // in front of it).
        //
        // Two kinds of mesh are deliberately left out despite being real
        // geometry: LCD_Screen's own backing (sits almost exactly
        // coincident with screenPlane's own geometry — see the
        // LCD_SCREEN_NODE_NAME branch above — purely to hide the hollow
        // body during the slideshow's transparent dip; including it would
        // make screenPlane vs. its own backing a coin flip for whichever
        // the raycaster happens to hit first), and anything hidden
        // (`visible = false`, e.g. the broken Botao triangle or the old
        // switch ring above) — raycasting ignores `.visible` entirely, so
        // without this check hidden dead geometry would still silently
        // block clicks. The one exception is the invisible comfort-margin
        // hit proxies built below/in _buildShutterButton, which — despite
        // also being invisible — are tagged isHitProxy specifically so
        // they're kept.
        this._occluders = [];
        model.traverse((child) => {
          if (!child.isMesh) return;
          if (child.name === LCD_SCREEN_NODE_NAME) return;
          if (!child.visible && !child.userData.isHitProxy) return;
          this._occluders.push(child);
        });

        this.modelGroup = model;
        this.group.add(model);
        this.modelLoaded = true;

        this._screenBasisQuat = this._screenBasisQuaternion();
        this._buildScreenPlane();
      },
      undefined,
      (err) => console.error("[CameraScene] failed to load camera model", err),
    );
  }

  // The front element as pure reflected light — see LENS_GLASS_MATERIAL above
  // for why it is modelled that way rather than as transmissive glass. Black
  // base colour plus AdditiveBlending means the material contributes only its
  // specular and environment reflection: everything behind it still shows
  // through at full strength, and the sheen sits on top. depthWrite stays off
  // so it can never occlude the barrel interior (which is what made it read as
  // a lid), and transmission is explicitly cleared because the GLB sets it and
  // it does nothing useful here.
  _setUpLensGlass(material) {
    material.metalness = 0;
    material.roughness = LENS_GLASS_ROUGHNESS;
    material.color.setHex(0x000000);
    material.envMapIntensity = LENS_GLASS_ENV_INTENSITY;
    material.blending = THREE.AdditiveBlending;
    material.depthWrite = false;
    if (material.isMeshPhysicalMaterial) {
      material.transmission = 0;
      // The coating: a second, tighter specular lobe over the base one is most
      // of what sells this as a lens rather than a smudge of light.
      material.clearcoat = 1;
      material.clearcoatRoughness = 0.03;
    }
  }

  // Stays a lit metal on purpose — see LENS_INNER_MATERIAL above. It has to be
  // lit to glint across its facets at all (an unlit material renders as one
  // flat disc, which is what turned the core into a black hole), and it has to
  // be metallic for the dark gold base to actually tint and dim the reflection
  // rather than being ignored.
  _setUpLensInner(material) {
    material.metalness = 1;
    material.roughness = LENS_INNER_ROUGHNESS;
    material.color.setHex(LENS_INNER_COLOR);
    material.envMapIntensity = 0.5;
  }

  // The rotation that takes modelGroup-local space to the screen plane's own
  // orientation, cached once (screenLocal never changes after load) instead
  // of rebuilt from a Matrix4 every frame in _updateScreenPlane.
  //
  // The subtlety it exists to handle: screenPlane is a PlaneGeometry, whose
  // TEXTURED front face is its own +Z. Attaching it with its +Z pointing into
  // the camera body means the photo is only ever seen from behind — which
  // renders it mirrored horizontally (DoubleSide keeps it visible, so this
  // goes unnoticed while the LCD is small and steeply foreshortened, but it
  // is plainly wrong once the entry align turns the screen square-on, and it
  // would flip left-to-right at the handoff to Hero's DOM <img>, which is
  // exactly what that crossfade is supposed to make seamless).
  //
  // Which way the LCD mesh's own +Z points is not something to assume: the
  // measured basis from deriveScreenLocalFromMesh has it pointing INTO the
  // body, while the hand-calibrated SCREEN_LOCAL_FALLBACK has it pointing
  // out — so a blanket flip would fix one path and break the other. Decide
  // from the geometry instead. modelGroup is centred on its own bounding box
  // (see _loadCameraModel), so the screen's own centre doubles as the
  // outward direction from the body, and a normal pointing against it is
  // pointing inward. `right` is flipped alongside `normal` so the basis stays
  // right-handed — negating the normal alone would make it a reflection,
  // which setFromRotationMatrix cannot represent and would silently produce
  // a garbage quaternion.
  _screenBasisQuaternion() {
    const { right, up, normal, position } = this.screenLocal;
    const facesOutward = normal.dot(position) >= 0;
    return new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(
        facesOutward ? right : right.clone().negate(),
        up,
        facesOutward ? normal : normal.clone().negate(),
      ),
    );
  }

  // The plane that stands in for the LCD. It's a top-level child of the
  // scene, NOT of modelGroup — its transform is fully recomputed from
  // scratch every frame in _tick (see _updateScreenPlane), always flush
  // against the physical screen; it's the CAMERA that moves to fill the
  // frame with it (see _dollyTarget). Being scene-level rather than nested
  // avoids any reparenting when the click-triggered transition starts or
  // reverses — nothing to hand off, just a continuous function of
  // entryT, so it's reversible for free the same way the turn
  // narrative is.
  _buildScreenPlane() {
    if (!this.screenImages.length) return;
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x1a1a1a,
      side: THREE.DoubleSide,
      toneMapped: false, // unlit + untouched by ACES — must match the DOM <img> exactly at crossfade
      transparent: true, // _updateSlideshow dips opacity to 0 between slides
      // LCD_Screen's real geometry isn't perfectly flat, so it doesn't sit
      // at a single consistent depth relative to this idealized flat plane
      // (see deriveScreenLocalFromMesh) — with normal depth testing, its
      // opaque backing material (_loadCameraModel) would win the z-test in
      // places and hide the photo behind it. A GPU polygon offset nudges
      // this material's depth-buffer value specifically (not its actual
      // position) just enough to consistently win against that near-
      // coplanar backing, without disabling depth testing outright —
      // unlike depthTest:false (tried first), it still gets correctly
      // hidden behind the rest of the body when viewed from angles where
      // that's the physically correct occlusion (e.g. face-on, before the
      // turn reveals the screen).
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.screenPlane = new THREE.Mesh(geometry, material);
    this.scene.add(this.screenPlane);

    // Every slide loads up front (there are only a handful) so cycling
    // between them is just swapping which already-decoded texture is
    // assigned, not a mid-slideshow network stall.
    const loader = new THREE.TextureLoader();
    this._slideTextures = new Array(this.screenImages.length).fill(null);
    this.screenImages.forEach((url, i) => {
      loader.load(url, (texture) => {
        if (this.disposed) return;
        texture.colorSpace = THREE.SRGBColorSpace;
        this._slideTextures[i] = texture;
        if (i === 0 && !material.map) {
          material.map = texture;
          material.color.set(0xffffff);
          material.needsUpdate = true;
        }
      });
    });
  }

  // Cycles the LCD through screenImages while idle (entryTarget === 0):
  // hold each slide for SLIDE_HOLD_DURATION, then dip the plane's opacity to
  // 0 and back to 1 over SLIDE_FADE_DURATION, swapping the texture at the
  // fully-transparent midpoint so the swap itself is invisible — a crossfade
  // built from the single existing plane/material rather than a second
  // overlapping mesh. Frozen (opacity forced to 1, no advancing) the moment
  // a click starts the enter transition, so whichever slide is on screen at
  // that instant is the one that dollies in and hands off to Hero.jsx.
  _updateSlideshow(dt) {
    if (!this.screenPlane) return;
    if (this.entryTarget !== 0 || this._slideTextures.length < 2) {
      this.screenPlane.material.opacity = 1;
      return;
    }

    this._slideElapsed += dt;
    const cycle = SLIDE_HOLD_DURATION + SLIDE_FADE_DURATION;
    if (this._slideElapsed >= cycle) this._slideElapsed -= cycle;

    if (this._slideElapsed < SLIDE_HOLD_DURATION) {
      this.screenPlane.material.opacity = 1;
      this._slideSwapped = false;
      return;
    }

    const fadeT =
      (this._slideElapsed - SLIDE_HOLD_DURATION) / SLIDE_FADE_DURATION;
    if (fadeT < 0.5) {
      this.screenPlane.material.opacity = 1 - fadeT * 2;
      return;
    }

    if (!this._slideSwapped) {
      this._slideSwapped = true;
      this._slideIndex = (this._slideIndex + 1) % this._slideTextures.length;
      const texture = this._slideTextures[this._slideIndex];
      if (texture) {
        this.screenPlane.material.map = texture;
        this.screenPlane.material.needsUpdate = true;
      }
    }
    this.screenPlane.material.opacity = (fadeT - 0.5) * 2;
  }

  // Where the CAMERA (not the plane) travels to for the "entering the LCD"
  // transition: a point `distance` in front of the screen's current world
  // position, where `distance` is chosen so the screen's own fixed physical
  // size exactly fills the frame — i.e. the fill comes from getting close
  // enough (real perspective), the same way walking up to a TV makes it
  // fill your vision, not from the screen object itself growing. Using
  // min(dHeight, dWidth) means the tighter dimension lands exactly on frame
  // edge while the other overflows and gets clipped — that overflow is the
  // "cover" crop, done by the frustum instead of a UV crop.
  _dollyTarget(attachedPos, width, height) {
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const viewportAspect = window.innerWidth / window.innerHeight;
    const dHeight = height / (2 * Math.tan(vFov / 2));
    const dWidth = width / (2 * Math.tan(vFov / 2) * viewportAspect);
    const distance = Math.max(0.3, Math.min(dHeight, dWidth));
    return { x: attachedPos.x, y: attachedPos.y, z: attachedPos.z + distance };
  }

  // Keeps the plane flush against the physical LCD at all times — tracking
  // modelGroup's current world transform (correct through the whole turn/
  // reveal/approach narrative) — at its own true size. It never grows;
  // "filling the screen" is achieved by the CAMERA moving toward it (see
  // _dollyTarget, driven from _tick's entryT), which is what actually
  // reads as entering the panel rather than the photo inflating in place.
  _updateScreenPlane() {
    if (!this.screenPlane || !this.modelGroup) return null;

    this.modelGroup.updateMatrixWorld(true);
    const screenLocal = this.screenLocal;
    const attachedPos = this.modelGroup.localToWorld(
      screenLocal.position.clone(),
    );
    const attachedQuat = this.modelGroup
      .getWorldQuaternion(new THREE.Quaternion())
      .multiply(this._screenBasisQuat);
    const worldScale = this.modelGroup.getWorldScale(new THREE.Vector3()).x;
    const planeWidth = screenLocal.width * worldScale * this.screenInset;
    const planeHeight = screenLocal.height * worldScale * this.screenInset;

    // Float the photo just clear of the LCD_Screen backing mesh, which it is
    // otherwise exactly coplanar with (that mesh is a mere ~7e-6 world units
    // thick — see _screenBasisQuaternion for why it is there at all).
    //
    // The material's polygonOffset used to be the only thing keeping these
    // two apart, and it quietly stopped being enough the moment the entry
    // align turned the plane exactly perpendicular to the view axis: the
    // offset's `factor` term scales with the polygon's depth SLOPE, which is
    // zero for a plane square to the camera, leaving only the small `units`
    // term. The two surfaces then z-fought and the near-black backing won —
    // the photo blanked out at exactly the moment it was supposed to fill the
    // frame. Raising `units` far enough to cover it (it took ~256) would also
    // start letting the photo punch through the camera body when viewed
    // face-on, which is the one thing polygonOffset was chosen over
    // depthTest:false to avoid. A real separation along the plane's own
    // outward normal costs nothing, works at every viewing angle, and keeps
    // the body occlusion honest. polygonOffset stays as well, still earning
    // its keep at oblique angles where the slope term is large.
    //
    // At this model's size the lift is ~0.3% of the camera body's width —
    // well inside the bezel margin the inset above already leaves, so the
    // photo cannot ride up over the bezel edge at grazing angles.
    attachedPos.addScaledVector(
      new THREE.Vector3(0, 0, 1).applyQuaternion(attachedQuat),
      planeWidth * SCREEN_SURFACE_LIFT,
    );

    this.screenPlane.position.copy(attachedPos);
    this.screenPlane.quaternion.copy(attachedQuat);
    this.screenPlane.scale.set(planeWidth, planeHeight, 1);
    this._applyCoverUV(planeWidth, planeHeight);

    return { attachedPos, planeWidth, planeHeight };
  }

  // Plane geometry uses plain 0-1 UVs, which would stretch the texture to
  // whatever the plane's current aspect happens to be — visibly different
  // from the DOM <img>'s `object-fit: cover` (Hero.module.css) at every
  // frame, not just at the crossfade. Crops the texture the same way cover
  // does (via repeat/offset) so both layers show an identical framing of
  // the photo throughout the whole grow phase, and the crossfade handoff
  // has nothing left to reveal a seam.
  _applyCoverUV(planeWidth, planeHeight) {
    const texture = this.screenPlane.material.map;
    const image = texture?.image;
    if (!image?.width) return;
    const imageAspect = image.width / image.height;
    const planeAspect = planeWidth / planeHeight;
    let repeatX = 1;
    let repeatY = 1;
    if (imageAspect > planeAspect) {
      repeatX = planeAspect / imageAspect;
    } else {
      repeatY = imageAspect / planeAspect;
    }
    texture.repeat.set(repeatX, repeatY);
    texture.offset.set((1 - repeatX) / 2, (1 - repeatY) / 2);
  }

  setPointer(x, y) {
    this.pointer.x = x;
    this.pointer.y = y;
  }

  // If the screen was left open (or opening) when this scrolled out of view
  // — completing the click-to-enter transition and navigating away to Work
  // always leaves it that way, since _tick's compute/render is skipped
  // entirely while inactive — reset instantly the moment it's back in view,
  // before anything renders. Otherwise the camera/plane would resume
  // exactly where they were frozen (mid-dolly, screen filling the frame)
  // and only visibly catch up to the resting pose over the next second or
  // so, instead of matching the clean settled shot scrolling alone always
  // gives.
  setActive(active) {
    if (active && !this.active && this.entryTarget !== 0) {
      this._resetScreenTransition(false);
      this.onScreenExit?.();
    }
    this.active = active;
  }

  // Snaps or eases entryT/entryTarget back to the closed resting
  // state. `animate: true` is the live, watched reversal (scrolling back up
  // while still in view — see _tick's auto-close); `animate: false` is the
  // instant, unwatched reset above.
  _resetScreenTransition(animate) {
    if (animate) {
      this._setEntryTarget(0);
    } else {
      this.entryTarget = 0;
      this.entryT = 0;
    }
    this._screenEntered = false;
  }

  // Raycasts against every real surface at once (see _occluders) and
  // returns only the nearest hit — i.e. whatever a viewer would actually
  // see at that pixel — so each hitTest* method below can ask "is the
  // frontmost thing here part of me?" instead of "does my own geometry
  // happen to lie somewhere along this ray?", which is what previously let
  // clicks register through parts that were really hidden behind something
  // closer (e.g. clicking the lens from an angle where the body panel
  // genuinely occludes it). screenPlane is added in too, alongside the
  // body occluders, so the LCD competes fairly with the body for whichever
  // is really nearest (blocked by the body before the turn, clickable once
  // it's actually facing the viewer).
  _pickNearest(nx, ny) {
    if (!this.modelLoaded) return null;
    this.raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    const targets = this.screenPlane
      ? [...this._occluders, this.screenPlane]
      : this._occluders;
    const hits = this.raycaster.intersectObjects(targets, false);
    return hits[0] ?? null;
  }

  // Gated the same way handleScreenClick is (progress far enough into the
  // turn, not already open/opening) — used both for the click-to-enter
  // gesture and, from CameraCanvas, to show a pointer cursor while hovering
  // the LCD, so the cursor never promises a click that wouldn't register
  // (the screen plane itself exists — and is raycastable — through the
  // whole turn, well before it's actually facing the viewer; the progress
  // gate is what actually keeps it from being clickable too early, not
  // occlusion, since by design nothing else in the model is really in
  // front of it once the turn has progressed this far).
  hitTestScreen(nx, ny) {
    if (!this.active || !this.screenPlane) return false;
    if (this.entryTarget === 1) return false;
    if (this.getScrollProgress() < CLICK_MIN_PROGRESS) return false;
    const hit = this._pickNearest(nx, ny);
    return !!hit && hit.object === this.screenPlane;
  }

  // Restarts the ease from wherever entryT currently is toward `target`
  // (0 or 1), scaling the leg's duration by the remaining distance so a
  // reversal partway through (see _tick's auto-close) keeps roughly the same
  // apparent speed as a full open/close instead of replaying the whole
  // duration for a shorter hop.
  _setEntryTarget(target) {
    if (this.entryTarget === target) return;
    // Captured per open, not once at load: where the model has to swing from
    // depends entirely on how far into the turn the user clicked.
    if (target === 1) this._entryPose = this._computeEntryPose();
    this.entryTarget = target;
    this._entryAnimFrom = this.entryT;
    this._entryAnimStart = performance.now();
    this._entryAnimDuration = Math.max(
      0.2,
      ENTRY_DURATION * Math.abs(target - this.entryT),
    );
  }

  // The pose the align leg eases the model into: LCD dead centre in the
  // viewport and exactly square to the camera, so the approach that follows
  // is a straight line down the view axis rather than a diagonal closing on
  // a tilted plane.
  //
  // Both halves are solved from the model's own measured geometry rather than
  // hand-tuned angles, which is what makes it land correctly from any pose
  // the click can happen in:
  //
  //   * Orientation. The plane's world orientation is groupQuat * K, where
  //     K is the constant modelGroup-local -> screen rotation. Square to the
  //     camera means that product is the identity (the plane's normal, now
  //     guaranteed to be its outward face by _screenBasisQuaternion, pointing
  //     straight back down +Z at the camera), so the group rotation that
  //     achieves it is simply K's inverse.
  //   * Position. Centring the BODY would not centre the screen — the LCD
  //     sits well off the model's own pivot, and the whole body has been
  //     drifted sideways by TURN_POS_X to clear the hero text. So offset the
  //     group by exactly where the screen centre would land under the new
  //     rotation, which puts that centre on the view axis.
  //
  // Depth is deliberately left untouched (the screen keeps the world z it
  // already has), so this leg only straightens and centres — it never changes
  // apparent size. Moving closer is the approach leg's job, and keeping the
  // two strictly separate is what makes the sequence read as "settle, then
  // go" instead of one smeared move.
  _computeEntryPose() {
    if (!this.screenPlane || !this.modelGroup || !this._screenBasisQuat) {
      return null;
    }

    const quaternion = this.modelGroup.quaternion
      .clone()
      .multiply(this._screenBasisQuat)
      .invert();

    const offset = this.screenLocal.position
      .clone()
      .applyMatrix4(this.modelGroup.matrix)
      .multiplyScalar(this.group.scale.x)
      .applyQuaternion(quaternion);

    return {
      quaternion,
      position: new THREE.Vector3(
        -offset.x,
        -offset.y,
        this.screenPlane.position.z - offset.z,
      ),
    };
  }

  // "Putting your face on the LCD": once the turn has revealed the screen,
  // clicking it sets entryTarget to 1 — _tick eases entryT toward it every
  // frame (self-driven, not scroll-scrubbed), first straightening and
  // centring the model and then pushing the camera straight into the screen,
  // and hands off to onScreenEnter (Hero.jsx navigates to Work) once it
  // arrives. Gated on scroll progress so an early click, while the LCD is
  // still turned away, can't register.
  handleScreenClick(nx, ny) {
    if (!this.hitTestScreen(nx, ny)) return false;
    this._setEntryTarget(1);
    return true;
  }

  // Unlike hitTestScreen this has no scroll-progress gate — the barrel
  // sits on the camera's front face and stays clickable through the whole
  // scroll narrative, independent of the LCD turn/reveal. No comfort-margin
  // proxy either (unlike the dial/button below): the lens is a large,
  // unambiguous target on its own, and the whole point of this hit-test is
  // to match its real, visible silhouette precisely — not loosen it.
  hitTestCylinder(nx, ny) {
    if (!this.active || !this.lensCylinder) return false;
    const hit = this._pickNearest(nx, ny);
    return !!hit && isDescendantOf(hit.object, this.lensCylinder);
  }

  // Spins the lens barrel one full turn around its own optical axis (local
  // Z — see CYLINDER_NODE_NAME above), alternating direction each click
  // (left, then right, then left again...) rather than always spinning the
  // same way — reads more like twisting a focus ring back and forth than a
  // reel spinning forward forever. Still a full TAU either way, so the
  // resting orientation never drifts off its original pose regardless of
  // how many times it's clicked. Relative ("+=") rather than an absolute
  // target so a click mid-spin keeps building on wherever the barrel
  // currently sits: GSAP's default overwrite behavior takes over the
  // already-running tween on this same property from its live current
  // value, so a repeated click blends into the next leg instead of
  // snapping or restarting cold.
  handleCylinderClick(nx, ny) {
    if (!this.hitTestCylinder(nx, ny)) return false;
    const direction = this._cylinderSpinDir;
    this._cylinderSpinDir *= -1;
    gsap.to(this.lensCylinder.rotation, {
      z: `+=${direction * TAU}`,
      duration: CYLINDER_SPIN_DURATION,
      ease: CYLINDER_SPIN_EASE,
    });
    return true;
  }

  // Adds an invisible, moderately enlarged raycast-only sphere as a SIBLING
  // of `anchorObject` under `parent` — not a child of `anchorObject` itself.
  // That distinction matters: `anchorObject` (a dial node) carries both a
  // baked resting rotation AND a non-uniform scale (see MODE_DIAL_NODE_NAME
  // above), and composing a further child under a rotated *and*
  // non-uniformly-scaled parent shears the local space — a plain sphere
  // placed there stops being a sphere (or even a clean axis-aligned
  // ellipsoid) in world terms, and reasoning about its resulting size/
  // position stops working the way it looks like it should on paper (this
  // was tried first and silently produced a proxy a fraction of the
  // intended size — caught by comparing raycast hits against it directly,
  // not by inspection). Sitting as a sibling under `parent` (`group2`,
  // the same un-rotated node cilindro_low1/pCylinder8/9/Mid_2/
  // ShutterButton all hang off directly) at `anchorObject`'s own position
  // avoids that entirely — `anchorObject.position` is already a clean,
  // un-sheared offset in `parent`'s space regardless of what `anchorObject`
  // does with its own rotation/scale below that point.
  //
  // Sized off `anchorObject`'s own first real mesh (X/Z — the flat face of
  // a disc-shaped dial, not the tallest of all three raw axes, which for
  // this mesh is actually its own local Y despite ending up the *thinnest*
  // in world space once the node's non-uniform scale squashes it down) so
  // the margin scales with however big the part actually is, converted
  // into `parent`-space units via `anchorObject.scale.x` (uniform across
  // X/Z for this export) since the raw mesh size alone is in the wrong
  // units for a sibling placed one level up. Tagged isHitProxy so the
  // _occluders scan (which otherwise skips anything invisible, to avoid
  // hidden dead geometry silently blocking clicks — see _loadCameraModel)
  // knows to keep this one. Raycasting ignores `.visible` entirely (only
  // WebGLRenderer respects it), so this works purely as a click target
  // with zero visual footprint.
  _addComfortHitProxy(parent, anchorObject, margin) {
    let mesh = null;
    anchorObject.traverse((child) => {
      if (child.isMesh && !mesh) mesh = child;
    });
    if (!mesh?.geometry) return;
    mesh.geometry.computeBoundingBox();
    const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
    const radius =
      (Math.max(size.x, size.z) / 2) * anchorObject.scale.x * margin;
    const proxy = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 8),
      new THREE.MeshBasicMaterial(),
    );
    proxy.visible = false;
    proxy.userData.isHitProxy = true;
    proxy.userData.owner = anchorObject;
    proxy.position.copy(anchorObject.position);
    parent.add(proxy);
  }

  // Captures a dial/lever node's resting quaternion once at load, plus the
  // bit of state _spinDialToggle needs to ease it between rest and swung.
  // Returns null (with a console warning) if the model doesn't have that
  // node, matching the lensCylinder/LCD_Screen fallback pattern above.
  _makeDialState(model, nodeName) {
    const object = model.getObjectByName(nodeName);
    if (!object) {
      console.warn(
        `[CameraScene] No "${nodeName}" object in the loaded model — click-to-toggle disabled.`,
      );
      return null;
    }
    const parent = model.getObjectByName("group2") ?? model;
    this._addComfortHitProxy(parent, object, DIAL_HIT_MARGIN);
    return {
      object,
      baseQuaternion: object.quaternion.clone(),
      angle: 0,
      on: false,
    };
  }

  hitTestModeDial(nx, ny) {
    if (!this.active || !this.modeDial) return false;
    const hit = this._pickNearest(nx, ny);
    return hitBelongsTo(hit, this.modeDial.object);
  }

  handleModeDialClick(nx, ny) {
    if (!this.hitTestModeDial(nx, ny)) return false;
    this._spinDialToggle(this.modeDial, MODE_DIAL_SWING);
    return true;
  }

  // Eases a dial/lever between its two states (rest = its baked export
  // orientation, swung = that same orientation with an extra rotation
  // composed on top, around the disc's own local-Y face-normal — see
  // DIAL_LOCAL_AXIS). Composing on the right (base.multiply(delta)) applies
  // the extra turn in the mesh's own un-rotated modeling space rather than
  // world space, so it reads as "spin around the disc's own axis" no
  // matter how that disc is tilted to sit on the camera body — naively
  // tweening .rotation.y directly would instead silently replace the whole
  // orientation via a fresh Euler decomposition and visibly warp the tilt.
  // Tweens `angle` on the persistent `state` object itself (not a fresh
  // throwaway target) so a repeated click reuses GSAP's default overwrite
  // behavior on that same property, same as handleCylinderClick above.
  _spinDialToggle(state, swingAngle) {
    state.on = !state.on;
    gsap.to(state, {
      angle: state.on ? swingAngle : 0,
      duration: DIAL_SWING_DURATION,
      ease: DIAL_SWING_EASE,
      onUpdate: () => {
        state.object.quaternion
          .copy(state.baseQuaternion)
          .multiply(
            new THREE.Quaternion().setFromAxisAngle(
              DIAL_LOCAL_AXIS,
              state.angle,
            ),
          );
      },
    });
  }

  // Builds the procedural shutter-button stand-in (see BUTTON_NODE_NAME
  // above) and attaches it to "group2" — the same node cilindro_low1,
  // pCylinder8/9 and Mid_2 all hang off directly — at BUTTON_LOCAL_POSITION,
  // so it inherits the model's own normalize scale/position and every frame
  // of turn/idle/pointer motion for free, exactly like a real GLB part
  // would. Two materials (collar + cap) are pushed onto _bodyMaterials so
  // it fades out in step with the rest of the shell during the
  // click-to-enter-LCD transition instead of hanging in front of the photo.
  _buildShutterButton(model) {
    const parent = model.getObjectByName("group2") ?? model;
    const group = new THREE.Group();
    group.name = "ShutterButton";

    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(
        BUTTON_RADIUS * 1.1,
        BUTTON_RADIUS * 1.18,
        BUTTON_COLLAR_HEIGHT,
        20,
      ),
      new THREE.MeshStandardMaterial({
        color: 0x9a9a9a,
        metalness: 0.75,
        roughness: 0.35,
        envMapIntensity: 0.35,
      }),
    );
    collar.position.y = BUTTON_COLLAR_HEIGHT / 2;

    // A shallow dome (partial sphere) reads as a pressable button cap far
    // better than a flat-topped cylinder would at this size.
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(BUTTON_RADIUS, 20, 12, 0, TAU, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({
        color: 0x0c0c0c,
        metalness: 0.15,
        roughness: 0.5,
        envMapIntensity: 0.15,
      }),
    );
    cap.position.y = BUTTON_COLLAR_HEIGHT;

    collar.material.transparent = true;
    cap.material.transparent = true;
    this._bodyMaterials.push(collar.material, cap.material);

    group.add(collar, cap);

    // Invisible, moderately enlarged raycast-only target — comfortable to
    // click without needing pixel-perfect precision on the small dome, but
    // not so big it eats into the body panel around it. Centered around
    // the visible cap (not the group's own anchor at the collar's base —
    // see BUTTON_LOCAL_POSITION) so the margin is even in every direction
    // rather than mostly extending downward into the panel below the
    // button, which is exactly the kind of false-positive click this whole
    // pass is trying to eliminate. Tagged isHitProxy so the _occluders
    // scan (which otherwise skips anything invisible, to avoid hidden dead
    // geometry silently blocking clicks) knows to keep this one.
    const hitProxy = new THREE.Mesh(
      new THREE.SphereGeometry(BUTTON_RADIUS * BUTTON_HIT_MARGIN, 12, 8),
      new THREE.MeshBasicMaterial(),
    );
    hitProxy.visible = false;
    hitProxy.userData.isHitProxy = true;
    hitProxy.position.y = BUTTON_COLLAR_HEIGHT * 1.5;
    group.add(hitProxy);

    group.position.copy(BUTTON_LOCAL_POSITION);
    group.rotation.x = BUTTON_TILT_X;
    parent.add(group);

    this.shutterButton = group;
    this._shutterButtonBasePosition = group.position.clone();
    // The press needs to sink "into" the button's own tilted face, not
    // straight down in the parent's Y — otherwise a pitched-forward button
    // (see BUTTON_TILT_X) visibly slides in the wrong direction when
    // clicked. Local -Y (the group's own "down", before its tilt) rotated
    // into parent space by the group's own quaternion gives that press
    // axis; captured once here since the tilt is static after build.
    this._shutterButtonPressAxis = new THREE.Vector3(0, -1, 0)
      .applyQuaternion(group.quaternion)
      .normalize();
    this._shutterPressT = 0;
  }

  hitTestShutterButton(nx, ny) {
    if (!this.active || !this.shutterButton) return false;
    const hit = this._pickNearest(nx, ny);
    return !!hit && isDescendantOf(hit.object, this.shutterButton);
  }

  // A quick press-and-release — snappy rather than the soft ease used for
  // the dial/lens, since a shutter click should feel instant. Guarded on
  // _shutterPressed so a double-click mid-press can't stack two presses and
  // leave the button stuck down (gsap's yoyo already returns it to rest on
  // its own, this just stops a second click from restarting that early).
  handleShutterButtonClick(nx, ny) {
    if (!this.hitTestShutterButton(nx, ny)) return false;
    if (this._shutterPressed) return true;
    this._shutterPressed = true;
    gsap.to(this, {
      _shutterPressT: 1,
      duration: BUTTON_PRESS_DURATION,
      ease: "power1.out",
      yoyo: true,
      repeat: 1,
      onUpdate: () => {
        this.shutterButton.position
          .copy(this._shutterButtonBasePosition)
          .addScaledVector(this._shutterButtonPressAxis, this._shutterPressT * BUTTON_PRESS_DEPTH);
      },
      // Fires once, at the yoyo turn — i.e. the instant the button bottoms
      // out and starts coming back up. That's the physical moment the
      // shutter releases, so sound/flash/recoil are hung off it rather than
      // off the click itself (which would land ~90ms early, while the button
      // is still visibly travelling down).
      onRepeat: () => this._fireShutter(),
      onComplete: () => {
        this._shutterPressed = false;
      },
    });
    return true;
  }

  // One HTMLAudioElement, created up front and reused, rather than a fresh
  // one per shot: the press guard in handleShutterButtonClick already stops
  // shots from overlapping, so rewinding this one to 0 is enough, and it
  // means the file is fetched/decoded once on load instead of on the first
  // click (where the network round-trip would put the sound noticeably
  // behind the flash). Constructed defensively — Audio is unavailable in
  // non-browser environments, and a missing/undecodable file should cost the
  // rest of the interaction nothing.
  _createShutterAudio() {
    if (typeof Audio === "undefined") return null;
    try {
      const audio = new Audio(SHUTTER_SOUND_URL);
      audio.preload = "auto";
      audio.volume = SHUTTER_SOUND_VOLUME;
      return audio;
    } catch {
      return null;
    }
  }

  // The shot itself. Everything here is additive/self-resetting so it can
  // never leave the scene in a modified state: _flashT and _kick both tween
  // back to exactly 0, and neither is read anywhere except as an offset on
  // top of the normally-composed frame.
  _fireShutter() {
    if (this._shutterAudio) {
      // A click is a user gesture, so play() is allowed — but it still
      // rejects if the file failed to load, and an unhandled rejection here
      // would surface as a console error on an otherwise fine interaction.
      this._shutterAudio.currentTime = 0;
      this._shutterAudio.play().catch(() => {});
    }

    // Scene-light burst. Tweened on `this` (killed wholesale in dispose
    // alongside the existing _shutterPressT tween) and read back in _tick.
    gsap.killTweensOf(this, "_flashT");
    this._flashT = 0;
    gsap
      .timeline()
      .to(this, { _flashT: 1, duration: FLASH_ATTACK, ease: "power2.out" })
      .to(this, { _flashT: 0, duration: FLASH_DECAY, ease: "power2.in" });

    // Recoil. The attack is a hard, fast displacement; the return uses an
    // elastic ease so the body settles through a couple of decaying wobbles
    // instead of gliding back — that damped overshoot is what sells it as
    // mass reacting to an impulse rather than a scripted move.
    gsap.killTweensOf(this._kick);
    gsap
      .timeline()
      .to(this._kick, {
        pitch: KICK_PITCH,
        yaw: KICK_YAW,
        y: KICK_Y,
        duration: KICK_ATTACK,
        ease: "power3.out",
      })
      .to(this._kick, {
        pitch: 0,
        yaw: 0,
        y: 0,
        duration: KICK_SETTLE,
        ease: KICK_SETTLE_EASE,
      });

    // The fullscreen clarão is a DOM layer, not a 3D one — see Hero.jsx.
    this.onShutterFire?.();
  }

  _handleResize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const { clientWidth: w, clientHeight: h } = parent;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // See the block above the class for `cameraPhrase` — this just reads
  // yaw/dolly/pitch off that one shared signal (pitch lagged) and adds the
  // single independent breathing sine on bobY.
  _idleMotion(elapsed) {
    const envelope = smoothstep(IDLE.envelopeStart, IDLE.envelopeEnd, elapsed);
    const phrase = cameraPhrase(elapsed);
    const pitchPhrase = cameraPhrase(elapsed, PITCH_LAG);
    const yaw = phrase * IDLE.yawAmp * envelope;
    const dolly = phrase * IDLE.dollyAmp * envelope;
    const pitch = pitchPhrase * IDLE.pitchAmp * envelope;
    const bobY =
      Math.sin((elapsed / IDLE.bobPeriod) * TAU) * IDLE.bobAmp * envelope;
    return { envelope, phrase, yaw, pitch, bobY, dolly };
  }

  _tick() {
    if (this.disposed) return;

    if (this.active && this.modelLoaded) {
      const now = performance.now();
      const elapsed = (now - this.startTime) / 1000;
      // Clamped so a long stretch inactive (off-screen, or the tab
      // backgrounded) doesn't register as one giant dt on the frame this
      // reactivates — _updateSlideshow would otherwise fast-forward through
      // several slides in a single tick to "catch up".
      const dt = Math.min((now - this._lastTickTime) / 1000, 0.1);
      this._lastTickTime = now;
      const progress = this.getScrollProgress();
      const idle = this._idleMotion(elapsed);

      // idleWeight fades the ambient idle sway and pointer-parallax out
      // early (by ~22% scroll) so cameraPhrase/pointer never fight the
      // scroll narrative for control of the same axes — past that point
      // scroll is the only thing moving the camera, right up to the fully
      // stable hero shot at progress 1.
      const idleWeight = 1 - smoothstep(0.04, 0.22, progress);
      const rotationT = smoothstep(0.15, 0.75, progress);
      const dollyT = smoothstep(0.45, 0.95, progress);
      const revealT = smoothstep(0.6, 1, progress);

      const targetY =
        this.baseRotation.y +
        this.pointer.x * 0.5 * idleWeight +
        rotationT * TURN_ANGLE;
      const targetX =
        this.baseRotation.x -
        this.pointer.y * 0.25 * idleWeight +
        rotationT * TURN_PITCH;
      const targetPosX = rotationT * TURN_POS_X;
      const targetPosY = rotationT * TURN_POS_Y;
      const targetPosZ = dollyT * TURN_POS_Z;
      // Entrance follow speed (0.041/0.031) is slowed to ~1/1.47x so the
      // model's swing-and-grow-in takes about as long as the Hero text
      // cascade (~3.3s) — keep these two in step if either timeline changes.
      // The same lerp carries the turn narrative: it's what gives the turn
      // "mass" — the pose always trails its target, catching up rather than
      // snapping straight to wherever the (already scrub-smoothed) scroll
      // progress points.
      this.driven.y += (targetY - this.driven.y) * 0.041;
      this.driven.x += (targetX - this.driven.x) * 0.041;
      // Entrance scale-in — same easing shape as the rotation follow above,
      // just toward a fixed target (1) instead of a moving pointer target.
      this.driven.scale += (1 - this.driven.scale) * 0.031;
      this.driven.posX += (targetPosX - this.driven.posX) * 0.041;
      this.driven.posY += (targetPosY - this.driven.posY) * 0.041;
      this.driven.posZ += (targetPosZ - this.driven.posZ) * 0.041;

      // Auto-close: if the user scrolls back up clear of the turned pose —
      // whether mid-open or after fully entering — ease the screen shut
      // again instead of leaving it stuck fullscreen, and re-arm the click
      // gesture for next time.
      if (
        this.entryTarget === 1 &&
        progress < CLICK_MIN_PROGRESS - CLICK_EXIT_BUFFER
      ) {
        this._resetScreenTransition(true);
      }

      // Advanced before the pose is composed (rather than after it, where
      // this used to sit) because the align leg below is part of that pose
      // now — reading a frame-old entryT there would leave the model one
      // frame behind the camera for the whole transition.
      if (this.entryT !== this.entryTarget) {
        const animElapsed = (performance.now() - this._entryAnimStart) / 1000;
        // Linear in time, deliberately: all the easing lives in the alignT /
        // approachT windows below, so each leg gets its own clean
        // ease-in/out. Shaping this as well would compound into a double ease
        // and, worse, would smear the hold between the legs — the pause only
        // reads as a deliberate beat if entryT crosses it at a steady rate.
        const animT = Math.min(animElapsed / this._entryAnimDuration, 1);
        this.entryT = THREE.MathUtils.lerp(
          this._entryAnimFrom,
          this.entryTarget,
          animT,
        );
        if (animT >= 1) this.entryT = this.entryTarget;
      }
      if (this.entryTarget === 1 && this.entryT === 1 && !this._screenEntered) {
        this._screenEntered = true;
        this.onScreenEnter?.(this.screenImages[this._slideIndex]);
      }

      // The two legs of the entry, shaped out of that one signal — same
      // idiom as rotationT/dollyT/revealT above. The gap between them is the
      // hold, and their ordering is what makes a reversal unwind correctly
      // without any extra bookkeeping.
      const alignT = smoothstep(0, ENTRY_ALIGN_END, this.entryT);
      const approachT = smoothstep(ENTRY_APPROACH_START, 1, this.entryT);

      // Composite the frame: driven (pointer/scroll/entrance/turn) + idle
      // (bounded organic float, weighted down once the turn takes over),
      // summed fresh each frame rather than accumulated, so idle motion can
      // never drift or compound.
      // The shutter kick is summed in here like any other layer, and stays
      // unweighted by idleWeight/progress: it's a physical impulse on the
      // body, so it has to land the same way whatever pose the narrative has
      // the camera in at that moment.
      // rotation.z is written explicitly, though nothing above ever produces
      // roll: the align below blends the group's QUATERNION, which syncs a
      // roll component back into this Euler, and without clearing it every
      // frame that would accumulate across frames.
      this.group.rotation.set(
        this.driven.x + idle.pitch * idleWeight + this._kick.pitch,
        this.driven.y + idle.yaw * idleWeight + this._kick.yaw,
        0,
      );
      this.group.scale.setScalar(this.driven.scale);
      // bobY stays unweighted — the one thing still breathing at the fully
      // settled hero shot, per design: everything else should be still.
      this.group.position.set(
        this.driven.posX,
        this.driven.posY + idle.bobY + this._kick.y,
        this.driven.posZ + idle.dolly * idleWeight,
      );

      // Entry align, leg one. Blended ON TOP of the finished pose rather than
      // by steering `driven` toward it — the same principle as the idle and
      // kick layers — which is what keeps it non-destructive: the scroll
      // narrative underneath carries on untouched, so when alignT falls back
      // to 0 the model is handed straight back to it and lands on exactly the
      // pose it would have been in anyway, with nothing to unwind or restore.
      // At alignT = 1 the blend is total, which also means the idle bob and
      // any in-flight shutter kick are fully overridden — the model is
      // genuinely still for the hold, not almost still.
      if (this._entryPose && alignT > 0) {
        this.group.quaternion.slerp(this._entryPose.quaternion, alignT);
        this.group.position.lerp(this._entryPose.position, alignT);
      }

      if (this.keyLight) {
        const angle =
          idle.phrase * IDLE.lightSweep * idle.envelope * idleWeight;
        const { x, z } = this._keyBasePos;
        this.keyLight.position.x = x * Math.cos(angle) - z * Math.sin(angle);
        this.keyLight.position.z = x * Math.sin(angle) + z * Math.cos(angle);
        this.keyLight.intensity =
          this._keyBaseIntensity +
          idle.phrase * IDLE.keyPulse * idle.envelope * idleWeight +
          revealT * TURN_KEY_BOOST +
          this._flashT * FLASH_KEY_BOOST;
        this.rimLight.intensity =
          this._rimBaseIntensity +
          idle.phrase * IDLE.rimPulse * idle.envelope * idleWeight;
      }

      this._updateSlideshow(dt);
      const screen = this._updateScreenPlane();

      // Entry approach, leg two — this IS the "entering the panel" effect:
      // the fill comes from real perspective as the viewpoint gets close,
      // not from the photo inflating in place.
      //
      // A straight push down the view axis, with no lateral component of its
      // own. It can be, because the align leg has already put the screen's
      // centre on that axis and turned it square to the camera — so target.x
      // and target.y are ~0 here by construction, and the sideways pan this
      // used to need (a fast early ease on x/y, which is what made the
      // arrival read as diagonal) is simply gone. They are still lerped
      // rather than hard-zeroed so that any residual offset resolves smoothly
      // instead of being snapped away, and so a model whose align pose could
      // not be derived degrades to the old recentring behaviour rather than
      // to a broken one. Resets to the resting pose as entryT eases back to
      // 0 (see the auto-close block above).
      if (screen && approachT > 0.001) {
        const target = this._dollyTarget(
          screen.attachedPos,
          screen.planeWidth,
          screen.planeHeight,
        );
        this.camera.position.set(
          target.x * approachT,
          target.y * approachT,
          THREE.MathUtils.lerp(this.cameraBaseZ, target.z, approachT),
        );
      } else {
        this.camera.position.set(0, 0, this.cameraBaseZ);
      }

      // The body stays solid through the first half of the approach (so the
      // photo reads as being entered, not just cut to), then dissolves —
      // otherwise, once the camera is close enough for the screen to fill
      // the frame it's still looking at a fully opaque camera body from
      // point-blank range, which would clip/occlude the shot instead of
      // reading as passing through it. Keyed to approachT rather than entryT
      // so "half way in" still means half of the actual approach, not half of
      // a sequence that spends its first third standing still.
      if (this._bodyMaterials) {
        const bodyOpacity = 1 - smoothstep(0.5, 1, approachT);
        for (const material of this._bodyMaterials)
          material.opacity = bodyOpacity;
      }
    }

    if (this.active) this.renderer.render(this.scene, this.camera);

    this._frameId = requestAnimationFrame(this._tick);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this._frameId);
    window.removeEventListener("resize", this._handleResize);
    if (this.lensCylinder) gsap.killTweensOf(this.lensCylinder.rotation);
    if (this.modeDial) gsap.killTweensOf(this.modeDial);
    gsap.killTweensOf(this._kick);
    gsap.killTweensOf(this);
    // Stop a shot that's still ringing out — the element outlives this
    // scene's canvas otherwise (nothing in the DOM holds it), so a scene
    // torn down mid-shutter would keep playing to the end.
    if (this._shutterAudio) {
      this._shutterAudio.pause();
      this._shutterAudio.src = "";
      this._shutterAudio = null;
    }
    // Only whichever slide is currently assigned as the screen plane's
    // material.map gets caught by the scene traversal below — the rest of
    // the preloaded slideshow textures need disposing explicitly.
    for (const texture of this._slideTextures) texture?.dispose();
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const materials = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        materials.forEach((m) => {
          m.map?.dispose();
          m.normalMap?.dispose();
          m.roughnessMap?.dispose();
          m.metalnessMap?.dispose();
          m.aoMap?.dispose();
          m.dispose();
        });
      }
    });
    this.scene.environment?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}
