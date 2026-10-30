# Invokit

Jednoduchý generátor faktur zdarma, který běží celý ve vašem prohlížeči. Nic, co vyplníte, neopouští váš počítač:
faktury, odběratelé i položky se ukládají jen do `localStorage` tohoto prohlížeče. Smazáním dat prohlížeče zmizí, proto
je tu **Záloha** (stáhne JSON soubor) a **Obnovit** (načte ho zpět, i v jiném prohlížeči nebo počítači).

- dodavatel a odběratel (IČO, DIČ), neplátce/plátce DPH
- položky, variabilní symbol, splatnost, bankovní účet
- QR Platba (SPD 1.0, IBAN se dopočítá z čísla účtu)
- tisk / uložení do PDF přes prohlížeč (jedna strana A4); tisk fakturu zároveň uloží do historie
- historie faktur (otevřít, zaplaceno/nezaplaceno, po splatnosti, smazat), uložení odběratelé a položky
- statistiky: fakturováno za rok, nezaplaceno, posledních 12 měsíců, podle odběratele

## Vývoj

```bash
corepack enable
pnpm install
pnpm dev
```

`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`. Push do `main` nasadí aplikaci na GitHub Pages
(`.github/workflows/pages.yml`; jednorázově Settings → Pages → Source: GitHub Actions).
