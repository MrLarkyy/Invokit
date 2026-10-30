# Fakturka

Jednoduchý generátor faktur zdarma, který běží celý ve vašem prohlížeči. Nic, co vyplníte, neopouští váš počítač:
rozpracovaná faktura se ukládá jen do `localStorage` tohoto prohlížeče.

- dodavatel a odběratel (IČO, DIČ), neplátce/plátce DPH
- položky, variabilní symbol, splatnost, bankovní účet
- QR Platba (SPD 1.0, IBAN se dopočítá z čísla účtu)
- tisk / uložení do PDF přes prohlížeč (jedna strana A4)

## Vývoj

```bash
corepack enable
pnpm install
pnpm dev
```

`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`. Push do `main` nasadí aplikaci na GitHub Pages
(`.github/workflows/pages.yml`; jednorázově Settings → Pages → Source: GitHub Actions).
