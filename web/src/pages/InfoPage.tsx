import { Card } from '../components/ui';

export default function InfoPage() {
  return (
    <div>
      <div className="mb-xl">
        <h1 className="text-4xl font-semibold leading-tight">Info</h1>
        <p className="text-text-secondary mt-tiny">Learn about Kript and its features</p>
      </div>

      <div className="flex flex-col gap-lg max-w-2xl">
        <Card>
          <h2 className="text-lg font-semibold mb-md">What is Kript?</h2>
          <p className="text-text-secondary">
            Kript is an open-source PGP encryption tool that runs entirely in your browser.
            It allows you to generate cryptographic keys, encrypt and decrypt messages,
            and sign and verify data — all without any data ever leaving your device.
          </p>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-md">Features</h2>
          <ul className="flex flex-col gap-sm text-text-secondary">
            <li>
              <strong className="text-text-primary">Keys</strong> — Generate and manage PGP key pairs using Curve25519 or RSA algorithms.
            </li>
            <li>
              <strong className="text-text-primary">Encrypt</strong> — Encrypt messages or files using a recipient's public key.
            </li>
            <li>
              <strong className="text-text-primary">Decrypt</strong> — Decrypt messages or files using your private key.
            </li>
            <li>
              <strong className="text-text-primary">Sign</strong> — Create digital signatures to prove authenticity.
            </li>
            <li>
              <strong className="text-text-primary">Verify</strong> — Verify digital signatures against a public key.
            </li>
          </ul>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-md">Privacy & Security</h2>
          <p className="text-text-secondary">
            All cryptographic operations are performed locally in your browser using the
            Web Crypto API and OpenPGP.js. Your keys and data are stored in your browser's
            IndexedDB and never transmitted to any server. Kript works offline once loaded.
          </p>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-md">Open Source</h2>
          <p className="text-text-secondary">
            Kript is fully open source. You can audit the code, report issues, or contribute
            on{' '}
            <a
              href="https://github.com/gabrielee5/kript"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-primary underline hover:no-underline"
            >
              GitHub
            </a>.
          </p>
        </Card>
      </div>
    </div>
  );
}
