import { Eyes } from '../components/Eyes';
import { IconBolt, IconDownload, IconEye, IconList, IconQr, IconShield } from '../components/Icons';
import { toHash } from '../router';
import { useStore } from '../StoreProvider';
import { useDocumentTitle } from '../useDocumentTitle';

const FEATURES = [
  {
    icon: <IconBolt />,
    title: 'Bez registrace',
    text: 'Žádný účet ani heslo. Otevřeš stránku a fakturuješ.',
  },
  {
    icon: <IconQr />,
    title: 'QR platba na každé faktuře',
    text: 'Český QR kód podle standardu SPAYD z tvého účtu, částky a variabilního symbolu. Klient zaplatí jedním skenem.',
  },
  {
    icon: <IconShield />,
    title: 'Data jen u tebe',
    text: 'Faktury, odběratelé i tvoje údaje zůstávají v prohlížeči na tvém zařízení. Nic se nikam neposílá.',
  },
  {
    icon: <IconEye />,
    title: 'Náhled naživo',
    text: 'Fakturu vidíš přesně tak, jak půjde do tisku nebo do PDF. Každá změna se hned projeví.',
  },
  {
    icon: <IconList />,
    title: 'Přehled, který hlídá',
    text: 'Kolik máš vystaveno, co čeká na platbu a co je po splatnosti. Na jeden pohled.',
  },
  {
    icon: <IconDownload />,
    title: 'Záloha do souboru',
    text: 'Všechna data si stáhneš jako jeden soubor a kdykoli je z něj obnovíš.',
  },
];

const STEPS = [
  {
    title: 'Vyplň údaje o sobě',
    text: 'Jednou zadáš jméno nebo firmu, IČO, adresu a číslo účtu. Invoo si je pamatuje.',
  },
  {
    title: 'Přidej odběratele a položky',
    text: 'Pár řádků a je to. Součty, DPH, splatnost i variabilní symbol se dopočítají.',
  },
  {
    title: 'Stáhni PDF nebo vytiskni',
    text: 'Faktura s QR kódem je hotová. V přehledu pak vidíš, jestli už je zaplacená.',
  },
];

const FAQ = [
  {
    q: 'Je Invoo opravdu zdarma?',
    a: 'Ano. Vystavování faktur, QR platba i záloha dat jsou zdarma a bez registrace.',
  },
  {
    q: 'Kde jsou moje faktury uložené?',
    a: 'Jen v prohlížeči na tvém zařízení. Na žádný server se neposílají.',
  },
  {
    q: 'Co když změním počítač nebo prohlížeč?',
    a: 'Stáhni si v nastavení zálohu do souboru a v novém prohlížeči ji obnov. Stejně se chráníš i pro případ, že si smažeš data prohlížeče.',
  },
  {
    q: 'Jsem plátce DPH. Poradí si s tím?',
    a: 'Ano. V nastavení přepneš na plátce a u položek se objeví sazby DPH, na faktuře rozpis daně a datum zdanitelného plnění.',
  },
];

export function Landing() {
  const { data } = useStore();
  const hasInvoices = data.invoices.length > 0;
  useDocumentTitle('');

  return (
    <div className="landing">
      <section className="hero container">
        <div className="hero__text">
          <h1>Faktury pod dohledem.</h1>
          <p className="hero__lead">
            Vystav fakturu s QR platbou za pár minut. Bez účtu a bez čekání. Všechno zůstává v tvém prohlížeči a Invoo
            pohlídá, co je po splatnosti.
          </p>
          <div className="hero__actions">
            <a className="btn btn--primary btn--lg" href={toHash({ name: 'nova' })}>
              {hasInvoices ? 'Vystavit fakturu' : 'Vystavit první fakturu'}
            </a>
            {hasInvoices ? (
              <a className="btn btn--outline btn--lg" href={toHash({ name: 'faktury' })}>
                Moje faktury
              </a>
            ) : null}
          </div>
          <ul className="hero__points">
            <li>Zdarma a bez registrace</li>
            <li>QR platba podle SPAYD</li>
            <li>Plátci i neplátci DPH</li>
          </ul>
        </div>

        <div className="hero__stage" aria-hidden="true">
          <div className="hero__eyes">
            <Eyes size={120} mood="follow" variant="solid" />
          </div>
        </div>
      </section>

      <section className="features container" aria-labelledby="features-title">
        <h2 id="features-title">Všechno, co faktura potřebuje. Nic, co by zdržovalo.</h2>
        <dl className="features__list">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="feature">
              <span className="feature__icon">{feature.icon}</span>
              <dt>{feature.title}</dt>
              <dd>{feature.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="privacy">
        <div className="container privacy__in">
          <div className="privacy__eyes" aria-hidden="true">
            <Eyes size={88} mood="follow" variant="solid" />
          </div>
          <div>
            <h2>Tvoje faktury nikam neposíláme.</h2>
            <p>
              Invoo nemá server, na který by doklady odcházely. Údaje o tobě, odběratelích i fakturách se ukládají jen
              do prohlížeče na tvém zařízení.
            </p>
            <ul className="privacy__points">
              <li>
                <strong>Žádné přihlášení.</strong> Není co zapomenout ani co ukrást.
              </li>
              <li>
                <strong>Záloha jedním kliknutím.</strong> Celá data v jednom souboru, který si uložíš, kam chceš.
              </li>
              <li>
                <strong>Počítej s tím:</strong> když smažeš data prohlížeče, zmizí i faktury. Proto je tu záloha.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="steps container" aria-labelledby="steps-title">
        <h2 id="steps-title">Od prázdné stránky k faktuře ve třech krocích</h2>
        <ol className="steps__list">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="steps__num">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="faq container" aria-labelledby="faq-title">
        <h2 id="faq-title">Na co se lidé ptají</h2>
        <div className="faq__list">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="container">
        <div className="cta">
          <h2>První faktura může odejít ještě dnes.</h2>
          <a className="btn btn--dark btn--lg" href={toHash({ name: 'nova' })}>
            Vystavit fakturu
          </a>
        </div>
      </section>
    </div>
  );
}
