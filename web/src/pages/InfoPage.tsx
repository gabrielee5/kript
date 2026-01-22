import { useTranslation } from 'react-i18next';
import { Card } from '../components/ui';

export default function InfoPage() {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-xl">
        <h1 className="text-4xl font-semibold leading-tight">{t('info.title')}</h1>
        <p className="text-text-secondary mt-tiny">{t('info.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-lg max-w-2xl">
        <Card>
          <h2 className="text-lg font-semibold mb-md">{t('info.whatIsKript')}</h2>
          <p className="text-text-secondary">
            {t('info.whatIsKriptDescription')}
          </p>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-md">{t('info.features')}</h2>
          <ul className="flex flex-col gap-sm text-text-secondary">
            <li>
              <strong className="text-text-primary">{t('nav.keys')}</strong> — {t('info.featureKeys')}
            </li>
            <li>
              <strong className="text-text-primary">{t('common.encrypt')}</strong> — {t('info.featureEncrypt')}
            </li>
            <li>
              <strong className="text-text-primary">{t('common.decrypt')}</strong> — {t('info.featureDecrypt')}
            </li>
            <li>
              <strong className="text-text-primary">{t('common.sign')}</strong> — {t('info.featureSign')}
            </li>
            <li>
              <strong className="text-text-primary">{t('common.verify')}</strong> — {t('info.featureVerify')}
            </li>
          </ul>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-md">{t('info.privacy')}</h2>
          <p className="text-text-secondary">
            {t('info.privacyDescription')}
          </p>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-md">{t('info.openSource')}</h2>
          <p className="text-text-secondary">
            {t('info.openSourceDescription')}{' '}
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
