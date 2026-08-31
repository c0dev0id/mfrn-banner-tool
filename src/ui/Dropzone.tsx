import { createSignal, onCleanup, onMount } from 'solid-js';

interface Props {
  busy: boolean;
  onFile: (file: File) => void;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

export default function Dropzone(props: Props) {
  const [over, setOver] = createSignal(false);
  let input!: HTMLInputElement;

  onMount(() => {
    // Pasting a screenshot straight in is the fastest path for most people.
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])][0];
      if (file) props.onFile(file);
    };
    window.addEventListener('paste', onPaste);
    onCleanup(() => window.removeEventListener('paste', onPaste));
  });

  return (
    <div
      class="dropzone"
      classList={{ 'is-over': over(), 'is-busy': props.busy }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) props.onFile(file);
      }}
      onClick={() => input.click()}
    >
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) props.onFile(file);
          e.currentTarget.value = '';
        }}
      />
      <p class="dropzone-title">{props.busy ? 'Reading image…' : 'Drop an image here'}</p>
      <p class="dropzone-sub">or click to choose · paste from the clipboard</p>
      <p class="dropzone-formats">JPG · PNG · WebP · HEIC</p>
    </div>
  );
}
