# Invoo

Faktury s QR platbou zdarma, bez registrace, na [invoo.cz](https://invoo.cz). Invoo běží celé ve tvém prohlížeči:
nemá server, nic, co vyplníš, neodchází z tvého zařízení, a nenačítá nic z cizích serverů (ani písma).

## Co umí

- údaje dodavatele vyplníš jednou v nastavení (IČO, DIČ, adresa, účet); každá uložená faktura si je uloží k sobě, takže
  pozdější změna nastavení vystavené faktury nezmění
- neplátce i plátce DPH: sazby 21 %, 12 % a 0 % u položek, na faktuře „Daňový doklad“, DUZP, DIČ obou stran a rozpis
  základu a DPH podle sazeb
- částky se počítají přesně v haléřích, DPH se zaokrouhluje jednou za každou sazbu
- QR Platba (SPD 1.0): IBAN se dopočítá z čísla účtu a ověří (modulo 11 a 97); bez platného účtu QR nevznikne a
  faktura řekne proč
- číslování `RRRR-MM-NNN` navazuje na předchozí faktury, variabilní symbol se doplní z čísla
- živý náhled, tisk a uložení do PDF přes tisk prohlížeče: běžná faktura (třeba 15 položek a kratší poznámka) se
  vejde na jednu stranu A4 v každém vzhledu; velmi dlouhá poznámka nebo hodně položek pokračuje na druhé straně, řádky
  položek se nikdy nepřetrhnou a součty, rozpis DPH, QR platba a patička zůstanou pohromadě
- tři vzhledy tištěné faktury: **Invoo** (barevný pruh se součtem), **Klasik** (černobílý, s linkami) a **Minimal**
  (hodně bílého místa); výchozí se vybírá v nastavení s náhledem, u každé faktury jde v editoru změnit
- volitelná barva zvýraznění (barví jen plochy, text na nich zůstává čitelný; Klasik se tiskne černobíle), volitelné
  logo dodavatele (PNG, JPEG nebo WebP do 5 MB, zmenší se samo, zůstane jen v prohlížeči a v záloze) a patička
  „Vystaveno v Invoo“, kterou jde vypnout; každá uložená faktura si vzhled pamatuje, pozdější změna nastavení ji
  nezmění
- přehled faktur se stavem platby (zaplaceno, čeká, po splatnosti), statistiky za rok, 12 měsíců a podle odběratelů
- uložení odběratelé a položky (nabízí je editor), duplikování a mazání faktur
- rozepsaná nová faktura přežije zavření stránky

## Data a záloha

Faktury, odběratelé, položky a tvoje údaje se ukládají do `localStorage` tohoto prohlížeče (`invoo.data.v2`).
Smazáním dat prohlížeče zmizí, proto je v nastavení **Stáhnout zálohu** (JSON soubor `invoo-zaloha-RRRR-MM-DD.json`) a
**Obnovit ze souboru** (i v jiném prohlížeči nebo počítači). Obnova soubor nejdřív zkontroluje (velikost do 10 MB,
počty, typy a rozsahy všech údajů); neplatný soubor odmítne s českou hláškou a stávající data nechá být.

Záloha má verzi 3: každá faktura i nastavení nesou svůj vzhled (šablona, barva, logo, patička) a loga jsou v záloze
jednou, i když je používá víc faktur (nejvýš 20 log). Loga se v záloze kontrolují stejně přísně jako ostatní údaje:
jen PNG, JPEG nebo WebP, nejvýš 50 000 znaků, žádné SVG ani odkazy jinam. Zálohy a uložená data verze 2 (a 1) se
načtou dál a dostanou vzhled Invoo bez barvy a loga, s patičkou.

Přechod z Invokitu (dřívější název aplikace): data ze starého klíče `invokit.data.v1` i zálohy verze 1 se při prvním
spuštění nebo při obnově automaticky převedou na aktuální verzi se stejnými částkami; starý klíč zůstává v prohlížeči
beze změny.

## Vývoj

```bash
corepack enable
pnpm install
pnpm dev
```

`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`. React, TypeScript a Vite; logika
(částky, DPH, IBAN, QR Platba, úložiště a převod dat) je v čistých modulech v `src/domain`, `src/czech` a
`src/storage` a pokrývají ji testy ve Vitestu, rozhraní je v `src/ui`.

Push do `main` nasadí aplikaci na GitHub Pages (`.github/workflows/pages.yml`). `public/CNAME` nese doménu `invoo.cz`;
vlastní doménu je potřeba nastavit i v Settings → Pages a v DNS.

## Licence písem

Písma Baloo 2 a Nunito jsou přibalená z balíčků Fontsource a šíří se pod licencí SIL Open Font License 1.1; plné znění
je v `public/licenses/`.
