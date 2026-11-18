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

Faktury, odběratelé, položky a tvoje údaje se ukládají do `localStorage` tohoto prohlížeče (`invoo.data.v3`).
Smazáním dat prohlížeče zmizí, proto je v nastavení **Stáhnout zálohu** (JSON soubor `invoo-zaloha-RRRR-MM-DD.json`) a
**Obnovit ze souboru** (i v jiném prohlížeči nebo počítači). Obnova soubor nejdřív zkontroluje (velikost do 10 MB,
počty, typy a rozsahy všech údajů); neplatný soubor odmítne s českou hláškou a stávající data nechá být.

Záloha má verzi 3: každá faktura i nastavení nesou svůj vzhled (šablona, barva, logo, patička) a loga jsou v záloze
jednou, i když je používá víc faktur (nejvýš 20 log). Loga se v záloze kontrolují stejně přísně jako ostatní údaje:
jen PNG, JPEG nebo WebP, nejvýš 50 000 znaků, žádné SVG ani odkazy jinam. Zálohy a uložená data verze 2 (a 1) se
načtou dál a dostanou vzhled Invoo bez barvy a loga, s patičkou.

Data verze 3 mají vlastní klíč `invoo.data.v3` (rozepsaná faktura `invoo.draft.v3`). Dřívější data z klíče
`invoo.data.v2` se jen přečtou; při první uložené změně se zapíšou pod nový klíč a teprve potom se starý klíč
odstraní (nevejdou-li se obě kopie vedle sebe, uvolní starý klíč místo předem a při neúspěchu se vrátí beze změny).
Rozepsaná faktura z dřívější verze se při tom přenese s daty (zkopíruje se; když se dvě kopie do úložiště nevejdou,
přesune se). Pod starý klíč už Invoo nic nového nezapisuje.

Starší verze Invoo otevřená v jiné záložce novým datům neublíží: verzi 3 nepřečte a ukládá dál jen pod svůj starý
klíč. Dokud tady nic neuložíš, její změny se přebírají. Potom už její data zůstávají stranou a Invoo na ně upozorní:
nabídne je ke stažení (`invoo-starsi-zalozka-RRRR-MM-DD.json`, jde obnovit jako záloha, obnova ale nahradí současná
data) a po stažení k odstranění z prohlížeče. Nic se neslučuje ani nepřepisuje. Stejně se zachová tahle verze, až
jednou najde data novější verze: nechá je být, přestane ukládat a požádá o obnovení stránky.

Co je dobré vědět, než se všechny záložky obnoví na novou verzi:

- Stránka se starší verzí otevřená až po převodu dat (třeba z mezipaměti prohlížeče) svůj klíč nenajde. Začne
  s prázdným přehledem, nebo si znovu převede data z Invokitu, pokud jsou ještě v prohlížeči (klíč `invokit.data.v1`
  tam zůstává, dokud ho neodstraníš): ukáže pak faktury z Invokitu a jeho poslední fakturu případně nabídne jako
  rozepsanou. Tvoje současná data nejsou pryč: stačí stránku obnovit. Co si starší stránka mezitím uložila pod svůj
  klíč (prázdná data, nebo znovu převedená data z Invokitu), nová verze nepřebírá, její rozepsanou fakturu také ne;
  nabídne to ke stažení a odstranění jako data starší záložky.
- Data odložená stranou pod `invoo.data.v2` zabírají místo v úložišti prohlížeče. Když se kvůli tomu nepodaří uložit
  změnu, stáhni si je a odstraň (obojí nabízí upozornění nahoře na stránce).
- Úložiště prohlížeče neumí zamykat mezi záložkami. Uloží-li starší záložka něco přesně ve chvíli, kdy nová verze
  po převodu odstraňuje starý klíč, může se tahle jedna změna starší záložky ztratit; nová data tím dotčená nejsou.

Mezi záložkami stejné verze se změny přebírají samy; před každým uložením si záložka nejdřív načte, co mezitím
uložila jiná, aby to nepřepsala. Nová faktura, jejíž číslo si mezitím vzala faktura uložená v jiné záložce, se
neuloží přes ni: formulář zůstane otevřený, rozepsaná faktura zůstane (i po obnovení stránky) a Invoo řekne, že číslo
už existuje. Smaže-li jiná záložka fakturu, kterou máš právě otevřenou k úpravě, formulář zůstane i s tím, co jsi
napsal, a Invoo na to upozorní; uložením se faktura vrátí mezi uložené, se stavem zaplacení, jaký měla při otevření,
ale bez loga, pokud se s ní z prohlížeče odstranilo i logo, které už nepoužívala žádná jiná faktura ani nastavení.

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

Formát uložených dat má číslo verze (`version`, teď 3). Každá změna, kterou by už vydaná verze Invoo neuměla přečíst,
musí číslo zvýšit: vyšší verzi starší Invoo pozná a nechá být, kdežto data, která jen nedokáže přečíst, otevřená
záložka ignoruje a při dalším uložení přepíše.

Push do `main` nasadí aplikaci na GitHub Pages (`.github/workflows/pages.yml`). `public/CNAME` nese doménu `invoo.cz`;
vlastní doménu je potřeba nastavit i v Settings → Pages a v DNS.

## Licence písem

Písma Baloo 2 a Nunito jsou přibalená z balíčků Fontsource a šíří se pod licencí SIL Open Font License 1.1; plné znění
je v `public/licenses/`.
