// Camera views. A scene says which views it has, and V (or the HUD button)
// steps through them. Scenes read the index every frame; nothing here knows
// about three.js. A view never changes the rules of the game, only the camera.

import { useEffect } from 'react';
import { create } from 'zustand';
import { playCue } from './audio';
import { input } from './input';

export interface ViewState { names: string[]; index: number; /** 1 is the normal distance. Smaller is closer. */ zoom: number }

export const useView = create<ViewState>(() => ({ names: [], index: 0, zoom: 1 }));

export const ZOOM_MIN = 0.55;
export const ZOOM_MAX = 1.9;

/** The last view picked for each kind of scene, so it is kept from phase to phase. */
const remembered = new Map<string, number>();
const keyOf = (names: string[]) => names.join('|');

export const WALK_VIEWS = ['Follow', 'Close', 'Above', 'Helmet'];
export const LANDER_VIEWS = ['Chase', 'Side', 'Above', 'Window'];
export const DOCK_VIEWS = ['Docking camera', 'Outside'];
export const LAUNCH_VIEWS = ['Cockpit', 'Outside'];

export const view = {
  set(names: string[]): void {
    const at = remembered.get(keyOf(names)) ?? 0;
    useView.setState({ names, index: at < names.length ? at : 0 });
  },
  clear(names: string[]): void {
    // A scene that has already been replaced must not wipe the next scene's views.
    if (keyOf(useView.getState().names) === keyOf(names)) useView.setState({ names: [], index: 0 });
  },
  next(): void {
    const s = useView.getState();
    if (s.names.length < 2) return;
    const index = (s.index + 1) % s.names.length;
    remembered.set(keyOf(s.names), index);
    useView.setState({ index });
    playCue('select');
  },
  index: (): number => useView.getState().index,
  /** How far the outside cameras stand back, as a multiple of normal. The HUD does not scale with it. */
  zoom: (): number => useView.getState().zoom,
  zoomBy(factor: number): void {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, useView.getState().zoom * factor));
    useView.setState({ zoom: Math.round(z * 100) / 100 });
  },
  /** True when the current view of the current scene has this name. */
  is: (name: string): boolean => { const s = useView.getState(); return s.names[s.index] === name; },
};

/** Declares a scene's views for as long as it is on screen. */
export function useViews(names: string[]): void {
  const key = keyOf(names);
  useEffect(() => {
    view.set(names);
    return () => view.clear(names);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

let attached = false;
export function attachViewKey(): void {
  if (attached) return;
  attached = true;
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || input.isSuspended()) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    if (e.code === 'KeyV' && !e.repeat) view.next();
    // Minus stands back, plus moves in.
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') view.zoomBy(1.12);
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') view.zoomBy(1 / 1.12);
  });
  // The mouse wheel zooms while the pointer is over the 3D view.
  window.addEventListener('wheel', (e) => {
    if (input.isSuspended() || !(e.target instanceof HTMLCanvasElement) || useView.getState().names.length === 0) return;
    view.zoomBy(e.deltaY > 0 ? 1.08 : 1 / 1.08);
  }, { passive: true });
}
