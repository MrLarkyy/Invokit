import type { ReactNode } from 'react';
import { toHash, type Route } from '../router';
import { IconAlert, IconList, IconPlus, IconSettings, IconShield } from './Icons';
import { Logo } from './Logo';

interface ShellProps {
  route: Route;
  /** The stored data could not be read at start. */
  recovered: boolean;
  children: ReactNode;
}

/** The app frame: header, content, footer and the bottom bar on mobile. */
export function Shell({ route, recovered, children }: ShellProps) {
  const inApp = route.name !== 'uvod';
  const current = (...names: Route['name'][]) => (names.includes(route.name) ? 'page' : undefined);

  return (
    <div className={`shell${inApp ? ' shell--app' : ''}`}>
      <header className="header">
        <div className="container header__in">
          <a className="header__logo" href={toHash({ name: 'uvod' })} aria-label="Invoo, úvodní stránka">
            <Logo mood="follow" />
          </a>
          <nav className="nav" aria-label="Hlavní navigace">
            <a className="nav__link" href={toHash({ name: 'faktury' })} aria-current={current('faktury', 'faktura')}>
              Faktury
            </a>
            <a className="nav__link" href={toHash({ name: 'nastaveni' })} aria-current={current('nastaveni')}>
              Nastavení
            </a>
            <a
              className="local-pill"
              href={toHash({ name: 'nastaveni' })}
              title="Data se ukládají jen v tomhle prohlížeči. Zálohu najdeš v nastavení."
            >
              <IconShield size={16} />
              Data jen u tebe
            </a>
            <a className="btn btn--primary btn--sm" href={toHash({ name: 'nova' })}>
              <IconPlus size={18} />
              Nová faktura
            </a>
          </nav>
        </div>
      </header>

      {recovered ? (
        <div className="container banner" role="alert">
          <IconAlert size={18} />
          <p>
            Uložená data v tomhle prohlížeči se nepodařilo přečíst, proto začínáš s prázdným přehledem. Původní data
            zůstala v prohlížeči uložená stranou. Máš-li zálohu, obnov ji v nastavení.
          </p>
        </div>
      ) : null}

      <main className="main">{children}</main>

      <footer className="footer">
        <div className="container footer__in">
          <Logo size={24} />
          <p>Faktury s QR platbou. Zdarma, bez registrace, s daty jen v tvém prohlížeči.</p>
          <p className="footer__note">Invoo nemá server: nic, co vyplníš, neodchází z tohoto zařízení.</p>
        </div>
      </footer>

      {inApp ? (
        <nav className="tabbar" aria-label="Aplikace">
          <a href={toHash({ name: 'faktury' })} aria-current={current('faktury', 'faktura')}>
            <IconList />
            Faktury
          </a>
          <a href={toHash({ name: 'nova' })} aria-current={current('nova', 'upravit')}>
            <IconPlus />
            Nová
          </a>
          <a href={toHash({ name: 'nastaveni' })} aria-current={current('nastaveni')}>
            <IconSettings />
            Nastavení
          </a>
        </nav>
      ) : null}
    </div>
  );
}
