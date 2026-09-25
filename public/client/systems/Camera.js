// The main camera is zoomed out and follows the car. The HUD gets a second,
// unzoomed camera on top so it stays put and pixel sized.
export const ZOOM = 0.4;

export default function setupCameras(scene, target, track, worldLayer, hudLayer) {
  const main = scene.cameras.main;
  main.setZoom(ZOOM);
  main.setBounds(0, 0, track.worldW, track.worldH);
  main.startFollow(target, true, 0.1, 0.1);
  main.ignore(hudLayer);

  scene.cameras.add(0, 0, scene.scale.width, scene.scale.height).ignore(worldLayer);
}
