import { Dropzone } from './ui/Dropzone';

/**
 * App shell (M0). For now it shows only the empty-state dropzone.
 * Topbar / toolbar / score canvas / transport arrive in later milestones.
 */
export default function App() {
  return (
    <Dropzone
      onFile={(file) => {
        // M1 wires this to LocalFileIO (load → parse → render).
        console.info('[MusiPad] file selected:', file.name);
      }}
    />
  );
}
