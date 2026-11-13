import { toHash } from '../router';
import { Eyes } from './Eyes';

export function NotFound() {
  return (
    <div className="page container">
      <div className="empty">
        <Eyes size={44} mood="follow" variant="outline" />
        <h1>Tuhle fakturu jsem nenašel</h1>
        <p>Možná byla vystavená v jiném prohlížeči nebo smazaná. Podívej se do přehledu.</p>
        <a className="btn btn--primary" href={toHash({ name: 'faktury' })}>
          Zpět na faktury
        </a>
      </div>
    </div>
  );
}
