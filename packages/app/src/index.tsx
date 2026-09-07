import '@backstage/cli/asset-types';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@backstage/ui/css/styles.css';

// Temporary workaround for HTTP (non-secure context)
if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );

    return uuid as ReturnType<typeof crypto.randomUUID>;
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  App.createRoot(),
);
